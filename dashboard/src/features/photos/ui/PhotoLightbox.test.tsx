// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoLightbox, type PhotoLightboxImage } from './PhotoLightbox';

const IMAGES: PhotoLightboxImage[] = [
  { id: 'a', url: 'https://example.test/a.jpg', alt: 'első', caption: 'Dátum: 2026-08-01' },
  { id: 'b', url: 'https://example.test/b.jpg', alt: 'második' },
  { id: 'c', url: 'https://example.test/c.jpg', alt: 'harmadik' },
];

function openLightbox(props: Partial<Parameters<typeof PhotoLightbox>[0]> = {}) {
  const onClose = props.onClose ?? vi.fn();
  const view = render(<PhotoLightbox images={IMAGES} onClose={onClose} {...props} />);
  return { ...view, onClose };
}

const canvas = () => screen.getByRole('dialog');
const counter = (index: number, total: number) => `Kép ${index}/${total}`;

// A vászon fölött húzás: happy-dom-ban a méretek nullák, de a lapozás csak a
// pointer-koordinátákból dolgozik, így valósághűen kipróbálható.
function swipe(distance: number) {
  const box = canvas();
  fireEvent.pointerDown(box, { pointerId: 1, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(box, { pointerId: 1, clientX: 200 + distance / 2, clientY: 300 });
  fireEvent.pointerMove(box, { pointerId: 1, clientX: 200 + distance, clientY: 300 });
  fireEvent.pointerUp(box, { pointerId: 1, clientX: 200 + distance, clientY: 300 });
}

function tap(clientX: number, clientY: number) {
  const box = canvas();
  fireEvent.pointerDown(box, { pointerId: 1, clientX, clientY });
  fireEvent.pointerUp(box, { pointerId: 1, clientX, clientY });
}

afterEach(() => {
  cleanup();
});

describe('PhotoLightbox', () => {
  it('a kezdőindexen nyílik, és a számláló az aktuális képet mutatja', () => {
    openLightbox({ initialIndex: 1 });

    expect(screen.getByText(new RegExp(counter(2, 3)))).toBeTruthy();
  });

  it('a nyilakkal lapoz, és a szélein letiltja őket', async () => {
    const user = userEvent.setup();
    openLightbox();

    const previous = screen.getByRole<HTMLButtonElement>('button', { name: 'Előző kép' });
    const next = screen.getByRole<HTMLButtonElement>('button', { name: 'Következő kép' });
    expect(previous.disabled).toBe(true);

    await user.click(next);
    expect(screen.getByText(new RegExp(counter(2, 3)))).toBeTruthy();
    expect(previous.disabled).toBe(false);

    await user.click(next);
    expect(screen.getByText(new RegExp(counter(3, 3)))).toBeTruthy();
    expect(next.disabled).toBe(true);
  });

  it('egyetlen képnél nincs lapozó nyíl', () => {
    openLightbox({ images: [IMAGES[0]] });

    expect(screen.queryByRole('button', { name: 'Következő kép' })).toBeNull();
    expect(screen.getByText(new RegExp(counter(1, 1)))).toBeTruthy();
  });

  it('a képaláírás a számláló mellett látszik', () => {
    openLightbox();

    expect(screen.getByText(/Kép 1\/3 • Dátum: 2026-08-01/)).toBeTruthy();
  });

  it('billentyűkkel lapoz, nagyít és zár', () => {
    const { onClose } = openLightbox();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(new RegExp(counter(2, 3)))).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(new RegExp(counter(1, 3)))).toBeTruthy();

    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByText('160%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '-' });
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '0' });
    expect(screen.getByText('100%')).toBeTruthy();

    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a nagyítás a maximumon és a minimumon megáll', () => {
    openLightbox();

    for (let step = 0; step < 12; step += 1) fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByText('500%')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Nagyítás' }).disabled).toBe(true);

    for (let step = 0; step < 12; step += 1) fireEvent.keyDown(window, { key: '-' });
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Kicsinyítés' }).disabled).toBe(true);
  });

  it('vízszintes húzás alaphelyzetben lapoz, a végén nem fordul körbe', () => {
    openLightbox();

    swipe(-120);
    expect(screen.getByText(new RegExp(counter(2, 3)))).toBeTruthy();
    swipe(-120);
    expect(screen.getByText(new RegExp(counter(3, 3)))).toBeTruthy();
    swipe(-120);
    expect(screen.getByText(new RegExp(counter(3, 3)))).toBeTruthy();

    swipe(120);
    expect(screen.getByText(new RegExp(counter(2, 3)))).toBeTruthy();
  });

  it('a küszöb alatti húzás nem lapoz', () => {
    openLightbox();

    swipe(-30);
    expect(screen.getByText(new RegExp(counter(1, 3)))).toBeTruthy();
  });

  it('lapozáskor jelez a hívónak', () => {
    const onIndexChange = vi.fn();
    openLightbox({ onIndexChange });

    swipe(-120);
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onIndexChange.mock.calls).toEqual([[1], [2]]);
  });

  it('dupla koppintás nagyít, ismételve visszaáll', () => {
    openLightbox();

    tap(120, 200);
    tap(120, 200);
    expect(screen.getByText('250%')).toBeTruthy();

    tap(120, 200);
    tap(120, 200);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('a zoom-panel gombjára érkező pointer nem zárja be a nézőt', () => {
    const { onClose } = openLightbox();
    const zoomIn = screen.getByRole('button', { name: 'Nagyítás' });

    fireEvent.pointerDown(zoomIn, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(zoomIn, { pointerId: 1, clientX: 30, clientY: 30 });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('a bezárás gomb jelez a hívónak', async () => {
    const user = userEvent.setup();
    const { onClose } = openLightbox();

    await user.click(screen.getByRole('button', { name: 'Bezárás' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('az aktuális kép új lapon nyitható', () => {
    openLightbox({ initialIndex: 1 });

    const link = screen.getByRole<HTMLAnchorElement>('link', { name: 'Megnyitás új lapon' });
    expect(link.getAttribute('href')).toBe('https://example.test/b.jpg');
  });

  it('nyitva zárja a háttéroldal görgetését, záráskor visszaállítja', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = openLightbox();

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.overscrollBehavior).toBe('none');

    unmount();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.overscrollBehavior).toBe('');
  });
});
