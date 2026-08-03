// A beküldés előtt kiválasztott képek listájának kezelése: limit, maradék helyre
// vágás és az előnézeti objectURL-ek életciklusa. Keretrendszer-független, hogy
// a megjelenítő komponens effekt nélkül, tisztán prezentációs maradhasson.

// A szoloink fórum-képfeltöltésének alapértelmezett korlátja.
export const DEFAULT_MAX_SELECTED_PHOTOS = 6;

export interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

export interface PhotoSelection {
  photos: SelectedPhoto[];
  // A limit miatt kimaradt képek száma.
  rejectedCount: number;
  // Felhasználónak szánt üzenet, ha a kijelölés nem fért bele a limitbe.
  error: string | null;
}

function limitMessage(maxCount: number, rejectedCount: number): string {
  return `Legfeljebb ${maxCount} fotó választható ki, ${rejectedCount} kép kimaradt.`;
}

// A már kiválasztott képek után fűzi az újakat, a maradék helyre vágva. A
// kamerával készített kép így hozzáadódik a listához, nem írja felül. Csak a
// befogadott képekhez készül objectURL, a kimaradókhoz nem.
export function appendSelectedPhotos(
  current: readonly SelectedPhoto[],
  added: readonly File[],
  maxCount: number = DEFAULT_MAX_SELECTED_PHOTOS,
): PhotoSelection {
  const remainingSlots = Math.max(0, maxCount - current.length);
  const accepted = added.slice(0, remainingSlots).map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
  }));
  const rejectedCount = added.length - accepted.length;

  return {
    photos: [...current, ...accepted],
    rejectedCount,
    error: rejectedCount > 0 ? limitMessage(maxCount, rejectedCount) : null,
  };
}

// Az eltávolított kép objectURL-jét azonnal felszabadítja.
export function removeSelectedPhotoAt(
  current: readonly SelectedPhoto[],
  index: number,
): SelectedPhoto[] {
  const removed = current[index];
  if (removed) URL.revokeObjectURL(removed.previewUrl);

  return current.filter((_, photoIndex) => photoIndex !== index);
}

// A kiválasztás elhagyásakor (űrlap lecsatolása) hívandó.
export function releaseSelectedPhotos(photos: readonly SelectedPhoto[]): void {
  photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
}

export function selectedPhotoFiles(photos: readonly SelectedPhoto[]): File[] {
  return photos.map((photo) => photo.file);
}
