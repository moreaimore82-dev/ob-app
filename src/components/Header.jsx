import { useEffect, useState } from 'react';

function ParamToggle({ checked, onChange, label, tooltip }) {
  return (
    <label className="param-toggle" title={tooltip}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="param-toggle-track" />
      <span className="param-toggle-text">{label}</span>
      {tooltip && <span className="param-tip-icon">?</span>}
    </label>
  );
}

export default function Header({
  symbol, setSymbol, interval, setInterval, atrMultiplier, setAtrMultiplier,
  onFetch, loading, onOpenSidebar, countdown,
  showTrend, setShowTrend, showLiquidity, setShowLiquidity, liquidityThreshold, setLiquidityThreshold,
  showRSI, setShowRSI, showFVG, setShowFVG,
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showParams, setShowParams] = useState(false);

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
            <p className="brand-sub">Binance Futures · Order Blocks</p>
          </div>
        </div>

        <div className="header-actions">
          {showInstall && (
            <button className="btn-install" onClick={handleInstall}>
              📲 Uygulamayı Yükle
            </button>
          )}
          <button
            className={`btn-params ${showParams ? 'active' : ''}`}
            onClick={() => setShowParams(v => !v)}
            title="Parametreler"
          >
            ⚙️ Parametreler
          </button>
          <button className="btn-sidebar" onClick={onOpenSidebar}>
            📋 OB Listesi
          </button>
        </div>
      </div>

      {showParams && (
        <div className="params-panel">
          <div className="params-section">
            <span className="params-label">Göstergeler:</span>
            <ParamToggle
              checked={showTrend}
              onChange={setShowTrend}
              label="Trend Çizgisi"
              tooltip="Son swing yüksek/düşüklerine lineer regresyon uygulayarak destek ve direnç eğilimini çizer. Fiyatın genel yönünü görselleştirir."
            />
            <ParamToggle
              checked={showLiquidity}
              onChange={setShowLiquidity}
              label="Likidite Duvarları"
              tooltip="Order book'ta mevcut fiyata yakın bölgelerdeki yoğun alım (yeşil) ve satım (kırmızı) emirlerini grafikte gösterir. Yanındaki rakam o seviyedeki coin adedini (hacmini) ifade eder. Bu seviyeler güçlü destek/direnç işlevi görebilir."
            />
            <ParamToggle
              checked={showRSI}
              onChange={setShowRSI}
              label="RSI Onayı"
              tooltip="RSI (Göreceli Güç Endeksi) momentum göstergesidir. LONG sinyalinde RSI < 35 ise aşırı satım (dip yakın), SHORT sinyalinde RSI > 65 ise aşırı alım (tepe yakın) olarak OB sinyalini doğrular."
            />
            <ParamToggle
              checked={showFVG}
              onChange={setShowFVG}
              label="FVG Onayı"
              tooltip="Fair Value Gap (Adil Değer Boşluğu): 3 mumlu formasyonda oluşan ve henüz dolmamış fiyat boşluklarıdır. Fiyat bu boşluğa yakınsa, OB sinyalini aynı yönde güçlendirir."
            />
          </div>
          {showLiquidity && (
            <div className="params-section params-threshold">
              <span
                className="params-label"
                title="Order book hacminin ortalama bucket hacmine oranını belirler. Yüksek değer = sadece çok büyük duvarları göster. Düşük değer = daha fazla duvar göster."
              >
                Duvar Eşiği:
              </span>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={liquidityThreshold}
                onChange={e => setLiquidityThreshold(e.target.value)}
                className="threshold-range"
              />
              <span className="threshold-value">{liquidityThreshold}x</span>
              <span className="threshold-hint">
                {liquidityThreshold <= 2 ? '(gevşek)' : liquidityThreshold <= 5 ? '(orta)' : '(sıkı)'}
              </span>
            </div>
          )}
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
