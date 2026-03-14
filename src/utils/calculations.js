export function calculateATR(data, period = 14) {
  const atrData = new Array(data.length).fill(0);
  let trSum = 0;
  for (let i = 1; i < data.length; i++) {
    const { high, low } = data[i];
    const prevClose = data[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    if (i < period) {
      trSum += tr;
      atrData[i] = trSum / i;
    } else {
      atrData[i] = (atrData[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atrData;
}

export function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

export function detectFVGs(data) {
  const fvgs = [];
  if (data.length < 3) return fvgs;
  const currentPrice = data[data.length - 1].close;

  for (let i = 2; i < data.length; i++) {
    const a = data[i - 2];
    const c = data[i];

    // Bullish FVG: önceki mumun high'ı ile sonraki mumun low'u arasında boşluk
    if (a.high < c.low) {
      const bottom = a.high;
      const top = c.low;
      // Dolmamış mı? Sonraki mumlarda fiyat bottom'ın altına kapanmamışsa
      let filled = false;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].close < bottom) { filled = true; break; }
      }
      // Mevcut fiyata ±20% içindeyse kaydet
      if (!filled && top >= currentPrice * 0.80 && bottom <= currentPrice * 1.20) {
        fvgs.push({ type: 'bullish', top, bottom });
      }
    }

    // Bearish FVG: önceki mumun low'u ile sonraki mumun high'ı arasında boşluk
    if (a.low > c.high) {
      const bottom = c.high;
      const top = a.low;
      let filled = false;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].close > top) { filled = true; break; }
      }
      if (!filled && top >= currentPrice * 0.80 && bottom <= currentPrice * 1.20) {
        fvgs.push({ type: 'bearish', top, bottom });
      }
    }
  }
  return fvgs;
}

export function detectOrderBlocks(data, atrData, multiplier = 1.5) {
  const orderBlocks = [];
  const avgVolume = data.reduce((s, c) => s + parseFloat(c.volume), 0) / data.length;

  const addUnique = (newOb) => {
    if (!orderBlocks.find(ob => ob.startIndex === newOb.startIndex)) {
      orderBlocks.push(newOb);
    }
  };

  for (let i = 10; i < data.length; i++) {
    const candle = data[i];
    const atr = atrData[i];
    const bodySize = Math.abs(candle.close - candle.open);

    if (bodySize > atr * multiplier) {
      const isBullishMove = candle.close > candle.open;

      if (isBullishMove) {
        let obCandle = null;
        let lowestLow = Infinity;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const prev = data[j];
          if (prev.close < prev.open && prev.low < lowestLow) {
            lowestLow = prev.low;
            obCandle = prev;
          }
        }
        if (obCandle && (obCandle.high - obCandle.low) < atrData[obCandle.index] * 2.5) {
          const strength = calcStrength(obCandle, avgVolume, true);
          addUnique({ type: 'bullish', startIndex: obCandle.index, displacementIndex: i, top: obCandle.high, bottom: obCandle.low, active: true, mitigatedIndex: null, strength, data: obCandle });
        }
      } else {
        let obCandle = null;
        let highestHigh = -Infinity;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const prev = data[j];
          if (prev.close > prev.open && prev.high > highestHigh) {
            highestHigh = prev.high;
            obCandle = prev;
          }
        }
        if (obCandle && (obCandle.high - obCandle.low) < atrData[obCandle.index] * 2.5) {
          const strength = calcStrength(obCandle, avgVolume, false);
          addUnique({ type: 'bearish', startIndex: obCandle.index, displacementIndex: i, top: obCandle.high, bottom: obCandle.low, active: true, mitigatedIndex: null, strength, data: obCandle });
        }
      }
    }
  }

  for (const ob of orderBlocks) {
    for (let k = ob.displacementIndex + 1; k < data.length; k++) {
      const c = data[k];
      if (ob.type === 'bullish' && c.close < ob.bottom) { ob.active = false; ob.mitigatedIndex = k; break; }
      if (ob.type === 'bearish' && c.close > ob.top) { ob.active = false; ob.mitigatedIndex = k; break; }
    }
  }

  return orderBlocks;
}

function calcStrength(obCandle, avgVolume, isBullish) {
  const volRatio = Math.min(2, parseFloat(obCandle.volume) / avgVolume);
  const buyPct = parseFloat(obCandle.buyPct);
  const dominance = isBullish ? buyPct / 100 : (100 - buyPct) / 100;
  const raw = (volRatio / 2) * 0.6 + dominance * 0.4;
  return Math.max(1, Math.min(5, Math.round(raw * 5)));
}

export function calcOBSuccessRate(orderBlocks, data) {
  const mitigated = orderBlocks.filter(ob => !ob.active);
  if (mitigated.length === 0) return null;

  let reacted = 0;
  for (const ob of mitigated) {
    for (let k = ob.displacementIndex; k < ob.mitigatedIndex; k++) {
      const c = data[k];
      if (ob.type === 'bullish' && c.low <= ob.top && c.close > ob.top) { reacted++; break; }
      if (ob.type === 'bearish' && c.high >= ob.bottom && c.close < ob.bottom) { reacted++; break; }
    }
  }

  return {
    total: mitigated.length,
    reacted,
    rate: Math.round((reacted / mitigated.length) * 100),
  };
}

// Hacim etiketleme yardımcısı
function fmtVol(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(0);
}

// Çoklu onay sistemi — OB temel, diğer parametreler doğrulama katar
export function calcConvergence({ ai, liquidityWalls = [], data = [], showLiquidity, showRSI, showFVG }) {
  if (!ai || !data.length) return null;

  const isLong = ai.signal.includes('LONG');
  const isShort = ai.signal.includes('SHORT');
  if (!isLong && !isShort) return null;

  const currentPrice = data[data.length - 1].close;
  const confirmations = [];

  // --- Likidite Duvarı ---
  if (showLiquidity && liquidityWalls.length) {
    const band = currentPrice * 0.03;
    if (isLong) {
      const wall = liquidityWalls
        .filter(w => w.type === 'bid' && w.price <= currentPrice && w.price >= currentPrice - band)
        .sort((a, b) => b.volume - a.volume)[0];
      if (wall) confirmations.push({
        name: 'Likidite Duvarı',
        reason: `${wall.price.toFixed(0)}$ seviyesinde ${fmtVol(wall.volume)} adet alım hacmi`,
      });
    } else {
      const wall = liquidityWalls
        .filter(w => w.type === 'ask' && w.price >= currentPrice && w.price <= currentPrice + band)
        .sort((a, b) => b.volume - a.volume)[0];
      if (wall) confirmations.push({
        name: 'Likidite Duvarı',
        reason: `${wall.price.toFixed(0)}$ seviyesinde ${fmtVol(wall.volume)} adet satım hacmi`,
      });
    }
  }

  // --- RSI ---
  if (showRSI) {
    const rsi = calculateRSI(data);
    if (rsi !== null) {
      if (isLong && rsi < 35) confirmations.push({
        name: 'RSI',
        reason: `RSI ${rsi.toFixed(0)} — aşırı satım bölgesinde (< 35)`,
      });
      else if (isShort && rsi > 65) confirmations.push({
        name: 'RSI',
        reason: `RSI ${rsi.toFixed(0)} — aşırı alım bölgesinde (> 65)`,
      });
    }
  }

  // --- Fair Value Gap ---
  if (showFVG) {
    const fvgs = detectFVGs(data);
    const band = currentPrice * 0.025;
    if (isLong) {
      const hit = fvgs.find(f =>
        f.type === 'bullish' &&
        f.top >= currentPrice - band &&
        f.bottom <= currentPrice + band
      );
      if (hit) confirmations.push({
        name: 'FVG',
        reason: `${hit.bottom.toFixed(0)}–${hit.top.toFixed(0)}$ bullish dengesizlik (dolmamış boşluk)`,
      });
    } else {
      const hit = fvgs.find(f =>
        f.type === 'bearish' &&
        f.bottom <= currentPrice + band &&
        f.top >= currentPrice - band
      );
      if (hit) confirmations.push({
        name: 'FVG',
        reason: `${hit.bottom.toFixed(0)}–${hit.top.toFixed(0)}$ bearish dengesizlik (dolmamış boşluk)`,
      });
    }
  }

  if (confirmations.length === 0) return null;

  return {
    type: isLong ? 'LONG' : 'SHORT',
    confirmations,
  };
}

export function generateAIRecommendation(data, orderBlocks) {
  if (!data.length) return null;
  const currentPrice = data[data.length - 1].close;
  const activeObs = orderBlocks.filter(ob => ob.active);
  let nearestBull = null, nearestBear = null, minBullDist = Infinity, minBearDist = Infinity;

  activeObs.forEach(ob => {
    if (ob.type === 'bullish') {
      const dist = Math.abs(currentPrice - ob.top);
      if (currentPrice >= ob.bottom && currentPrice <= ob.top) { minBullDist = 0; nearestBull = ob; }
      else if (dist < minBullDist && ob.top <= currentPrice) { minBullDist = dist; nearestBull = ob; }
    } else {
      const dist = Math.abs(ob.bottom - currentPrice);
      if (currentPrice >= ob.bottom && currentPrice <= ob.top) { minBearDist = 0; nearestBear = ob; }
      else if (dist < minBearDist && ob.bottom >= currentPrice) { minBearDist = dist; nearestBear = ob; }
    }
  });

  const decimals = currentPrice < 1 ? 5 : currentPrice > 1000 ? 0 : 2;
  const fmt = (v) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  let signal = 'NÖTR ⚖️', color = 'text-gray-400', tp = '-', sl = '-', reasoning = 'Yeterli OB verisi yok.';

  if (nearestBull && nearestBear) {
    if (minBullDist <= minBearDist) {
      signal = 'LONG 🟢'; color = 'text-emerald-400';
      sl = fmt(nearestBull.bottom * 0.998); tp = fmt(nearestBear.bottom);
      reasoning = `Desteğe (${fmt(nearestBull.top)}) yakın. Sıçrama beklenir.`;
    } else {
      signal = 'SHORT 🔴'; color = 'text-rose-400';
      sl = fmt(nearestBear.top * 1.002); tp = fmt(nearestBull.top);
      reasoning = `Dirence (${fmt(nearestBear.bottom)}) yakın. Ret yemesi beklenir.`;
    }
  } else if (nearestBull) {
    signal = 'LONG 🟢'; color = 'text-emerald-400';
    sl = fmt(nearestBull.bottom * 0.998);
    const risk = currentPrice - nearestBull.bottom * 0.998;
    tp = fmt(currentPrice + risk * 2);
    reasoning = 'Açık direnç yok. Desteğe dayalı long fırsatı.';
  } else if (nearestBear) {
    signal = 'SHORT 🔴'; color = 'text-rose-400';
    sl = fmt(nearestBear.top * 1.002);
    const risk = nearestBear.top * 1.002 - currentPrice;
    tp = fmt(currentPrice - risk * 2);
    reasoning = 'Açık destek yok. Dirence dayalı short fırsatı.';
  }

  return { signal, color, tp, sl, reasoning };
}
