import { formatFiyat, formatHacim, getDecimals } from '../utils/formatters';

function StrengthStars({ strength = 1 }) {
  return (
    <span className="ob-strength" title={`Güç: ${strength}/5`}>
      {'★'.repeat(strength)}{'☆'.repeat(5 - strength)}
    </span>
  );
}

function OBCard({ ob }) {
  const isBullish = ob.type === 'bullish';
  const decimals = getDecimals(ob.top);

  return (
    <div className={`ob-card ${isBullish ? 'bullish' : 'bearish'} ${ob.active ? 'active' : 'mitigated'}`}>
      <div className="ob-card-header">
        <span className="ob-type">{isBullish ? '🟩 Bullish OB' : '🟥 Bearish OB'}</span>
        <div className="ob-card-header-right">
          <StrengthStars strength={ob.strength} />
          <span className={`ob-badge ${ob.active ? 'active' : ''}`}>
            {ob.active ? 'Aktif' : 'Kırıldı'}
          </span>
        </div>
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

function SuccessStatsCard({ stats }) {
  if (!stats) return null;
  const color = stats.rate >= 60 ? '#34d399' : stats.rate >= 40 ? '#fbbf24' : '#fb7185';
  return (
    <div className="success-stats-card">
      <div className="success-stats-title">📊 OB Geçmiş Başarı Oranı</div>
      <div className="success-stats-body">
        <div className="success-rate-circle" style={{ borderColor: color, color }}>
          %{stats.rate}
        </div>
        <div className="success-stats-detail">
          <div className="success-stats-row">
            <span>Kırılan OB</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="success-stats-row">
            <span>Tepki Verdi</span>
            <strong style={{ color: '#34d399' }}>{stats.reacted}</strong>
          </div>
          <div className="success-stats-row">
            <span>Tepkisiz Kırıldı</span>
            <strong style={{ color: '#fb7185' }}>{stats.total - stats.reacted}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ orderBlocks, successStats, isOpen, onClose }) {
  const active = [...orderBlocks].reverse().filter(ob => ob.active);
  const inactive = [...orderBlocks].reverse().filter(ob => !ob.active);

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Tespit Edilen OB'ler</h2>
          <button className="sidebar-close" onClick={onClose}>✕</button>
        </div>
        <div className="sidebar-body">
          <SuccessStatsCard stats={successStats} />

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
