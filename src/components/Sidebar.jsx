import { formatFiyat, formatHacim, getDecimals } from '../utils/formatters';

function OBCard({ ob }) {
  const isBullish = ob.type === 'bullish';
  const decimals = getDecimals(ob.top);

  return (
    <div className={`ob-card ${isBullish ? 'bullish' : 'bearish'} ${ob.active ? 'active' : 'mitigated'}`}>
      <div className="ob-card-header">
        <span className="ob-type">{isBullish ? '🟩 Bullish OB' : '🟥 Bearish OB'}</span>
        <span className={`ob-badge ${ob.active ? 'active' : ''}`}>
          {ob.active ? 'Aktif' : 'Kırıldı'}
        </span>
      </div>
      <div className="ob-prices">
        <div>Üst: <strong>{formatFiyat(ob.top, decimals)}</strong></div>
        <div>Alt: <strong>{formatFiyat(ob.bottom, decimals)}</strong></div>
      </div>
      <div className="ob-vol-section">
        <div className="ob-vol-label">Volümetrik Dağılım:</div>
        <div className="ob-vol-row">
          <span>Hacim: <strong>{formatHacim(ob.data.volume)}</strong></span>
          <span className={isBullish ? 'bull-text' : 'bear-text'}>Alıcı: <strong>%{ob.data.buyPct}</strong></span>
        </div>
        <div className="ob-bar">
          <div className="ob-bar-fill" style={{ width: `${ob.data.buyPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ orderBlocks, isOpen, onClose }) {
  const active = [...orderBlocks].reverse().filter(ob => ob.active);
  const inactive = [...orderBlocks].reverse().filter(ob => !ob.active);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Tespit Edilen OB'ler</h2>
          <button className="sidebar-close" onClick={onClose}>✕</button>
        </div>
        <div className="sidebar-body">
          <div className="ob-section">
            <h3 className="ob-section-title active-title">
              <span className="dot blue" /> Aktif OB'ler
            </h3>
            {active.length === 0
              ? <p className="no-ob">Şu an aktif blok yok.</p>
              : active.map((ob, i) => <OBCard key={i} ob={ob} />)
            }
          </div>
          {inactive.length > 0 && (
            <div className="ob-section">
              <h3 className="ob-section-title">
                <span className="dot gray" /> Kırılan OB'ler
              </h3>
              {inactive.map((ob, i) => <OBCard key={i} ob={ob} />)}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
