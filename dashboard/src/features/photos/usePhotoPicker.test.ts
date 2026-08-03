import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTouchDevice } from './usePhotoPicker';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const PHONE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function stubDevice(userAgent: string, maxTouchPoints: number, pointerCoarse: boolean) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });
  vi.stubGlobal('window', {
    matchMedia: (query: string) => ({ matches: query === '(pointer: coarse)' && pointerCoarse }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isTouchDevice', () => {
  it('a mobil userAgentet önmagában elfogadja', () => {
    stubDevice(PHONE_USER_AGENT, 0, false);

    expect(isTouchDevice()).toBe(true);
  });

  it('a desktop userAgentet küldő iPadOS-t az érintőelsődlegességből ismeri fel', () => {
    stubDevice(DESKTOP_USER_AGENT, 5, true);

    expect(isTouchDevice()).toBe(true);
  });

  it('az érintőképernyős laptopot nem tekinti mobil eszköznek', () => {
    stubDevice(DESKTOP_USER_AGENT, 10, false);

    expect(isTouchDevice()).toBe(false);
  });

  it('érintés nélküli desktopon hamis', () => {
    stubDevice(DESKTOP_USER_AGENT, 0, false);

    expect(isTouchDevice()).toBe(false);
  });
});
