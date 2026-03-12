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

export function detectOrderBlocks(data, atrData, multiplier = 1.5) {
  const orderBlocks = [];

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
          addUnique({ type: 'bullish', startIndex: obCandle.index, displacementIndex: i, top: obCandle.high, bottom: obCandle.low, active: true, mitigatedIndex: null, data: obCandle });
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
          addUnique({ type: 'bearish', startIndex: obCandle.index, displacementIndex: i, top: obCandle.high, bottom: obCandle.low, active: true, mitigatedIndex: null, data: obCandle });
        }
      }
    }
  }

  // Mitigation check
  for (const ob of orderBlocks) {
    for (let k = ob.displacementIndex + 1; k < data.length; k++) {
      const c = data[k];
      if (ob.type === 'bullish' && c.close < ob.bottom) { ob.active = false; ob.mitigatedIndex = k; break; }
      if (ob.type === 'bearish' && c.close > ob.top) { ob.active = false; ob.mitigatedIndex = k; break; }
    }
  }

  return orderBlocks;
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
