import { formatFiyat, formatHacim } from './formatters';

const colors = {
  bg: '#131722',
  grid: '#2B3139',
  text: '#8a939f',
  bullishCandle: '#089981',
  bearishCandle: '#F23645',
  bullishOB: 'rgba(8, 153, 129, 0.25)',
  bullishOBBorder: 'rgba(8, 153, 129, 0.8)',
  bearishOB: 'rgba(242, 54, 69, 0.25)',
  bearishOBBorder: 'rgba(242, 54, 69, 0.8)',
  mitigatedBullishOB: 'rgba(8, 153, 129, 0.05)',
  mitigatedBearishOB: 'rgba(242, 54, 69, 0.05)',
  mitigatedOBBorder: 'rgba(138, 147, 159, 0.3)',
};

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function calcTrendLines(data, startIndex, endIndex) {
  const N = 3;
  const swingHighs = [];
  const swingLows = [];

  for (let i = startIndex + N; i <= endIndex - N && i < data.length; i++) {
    const c = data[i];
    let isHigh = true, isLow = true;
    for (let j = i - N; j <= i + N; j++) {
      if (j === i || !data[j]) continue;
      if (data[j].high > c.high) isHigh = false;
      if (data[j].low < c.low) isLow = false;
    }
    if (isHigh) swingHighs.push({ x: i, y: c.high });
    if (isLow) swingLows.push({ x: i, y: c.low });
  }

  const linReg = (pts) => {
    if (pts.length < 3) return null;
    const last = pts.slice(-5);
    const n = last.length;
    const xMean = last.reduce((s, p) => s + p.x, 0) / n;
    const yMean = last.reduce((s, p) => s + p.y, 0) / n;
    const num = last.reduce((s, p) => s + (p.x - xMean) * (p.y - yMean), 0);
    const den = last.reduce((s, p) => s + (p.x - xMean) ** 2, 0);
    if (den === 0) return null;
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    return { slope, intercept };
  };

  return {
    resistance: linReg(swingHighs),
    support: linReg(swingLows),
  };
}

export function drawChart({ canvas, data, orderBlocks, offsetX, candleWidth, spacing, mouseX, mouseY, isDragging, yZoom = 1, showTrend = false, liquidityWalls = [] }) {
  if (!data.length) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const totalItemWidth = candleWidth + spacing;
  const rightPad = 80;
  const visibleWidth = canvas.width - rightPad;

  const chartBottom = canvas.height;

  const visibleCandlesCount = Math.ceil(visibleWidth / totalItemWidth);
  const startIndex = Math.max(0, Math.floor(-offsetX / totalItemWidth));
  const endIndex = Math.min(data.length - 1, startIndex + visibleCandlesCount + 2);

  let maxPrice = -Infinity, minPrice = Infinity, hasVisible = false;
  for (let i = startIndex; i <= endIndex; i++) {
    if (data[i]) {
      if (data[i].high > maxPrice) maxPrice = data[i].high;
      if (data[i].low < minPrice) minPrice = data[i].low;
      hasVisible = true;
    }
  }
  if (!hasVisible) { maxPrice = 100; minPrice = 0; }

  const pad = (maxPrice - minPrice) * 0.1;
  const baseMax = maxPrice + pad;
  const baseMin = minPrice - pad;
  const baseRange = baseMax - baseMin || 1;
  const baseCenter = (baseMax + baseMin) / 2;

  const priceRange = baseRange / Math.max(0.1, yZoom);
  maxPrice = baseCenter + priceRange / 2;
  minPrice = baseCenter - priceRange / 2;

  const scaleY = chartBottom / priceRange;

  let decimals = 2;
  if (priceRange < 0.1) decimals = 6;
  else if (priceRange < 1) decimals = 4;
  else if (priceRange > 1000) decimals = 0;

  const getX = (index) => offsetX + index * totalItemWidth + candleWidth / 2;
  const getY = (price) => chartBottom - (price - minPrice) * scaleY;

  // Grid
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const p = minPrice + priceRange * (i / 5);
    const y = getY(p);
    if (y < 0 || y > chartBottom) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  // Trend Çizgileri
  if (showTrend && (endIndex - startIndex) > 15) {
    const tl = calcTrendLines(data, startIndex, endIndex);
    const drawTrend = (reg, color) => {
      if (!reg) return;
      const x1 = getX(startIndex);
      const x2 = getX(endIndex);
      const y1 = getY(reg.slope * startIndex + reg.intercept);
      const y2 = getY(reg.slope * endIndex + reg.intercept);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width - rightPad, chartBottom);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };
    drawTrend(tl.resistance, 'rgba(251, 113, 133, 0.85)');
    drawTrend(tl.support, 'rgba(52, 211, 153, 0.85)');
  }

  // Order Blocks
  orderBlocks.forEach(ob => {
    if (ob.mitigatedIndex !== null && ob.mitigatedIndex < startIndex) return;
    if (ob.startIndex > endIndex) return;

    const startX = getX(ob.startIndex) - candleWidth / 2;
    const endX = ob.active ? getX(data.length - 1) + 200 : getX(ob.mitigatedIndex) + candleWidth / 2;
    const yTop = getY(ob.top);
    const yBottom = getY(ob.bottom);
    const h = yBottom - yTop;

    ctx.fillStyle = ob.active
      ? (ob.type === 'bullish' ? colors.bullishOB : colors.bearishOB)
      : (ob.type === 'bullish' ? colors.mitigatedBullishOB : colors.mitigatedBearishOB);
    ctx.fillRect(startX, yTop, endX - startX, h);

    ctx.strokeStyle = ob.active
      ? (ob.type === 'bullish' ? colors.bullishOBBorder : colors.bearishOBBorder)
      : colors.mitigatedOBBorder;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, yTop); ctx.lineTo(endX, yTop);
    ctx.moveTo(startX, yBottom); ctx.lineTo(endX, yBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Candles
  for (let i = startIndex; i <= endIndex; i++) {
    const c = data[i];
    const x = getX(i);
    const isBullish = c.close >= c.open;
    const color = isBullish ? colors.bullishCandle : colors.bearishCandle;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x, getY(c.high));
    ctx.lineTo(x, getY(c.low));
    ctx.stroke();

    const yOpen = getY(c.open);
    const yClose = getY(c.close);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - candleWidth / 2, Math.min(yOpen, yClose), candleWidth, bodyH);
  }

  // Likidite Duvarları
  if (liquidityWalls.length > 0) {
    liquidityWalls.forEach(wall => {
      const wy = getY(wall.price);
      if (wy < 0 || wy > chartBottom) return;

      const isBid = wall.type === 'bid';
      const wallColor = isBid ? 'rgba(52, 211, 153, 0.9)' : 'rgba(251, 113, 133, 0.9)';

      // Çizgi
      ctx.strokeStyle = wallColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.lineTo(canvas.width - rightPad, wy);
      ctx.stroke();

      // Sol taraf etiketi (hacim)
      const volLabel = wall.volume >= 1000
        ? `${(wall.volume / 1000).toFixed(1)}K`
        : wall.volume.toFixed(1);
      const tag = `${isBid ? '▲' : '▼'} ${volLabel}`;
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'left';
      const tw = ctx.measureText(tag).width + 8;
      ctx.fillStyle = isBid ? 'rgba(6, 78, 59, 0.85)' : 'rgba(127, 29, 29, 0.85)';
      ctx.fillRect(4, wy - 9, tw, 16);
      ctx.fillStyle = wallColor;
      ctx.fillText(tag, 8, wy + 4);
    });
  }

  // Price axis background
  ctx.fillStyle = '#1e222d';
  ctx.fillRect(canvas.width - rightPad, 0, rightPad, canvas.height);

  // Price axis labels
  ctx.fillStyle = '#8a939f';
  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const p = minPrice + priceRange * (i / 5);
    const y = getY(p);
    if (y < 0 || y > chartBottom) continue;
    ctx.fillText(formatFiyat(p, decimals), canvas.width - 5, y + 4);
  }

  // Current price line
  if (data.length > 0) {
    const last = data[data.length - 1];
    const curY = getY(last.close);
    let labelY = Math.max(15, Math.min(chartBottom - 15, curY));
    const isBull = last.close >= last.open;
    const pc = isBull ? colors.bullishCandle : colors.bearishCandle;

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pc;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, curY);
    ctx.lineTo(canvas.width - rightPad, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = pc;
    ctx.fillRect(canvas.width - rightPad, labelY - 10, rightPad, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText(formatFiyat(last.close, decimals), canvas.width - 5, labelY + 4);
  }

  // Tooltip on hover
  if (mouseX > 0 && mouseY > 0 && !isDragging) {
    let hoveredOB = null;
    for (let i = orderBlocks.length - 1; i >= 0; i--) {
      const ob = orderBlocks[i];
      const startX = getX(ob.startIndex) - candleWidth / 2;
      const endX = ob.active ? getX(data.length - 1) + 200 : getX(ob.mitigatedIndex) + candleWidth / 2;
      const yTop = Math.min(getY(ob.top), getY(ob.bottom));
      const yBottom = Math.max(getY(ob.top), getY(ob.bottom));
      if (mouseX >= startX && mouseX <= endX && mouseY >= yTop && mouseY <= yBottom) {
        hoveredOB = ob; break;
      }
    }

    if (hoveredOB) {
      const isMobile = canvas.width < 600;
      const tipW = isMobile ? canvas.width - 24 : 220;
      const tipH = isMobile ? 130 : 110;
      const fBase = isMobile ? 14 : 12;
      const fSmall = isMobile ? 13 : 11;
      const lineH = isMobile ? 20 : 16;

      let tipX, tipY;
      if (isMobile) {
        tipX = 12;
        tipY = 12;
      } else {
        tipX = mouseX + 15;
        tipY = mouseY + 15;
        if (tipX + tipW > canvas.width - rightPad) tipX = mouseX - tipW - 10;
        if (tipY + tipH > canvas.height) tipY = mouseY - tipH - 10;
      }

      ctx.fillStyle = 'rgba(10, 17, 32, 0.97)';
      ctx.strokeStyle = hoveredOB.active ? (hoveredOB.type === 'bullish' ? '#4ade80' : '#fb7185') : '#64748b';
      ctx.lineWidth = isMobile ? 2 : 1;
      drawRoundRect(ctx, tipX, tipY, tipW, tipH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = `bold ${fBase}px sans-serif`;
      let title = hoveredOB.type === 'bullish' ? '🟩 Bullish OB' : '🟥 Bearish OB';
      if (!hoveredOB.active) title += ' (Kırıldı)';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(title, tipX + 12, tipY + fBase + 8);

      // Güç skoru
      const stars = '★'.repeat(hoveredOB.strength || 1) + '☆'.repeat(5 - (hoveredOB.strength || 1));
      ctx.font = `${fSmall}px sans-serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(stars, tipX + tipW - (isMobile ? 70 : 60), tipY + fBase + 8);

      const divY = tipY + fBase + 14;
      ctx.beginPath();
      ctx.moveTo(tipX + 10, divY);
      ctx.lineTo(tipX + tipW - 10, divY);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `${fSmall}px sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Üst:', tipX + 12, divY + lineH);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formatFiyat(hoveredOB.top, decimals), tipX + (isMobile ? 50 : 40), divY + lineH);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Alt:', tipX + 12, divY + lineH * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(formatFiyat(hoveredOB.bottom, decimals), tipX + (isMobile ? 50 : 40), divY + lineH * 2);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Hacim:', tipX + 12, divY + lineH * 3);
      ctx.fillStyle = hoveredOB.type === 'bullish' ? '#4ade80' : '#fb7185';
      ctx.fillText(`${formatHacim(hoveredOB.data.volume)}  Alıcı: %${hoveredOB.data.buyPct}`, tipX + (isMobile ? 65 : 55), divY + lineH * 3);
    }
  }

  ctx.textAlign = 'left';
}
