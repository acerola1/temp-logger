import { useCallback, useMemo } from 'react';

export type PhotoPickerSource = 'camera' | 'gallery';

function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent,
  );
}

export function usePhotoPicker() {
  const isMobileDevice = useMemo(() => isMobileUserAgent(), []);

  const openPicker = useCallback(
    (inputRef: React.RefObject<HTMLInputElement | null>, source: PhotoPickerSource) => {
      const input = inputRef.current;
      if (!input) return;

      if (source === 'camera') {
        input.setAttribute('capture', 'environment');
      } else {
        input.removeAttribute('capture');
      }

      input.value = '';
      input.click();
    },
    [],
  );

  return { isMobileDevice, openPicker };
}
