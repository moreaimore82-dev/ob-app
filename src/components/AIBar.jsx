export default function AIBar({ ai }) {
  if (!ai) return (
    <div className="ai-bar">
      <span className="ai-label">⚡ AI Önerisi:</span>
      <span className="ai-signal neutral">Yükleniyor...</span>
    </div>
  );

  return (
    <div className="ai-bar">
      <div className="ai-left">
        <div className="ai-item">
          <span className="ai-label">⚡ AI Önerisi:</span>
          <span className={`ai-signal ${ai.color.replace('text-', '')}`}>{ai.signal}</span>
        </div>
        <div className="ai-item">
          <span className="ai-muted">Hedef (TP):</span>
          <span className="ai-tp">{ai.tp}</span>
        </div>
        <div className="ai-item">
          <span className="ai-muted">Zarar Kes (SL):</span>
          <span className="ai-sl">{ai.sl}</span>
        </div>
      </div>
      <div className="ai-reasoning">{ai.reasoning}</div>
    </div>
  );
}
