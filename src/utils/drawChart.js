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

export function drawChart({ canvas, data, orderBlocks, offsetX, candleWidth, spacing, mouseX, mouseY, isDragging }) {
  if (!data.length) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const totalItemWidth = candleWidth + spacing;
  const rightPad = 80;
  const visibleWidth = canvas.width - rightPad;
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
  maxPrice += pad;
  minPrice -= pad;
  const priceRange = maxPrice - minPrice || 1;
  const scaleY = canvas.height / priceRange;

  let decimals = 2;
  if (priceRange < 0.1) decimals = 6;
  else if (priceRange < 1) decimals = 4;
  else if (priceRange > 1000) decimals = 0;

  const getX = (index) => offsetX + index * totalItemWidth + candleWidth / 2;
  const getY = (price) => canvas.height - (price - minPrice) * scaleY;

  // Grid
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const p = minPrice + priceRange * (i / 5);
    const y = getY(p);
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

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

  // Price axis background
  ctx.fillStyle = '#1e222d';
  ctx.fillRect(canvas.width - rightPad, 0, rightPad, canvas.height);
  ctx.fillStyle = '#8a939f';
  ctx.font = '11px Arial';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const p = minPrice + priceRange * (i / 5);
    ctx.fillText(formatFiyat(p, decimals), canvas.width - 5, getY(p) + 4);
  }

  // Current price line
  if (data.length > 0) {
    const last = data[data.length - 1];
    const curY = getY(last.close);
    let labelY = Math.max(15, Math.min(canvas.height - 15, curY));
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
      const tipW = 175, tipH = 82;
      let tipX = mouseX + 15, tipY = mouseY + 15;
      if (tipX + tipW > canvas.width - rightPad) tipX = mouseX - tipW - 10;
      if (tipY + tipH > canvas.height) tipY = mouseY - tipH - 10;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = hoveredOB.active ? (hoveredOB.type === 'bullish' ? '#4ade80' : '#fb7185') : '#64748b';
      ctx.lineWidth = 1;
      drawRoundRect(ctx, tipX, tipY, tipW, tipH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 12px sans-serif';
      let title = hoveredOB.type === 'bullish' ? '🟩 Bullish OB' : '🟥 Bearish OB';
      if (!hoveredOB.active) title += ' (Kırıldı)';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(title, tipX + 12, tipY + 22);

      ctx.beginPath();
      ctx.moveTo(tipX + 10, tipY + 30);
      ctx.lineTo(tipX + tipW - 10, tipY + 30);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.stroke();

      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Üst: ${formatFiyat(hoveredOB.top, decimals)}`, tipX + 12, tipY + 46);
      ctx.fillText(`Alt: ${formatFiyat(hoveredOB.bottom, decimals)}`, tipX + 12, tipY + 60);
      ctx.fillStyle = hoveredOB.type === 'bullish' ? '#4ade80' : '#fb7185';
      ctx.fillText(`Hacim: ${formatHacim(hoveredOB.data.volume)} (%${hoveredOB.data.buyPct} Alıcı)`, tipX + 12, tipY + 74);
    }
  }

  ctx.textAlign = 'left';
}
