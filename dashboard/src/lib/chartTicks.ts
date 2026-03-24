import type { TimeRange } from '../types/sensor';

export interface ChartTick {
  value: number;
  ratio: number;
}

const tickCountByRange: Record<TimeRange, number> = {
  '24h': 5,
  '7d': 5,
  '30d': 6,
};

export function buildTimeTicks(
  domain: [number, number],
  timeRange: TimeRange,
): ChartTick[] {
  const [start, end] = domain;

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const tickCount = tickCountByRange[timeRange];
  const ticks: ChartTick[] = [];

  for (let index = 0; index < tickCount; index += 1) {
    const ratio = tickCount === 1 ? 0.5 : index / (tickCount - 1);
    ticks.push({
      value: start + (end - start) * ratio,
      ratio,
    });
  }

  return ticks;
}
