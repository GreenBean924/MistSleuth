import { useEffect, useState } from "react";
import * as api from "./api";
import GameView from "./GameView";
import ReplayView from "./ReplayView";

type View = "scripts" | "characters" | "game" | "replay";

export default function App() {
  const [view, setView] = useState<View>("scripts");
  const [scripts, setScripts] = useState<api.ScriptSummary[]>([]);
  const [detail, setDetail] = useState<api.ScriptDetail | null>(null);
  const [startResp, setStartResp] = useState<api.StartResponse | null>(null);
  const [accuseResp, setAccuseResp] = useState<api.AccuseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listScripts()
      .then(setScripts)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function pickScript(id: number) {
    setLoading(true);
    setError("");
    try {
      setDetail(await api.getScript(id));
      setView("characters");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function pickCharacter(name: string) {
    if (!detail) return;
    setLoading(true);
    setError("");
    try {
      setStartResp(await api.startGame(detail.id, name));
      setView("game");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleAccuse(r: api.AccuseResponse) {
    setAccuseResp(r);
    setView("replay");
  }

  function restart() {
    setView("scripts");
    setDetail(null);
    setStartResp(null);
    setAccuseResp(null);
    setError("");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🕯️ 迷雾剧场</h1>
        <p className="subtitle">单人沉浸式 AI 剧本杀 · 选一个角色，勘破真相</p>
      </header>

      {error && <div className="error-banner">⚠️ {error}</div>}

      {view === "scripts" && (
        <section className="panel">
          <h2>选择剧本</h2>
          {scripts.length === 0 && !loading && <p className="muted">暂无可用剧本</p>}
          <div className="card-list">
            {scripts.map((s) => (
              <button key={s.id} className="card" onClick={() => pickScript(s.id)}>
                <span className="card-title">{s.title}</span>
                <span className="card-desc">{s.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "characters" && detail && (
        <section className="panel">
          <h2>《{detail.title}》· 选择你的角色</h2>
          <p className="muted">{detail.description}</p>
          <div className="card-list">
            {detail.characters.map((c) => (
              <button key={c.name} className="card" onClick={() => pickCharacter(c.name)}>
                <span className="card-title">{c.name}</span>
                <span className="card-desc">{c.public_identity}</span>
              </button>
            ))}
          </div>
          <button className="ghost-btn" onClick={() => setView("scripts")}>
            ← 返回剧本列表
          </button>
        </section>
      )}

      {view === "game" && startResp && detail && (
        <GameView
          startResp={startResp}
          characters={detail.characters}
          onAccuse={handleAccuse}
          onQuit={restart}
        />
      )}

      {view === "replay" && accuseResp && (
        <ReplayView accuseResp={accuseResp} onRestart={restart} />
      )}

      {loading && <div className="loading">⏳ 正在推进剧情…</div>}
    </div>
  );
}
