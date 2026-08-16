"""视角隔离 Agent + 游戏状态机。

核心设计：
- 游玩阶段「truth（真凶/手法/动机）」绝不进入 prompt → 结构上零剧透。
- AI 主持控场 + 发线索；玩家点名 NPC 时 AI 以该 NPC 身份回答（秘密被证据戳破才松口）。
- 复盘阶段才注入 truth + 完整时间线，对照玩家指认逐条点评。
"""
import uuid

from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import HumanMessage, SystemMessage

from app import config
from app.schemas import Character, ScriptStructure

PHASE_PLAYING = "playing"
PHASE_REPLAY = "replay"


def _public_list(chars: list[Character]) -> str:
    return "\n".join(f"- {c.name}：{c.public_identity}" for c in chars)


def _secret_list(chars: list[Character]) -> str:
    return "\n".join(f"- {c.name}（秘密，被证据戳破才可透露）：{c.secret}" for c in chars)


def _clue_list(clues) -> str:
    lines = []
    for c in clues:
        tail = f"（归属：{c.owner}）" if c.owner else ""
        lines.append(f"[{c.id}] {c.category}：{c.content}{tail}")
    return "\n".join(lines)


def _timeline_list(timeline) -> str:
    return "\n".join(f"- {t.time}：{t.event}" for t in timeline)


class GameAgent:
    def __init__(self, structure: ScriptStructure, player_character: str):
        self.structure = structure
        self.player_character = player_character
        self.phase = PHASE_PLAYING
        self.history: list[dict] = []
        self.accusation: dict | None = None
        self._llm = ChatTongyi(model=config.MODEL_NAME, temperature=config.AGENT_TEMPERATURE)

    # ---------- 查询 ----------
    def player_view(self) -> dict:
        c = self._character(self.player_character)
        return {
            "name": c.name,
            "public_identity": c.public_identity,
            "secret": c.secret,
            "goal": c.goal,
        }

    def _character(self, name: str) -> Character:
        for c in self.structure.characters:
            if c.name == name:
                return c
        raise ValueError(f"未知角色: {name}")

    # ---------- 阶段 1：开场 ----------
    def start(self) -> str:
        pc = self._character(self.player_character)
        system = (
            f"你是剧本《{self.structure.title}》的主持人，正在引导一位单人玩家进行剧本杀。\n"
            f"故事背景：{self.structure.description}\n\n"
            "请写一段开场白，要求：\n"
            "1. 用沉浸式的语言交代故事背景与案发情况。\n"
            "2. 简要介绍在场所有角色的【公开身份】（绝不透露任何人的秘密）。\n"
            "3. 告知玩家他扮演的是【{pc.name}】，并说明他的公开身份、秘密与目标（这是只有玩家自己知道的信息）。\n"
            "4. 引导玩家开始行动：可以搜证、向某个角色提问、或陈述推理。\n\n"
            "铁律：绝不能透露真凶、作案手法、作案动机。"
        )
        user = (
            f"在场角色的公开身份：\n{_public_list(self.structure.characters)}\n\n"
            f"玩家扮演：{pc.name}\n"
            f"- 公开身份：{pc.public_identity}\n"
            f"- 秘密：{pc.secret}\n"
            f"- 目标：{pc.goal}\n\n"
            "请开始。"
        )
        opening = self._invoke(system, user)
        self.history.append({"role": "assistant", "content": opening})
        return opening

    # ---------- 阶段 2：游玩（搜证 / 提问 / 推理） ----------
    def _build_playing_prompt(self, user_input: str) -> tuple[str, str]:
        system = (
            f"你是剧本《{self.structure.title}》的主持人，同时负责扮演所有 NPC 角色。\n"
            f"故事背景：{self.structure.description}\n\n"
            "【身份切换规则】\n"
            "- 玩家要求搜证 / 要线索 / 查看现场 → 以主持人身份，从下方【线索库】选一条【尚未在对话历史中出现过】的线索发放（给出编号与内容）。\n"
            "- 玩家点名问某个角色 → 以该角色身份回答。\n"
            "- 玩家陈述推理 → 以主持人身份回应，可鼓励、可反问，但绝不确认或否定任何结论。\n\n"
            "【扮演 NPC 的铁律】\n"
            "- 只基于该角色的公开身份与秘密回答。\n"
            "- 该角色的秘密，只有被玩家用已公开的线索/证据戳破时才可透露，否则要隐瞒、遮掩甚至撒谎。\n"
            "- 绝不透露其他角色的秘密，绝不透露真凶。\n\n"
            "【主持人的铁律】\n"
            "- 你知道全部真相，但在玩家指认凶手之前，绝不透露真凶、作案手法、作案动机。\n\n"
            "【线索库（主持人专用，用于发放）】\n"
            f"{_clue_list(self.structure.clues)}\n\n"
            "【角色公开身份】\n"
            f"{_public_list(self.structure.characters)}\n\n"
            "【各角色秘密（扮演时被证据戳破才可透露）】\n"
            f"{_secret_list(self.structure.characters)}\n"
        )
        user = f"对话历史：\n{self._history_text()}\n\n玩家：{user_input}"
        return system, user

    def respond(self, user_input: str) -> str:
        self.history.append({"role": "user", "content": user_input})
        system, user = self._build_playing_prompt(user_input)
        reply = self._invoke(system, user)
        self.history.append({"role": "assistant", "content": reply})
        return reply

    async def respond_stream(self, user_input: str):
        """流式回复（供 SSE）。边生成边产出，结束后写入历史。"""
        self.history.append({"role": "user", "content": user_input})
        system, user = self._build_playing_prompt(user_input)
        full: list[str] = []
        async for chunk in self._llm.astream(
            [SystemMessage(content=system), HumanMessage(content=user)]
        ):
            piece = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
            if piece:
                full.append(piece)
                yield piece
        self.history.append({"role": "assistant", "content": "".join(full)})

    # ---------- 阶段 3：指认 + 复盘 ----------
    def accuse(self, culprit: str, method: str, motive: str) -> dict:
        correct = culprit.strip() == self.structure.truth.culprit
        self.accusation = {"culprit": culprit, "method": method, "motive": motive, "correct": correct}
        self.phase = PHASE_REPLAY

        t = self.structure.truth
        system = (
            f"你是剧本《{self.structure.title}》的复盘主持人。游戏已结束，请为玩家做一份完整复盘。\n\n"
            "请按以下结构输出：\n"
            "1.【真相揭晓】宣布真凶，并完整还原手法、动机与关键证据。\n"
            "2.【完整时间线】按时间顺序还原案发经过，点明每个角色在案发当晚的真实行为。\n"
            "3.【指认对照】对照玩家提交的指认，指出他判断对在哪、错在哪。\n"
            "4.【推理盲区】指出玩家在推理中遗漏的关键线索或关键矛盾。\n"
            "5.【角色结局】交代玩家所扮演角色的最终处境。"
        )
        user = (
            f"【真相】\n凶手：{t.culprit}\n手法：{t.method}\n动机：{t.motive}\n关键证据：{t.key_evidence}\n\n"
            f"【完整时间线】\n{_timeline_list(self.structure.timeline)}\n\n"
            f"【玩家指认】\n凶手：{culprit}（判定：{'正确' if correct else '错误'}）\n"
            f"手法：{method}\n动机：{motive}\n\n"
            f"【玩家推理过程】\n{self._history_text()}\n\n"
            "请开始复盘。"
        )
        replay = self._invoke(system, user)
        self.history.append({"role": "assistant", "content": replay})
        return {
            "correct": correct,
            "truth_culprit": t.culprit,
            "replay": replay,
        }

    # ---------- 工具 ----------
    def _history_text(self) -> str:
        lines = []
        for m in self.history:
            role = "主持人" if m["role"] == "assistant" else "玩家"
            lines.append(f"{role}：{m['content']}")
        return "\n".join(lines)

    def _invoke(self, system: str, user: str) -> str:
        resp = self._llm.invoke(
            [SystemMessage(content=system), HumanMessage(content=user)]
        )
        return resp.content if isinstance(resp.content, str) else str(resp.content)


# ---------- 会话管理（内存，单进程单容器） ----------
_SESSIONS: dict[str, GameAgent] = {}


def create_session(script_id: int, player_character: str) -> tuple[str, GameAgent]:
    from app import db

    structure = db.get_script(script_id)
    if structure is None:
        raise ValueError(f"剧本 {script_id} 不存在")
    agent = GameAgent(structure, player_character)
    session_id = uuid.uuid4().hex
    _SESSIONS[session_id] = agent
    return session_id, agent


def get_session(session_id: str) -> GameAgent | None:
    return _SESSIONS.get(session_id)
