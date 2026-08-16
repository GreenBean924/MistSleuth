import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as api from "./api";

interface Props {
  startResp: api.StartResponse;
  characters: api.CharacterSummary[];
  onAccuse: (r: api.AccuseResponse) => void;
  onQuit: () => void;
}

export default function GameView({ startResp, characters, onAccuse, onQuit }: Props) {
  const [messages, setMessages] = useState<api.ChatMessage[]>([
    { role: "assistant", content: startResp.opening },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showAccuse, setShowAccuse] = useState(false);
  const [culprit, setCulprit] = useState("");
  const [method, setMethod] = useState("");
  const [motive, setMotive] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      await api.sendMessage(startResp.session_id, text, (chunk) => {
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
              <ReactMarkdown>{m.content}</ReactMarkdown>
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
        ) : (
          <div className="composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="搜证 / 向某个角色提问 / 陈述推理…"
              disabled={streaming}
            />
            <button className="primary-btn" onClick={handleSend} disabled={streaming || !input.trim()}>
              发送
            </button>
            <button className="accuse-btn" onClick={() => setShowAccuse(true)}>
              🔍 指认凶手
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
