import { useRef, useEffect, useCallback } from 'react';
import { drawChart } from '../utils/drawChart';

const RIGHT_PAD = 80; // fiyat ekseni genişliği

export default function ChartCanvas({ data, orderBlocks }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    offsetX: 0,
    candleWidth: 8,
    spacing: 2,
    isDragging: false,
    startDragX: 0,
    dragOffsetX: 0,
    mouseX: -1,
    mouseY: -1,
    tooltipLocked: false,   // dokunmatik tap ile kilitlenmiş tooltip
    tooltipTimer: null,
    data: [],
    orderBlocks: [],
    initialized: false,
  });

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    drawChart({
      canvas,
      data: s.data,
      orderBlocks: s.orderBlocks,
      offsetX: s.offsetX,
      candleWidth: s.candleWidth,
      spacing: s.spacing,
      mouseX: s.mouseX,
      mouseY: s.mouseY,
      isDragging: s.isDragging,
    });
  }, []);

  // Prop değişince ref'e yaz
  useEffect(() => {
    const s = stateRef.current;
    const container = containerRef.current;
    if (!container || !data.length) return;
    s.data = data;
    s.orderBlocks = orderBlocks;
    if (!s.initialized) {
      const tw = s.candleWidth + s.spacing;
      s.offsetX = (container.clientWidth - 130) - (data.length * tw);
      s.initialized = true;
    }
    render();
  }, [data, orderBlocks, render]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  // Tüm event'ler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;

    // --- MOUSE ---
    const onMouseDown = (e) => {
      s.isDragging = true;
      s.startDragX = e.clientX;
      s.dragOffsetX = s.offsetX;
      canvas.style.cursor = 'grabbing';
    };
    const onMouseUp = () => { s.isDragging = false; canvas.style.cursor = 'crosshair'; };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      s.mouseX = e.clientX - rect.left;
      s.mouseY = e.clientY - rect.top;
      if (s.isDragging) s.offsetX = s.dragOffsetX + (e.clientX - s.startDragX);
      render();
    };
    const onMouseLeave = () => { s.mouseX = -1; s.mouseY = -1; s.isDragging = false; render(); };
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + dir));
      s.spacing = s.candleWidth * 0.25;
      render();
    };

    // --- TOUCH ---
    let touch1 = null;        // tek parmak başlangıcı
    let touchMode = null;     // 'pan' | 'zoom-pinch' | 'zoom-axis'
    let lastPinchDist = 0;
    let axisStartY = 0;
    let axisStartCW = 0;

    const clearTooltipTimer = () => {
      if (s.tooltipTimer) { clearTimeout(s.tooltipTimer); s.tooltipTimer = null; }
    };

    const lockTooltip = (x, y) => {
      clearTooltipTimer();
      s.mouseX = x;
      s.mouseY = y;
      s.tooltipLocked = true;
      render();
      // 3 saniye sonra tooltip'i kapat
      s.tooltipTimer = setTimeout(() => {
        s.mouseX = -1; s.mouseY = -1;
        s.tooltipLocked = false;
        render();
      }, 3000);
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;

        touch1 = { clientX: t.clientX, clientY: t.clientY, x: tx, y: ty, time: Date.now() };

        // Fiyat ekseni bölgesinde mi? (sağdaki 80px)
        if (tx >= canvas.width - RIGHT_PAD) {
          touchMode = 'zoom-axis';
          axisStartY = t.clientY;
          axisStartCW = s.candleWidth;
        } else {
          touchMode = 'pan';
          s.dragOffsetX = s.offsetX;
        }
        s.isDragging = false;

      } else if (e.touches.length === 2) {
        touchMode = 'zoom-pinch';
        touch1 = null;
        s.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (touchMode === 'pan' && e.touches.length === 1 && touch1) {
        const dx = e.touches[0].clientX - touch1.clientX;
        const dy = Math.abs(e.touches[0].clientY - touch1.clientY);
        // Yeterli yatay hareket varsa drag başlat
        if (!s.isDragging && Math.abs(dx) > 5) s.isDragging = true;
        if (s.isDragging) {
          s.offsetX = s.dragOffsetX + dx;
          render();
        }
      } else if (touchMode === 'zoom-axis' && e.touches.length === 1) {
        // Dikey kaydırma → zoom
        const dy = axisStartY - e.touches[0].clientY; // yukarı = pozitif = büyüt
        const newCW = Math.max(2, Math.min(30, axisStartCW + dy * 0.08));
        s.candleWidth = newCW;
        s.spacing = newCW * 0.25;
        render();
      } else if (touchMode === 'zoom-pinch' && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = (dist - lastPinchDist) * 0.06;
        s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + delta));
        s.spacing = s.candleWidth * 0.25;
        lastPinchDist = dist;
        render();
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();
      // Tap tespiti: kısa süre + az hareket + pan modunda
      if (touchMode === 'pan' && touch1 && !s.isDragging) {
        const elapsed = Date.now() - touch1.time;
        if (elapsed < 300) {
          // Tooltip kilitliyse kapat, değilse aç
          if (s.tooltipLocked) {
            clearTooltipTimer();
            s.mouseX = -1; s.mouseY = -1;
            s.tooltipLocked = false;
            render();
          } else {
            lockTooltip(touch1.x, touch1.y);
          }
        }
      }
      s.isDragging = false;
      touch1 = null;
      touchMode = null;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      clearTooltipTimer();
    };
  }, [render]);

  return (
    <div ref={containerRef} className="chart-container">
      <canvas ref={canvasRef} className="chart-canvas" />
      <div className="zoom-hint">↕ fiyat eksenine kaydır = zoom</div>
    </div>
  );
}
