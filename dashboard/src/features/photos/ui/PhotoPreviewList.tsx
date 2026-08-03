import { X } from 'lucide-react';
import type { SelectedPhoto } from '../photoSelection';

interface PhotoPreviewListProps {
  photos: readonly SelectedPhoto[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

// A feltöltés előtt kiválasztott képek bélyegei, egyenként eltávolíthatóan. Az
// objectURL-eket a `photoSelection` kezeli, itt csak megjelenítjük őket.
export function PhotoPreviewList({ photos, onRemove, disabled = false }: PhotoPreviewListProps) {
  if (photos.length === 0) return null;

  return (
    <ul aria-label="Kiválasztott fotók" className="flex flex-wrap gap-2">
      {photos.map((photo, index) => (
        <li key={photo.previewUrl} className="relative">
          <img
            src={photo.previewUrl}
            alt={photo.file.name}
            className="h-20 w-20 rounded-xl border border-vine-200 object-cover dark:border-vine-700"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`${photo.file.name} eltávolítása`}
            className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-vine-200 bg-white text-vine-700 shadow-sm transition-colors hover:bg-vine-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-vine-700 dark:bg-vine-900 dark:text-vine-100 dark:hover:bg-vine-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
