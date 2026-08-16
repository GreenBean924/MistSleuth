"""LLM 结构化抽取：把主持人手册全文抽成 ScriptStructure。

抽取失败返回 None，由摄取管线降级为「纯 RAG 无视角」模式。
"""
import json
import re

from langchain_community.chat_models import ChatTongyi
from langchain_core.messages import HumanMessage, SystemMessage

from app import config
from app.schemas import ScriptStructure

_SYSTEM_PROMPT = """你是一个剧本杀手册结构化解析器。你的任务是从给定的剧本手册全文中，抽取结构化信息，并严格输出一个 JSON 对象。不要输出 JSON 以外的任何内容，不要用 markdown 代码块包裹。

JSON 结构如下：
{
  "title": "剧本标题",
  "description": "一句话故事背景",
  "characters": [
    {"name": "角色名", "public_identity": "公开身份", "secret": "该角色隐瞒的秘密", "goal": "该角色的目标", "relations": "与其他角色的关系"}
  ],
  "clues": [
    {"id": "线索编号", "category": "个人/公共/现场/尸检", "content": "线索内容", "owner": "该线索归属的角色名，公共线索留空字符串"}
  ],
  "timeline": [
    {"time": "时间点", "event": "事件描述"}
  ],
  "truth": {"culprit": "真凶角色名", "method": "作案手法", "motive": "作案动机", "key_evidence": "关键证据"}
}

硬性要求：
1. 所有内容严格来源于原文，不得编造或补充原文没有的信息。
2. characters 必须覆盖原文中出现的全部嫌疑人角色，secret 与 goal 要写具体。
3. clues 覆盖原文所有线索卡，category 只能取「个人 / 公共 / 现场 / 尸检」之一。
4. timeline 按时间顺序排列，覆盖完整案发时间线。
5. truth 是主持人上帝视角的真相结论。
6. 只输出 JSON 本身。"""


def _extract_json(text: str) -> dict | None:
    """从 LLM 输出中鲁棒地提取 JSON 对象（容忍前后杂文与代码块）。"""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return None


def extract_structure(full_text: str) -> ScriptStructure | None:
    """抽取结构化剧本；失败返回 None（由调用方降级）。"""
    llm = ChatTongyi(model=config.MODEL_NAME, temperature=config.EXTRACTION_TEMPERATURE)
    user_msg = f"剧本手册全文如下：\n\n{full_text}"
    try:
        resp = llm.invoke(
            [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=user_msg)]
        )
        content = resp.content if isinstance(resp.content, str) else str(resp.content)
        data = _extract_json(content)
        if data is None:
            return None
        return ScriptStructure.model_validate(data)
    except Exception:
        return None
