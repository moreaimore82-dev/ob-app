import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import AIBar from './components/AIBar';
import ChartCanvas from './components/ChartCanvas';
import Sidebar from './components/Sidebar';
import { calculateATR, detectOrderBlocks, generateAIRecommendation } from './utils/calculations';
import './App.css';

async function fetchKlines(symbol, interval) {
  const res = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}USDT&interval=${interval}&limit=500`);
  if (!res.ok) throw new Error('Veri çekilemedi. Parite adını kontrol edin (örn: BTC, ETH).');
  const klines = await res.json();
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
  const [interval, setInterval] = useState('5m');
  const [atrMultiplier, setAtrMultiplier] = useState('1.5');
  const [data, setData] = useState([]);
  const [orderBlocks, setOrderBlocks] = useState([]);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const countdownRef = useRef(null);
  const isFetchingRef = useRef(false);

  const processAndSet = useCallback((rawData, mult) => {
    const atr = calculateATR(rawData);
    const obs = detectOrderBlocks(rawData, atr, parseFloat(mult) || 1.5);
    const aiResult = generateAIRecommendation(rawData, obs);
    setData(rawData);
    setOrderBlocks(obs);
    setAi(aiResult);
  }, []);

  const startCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, []);

  const fetchData = useCallback(async (sym, intv, mult) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    clearInterval(countdownRef.current);
    try {
      const raw = await fetchKlines(sym, intv);
      processAndSet(raw, mult);
      startCountdown();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [processAndSet, startCountdown]);

  // Auto-refresh when countdown hits 0
  useEffect(() => {
    if (countdown === 0 && !loading) {
      fetchData(symbol, interval, atrMultiplier);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Initial fetch
  useEffect(() => {
    fetchData(symbol, interval, atrMultiplier);
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
    }
  };

  const handleIntervalChange = (val) => {
    setInterval(val);
    fetchData(symbol, val, atrMultiplier);
  };

  return (
    <div className="app">
      <Header
        symbol={symbol}
        setSymbol={setSymbol}
        interval={interval}
        setInterval={handleIntervalChange}
        atrMultiplier={atrMultiplier}
        setAtrMultiplier={handleAtrChange}
        onFetch={() => fetchData(symbol, interval, atrMultiplier)}
        loading={loading}
        onOpenSidebar={() => setSidebarOpen(true)}
        countdown={countdown}
      />
      <AIBar ai={ai} />
      <div className="main-content">
        <ChartCanvas data={data} orderBlocks={orderBlocks} />
        <Sidebar
          orderBlocks={orderBlocks}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
