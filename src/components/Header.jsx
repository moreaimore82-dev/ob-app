import { useEffect, useState } from 'react';

export default function Header({
  symbol, setSymbol, interval, setInterval, atrMultiplier, setAtrMultiplier,
  onFetch, loading, onOpenSidebar, countdown, geminiKey, setGeminiKey,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState(geminiKey);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
    setDeferredPrompt(null);
  };

  const saveKey = () => {
    setGeminiKey(keyDraft.trim());
    setShowKeyInput(false);
  };

  const barPct = (countdown / 30) * 100;

  return (
    <header className="header">
      <div className="header-top">
        <div className="header-brand">
          <svg className="brand-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <h1 className="brand-title">Gerçek Zamanlı OB Analizi</h1>
            <p className="brand-sub">Binance API · Gemini AI</p>
          </div>
        </div>

        <div className="header-actions">
          {showInstall && (
            <button className="btn-install" onClick={handleInstall}>
              📲 Uygulamayı Yükle
            </button>
          )}
          <button
            className={`btn-gemini ${geminiKey ? 'active' : ''}`}
            onClick={() => { setKeyDraft(geminiKey); setShowKeyInput(v => !v); }}
            title="Gemini API Key"
          >
            {geminiKey ? '✅ Gemini AI' : '🔑 Gemini Key'}
          </button>
          <button className="btn-sidebar" onClick={onOpenSidebar}>
            📋 OB Listesi
          </button>
        </div>
      </div>

      {/* Gemini Key Input Panel */}
      {showKeyInput && (
        <div className="gemini-key-panel">
          <span className="gemini-key-label">Gemini API Key:</span>
          <input
            type="password"
            className="gemini-key-input"
            placeholder="AIza..."
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            autoFocus
          />
          <button className="btn-save-key" onClick={saveKey}>Kaydet</button>
          {geminiKey && (
            <button className="btn-clear-key" onClick={() => { setGeminiKey(''); setKeyDraft(''); setShowKeyInput(false); }}>
              Sil
            </button>
          )}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="gemini-key-link"
          >
            Key al →
          </a>
        </div>
      )}

      <div className="header-controls">
        <div className="control-group">
          <label>Parite</label>
          <div className="symbol-input-wrap">
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase().replace('USDT', ''))}
              onKeyDown={e => e.key === 'Enter' && onFetch()}
              placeholder="BTC"
              className="symbol-input"
            />
            <span className="symbol-suffix">USDT.P</span>
          </div>
        </div>

        <div className="control-group">
          <label>Zaman</label>
          <select value={interval} onChange={e => setInterval(e.target.value)} className="select-input">
            <option value="5m">5D</option>
            <option value="15m">15D</option>
            <option value="1h">1S</option>
            <option value="4h">4S</option>
            <option value="1d">1G</option>
          </select>
        </div>

        <div className="control-group">
          <label>ATR Çarpanı</label>
          <input type="number" value={atrMultiplier} onChange={e => setAtrMultiplier(e.target.value)} step="0.1" min="1" max="5" className="atr-input" />
        </div>

        <button className="btn-fetch" onClick={onFetch} disabled={loading}>
          {loading ? '⏳ Yükleniyor...' : '🔄 Verileri Çek'}
        </button>

        <div className="countdown-box" title="Sonraki yenilemeye kalan süre">
          <div className="countdown-bar" style={{ width: `${barPct}%` }} />
          <span className="countdown-icon">🕐</span>
          <span className="countdown-text">{countdown}s</span>
        </div>
      </div>
    </header>
  );
}
