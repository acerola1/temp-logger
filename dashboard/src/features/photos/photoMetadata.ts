// A fotórekord közös alakja: a dugványfotó és a tőkeeseményfotó ugyanezt a
// metaadatot hordozza, hogy a galéria, a néző és az idővonal ugyanúgy tudja
// olvasni mindkettőt.
import { formatDateTime } from '../../lib/dateFormat';
import type { IsoDateTimeString } from '../../types/datetime';

/**
 * A kép kicsi változata: a 80 px-es keretek ezt töltik le a nagy kép helyett.
 * A rekord beágyazott mezője, nem kikövetkeztetett Storage-út — az útból képzett
 * URL letöltési tokent, azaz futásidejű `getDownloadURL`-t igényelne kártyánként.
 */
export interface PhotoThumbnail {
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export interface Photo {
  id: string;
  storagePath: string;
  downloadUrl: string;
  width: number;
  height: number;
  /**
   * A kis változat, vagy `null`: a bélyeg előtti rekordokban és a már eleve
   * kicsi képeknél hiányzik. Nem hiba, csak a régi viselkedés.
   */
  thumbnail: PhotoThumbnail | null;
  /**
   * A kép EXIF-ből kiolvasott készítési ideje. `null`, ha a fájlban nem volt
   * `DateTimeOriginal` — a régi rekordokban is ez van.
   */
  capturedAt: IsoDateTimeString | null;
  uploadedAt: IsoDateTimeString;
  caption: string;
}

/** A megjelenítéshez elég a két dátum; így a bélyeg és a néző is átadható. */
export type PhotoDates = Pick<Photo, 'capturedAt' | 'uploadedAt'>;

/** A feltöltés eredményének az a része, amiből a rekord összeáll. */
export type PhotoUploadResult = Omit<Photo, 'uploadedAt' | 'caption'> & { id: string };

/**
 * A feltöltött objektumból fotórekord. Egy helyen, mert a dugvány- és a
 * tőkeeseményfotó ugyanezt az alakot tölti ki.
 */
export function toPhotoRecord(upload: PhotoUploadResult, uploadedAt: IsoDateTimeString): Photo {
  return {
    id: upload.id,
    storagePath: upload.storagePath,
    downloadUrl: upload.downloadUrl,
    width: upload.width,
    height: upload.height,
    thumbnail: upload.thumbnail,
    capturedAt: upload.capturedAt,
    uploadedAt,
    // A feliratot a felület tölti meg, a feltöltés nem tud róla semmit.
    caption: '',
  };
}

/**
 * A kis keretek képforrása: a bélyeg URL-je, hiányában a nagy képé. A hiányzó
 * bélyeg így sosem üres keret, csak több letöltött bájt.
 */
export function photoThumbnailUrl(photo: Pick<Photo, 'downloadUrl' | 'thumbnail'>): string {
  return photo.thumbnail?.downloadUrl || photo.downloadUrl;
}

export interface PhotoDateLabel {
  /** `true`, ha a dátum a valódi készítési idő, nem a feltöltés pillanata. */
  isCaptured: boolean;
  /** Emberi címke: `Készült` vagy `Feltöltve`. */
  prefix: string;
  value: IsoDateTimeString;
}

/**
 * A felület sosem állítja azt, hogy ismeri a készítés idejét: EXIF nélkül a
 * feltöltés idejét mutatja, és ezt a címke ki is mondja.
 */
export function photoDateLabel(photo: PhotoDates): PhotoDateLabel {
  if (photo.capturedAt) {
    return { isCaptured: true, prefix: 'Készült', value: photo.capturedAt };
  }

  return { isCaptured: false, prefix: 'Feltöltve', value: photo.uploadedAt };
}

/** A kiírt dátumsor, egy helyen megfogalmazva: `Készült: 2026.05.02. 10:11`. */
export function photoDateText(photo: PhotoDates): string {
  const label = photoDateLabel(photo);

  return `${label.prefix}: ${formatDateTime(label.value)}`;
}

/**
 * A közös képnéző feliratsora: a kép saját feliratát és dátumsorát fűzi össze a
 * hívó extra részeivel (például az esemény címével), üres részeket kihagyva.
 */
export function photoLightboxCaption(
  photo: PhotoDates & Pick<Photo, 'caption'>,
  ...extraParts: string[]
): string {
  return [...extraParts, photo.caption, photoDateText(photo)].filter(Boolean).join(' • ');
}
