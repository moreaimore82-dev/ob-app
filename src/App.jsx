import { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import AIBar from './components/AIBar';
import ChartCanvas from './components/ChartCanvas';
import Sidebar from './components/Sidebar';
import { calculateATR, detectOrderBlocks, generateAIRecommendation } from './utils/calculations';
import { callGeminiAI } from './utils/gemini';
import './App.css';

// Binance interval → Bybit interval
const INTERVAL_MAP = { '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D' };

async function fetchKlines(symbol, interval) {
  const bybitInterval = INTERVAL_MAP[interval] || '5';
  const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}USDT&interval=${bybitInterval}&limit=500`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Ağ hatası. İnternet bağlantınızı kontrol edin.');
  }

  if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}. Parite adını kontrol edin (örn: BTC, ETH).`);

  const json = await res.json();

  if (json.retCode !== 0) {
    throw new Error(`Hata: ${json.retMsg || 'Geçersiz parite adı.'}`);
  }

  // Bybit en yeni mumu başa koyar → ters çevir
  const list = [...json.result.list].reverse();

  return list.map((k, i) => {
    // [timestamp, open, high, low, close, volume, turnover]
    const totalVol = parseFloat(k[5]);
    return {
      index: i,
      time: parseInt(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: totalVol.toFixed(2),
      buyVolume: '0',
      sellVolume: '0',
      buyPct: '50', // Bybit kline'da taker buy verisi yok
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
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_key') || '');

  const countdownRef = useRef(null);
  const isFetchingRef = useRef(false);

  const handleGeminiKeyChange = (key) => {
    setGeminiKey(key);
    localStorage.setItem('gemini_key', key);
  };

  const runAI = useCallback(async (rawData, obs, key) => {
    if (key) {
      setAiLoading(true);
      try {
        const result = await callGeminiAI(key, rawData, obs);
        setAi(result);
      } catch (err) {
        // Gemini başarısız olursa kural tabanlıya dön
        console.warn('Gemini hatası, kural tabanlı AI kullanılıyor:', err.message);
        setAi(generateAIRecommendation(rawData, obs));
      } finally {
        setAiLoading(false);
      }
    } else {
      setAi(generateAIRecommendation(rawData, obs));
    }
  }, []);

  const processAndSet = useCallback((rawData, mult, key) => {
    const atr = calculateATR(rawData);
    const obs = detectOrderBlocks(rawData, atr, parseFloat(mult) || 1.5);
    setData(rawData);
    setOrderBlocks(obs);
    runAI(rawData, obs, key);
  }, [runAI]);

  const startCountdown = useCallback(() => {
    clearInterval(countdownRef.current);
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
  }, []);

  const fetchData = useCallback(async (sym, intv, mult, key) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    clearInterval(countdownRef.current);
    try {
      const raw = await fetchKlines(sym, intv);
      processAndSet(raw, mult, key);
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
      fetchData(symbol, interval, atrMultiplier, geminiKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  useEffect(() => {
    fetchData(symbol, interval, atrMultiplier, geminiKey);
    return () => clearInterval(countdownRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAtrChange = (val) => {
    setAtrMultiplier(val);
    if (data.length > 0) {
      const atr = calculateATR(data);
      const obs = detectOrderBlocks(data, atr, parseFloat(val) || 1.5);
      setOrderBlocks(obs);
      runAI(data, obs, geminiKey);
    }
  };

  const handleIntervalChange = (val) => {
    setInterval(val);
    fetchData(symbol, val, atrMultiplier, geminiKey);
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
        onFetch={() => fetchData(symbol, interval, atrMultiplier, geminiKey)}
        loading={loading}
        onOpenSidebar={() => setSidebarOpen(true)}
        countdown={countdown}
        geminiKey={geminiKey}
        setGeminiKey={handleGeminiKeyChange}
      />
      <AIBar ai={ai} aiLoading={aiLoading} hasKey={!!geminiKey} />
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
