import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  /** A dialógus akadálymentes neve; ezen keresztül horgonyoznak a tesztek is. */
  label: string;
  onClose: () => void;
  /** A panel osztályai, hogy a hívó a szélességet és a belső elrendezést szabja. */
  className?: string;
  children: ReactNode;
}

// A dashboard közös modális burkolója: overlay, `Esc` és overlay-kattintás
// zárás, háttér-görgetés tiltása, portál a `document.body`-ba. A portál nem
// kényelmi kérdés: a hívók egy része űrlapon belül él, ott a DOM-ban belülre
// rendelt overlay érvénytelen beágyazott formot és véletlen submitot adna.
export function Dialog({ label, onClose, className, children }: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // A háttéroldal ne görgethető, amíg a dialógus nyitva van.
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

  return createPortal(
    <div
      data-testid="dialog-overlay"
      // Csak a magára az overlayre eső kattintás zár. A panelen belüli
      // kattintás felbugyborékol ugyan ide, de ott a `target` már nem az
      // overlay, ezért nem kell a panelre `stopPropagation`.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={
          className ??
          'w-full max-w-lg rounded-3xl border border-vine-200 bg-white p-4 shadow-xl dark:border-vine-700 dark:bg-vine-900'
        }
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
