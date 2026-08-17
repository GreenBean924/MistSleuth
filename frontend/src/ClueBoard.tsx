import { useEffect, useState } from "react";
import * as api from "./api";

type Relation = "related" | "conflict" | "point";

interface Link {
  from: string;
  to: string;
  relation: Relation;
}

const RELATION_LABEL: Record<Relation, string> = {
  related: "关联",
  conflict: "矛盾",
  point: "指向",
};

interface Props {
  sessionId: string;
  clues: api.ClueCard[];
  onClose: () => void;
}

const notesKey = (sid: string) => `mistsleuth-notes-${sid}`;
const linksKey = (sid: string) => `mistsleuth-links-${sid}`;

export default function ClueBoard({ sessionId, clues, onClose }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Link[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [relation, setRelation] = useState<Relation>("related");

  useEffect(() => {
    try {
      setNotes(JSON.parse(localStorage.getItem(notesKey(sessionId)) || "{}"));
    } catch {
      setNotes({});
    }
    try {
      setLinks(JSON.parse(localStorage.getItem(linksKey(sessionId)) || "[]"));
    } catch {
      setLinks([]);
    }
  }, [sessionId]);

  function updateNote(id: string, value: string) {
    setNotes((prev) => {
      const next = { ...prev, [id]: value };
      localStorage.setItem(notesKey(sessionId), JSON.stringify(next));
      return next;
    });
  }

  function addLink() {
    if (!from || !to || from === to) return;
    const next = [...links, { from, to, relation }];
    setLinks(next);
    localStorage.setItem(linksKey(sessionId), JSON.stringify(next));
    setFrom("");
    setTo("");
  }

  function removeLink(index: number) {
    const next = links.filter((_, i) => i !== index);
    setLinks(next);
    localStorage.setItem(linksKey(sessionId), JSON.stringify(next));
  }

  return (
    <div className="board-overlay" onClick={onClose}>
      <div className="board" onClick={(e) => e.stopPropagation()}>
        <header className="board-header">
          <h3>🧩 线索板</h3>
          <button className="ghost-btn" onClick={onClose}>
            关闭 ✕
          </button>
        </header>

        {clues.length === 0 ? (
          <p className="muted">尚未发现线索。去搜证或质问，主持人发放的线索会自动挂到这里。</p>
        ) : (
          <div className="clue-grid">
            {clues.map((c) => (
              <div key={c.id} className="clue-card">
                <div className="clue-head">
                  <span className="clue-id">{c.id}</span>
                  <span className="clue-category">{c.category}</span>
                </div>
                <p className="clue-content">{c.content}</p>
                <textarea
                  className="clue-note"
                  placeholder="记录你的推理…"
                  value={notes[c.id] || ""}
                  onChange={(e) => updateNote(c.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <section className="links-section">
          <h4>关系连线</h4>
          {clues.length < 2 ? (
            <p className="muted">发现至少两条线索后可建立连线。</p>
          ) : (
            <>
              <div className="link-builder">
                <select value={from} onChange={(e) => setFrom(e.target.value)}>
                  <option value="">线索 A…</option>
                  {clues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id}
                    </option>
                  ))}
                </select>
                <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
                  {(Object.keys(RELATION_LABEL) as Relation[]).map((r) => (
                    <option key={r} value={r}>
                      {RELATION_LABEL[r]}
                    </option>
                  ))}
                </select>
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  <option value="">线索 B…</option>
                  {clues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id}
                    </option>
                  ))}
                </select>
                <button
                  className="primary-btn"
                  disabled={!from || !to || from === to}
                  onClick={addLink}
                >
                  连线
                </button>
              </div>
              {links.length > 0 && (
                <ul className="link-list">
                  {links.map((l, i) => (
                    <li key={i} className="link-item">
                      <span className="link-ends">
                        {l.from} ⟷ {l.to}
                      </span>
                      <span className={`link-relation ${l.relation}`}>
                        {RELATION_LABEL[l.relation]}
                      </span>
                      <button className="link-remove" onClick={() => removeLink(i)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
