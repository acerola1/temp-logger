import { useCallback, useMemo } from 'react';

export type PhotoPickerSource = 'camera' | 'gallery';

interface PhotoPickerOptions {
  // Galériából több kép is választható-e. Egyképes űrlapokon false.
  allowMultiple?: boolean;
}

// Az iPadOS 13+ Safari desktop userAgentet küld, ezért a userAgent-regex
// mellett az érintőelsődlegességet is elfogadjuk. A `pointer: coarse` feltétel
// egyben kizárja az érintőképernyős laptopokat.
export function isTouchDevice() {
  if (typeof navigator === 'undefined') return false;

  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent,
  );
  const touchPrimary =
    (navigator.maxTouchPoints ?? 0) > 0 &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return mobileUserAgent || touchPrimary;
}

export function usePhotoPicker(options: PhotoPickerOptions = {}) {
  const allowMultiple = options.allowMultiple ?? true;
  const isMobileDevice = useMemo(() => isTouchDevice(), []);

  const openPicker = useCallback(
    (inputRef: React.RefObject<HTMLInputElement | null>, source: PhotoPickerSource) => {
      const input = inputRef.current;
      if (!input) return;

      if (source === 'camera') {
        // A kamera úgyis egy képet ad; a `multiple` ilyenkor csak zavar.
        input.setAttribute('capture', 'environment');
        input.multiple = false;
      } else {
        input.removeAttribute('capture');
        input.multiple = allowMultiple;
      }

      input.value = '';
      input.click();
    },
    [allowMultiple],
  );

  return { isMobileDevice, openPicker };
}
