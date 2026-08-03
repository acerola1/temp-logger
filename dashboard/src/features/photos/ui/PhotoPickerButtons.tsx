import { useRef, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { usePhotoPicker } from '../usePhotoPicker';

const BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-xl border border-vine-200 bg-white px-3 py-2 text-sm text-vine-700 transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800';

interface PhotoPickerButtonsProps {
  onSelect: (files: File[]) => void;
  disabled?: boolean;
  // Töltés közben a kameragombon pörgő ikon jelenik meg.
  busy?: boolean;
  // Galériából több kép is választható-e. Egyképes űrlapokon false.
  allowMultiple?: boolean;
  // Desktopon egyetlen gomb jelenik meg, ez a feliratja.
  singleLabel?: string;
  className?: string;
}

// Érintőeszközön `Fotózás` + `Galéria`, egyébként egyetlen választógomb. A rejtett
// inputot maga tartja, így minden hívó ugyanazt a viselkedést kapja.
export function PhotoPickerButtons({
  onSelect,
  disabled = false,
  busy = false,
  allowMultiple = true,
  singleLabel = 'Kép kiválasztása',
  className = 'flex flex-wrap items-center gap-2',
}: PhotoPickerButtonsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobileDevice, openPicker } = usePhotoPicker({ allowMultiple });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // A `change` után is nullázzuk, nem csak a megnyitás előtt: így ugyanaz a
    // fájl egymás után kétszer is kiválasztható.
    event.target.value = '';
    if (files.length > 0) onSelect(files);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleChange}
        className="hidden"
      />
      {isMobileDevice ? (
        <>
          <button
            type="button"
            onClick={() => openPicker(inputRef, 'camera')}
            disabled={disabled}
            className={BUTTON_CLASS}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Fotózás
          </button>
          <button
            type="button"
            onClick={() => openPicker(inputRef, 'gallery')}
            disabled={disabled}
            className={BUTTON_CLASS}
          >
            <ImagePlus className="h-4 w-4" />
            Galéria
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => openPicker(inputRef, 'gallery')}
          disabled={disabled}
          className={BUTTON_CLASS}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {singleLabel}
        </button>
      )}
    </div>
  );
}
