export default function AIBar({ ai, convergence }) {
  if (!ai) return (
    <div className="ai-bar">
      <div className="ai-left">
        <div className="ai-item">
          <span className="ai-label">⚡ AI Önerisi:</span>
          <span className="ai-signal neutral">Yükleniyor...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ai-bar-wrapper">
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

      {convergence && (
        <div className={`convergence-bar ${convergence.type === 'LONG' ? 'long' : 'short'}`}>
          <span className="convergence-icon">🔥</span>
          <span className="convergence-label">GÜÇLÜ SİNYAL</span>
          <span className="convergence-reason">{convergence.reason}</span>
        </div>
      )}
    </div>
  );
}
