import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as api from "./api";
import ClueBoard from "./ClueBoard";

interface Props {
  startResp: api.StartResponse;
  characters: api.CharacterSummary[];
  locations: api.Location[];
  onAccuse: (r: api.AccuseResponse) => void;
  onQuit: () => void;
}

type Action = "search" | "interrogate" | "reason" | null;

export default function GameView({ startResp, characters, locations, onAccuse, onQuit }: Props) {
  const [messages, setMessages] = useState<api.ChatMessage[]>([
    { role: "assistant", content: startResp.opening },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [showAccuse, setShowAccuse] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [clues, setClues] = useState<api.ClueCard[]>([]);
  const [culprit, setCulprit] = useState("");
  const [method, setMethod] = useState("");
  const [motive, setMotive] = useState("");
  const [interrogee, setInterrogee] = useState("");
  const [question, setQuestion] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    setAction(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      await api.sendMessage(startResp.session_id, t, (chunk) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          next[next.length - 1] = { role: "assistant", content: last.content + chunk };
          return next;
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
    // 流结束后刷新已发现线索（失败不影响聊天）
    try {
      setClues(await api.getClues(startResp.session_id));
    } catch {
      /* 忽略线索刷新失败 */
    }
  }

  function searchLocation(name: string) {
    send(`我要去【${name}】搜证`);
  }

  function continueSearch() {
    send("继续搜证");
  }

  function submitInterrogate() {
    if (!interrogee || !question.trim()) return;
    send(`我要质问【${interrogee}】：${question.trim()}`);
    setQuestion("");
    setInterrogee("");
  }

  async function handleAccuse() {
    if (!culprit || streaming) return;
    setStreaming(true);
    try {
      onAccuse(await api.accuse(startResp.session_id, culprit, method, motive));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setStreaming(false);
    }
  }

  const areas = Array.from(new Set(locations.map((l) => l.area)));

  return (
    <div className="game">
      <aside className="player-card">
        <h3>{startResp.player_view.name}</h3>
        <p className="label">公开身份</p>
        <p>{startResp.player_view.public_identity}</p>
        <p className="label">你的秘密</p>
        <p className="secret">{startResp.player_view.secret}</p>
        <p className="label">你的目标</p>
        <p>{startResp.player_view.goal}</p>
        <button className="ghost-btn" onClick={onQuit}>
          ← 退出本局
        </button>
      </aside>

      <main className="chat">
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content ? (
                <ReactMarkdown>{m.content}</ReactMarkdown>
              ) : (
                <span className="typing-emoji">🕯️🔍🕵️🗡️🔎</span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {showAccuse ? (
          <div className="accuse-form">
            <h4>指认凶手</h4>
            <select value={culprit} onChange={(e) => setCulprit(e.target.value)}>
              <option value="">选择凶手…</option>
              {characters.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="作案手法（如：抱枕捂死）"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
            <input
              placeholder="作案动机（如：为财 / 复仇 / 灭口）"
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
            />
            <div className="row">
              <button
                className="primary-btn"
                disabled={!culprit || streaming}
                onClick={handleAccuse}
              >
                提交指认
              </button>
              <button className="ghost-btn" onClick={() => setShowAccuse(false)}>
                取消
              </button>
            </div>
          </div>
        ) : action === "search" ? (
          <div className="action-panel">
            <h4>🔍 选择搜查地点</h4>
            {locations.length === 0 ? (
              <p className="muted">本剧本暂无地点信息。</p>
            ) : (
              areas.map((area) => (
                <div key={area} className="location-group">
                  <p className="location-area">{area}</p>
                  <div className="location-grid">
                    {locations
                      .filter((l) => l.area === area)
                      .map((l) => (
                        <button
                          key={l.name}
                          className="location-card"
                          onClick={() => searchLocation(l.name)}
                        >
                          <span className="location-name">{l.name}</span>
                          {l.description && <span className="location-desc">{l.description}</span>}
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
            <button className="ghost-btn" onClick={() => setAction(null)}>
              取消
            </button>
          </div>
        ) : action === "interrogate" ? (
          <div className="action-panel">
            <h4>❓ 质问</h4>
            <select value={interrogee} onChange={(e) => setInterrogee(e.target.value)}>
              <option value="">选择质问对象…</option>
              {characters.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="自定义你的问题…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitInterrogate()}
            />
            <div className="row">
              <button
                className="primary-btn"
                disabled={!interrogee || !question.trim() || streaming}
                onClick={submitInterrogate}
              >
                发问
              </button>
              <button className="ghost-btn" onClick={() => setAction(null)}>
                取消
              </button>
            </div>
          </div>
        ) : action === "reason" ? (
          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="陈述你的推理 / 自由输入…"
              disabled={streaming}
            />
            <button className="primary-btn" onClick={() => send(input)} disabled={streaming || !input.trim()}>
              发送
            </button>
            <button className="ghost-btn" onClick={() => setAction(null)}>
              取消
            </button>
          </div>
        ) : (
          <div className="toolbar">
            <button className="tool-btn" onClick={() => setAction("search")} disabled={streaming}>
              🔍 搜查
            </button>
            <button className="tool-btn" onClick={continueSearch} disabled={streaming}>
              继续搜查
            </button>
            <button className="tool-btn" onClick={() => setAction("interrogate")} disabled={streaming}>
              ❓ 质问
            </button>
            <button className="tool-btn" onClick={() => setAction("reason")} disabled={streaming}>
              💭 推理
            </button>
            <button className="tool-btn" onClick={() => setShowBoard(true)}>
              🧩 线索板
            </button>
            <button className="accuse-btn" onClick={() => setShowAccuse(true)} disabled={streaming}>
              指认凶手
            </button>
          </div>
        )}
      </main>

      {showBoard && (
        <ClueBoard
          sessionId={startResp.session_id}
          clues={clues}
          onClose={() => setShowBoard(false)}
        />
      )}
    </div>
  );
}
