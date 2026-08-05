// A tőke fotósorrendje és borítóképe. A galéria, a lightbox, a listakártya és
// az adatlap fejléce ugyanezt a két függvényt használja, ezért nem tudnak eltérő
// képet vagy eltérő sorrendet mutatni.
//
// A `photos` almodulját közvetlenül importáljuk, nem az indexen át: a
// borítófeloldást a listakártya is használja, ami így nem húzza be a feltöltő
// hook Firebase-szingletonját.
import {
  resolvePhotoCover,
  sortPhotosNewestFirst,
  type ResolvedPhotoCover,
} from '../photos/photoOrder';
import type { Vine, VinePhoto } from './model';

export type VineCoverPhoto = ResolvedPhotoCover<VinePhoto>;

/** A borító feloldásához a tőkéből csak ez a két mező kell. */
export type VineCoverPhotoSource = Pick<Vine, 'photos' | 'coverPhotoId'>;

/** A tőke fotói megjelenítési sorrendben: legújabb elöl. */
export function sortVinePhotos(photos: readonly VinePhoto[]): VinePhoto[] {
  return sortPhotosNewestFirst(photos);
}

/**
 * A tőke borítóképe, vagy `null`, ha nincs fotója. Elavult mutató (már törölt
 * fotó azonosítója) nem hiba: ilyenkor csendben az automatikus képre, azaz a
 * rendezés első elemére esik vissza.
 */
export function resolveVineCoverPhoto(vine: VineCoverPhotoSource): VineCoverPhoto | null {
  return resolvePhotoCover(sortVinePhotos(vine.photos), vine.coverPhotoId);
}
