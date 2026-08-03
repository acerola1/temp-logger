import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, X } from 'lucide-react';
import {
  clamp,
  clampLightboxOffset,
  MAX_LIGHTBOX_SCALE,
  MIN_LIGHTBOX_SCALE,
  RESET_LIGHTBOX_VIEW,
  zoomLightboxView,
  type LightboxBounds,
  type LightboxView,
} from '../photoLightboxView';

export interface PhotoLightboxImage {
  // Stabil kulcs a filmszalag elemeihez.
  id: string;
  url: string;
  alt?: string;
  // Az alsó sávban a számláló mellett megjelenő szöveg.
  caption?: string;
}

interface PhotoLightboxProps {
  images: readonly PhotoLightboxImage[];
  // Melyik képen nyíljon meg a néző. A komponens csak nyitott állapotban létezik.
  initialIndex?: number;
  onClose: () => void;
  // Lapozáskor a hívó is követheti az aktív képet.
  onIndexChange?: (index: number) => void;
  label?: string;
}

// Egy aktív ujj/kurzor pozíciója.
interface PointerPos {
  id: number;
  x: number;
  y: number;
}

// Az éppen zajló gesztus. Ref-ben tartjuk, mert minden pointermove-nál kell.
interface Gesture {
  mode: 'none' | 'pan' | 'swipe' | 'pinch';
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastDist: number;
  moved: boolean;
}

// Dupla koppintás / dupla klikk ennyire nagyít
const DOUBLE_TAP_SCALE = 2.5;
const ZOOM_BUTTON_STEP = 1.6;
// Ennyi vízszintes húzás után váltunk képet (csak alaphelyzetben)
const SWIPE_THRESHOLD = 60;
// A képsáv két végén ennyire fékezett a húzás
const EDGE_DRAG_DAMPING = 0.3;
// Ennél kisebb elmozdulás még koppintásnak számít, nem húzásnak
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 28;

const OVERLAY_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40';
const ZOOM_BUTTON_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

const distanceOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

// A dashboard közös teljes képernyős képnézője.
// Desktop: görgő = nagyítás a kurzor felé, dupla klikk = 2,5x, húzás = mozgatás,
// nyilak = képváltás, +/-/0 = nagyítás billentyűn is, Esc = zárás.
// Mobil: két ujjal pinch, dupla koppintás = 2,5x, egy ujjal húzás nagyításban
// mozgat, alaphelyzetben pedig előző/következő képre lapoz.
export function PhotoLightbox({
  images,
  initialIndex = 0,
  onClose,
  onIndexChange,
  label = 'Képnéző',
}: PhotoLightboxProps) {
  const lastIndex = images.length - 1;
  // A képlista menet közben is szűkülhet (pl. törlés), ezért minden index ezen megy át.
  const clampIndex = (value: number) => clamp(value, 0, Math.max(0, lastIndex));
  const [index, setIndex] = useState(() => clampIndex(initialIndex));
  const [view, setView] = useState<LightboxView>(RESET_LIGHTBOX_VIEW);
  // Lapozás közbeni ujj-követés: csak vizuális visszajelzés
  const [dragX, setDragX] = useState(0);
  // Gesztus közben nincs animáció, gombnál/dupla koppintásnál van
  const [smooth, setSmooth] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewRef = useRef<LightboxView>(RESET_LIGHTBOX_VIEW);
  const pointersRef = useRef<PointerPos[]>([]);
  const gestureRef = useRef<Gesture>({
    mode: 'none',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastDist: 0,
    moved: false,
  });
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const hasMultiple = images.length > 1;
  const safeIndex = clampIndex(index);
  const current = images[safeIndex];

  const commitView = useCallback((next: LightboxView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  // Az eltolás-korlátozáshoz és a nagyításhoz a látott kép és a vászon mérete kell.
  const measure = useCallback((): LightboxBounds | null => {
    const img = imgRef.current;
    const box = boxRef.current;
    if (!img || !box) return null;
    return {
      imageWidth: img.offsetWidth,
      imageHeight: img.offsetHeight,
      canvasWidth: box.clientWidth,
      canvasHeight: box.clientHeight,
    };
  }, []);

  // A pointer a képen van-e. Szándékosan geometria és nem event.target alapján:
  // a gesztus alatt pointer capture van a vásznon, ezért a pointerup targetje
  // már a vászon lenne, nem a kép.
  const isPointOnImage = useCallback((clientX: number, clientY: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }, []);

  // A vászon közepéhez relatív pozíció, a nagyítás fókuszpontjához.
  const toFocus = useCallback((clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }, []);

  const zoomTo = useCallback(
    (target: number, focus: { x: number; y: number } = { x: 0, y: 0 }) => {
      commitView(zoomLightboxView(viewRef.current, target, focus, measure()));
    },
    [commitView, measure],
  );

  const resetView = useCallback(() => {
    lastTapRef.current = null;
    commitView(RESET_LIGHTBOX_VIEW);
    setDragX(0);
  }, [commitView]);

  // Lapozás. Szándékosan NEM körkörös: a képsáv lineáris, így a szélén látszik,
  // hogy nincs több kép (a nyilak ott le is tiltódnak).
  const step = useCallback(
    (direction: number) => {
      const next = clamp(safeIndex + direction, 0, lastIndex);
      if (next === safeIndex) return;
      setSmooth(true);
      setIndex(next);
      resetView();
      onIndexChange?.(next);
    },
    [lastIndex, onIndexChange, resetView, safeIndex],
  );

  // A görgős nagyítást saját, nem passzív listenerrel kötjük be: a React
  // onWheel passzív listenerben fut, ott a preventDefault nem érvényesül.
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      setSmooth(false);
      zoomTo(
        viewRef.current.s * Math.exp(-event.deltaY * 0.0015),
        toFocus(event.clientX, event.clientY),
      );
    },
    [toFocus, zoomTo],
  );

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.addEventListener('wheel', handleWheel, { passive: false });
    return () => box.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
      else if (event.key === '+' || event.key === '=') {
        setSmooth(true);
        zoomTo(viewRef.current.s * ZOOM_BUTTON_STEP);
      } else if (event.key === '-') {
        setSmooth(true);
        zoomTo(viewRef.current.s / ZOOM_BUTTON_STEP);
      } else if (event.key === '0') {
        setSmooth(true);
        resetView();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, resetView, step, zoomTo]);

  // A háttéroldal ne görgethető, amíg a néző nyitva van.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  const handleTap = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = lastTapRef.current;
    const now = performance.now();
    const isDoubleTap =
      previous !== null &&
      now - previous.time < DOUBLE_TAP_MS &&
      Math.abs(event.clientX - previous.x) < DOUBLE_TAP_SLOP &&
      Math.abs(event.clientY - previous.y) < DOUBLE_TAP_SLOP;

    if (isDoubleTap) {
      lastTapRef.current = null;
      setSmooth(true);
      if (viewRef.current.s > MIN_LIGHTBOX_SCALE) resetView();
      else zoomTo(DOUBLE_TAP_SCALE, toFocus(event.clientX, event.clientY));
      return;
    }

    lastTapRef.current = { time: now, x: event.clientX, y: event.clientY };
    // A képen kívüli fekete területre koppintás zár, de csak alaphelyzetben,
    // hogy nagyítás közben ne csukódjon be véletlenül.
    if (!isPointOnImage(event.clientX, event.clientY) && viewRef.current.s === MIN_LIGHTBOX_SCALE) {
      onClose();
    }
  };

  const startGesture = (points: PointerPos[]) => {
    const gesture = gestureRef.current;
    if (points.length === 1) {
      gesture.mode = viewRef.current.s > MIN_LIGHTBOX_SCALE ? 'pan' : 'swipe';
      gesture.startX = gesture.lastX = points[0].x;
      gesture.startY = gesture.lastY = points[0].y;
      gesture.lastDist = 0;
    } else if (points.length >= 2) {
      gesture.mode = 'pinch';
      gesture.lastDist = distanceOf(points[0], points[1]);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A vezérlőket (gombok, link, zoom-panel, számláló) ne fogja el a
    // gesztuskezelés, különben a panel hátterére koppintás bezárná a nézőt.
    if ((event.target as HTMLElement).closest('a, button, [data-lightbox-ui]')) return;

    pointersRef.current = pointersRef.current
      .filter((pointer) => pointer.id !== event.pointerId)
      .concat({ id: event.pointerId, x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    setSmooth(false);
    gestureRef.current.moved = false;
    startGesture(pointersRef.current);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const points = pointersRef.current;
    const active = points.find((pointer) => pointer.id === event.pointerId);
    if (!active) return;
    active.x = event.clientX;
    active.y = event.clientY;
    const gesture = gestureRef.current;

    if (gesture.mode === 'pinch' && points.length >= 2) {
      const dist = distanceOf(points[0], points[1]);
      if (gesture.lastDist > 0 && dist > 0) {
        const midX = (points[0].x + points[1].x) / 2;
        const midY = (points[0].y + points[1].y) / 2;
        zoomTo(viewRef.current.s * (dist / gesture.lastDist), toFocus(midX, midY));
      }
      gesture.lastDist = dist;
      gesture.moved = true;
      return;
    }

    if (points.length !== 1) return;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    if (
      Math.abs(event.clientX - gesture.startX) > TAP_SLOP ||
      Math.abs(event.clientY - gesture.startY) > TAP_SLOP
    ) {
      gesture.moved = true;
    }

    if (gesture.mode === 'pan') {
      const currentView = viewRef.current;
      commitView({
        s: currentView.s,
        ...clampLightboxOffset(currentView.x + dx, currentView.y + dy, currentView.s, measure()),
      });
    } else if (gesture.mode === 'swipe' && hasMultiple) {
      const raw = event.clientX - gesture.startX;
      // A két végén nincs hova lapozni, ezért ott a húzás fékezett (rubber band):
      // érezhető, hogy a sáv véget ért.
      const atEdge = (safeIndex === 0 && raw > 0) || (safeIndex === lastIndex && raw < 0);
      setDragX(atEdge ? raw * EDGE_DRAG_DAMPING : raw);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const wasActive = pointersRef.current.some((pointer) => pointer.id === event.pointerId);
    if (!wasActive) return;
    pointersRef.current = pointersRef.current.filter((pointer) => pointer.id !== event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const gesture = gestureRef.current;

    if (gesture.mode === 'swipe') {
      const dx = event.clientX - gesture.startX;
      setSmooth(true);
      setDragX(0);
      if (hasMultiple && Math.abs(dx) > SWIPE_THRESHOLD) step(dx < 0 ? 1 : -1);
    }
    if (!gesture.moved && event.type === 'pointerup') handleTap(event);

    if (pointersRef.current.length === 0) {
      gesture.mode = 'none';
      gesture.lastDist = 0;
    } else {
      // Pinch után a maradó ujjal folytatható a mozgatás.
      startGesture(pointersRef.current);
    }
  };

  if (!current) return null;

  const zoomPercent = Math.round(view.s * 100);
  const canZoomOut = view.s > MIN_LIGHTBOX_SCALE;
  const canZoomIn = view.s < MAX_LIGHTBOX_SCALE;

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // A böngésző saját gesztusai ne vigyék el a pinch-et és a húzást.
      className={`fixed inset-0 z-[120] touch-none select-none overflow-hidden bg-black/90 ${
        canZoomOut ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
      }`}
    >
      {/* Sáv az összes képpel egymás mellett: így a szomszédos kép valóban
          beúszik lapozáskor, nem csak a mostani úszik ki. */}
      <div
        className="flex h-full w-full will-change-transform"
        style={{
          transform: `translate3d(calc(${-safeIndex * 100}% + ${dragX}px), 0, 0)`,
          transition: smooth ? 'transform 0.25s ease-out' : 'none',
        }}
      >
        {images.map((image, imageIndex) => {
          const isCurrent = imageIndex === safeIndex;

          return (
            <div
              key={image.id}
              className="flex h-full w-full flex-none items-center justify-center px-4 py-14 sm:px-16"
            >
              <img
                ref={isCurrent ? imgRef : null}
                src={image.url}
                alt={image.alt ?? ''}
                draggable={false}
                // A szomszédos képek előre betöltenek, hogy a lapozás ne üres
                // helyre úsztasson.
                loading={Math.abs(imageIndex - safeIndex) <= 1 ? 'eager' : 'lazy'}
                className="max-h-full max-w-full rounded-2xl object-contain will-change-transform"
                style={{
                  // A nagyítás mindig csak az éppen látott képre él.
                  transform: isCurrent
                    ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`
                    : undefined,
                  transition: smooth ? 'transform 0.18s ease-out' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`absolute right-4 top-4 z-40 h-10 w-10 ${OVERLAY_BUTTON_CLASS}`}
        aria-label="Bezárás"
      >
        <X className="h-5 w-5" />
      </button>

      <a
        href={current.url}
        target="_blank"
        rel="noreferrer"
        className={`absolute right-16 top-4 z-40 h-10 w-10 ${OVERLAY_BUTTON_CLASS}`}
        aria-label="Megnyitás új lapon"
        title="Megnyitás új lapon"
      >
        <ExternalLink className="h-5 w-5" />
      </a>

      <div
        data-lightbox-ui
        className="absolute left-4 top-4 z-40 inline-flex items-center gap-1 rounded-xl border border-white/30 bg-black/40 p-1 text-white"
      >
        <button
          type="button"
          onClick={() => {
            setSmooth(true);
            zoomTo(viewRef.current.s / ZOOM_BUTTON_STEP);
          }}
          disabled={!canZoomOut}
          className={ZOOM_BUTTON_CLASS}
          aria-label="Kicsinyítés"
          title="Kicsinyítés"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs tabular-nums">{zoomPercent}%</span>
        <button
          type="button"
          onClick={() => {
            setSmooth(true);
            zoomTo(viewRef.current.s * ZOOM_BUTTON_STEP);
          }}
          disabled={!canZoomIn}
          className={ZOOM_BUTTON_CLASS}
          aria-label="Nagyítás"
          title="Nagyítás"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSmooth(true);
            resetView();
          }}
          disabled={!canZoomOut}
          className="rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Nagyítás visszaállítása"
          title="Nagyítás visszaállítása"
        >
          Reset
        </button>
      </div>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={safeIndex === 0}
            className={`absolute left-4 top-1/2 z-40 h-11 w-11 -translate-y-1/2 ${OVERLAY_BUTTON_CLASS}`}
            aria-label="Előző kép"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={safeIndex === lastIndex}
            className={`absolute right-4 top-1/2 z-40 h-11 w-11 -translate-y-1/2 ${OVERLAY_BUTTON_CLASS}`}
            aria-label="Következő kép"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        data-lightbox-ui
        className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-white/20 bg-black/45 px-4 py-2 text-xs text-white"
      >
        Kép {safeIndex + 1}/{images.length}
        {current.caption ? ` • ${current.caption}` : ''}
      </div>
    </div>
  );
}
