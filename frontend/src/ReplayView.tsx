import ReactMarkdown from "react-markdown";
import * as api from "./api";

interface Props {
  accuseResp: api.AccuseResponse;
  onRestart: () => void;
}

export default function ReplayView({ accuseResp, onRestart }: Props) {
  return (
    <section className="replay">
      <div className={`verdict ${accuseResp.correct ? "correct" : "wrong"}`}>
        {accuseResp.correct
          ? "✅ 指认正确！"
          : `❌ 指认错误 · 真凶是「${accuseResp.truth_culprit}」`}
      </div>
      <article className="replay-body">
        <ReactMarkdown>{accuseResp.replay}</ReactMarkdown>
      </article>
      <button className="primary-btn" onClick={onRestart}>
        再玩一局
      </button>
    </section>
  );
}
