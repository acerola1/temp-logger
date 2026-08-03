// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoPickerButtons } from './PhotoPickerButtons';

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

function makeTouchDevice() {
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: query === '(pointer: coarse)' })) as
    typeof window.matchMedia;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('A rejtett fájlinput nem található.');
  return input;
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 0, configurable: true });
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('PhotoPickerButtons', () => {
  it('desktopon egyetlen választógombot jelenít meg', () => {
    render(<PhotoPickerButtons onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Kép kiválasztása' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Fotózás' })).toBeNull();
  });

  it('érintőeszközön a Fotózás és a Galéria gombpár jelenik meg', () => {
    makeTouchDevice();

    render(<PhotoPickerButtons onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Fotózás' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Galéria' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Kép kiválasztása' })).toBeNull();
  });

  it('a Fotózás a hátsó kamerát egy képre nyitja, a Galéria többes kijelöléssel', async () => {
    makeTouchDevice();
    const user = userEvent.setup();
    render(<PhotoPickerButtons onSelect={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Fotózás' }));
    expect(fileInput().getAttribute('capture')).toBe('environment');
    expect(fileInput().multiple).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Galéria' }));
    expect(fileInput().getAttribute('capture')).toBeNull();
    expect(fileInput().multiple).toBe(true);
  });

  it('a kiválasztott fájlokat továbbadja, és ugyanaz a fájl újra választható', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PhotoPickerButtons onSelect={onSelect} />);

    await user.upload(fileInput(), makeFile('kep-1.jpg'));
    // A `change` kezelő nullázza az inputot, ezért mehet ugyanaz a fájl újra.
    expect(fileInput().value).toBe('');

    await user.upload(fileInput(), makeFile('kep-1.jpg'));

    expect(onSelect).toHaveBeenCalledTimes(2);
    const selectedNames = onSelect.mock.calls.map((call) => (call[0] as File[])[0].name);
    expect(selectedNames).toEqual(['kep-1.jpg', 'kep-1.jpg']);
  });

  it('feltöltés közben a választógomb tiltott', () => {
    render(<PhotoPickerButtons onSelect={vi.fn()} disabled />);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Kép kiválasztása' }).disabled).toBe(
      true,
    );
  });
});
