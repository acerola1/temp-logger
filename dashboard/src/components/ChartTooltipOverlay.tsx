import { X, Plus } from 'lucide-react';
import { formatDateShort } from '../lib/dateFormat';

interface TooltipPoint {
  recordedAtMs: number;
  value: number;
}

interface ChartTooltipOverlayProps {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  activeTooltip: TooltipPoint | null;
  isPinned: boolean;
  isDark: boolean;
  lineColor: string;
  title: string;
  unit: string;
  canQuickCreateEvent: boolean;
  onQuickCreateAt?: (occurredAtIso: string) => void;
  onDismiss: () => void;
}

export function ChartTooltipOverlay({
  tooltipRef,
  activeTooltip,
  isPinned,
  isDark,
  lineColor,
  title,
  unit,
  canQuickCreateEvent,
  onQuickCreateAt,
  onDismiss,
}: ChartTooltipOverlayProps) {
  return (
    <div
      ref={tooltipRef}
      className="absolute z-20 max-w-64 rounded-xl border px-3 py-2.5 text-left text-[13px] shadow-lg"
      style={{
        left: 0,
        top: 0,
        transform: 'translate(0px, 0px) translate(-50%, -100%)',
        backgroundColor: isDark ? '#2a3518' : '#fff',
        borderColor: isDark ? '#3a4820' : '#e8e3d6',
        color: isDark ? '#f4f1ea' : '#18211b',
        visibility: activeTooltip ? 'visible' : 'hidden',
        pointerEvents: isPinned ? 'auto' : 'none',
      }}
    >
      {isPinned && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-1 top-1 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          aria-label="Kijelölés bezárása"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {activeTooltip && (
        <>
          <div className={isPinned ? 'pr-4' : ''}>{formatDateShort(activeTooltip.recordedAtMs)}</div>
          <hr className="my-1.5 border-current opacity-15" />
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColor }} />
            <span>{title} : {activeTooltip.value.toFixed(1)}{unit}</span>
          </div>
          {isPinned && canQuickCreateEvent && onQuickCreateAt && (
            <button
              type="button"
              onClick={() => onQuickCreateAt(new Date(activeTooltip.recordedAtMs).toISOString())}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-700 dark:bg-vine-700 dark:text-sky-200 dark:hover:bg-vine-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Új esemény
            </button>
          )}
        </>
      )}
    </div>
  );
}
