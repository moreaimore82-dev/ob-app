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

      {convergence && convergence.confirmations.length > 0 && (
        <div className={`convergence-bar ${convergence.type === 'LONG' ? 'long' : 'short'}`}>
          <div className="convergence-header">
            <span className="convergence-icon">🔥</span>
            <span className="convergence-label">GÜÇLÜ SİNYAL</span>
            <div className="convergence-tags">
              {convergence.confirmations.map(c => (
                <span key={c.name} className="convergence-tag">{c.name}</span>
              ))}
            </div>
          </div>
          <div className="convergence-reasons">
            {convergence.confirmations.map(c => (
              <div key={c.name} className="convergence-reason-row">
                <span className="convergence-reason-name">{c.name}:</span>
                <span className="convergence-reason-text">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
