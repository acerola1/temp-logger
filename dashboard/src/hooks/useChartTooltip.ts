import { useState, useRef, useEffect, useCallback } from 'react';
import { chartHeight, chartMargin, chartYAxisWidth } from '../constants/chartLayout';
import { scaleX } from '../lib/chartTransform';
import type { TimeSeriesPoint } from '../lib/chartSeries';

interface TooltipPoint {
  recordedAtMs: number;
  value: number;
}

interface UseChartTooltipOptions {
  data: TimeSeriesPoint[];
  dataKey: keyof TimeSeriesPoint;
  timeDomain: [number, number];
  plotWidth: number;
  chartRef: React.RefObject<HTMLDivElement | null>;
}

interface UseChartTooltipReturn {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  activeTooltip: TooltipPoint | null;
  isPinned: boolean;
  pinnedPoint: TooltipPoint | null;
  setPinnedPoint: (point: TooltipPoint | null) => void;
  handleMouseMove: (state: unknown) => void;
  handleMouseLeave: () => void;
  handleChartClick: (state: unknown) => void;
}

export function useChartTooltip({
  data,
  dataKey,
  timeDomain,
  plotWidth,
  chartRef,
}: UseChartTooltipOptions): UseChartTooltipReturn {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pinnedPoint, setPinnedPoint] = useState<TooltipPoint | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TooltipPoint | null>(null);

  const tooltipCurrentX = useRef(0);
  const tooltipTargetX = useRef(0);
  const tooltipVelocityX = useRef(0);
  const tooltipCurrentY = useRef(0);
  const tooltipTargetY = useRef(0);
  const tooltipVelocityY = useRef(0);
  const tooltipRafId = useRef(0);
  const animateTooltipRef = useRef<() => void>(() => {});

  const extractPoint = (state: unknown): TooltipPoint | null => {
    const s = state as {
      activeLabel?: number;
      activePayload?: Array<{ payload?: TimeSeriesPoint }>;
    };
    const payload = s.activePayload?.[0]?.payload;
    const ms =
      typeof payload?.recordedAtMs === 'number'
        ? payload.recordedAtMs
        : typeof s.activeLabel === 'number'
          ? s.activeLabel
          : null;
    if (ms === null) return null;
    const point = data.find(
      (item) => item.recordedAtMs === ms && typeof item[dataKey] === 'number',
    );
    if (!point) return null;
    const value = point[dataKey];
    if (typeof value !== 'number') return null;
    return { recordedAtMs: point.recordedAtMs, value };
  };

  const handleMouseMove = (state: unknown) => {
    if (pinnedPoint) return;
    setHoveredPoint(extractPoint(state));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (pinnedPoint) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      tooltipTargetY.current = Math.max(chartMargin.top, Math.min(y, chartHeight));
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, [pinnedPoint, chartRef]);

  const handleChartClick = (state: unknown) => {
    const point = extractPoint(state);
    if (!point) {
      setPinnedPoint(null);
      return;
    }
    setPinnedPoint((current) =>
      current?.recordedAtMs === point.recordedAtMs ? null : point,
    );
  };

  useEffect(() => {
    if (!pinnedPoint) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setPinnedPoint(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pinnedPoint]);

  const activeTooltip = pinnedPoint ?? hoveredPoint;
  const isPinned = pinnedPoint !== null;

  const animateTooltip = useCallback(() => {
    const stiffness = 0.012;
    const damping = 0.85;

    const dx = tooltipTargetX.current - tooltipCurrentX.current;
    const dy = tooltipTargetY.current - tooltipCurrentY.current;

    tooltipVelocityX.current = (tooltipVelocityX.current + dx * stiffness) * damping;
    tooltipVelocityY.current = (tooltipVelocityY.current + dy * stiffness) * damping;

    tooltipCurrentX.current += tooltipVelocityX.current;
    tooltipCurrentY.current += tooltipVelocityY.current;

    const settled =
      Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3 &&
      Math.abs(tooltipVelocityX.current) < 0.1 && Math.abs(tooltipVelocityY.current) < 0.1;

    if (settled) {
      tooltipCurrentX.current = tooltipTargetX.current;
      tooltipCurrentY.current = tooltipTargetY.current;
      tooltipVelocityX.current = 0;
      tooltipVelocityY.current = 0;
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate(${tooltipCurrentX.current}px, ${tooltipCurrentY.current}px) translate(-50%, -100%)`;
      }
      tooltipRafId.current = 0;
      return;
    }

    if (tooltipRef.current) {
      tooltipRef.current.style.transform = `translate(${tooltipCurrentX.current}px, ${tooltipCurrentY.current}px) translate(-50%, -100%)`;
    }
    tooltipRafId.current = requestAnimationFrame(animateTooltipRef.current);
  }, []);

  useEffect(() => {
    animateTooltipRef.current = animateTooltip;
  }, [animateTooltip]);

  useEffect(() => {
    if (!activeTooltip) {
      cancelAnimationFrame(tooltipRafId.current);
      tooltipRafId.current = 0;
      return;
    }
    const targetX = scaleX(activeTooltip.recordedAtMs, timeDomain, chartYAxisWidth, plotWidth);
    tooltipTargetX.current = targetX;
    if (isPinned) {
      tooltipTargetY.current = tooltipCurrentY.current;
    }
    if (!tooltipRafId.current) {
      tooltipRafId.current = requestAnimationFrame(animateTooltipRef.current);
    }
  }, [activeTooltip, animateTooltip, timeDomain, plotWidth, isPinned]);

  useEffect(() => {
    return () => cancelAnimationFrame(tooltipRafId.current);
  }, []);

  return {
    tooltipRef,
    activeTooltip,
    isPinned,
    pinnedPoint,
    setPinnedPoint,
    handleMouseMove,
    handleMouseLeave,
    handleChartClick,
  };
}
