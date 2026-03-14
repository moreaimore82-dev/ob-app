import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import AIBar from './components/AIBar';
import ChartCanvas from './components/ChartCanvas';
import Sidebar from './components/Sidebar';
import { calculateATR, detectOrderBlocks, generateAIRecommendation, calcOBSuccessRate } from './utils/calculations';
import './App.css';

async function fetchKlines(symbol, timeframe) {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/USDT$/i, '');
  const url = `/api/klines?symbol=${cleanSymbol}USDT&interval=${timeframe}&limit=500`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Ağ hatası: ${e.message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hata ${res.status}: ${body.slice(0, 120)}`);
  }

  const klines = await res.json();
  if (!Array.isArray(klines)) throw new Error(`Geçersiz parite adı: ${cleanSymbol}`);

  return klines.map((k, i) => {
    const totalVol = parseFloat(k[5]);
    const buyVol = parseFloat(k[9]);
    const buyPct = totalVol === 0 ? 0 : (buyVol / totalVol) * 100;
    return {
      index: i,
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: totalVol.toFixed(2),
      buyVolume: buyVol.toFixed(2),
      sellVolume: (totalVol - buyVol).toFixed(2),
      buyPct: buyPct.toFixed(1),
    };
  });
}

export default function App() {
  const [symbol, setSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState('5m');
  const [atrMultiplier, setAtrMultiplier] = useState('1.5');
  const [data, setData] = useState([]);
  const [orderBlocks, setOrderBlocks] = useState([]);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [successStats, setSuccessStats] = useState(null);

  // Parametreler
  const [showVolume, setShowVolume] = useState(() => localStorage.getItem('param_volume') === 'true');
  const [showTrend, setShowTrend] = useState(() => localStorage.getItem('param_trend') === 'true');
  const [alarm, setAlarm] = useState(() => {
    const v = localStorage.getItem('price_alarm');
    return v ? parseFloat(v) : null;
  });

  const countdownRef = useRef(null);
  const isFetchingRef = useRef(false);
  const alarmFiredRef = useRef(false);
  const prevPriceRef = useRef(null);
  const audioCtxRef = useRef(null);

  const playAlarmSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      // 3 kısa bip
      [0, 0.25, 0.5].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.6, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } catch (e) {
      // Ses çalınamazsa sessizce devam et
    }
  }, []);

  const handleSetVolume = (v) => { setShowVolume(v); localStorage.setItem('param_volume', v); };
  const handleSetTrend = (v) => { setShowTrend(v); localStorage.setItem('param_trend', v); };
  const handleSetAlarm = (price) => {
    if (price) {
      const p = parseFloat(price);
      if (isNaN(p)) return;
      setAlarm(p);
      localStorage.setItem('price_alarm', String(p));
      alarmFiredRef.current = false;
    } else {
      setAlarm(null);
      localStorage.removeItem('price_alarm');
      alarmFiredRef.current = false;
    }
  };

  // Alarm tetikleyici
  useEffect(() => {
    if (!alarm || !data.length) return;
    const currentPrice = data[data.length - 1].close;
    const prevPrice = prevPriceRef.current;
    if (prevPrice !== null) {
      const crossed = (prevPrice < alarm && currentPrice >= alarm) || (prevPrice > alarm && currentPrice <= alarm);
      if (crossed && !alarmFiredRef.current) {
        alarmFiredRef.current = true;
        playAlarmSound();
        const fire = () => new Notification('🔔 Fiyat Alarmı!', {
          body: `${symbol} fiyatı ${alarm} seviyesini geçti! Anlık: ${currentPrice.toFixed(2)}`,
          icon: '/favicon.svg',
        });
        if (Notification.permission === 'granted') {
          fire();
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') fire(); });
        }
      }
    }
    prevPriceRef.current = currentPrice;
  }, [data, alarm, symbol]);

  const processAndSet = useCallback((rawData, mult) => {
    const atr = calculateATR(rawData);
    const obs = detectOrderBlocks(rawData, atr, parseFloat(mult) || 1.5);
    setData(rawData);
    setOrderBlocks(obs);
    setAi(generateAIRecommendation(rawData, obs));
    setSuccessStats(calcOBSuccessRate(obs, rawData));
  }, []);

  const startCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(30);
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, []);

  const fetchData = useCallback(async (sym, tf, mult) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    clearInterval(countdownRef.current);
    try {
      const raw = await fetchKlines(sym, tf);
      processAndSet(raw, mult);
      startCountdown();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [processAndSet, startCountdown]);

  useEffect(() => {
    if (countdown === 0 && !loading) {
      fetchData(symbol, timeframe, atrMultiplier);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  useEffect(() => {
    fetchData(symbol, timeframe, atrMultiplier);
    return () => clearInterval(countdownRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAtrChange = (val) => {
    setAtrMultiplier(val);
    if (data.length > 0) {
      const atr = calculateATR(data);
      const obs = detectOrderBlocks(data, atr, parseFloat(val) || 1.5);
      setOrderBlocks(obs);
      setAi(generateAIRecommendation(data, obs));
      setSuccessStats(calcOBSuccessRate(obs, data));
    }
  };

  const handleTimeframeChange = (val) => {
    setTimeframe(val);
    fetchData(symbol, val, atrMultiplier);
  };

  return (
    <div className="app">
      <Header
        symbol={symbol}
        setSymbol={setSymbol}
        interval={timeframe}
        setInterval={handleTimeframeChange}
        atrMultiplier={atrMultiplier}
        setAtrMultiplier={handleAtrChange}
        onFetch={() => fetchData(symbol, timeframe, atrMultiplier)}
        loading={loading}
        onOpenSidebar={() => setSidebarOpen(true)}
        countdown={countdown}
        showVolume={showVolume}
        setShowVolume={handleSetVolume}
        showTrend={showTrend}
        setShowTrend={handleSetTrend}
        alarm={alarm}
        setAlarm={handleSetAlarm}
      />
      <AIBar ai={ai} />
      <div className="main-content">
        <ChartCanvas
          data={data}
          orderBlocks={orderBlocks}
          showVolume={showVolume}
          showTrend={showTrend}
          alarm={alarm}
        />
        <Sidebar
          orderBlocks={orderBlocks}
          successStats={successStats}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
