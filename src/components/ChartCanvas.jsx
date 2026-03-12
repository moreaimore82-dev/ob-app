import { useRef, useEffect, useCallback } from 'react';
import { drawChart } from '../utils/drawChart';

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
    data: [],
    orderBlocks: [],
    initialized: false,
    lastSymbolInterval: '',
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

  // Sync props into ref
  useEffect(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data.length) return;

    s.data = data;
    s.orderBlocks = orderBlocks;

    if (!s.initialized) {
      const rightPad = 130;
      const tw = s.candleWidth + s.spacing;
      s.offsetX = (container.clientWidth - rightPad) - (data.length * tw);
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

  // Mouse/touch events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;

    const onMouseDown = (e) => {
      s.isDragging = true;
      s.startDragX = e.clientX;
      s.dragOffsetX = s.offsetX;
      canvas.style.cursor = 'grabbing';
    };
    const onMouseUp = () => {
      s.isDragging = false;
      canvas.style.cursor = 'crosshair';
    };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      s.mouseX = e.clientX - rect.left;
      s.mouseY = e.clientY - rect.top;
      if (s.isDragging) {
        s.offsetX = s.dragOffsetX + (e.clientX - s.startDragX);
      }
      render();
    };
    const onMouseLeave = () => {
      s.mouseX = -1; s.mouseY = -1;
      s.isDragging = false;
      render();
    };
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + dir));
      s.spacing = s.candleWidth * 0.25;
      render();
    };

    // Touch events for mobile
    let lastTouchX = 0;
    let lastPinchDist = 0;
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        s.isDragging = true;
        lastTouchX = e.touches[0].clientX;
        s.dragOffsetX = s.offsetX;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && s.isDragging) {
        const dx = e.touches[0].clientX - lastTouchX;
        s.offsetX = s.dragOffsetX + dx;
        render();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = dist - lastPinchDist;
        s.candleWidth = Math.max(2, Math.min(30, s.candleWidth + delta * 0.05));
        s.spacing = s.candleWidth * 0.25;
        lastPinchDist = dist;
        render();
      }
    };
    const onTouchEnd = () => { s.isDragging = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [render]);

  return (
    <div ref={containerRef} className="chart-container">
      <canvas ref={canvasRef} className="chart-canvas" />
    </div>
  );
}
