const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function callGeminiAI(apiKey, data, orderBlocks) {
  if (!apiKey || !data.length) return null;

  const last = data[data.length - 1];
  const currentPrice = last.close;

  // Son 10 mumu özet olarak gönder
  const recentCandles = data.slice(-10).map(c => ({
    open: c.open, high: c.high, low: c.low, close: c.close,
    volume: c.volume, buyPct: c.buyPct,
  }));

  const activeOBs = orderBlocks.filter(ob => ob.active).map(ob => ({
    type: ob.type,
    top: ob.top,
    bottom: ob.bottom,
    buyPct: ob.data.buyPct,
    volume: ob.data.volume,
  }));

  const decimals = currentPrice < 1 ? 5 : currentPrice > 1000 ? 0 : 2;
  const fmt = v => Number(v).toFixed(decimals);

  const prompt = `Sen bir kripto para teknik analiz uzmanısın. Aşağıdaki verileri analiz et ve JSON formatında cevap ver.

Mevcut Fiyat: ${fmt(currentPrice)}
Son 10 Mum (OHLCV + Alıcı%):
${JSON.stringify(recentCandles, null, 2)}

Aktif Order Block'lar:
${JSON.stringify(activeOBs, null, 2)}

Analiz et ve SADECE şu JSON formatında cevap ver (başka hiçbir şey yazma):
{
  "signal": "LONG" veya "SHORT" veya "NÖTR",
  "tp": "<take profit fiyatı, sayı olarak>",
  "sl": "<stop loss fiyatı, sayı olarak>",
  "reasoning": "<Türkçe, max 80 karakter, kısa gerekçe>"
}`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API hatası: ${res.status}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // JSON'u çıkar (```json ... ``` bloğu içinde gelebilir)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini geçersiz yanıt döndürdü.');

  const parsed = JSON.parse(match[0]);

  const signalMap = {
    'LONG': { label: 'LONG 🟢', color: 'emerald-400' },
    'SHORT': { label: 'SHORT 🔴', color: 'rose-400' },
    'NÖTR': { label: 'NÖTR ⚖️', color: 'gray-400' },
  };
  const s = signalMap[parsed.signal?.toUpperCase()] || signalMap['NÖTR'];

  return {
    signal: s.label,
    color: `text-${s.color}`,
    tp: parsed.tp ? String(parsed.tp) : '-',
    sl: parsed.sl ? String(parsed.sl) : '-',
    reasoning: parsed.reasoning || '',
  };
}
