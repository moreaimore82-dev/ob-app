import { useRef, useEffect, useCallback } from 'react';
import { drawChart } from '../utils/drawChart';

const RIGHT_PAD = 80;

export default function ChartCanvas({ data, orderBlocks }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    offsetX: 0,
    candleWidth: 8,
    spacing: 2,
    isDragging: false,
    mouseX: -1,
    mouseY: -1,
    tooltipLocked: false,
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

  // Prop sync
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

  // Events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;

    // ── MOUSE ──────────────────────────────────────────────
    let lastMouseX = 0;
    const onMouseDown = (e) => {
      s.isDragging = true;
      lastMouseX = e.clientX;
      canvas.style.cursor = 'grabbing';
    };
    const onMouseUp = () => { s.isDragging = false; canvas.style.cursor = 'crosshair'; };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      s.mouseX = e.clientX - rect.left;
      s.mouseY = e.clientY - rect.top;
      if (s.isDragging) {
        s.offsetX += e.clientX - lastMouseX;
        lastMouseX = e.clientX;
      }
      render();
    };
    const onMouseLeave = () => { s.mouseX = -1; s.mouseY = -1; s.isDragging = false; render(); };
    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left; // zoom merkezi
      const dir = e.deltaY > 0 ? -1 : 1;
      const oldTW = s.candleWidth + s.spacing;
      s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + dir));
      s.spacing = s.candleWidth * 0.25;
      const newTW = s.candleWidth + s.spacing;
      // Fare altındaki mumun yerini koru
      s.offsetX = mx - (mx - s.offsetX) * (newTW / oldTW);
      render();
    };

    // ── TOUCH ──────────────────────────────────────────────
    // Durum değişkenleri
    let prevTouches = null;     // önceki frame'deki dokunuşlar
    let tapStart = null;        // tap tespiti için
    let lastTapTime = 0;        // double-tap
    let touchMode = null;       // 'pan' | 'pinch' | 'axis'
    let axisStartY = 0;
    let axisStartCW = 0;

    const clearTooltip = () => {
      if (s.tooltipTimer) { clearTimeout(s.tooltipTimer); s.tooltipTimer = null; }
    };
    const lockTooltip = (x, y) => {
      clearTooltip();
      s.mouseX = x; s.mouseY = y; s.tooltipLocked = true;
      render();
      s.tooltipTimer = setTimeout(() => {
        s.mouseX = -1; s.mouseY = -1; s.tooltipLocked = false; render();
      }, 3000);
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;
        tapStart = { x: tx, y: ty, time: Date.now() };
        prevTouches = [{ clientX: t.clientX, clientY: t.clientY }];

        if (tx >= canvas.width - RIGHT_PAD - 10) {
          // Fiyat ekseni bölgesi → dikey zoom
          touchMode = 'axis';
          axisStartY = t.clientY;
          axisStartCW = s.candleWidth;
        } else {
          touchMode = 'pan';
        }

      } else if (e.touches.length === 2) {
        touchMode = 'pinch';
        tapStart = null;
        prevTouches = [
          { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY },
          { clientX: e.touches[1].clientX, clientY: e.touches[1].clientY },
        ];
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (!prevTouches) return;
      const rect = canvas.getBoundingClientRect();

      if (touchMode === 'pan' && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - prevTouches[0].clientX;
        if (Math.abs(dx) > 1) {
          s.isDragging = true;
          s.offsetX += dx;
        }
        prevTouches = [{ clientX: t.clientX, clientY: t.clientY }];
        render();

      } else if (touchMode === 'axis' && e.touches.length === 1) {
        // Dikey kaydırma → zoom (yukarı = büyüt)
        const dy = axisStartY - e.touches[0].clientY;
        const newCW = Math.max(2, Math.min(30, axisStartCW + dy * 0.1));
        s.candleWidth = newCW;
        s.spacing = newCW * 0.25;
        render();

      } else if (touchMode === 'pinch' && e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];

        // Önceki ve yeni mesafe
        const prevDx = prevTouches[0].clientX - prevTouches[1].clientX;
        const prevDy = prevTouches[0].clientY - prevTouches[1].clientY;
        const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);

        const curDx = t0.clientX - t1.clientX;
        const curDy = t0.clientY - t1.clientY;
        const curDist = Math.sqrt(curDx * curDx + curDy * curDy);

        if (prevDist < 1) { prevTouches = [{ clientX: t0.clientX, clientY: t0.clientY }, { clientX: t1.clientX, clientY: t1.clientY }]; return; }

        const scale = curDist / prevDist;
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;

        const oldTW = s.candleWidth + s.spacing;
        const newCW = Math.max(2, Math.min(30, s.candleWidth * scale));
        s.candleWidth = newCW;
        s.spacing = newCW * 0.25;
        const newTW = s.candleWidth + s.spacing;

        // Zoom merkezi (iki parmak ortası) sabit kalsın
        s.offsetX = midX - (midX - s.offsetX) * (newTW / oldTW);

        // Yatay pan (iki parmak birlikte kayıyor)
        const prevMidX = (prevTouches[0].clientX + prevTouches[1].clientX) / 2;
        const curMidX = (t0.clientX + t1.clientX) / 2;
        s.offsetX += curMidX - prevMidX;

        prevTouches = [{ clientX: t0.clientX, clientY: t0.clientY }, { clientX: t1.clientX, clientY: t1.clientY }];
        render();
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();

      if (e.touches.length === 0) {
        // Double-tap → zoom reset
        const now = Date.now();
        if (tapStart && !s.isDragging && now - tapStart.time < 250) {
          if (now - lastTapTime < 350) {
            // Double tap: sağa hizala
            const container = containerRef.current;
            if (container) {
              const tw = s.candleWidth + s.spacing;
              s.offsetX = (container.clientWidth - 130) - (s.data.length * tw);
            }
            render();
          }
          lastTapTime = now;

          // Tek tap → tooltip
          if (!s.isDragging) {
            if (s.tooltipLocked) {
              clearTooltip();
              s.mouseX = -1; s.mouseY = -1; s.tooltipLocked = false; render();
            } else {
              lockTooltip(tapStart.x, tapStart.y);
            }
          }
        }
        s.isDragging = false;
        prevTouches = null;
        tapStart = null;
        touchMode = null;

      } else if (e.touches.length === 1) {
        // Pinch bitti, tek parmak kaldı → pan'e geç
        touchMode = 'pan';
        tapStart = null;
        prevTouches = [{ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }];
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      clearTooltip();
    };
  }, [render]);

  return (
    <div ref={containerRef} className="chart-container">
      <canvas ref={canvasRef} className="chart-canvas" />
    </div>
  );
}
