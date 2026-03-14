import { useRef, useEffect, useCallback } from 'react';
import { drawChart } from '../utils/drawChart';

const RIGHT_PAD = 80;

export default function ChartCanvas({ data, orderBlocks, showVolume, showTrend, alarm, liquidityWalls = [] }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    offsetX: 0,
    candleWidth: 8,
    spacing: 2,
    yZoom: 1,
    isDragging: false,
    mouseX: -1,
    mouseY: -1,
    tooltipLocked: false,
    tooltipTimer: null,
    data: [],
    orderBlocks: [],
    showVolume: false,
    showTrend: false,
    alarm: null,
    liquidityWalls: [],
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
      yZoom: s.yZoom,
      showVolume: s.showVolume,
      showTrend: s.showTrend,
      alarm: s.alarm,
      liquidityWalls: s.liquidityWalls,
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

  // Toggle/alarm/liquidity prop sync
  useEffect(() => {
    stateRef.current.showVolume = showVolume;
    stateRef.current.showTrend = showTrend;
    stateRef.current.alarm = alarm;
    stateRef.current.liquidityWalls = liquidityWalls;
    render();
  }, [showVolume, showTrend, alarm, liquidityWalls, render]);

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
      const mx = e.clientX - rect.left;
      const dir = e.deltaY > 0 ? -1 : 1;

      if (mx >= canvas.width - RIGHT_PAD - 10) {
        // Fiyat ekseni üzerinde: Y zoom
        s.yZoom = Math.max(0.2, Math.min(10, s.yZoom * (1 + dir * 0.1)));
      } else {
        // Grafik alanı: X zoom
        const oldTW = s.candleWidth + s.spacing;
        s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + dir));
        s.spacing = s.candleWidth * 0.25;
        const newTW = s.candleWidth + s.spacing;
        s.offsetX = mx - (mx - s.offsetX) * (newTW / oldTW);
      }
      render();
    };

    // ── TOUCH ──────────────────────────────────────────────
    let prevTouches = null;
    let tapStart = null;
    let lastTapTime = 0;
    let touchMode = null;  // 'pan' | 'pinch' | 'yAxis' | 'yAxisPinch'
    let axisStartY = 0;
    let axisStartZoom = 1;

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

    const isInAxisArea = (clientX, rect) => clientX - rect.left >= canvas.width - RIGHT_PAD - 10;

    const onTouchStart = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const tx = t.clientX - rect.left;
        const ty = t.clientY - rect.top;
        tapStart = { x: tx, y: ty, time: Date.now() };
        prevTouches = [{ clientX: t.clientX, clientY: t.clientY }];

        if (isInAxisArea(t.clientX, rect)) {
          touchMode = 'yAxis';
          axisStartY = t.clientY;
          axisStartZoom = s.yZoom;
        } else {
          touchMode = 'pan';
        }

      } else if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        tapStart = null;

        const midX = (t0.clientX + t1.clientX) / 2;
        const rect2 = canvas.getBoundingClientRect();
        if (isInAxisArea(midX, rect2)) {
          touchMode = 'yAxisPinch';
        } else {
          touchMode = 'pinch';
        }

        prevTouches = [
          { clientX: t0.clientX, clientY: t0.clientY },
          { clientX: t1.clientX, clientY: t1.clientY },
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

      } else if (touchMode === 'yAxis' && e.touches.length === 1) {
        const dy = axisStartY - e.touches[0].clientY;
        s.yZoom = Math.max(0.2, Math.min(10, axisStartZoom * Math.pow(1.01, dy)));
        render();

      } else if (touchMode === 'pinch' && e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];

        const prevDx = prevTouches[0].clientX - prevTouches[1].clientX;
        const prevDy = prevTouches[0].clientY - prevTouches[1].clientY;
        const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
        const curDx = t0.clientX - t1.clientX;
        const curDy = t0.clientY - t1.clientY;
        const curDist = Math.sqrt(curDx * curDx + curDy * curDy);

        if (prevDist < 1) {
          prevTouches = [{ clientX: t0.clientX, clientY: t0.clientY }, { clientX: t1.clientX, clientY: t1.clientY }];
          return;
        }

        const scale = curDist / prevDist;
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const oldTW = s.candleWidth + s.spacing;
        const newCW = Math.max(2, Math.min(30, s.candleWidth * scale));
        s.candleWidth = newCW;
        s.spacing = newCW * 0.25;
        const newTW = s.candleWidth + s.spacing;
        s.offsetX = midX - (midX - s.offsetX) * (newTW / oldTW);

        const prevMidX = (prevTouches[0].clientX + prevTouches[1].clientX) / 2;
        const curMidX = (t0.clientX + t1.clientX) / 2;
        s.offsetX += curMidX - prevMidX;

        prevTouches = [{ clientX: t0.clientX, clientY: t0.clientY }, { clientX: t1.clientX, clientY: t1.clientY }];
        render();

      } else if (touchMode === 'yAxisPinch' && e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const prevVertDist = Math.abs(prevTouches[0].clientY - prevTouches[1].clientY);
        const curVertDist = Math.abs(t0.clientY - t1.clientY);

        if (prevVertDist > 1) {
          const scale = curVertDist / prevVertDist;
          s.yZoom = Math.max(0.2, Math.min(10, s.yZoom * scale));
        }

        prevTouches = [{ clientX: t0.clientX, clientY: t0.clientY }, { clientX: t1.clientX, clientY: t1.clientY }];
        render();
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();

      if (e.touches.length === 0) {
        const now = Date.now();
        if (tapStart && !s.isDragging && now - tapStart.time < 250) {
          if (now - lastTapTime < 350) {
            // Double tap: sağa hizala + Y zoom sıfırla
            const container = containerRef.current;
            if (container) {
              const tw = s.candleWidth + s.spacing;
              s.offsetX = (container.clientWidth - 130) - (s.data.length * tw);
            }
            s.yZoom = 1;
            render();
          }
          lastTapTime = now;

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
