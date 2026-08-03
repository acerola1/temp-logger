// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SelectedPhoto } from '../photoSelection';
import { PhotoPreviewList } from './PhotoPreviewList';

function makePhoto(name: string): SelectedPhoto {
  return {
    file: new File(['x'], name, { type: 'image/jpeg' }),
    previewUrl: `blob:${name}`,
  };
}

afterEach(() => {
  cleanup();
});

describe('PhotoPreviewList', () => {
  it('minden kiválasztott képhez bélyeget rajzol', () => {
    const photos = [makePhoto('elso.jpg'), makePhoto('masodik.jpg')];

    render(<PhotoPreviewList photos={photos} onRemove={vi.fn()} />);

    const thumbnails = screen.getAllByRole<HTMLImageElement>('img');
    expect(thumbnails.map((image) => image.getAttribute('alt'))).toEqual([
      'elso.jpg',
      'masodik.jpg',
    ]);
    expect(thumbnails.map((image) => image.getAttribute('src'))).toEqual([
      'blob:elso.jpg',
      'blob:masodik.jpg',
    ]);
  });

  it('üres listánál nem rajzol semmit', () => {
    render(<PhotoPreviewList photos={[]} onRemove={vi.fn()} />);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('a ✕ gomb az adott kép indexével jelez', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <PhotoPreviewList
        photos={[makePhoto('elso.jpg'), makePhoto('masodik.jpg')]}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'masodik.jpg eltávolítása' }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('feltöltés közben a ✕ gomb tiltott', () => {
    render(<PhotoPreviewList photos={[makePhoto('elso.jpg')]} onRemove={vi.fn()} disabled />);

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'elso.jpg eltávolítása' }).disabled,
    ).toBe(true);
  });
});
