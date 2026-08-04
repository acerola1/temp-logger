// A tőke borítóképe: a kijelölt kép, vagy — kijelölés nélkül — a legutóljára
// fényképezett. A lista és az adatlap ugyanezt a feloldást használja, hogy ne
// tudjanak eltérő képet mutatni.
import { photoDateLabel } from '../photos/photoMetadata';
import type { Vine, VineEvent, VineEventPhoto } from './model';

export interface VineCoverPhoto {
  photo: VineEventPhoto;
  /** Az esemény, aminek a fotósorában a kép él. */
  event: VineEvent;
  /** `true`, ha admin jelölte ki; `false`, ha a legfrissebb fotóból adódik. */
  isPinned: boolean;
}

/** A borító feloldásához a tőkéből csak ez a két mező kell. */
export type VineCoverPhotoSource = Pick<Vine, 'coverPhoto' | 'events'>;

interface PhotoCandidate {
  photo: VineEventPhoto;
  event: VineEvent;
  eventIndex: number;
  photoIndex: number;
}

function photoTime(photo: VineEventPhoto): number {
  // Ugyanaz a dátum, amit a felület a kép alatt kiír: EXIF-készítési idő, annak
  // hiányában a feltöltés pillanata. Így a borító nem mondhat mást, mint a
  // fotó dátumsora.
  return new Date(photoDateLabel(photo).value).getTime();
}

/**
 * `true`, ha a bal oldali jelölt frissebb. Egyenlő dátumnál az esemény
 * időpontja, majd a beágyazott tömbök sorrendje dönt: ugyanaz az adat mindig
 * ugyanazt a borítót adja.
 */
function isNewer(candidate: PhotoCandidate, best: PhotoCandidate): boolean {
  const candidateTime = photoTime(candidate.photo);
  const bestTime = photoTime(best.photo);
  if (candidateTime !== bestTime) return candidateTime > bestTime;

  const candidateEventTime = new Date(candidate.event.occurredAt).getTime();
  const bestEventTime = new Date(best.event.occurredAt).getTime();
  if (candidateEventTime !== bestEventTime) return candidateEventTime > bestEventTime;

  if (candidate.eventIndex !== best.eventIndex) return candidate.eventIndex > best.eventIndex;
  return candidate.photoIndex > best.photoIndex;
}

function latestPhoto(events: readonly VineEvent[]): PhotoCandidate | null {
  let best: PhotoCandidate | null = null;

  events.forEach((event, eventIndex) => {
    event.photos.forEach((photo, photoIndex) => {
      const candidate = { photo, event, eventIndex, photoIndex };
      if (!best || isNewer(candidate, best)) best = candidate;
    });
  });

  return best;
}

function pinnedPhoto(vine: VineCoverPhotoSource): PhotoCandidate | null {
  const reference = vine.coverPhoto;
  if (!reference) return null;

  const eventIndex = vine.events.findIndex((candidate) => candidate.id === reference.eventId);
  const event = vine.events[eventIndex];
  if (!event) return null;

  const photoIndex = event.photos.findIndex((candidate) => candidate.id === reference.photoId);
  const photo = event.photos[photoIndex];
  if (!photo) return null;

  return { photo, event, eventIndex, photoIndex };
}

/**
 * A tőke borítóképe, vagy `null`, ha egyetlen eseményéhez sincs fotó. Elavult
 * mutató (törölt esemény vagy fotó) nem hiba: ilyenkor csendben az automatikus
 * képre esik vissza.
 */
export function resolveVineCoverPhoto(vine: VineCoverPhotoSource): VineCoverPhoto | null {
  const pinned = pinnedPhoto(vine);
  if (pinned) {
    return { photo: pinned.photo, event: pinned.event, isPinned: true };
  }

  const latest = latestPhoto(vine.events);
  return latest ? { photo: latest.photo, event: latest.event, isPinned: false } : null;
}
