// A kliensoldali kép-előkészítés egyetlen helye: a hívó adja a méretkorlátot,
// alapértelmezésben a dugvány- és munkamenetfotók 1000 px-e érvényes.
import type { IsoDateTimeString } from '../../types/datetime';
import { decoderAppliesExifOrientation } from './decoderOrientation';
import { readImageExif } from './exif';
import { decodeImageElement, type DecodedImage } from './imageDecode';
import {
  DEFAULT_ORIENTATION,
  orientationDraw,
  orientedSize,
  type ExifOrientation,
  type ImageSize,
} from './imageOrientation';

export const DEFAULT_MAX_IMAGE_SIDE = 1000;

const JPEG_QUALITY = 0.9;

export interface PrepareImageUploadOptions {
  maxImageSide?: number;
  /**
   * Ha meg van adva, a nagy kép mellé egy ekkora bélyeg is készül. A hívók
   * opt-in módon kérik: bélyeg nélkül a felület a nagy képre esik vissza.
   */
  thumbnailMaxSide?: number;
  /** Megszakításkor a folyamatban levő böngészőképes dekódolás is leáll. */
  signal?: AbortSignal;
}

function abortError(): DOMException {
  return new DOMException('A kép előkészítése megszakadt.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** A kis változat: ugyanaz a kép, ugyanabban a formátumban, kisebb pixelben. */
export interface PreparedImageThumbnail {
  blob: Blob;
  width: number;
  height: number;
}

export interface PreparedImageUpload {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  /** Az EXIF `DateTimeOriginal`, vagy `null`, ha a fájl nem hordozta. */
  capturedAt: IsoDateTimeString | null;
  /**
   * A bélyeg, vagy `null`, ha a hívó nem kért, illetve ha az eredeti már eleve
   * nem nagyobb a bélyegméretnél.
   */
  thumbnail: PreparedImageThumbnail | null;
}

export function getFileExtension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Egy méretkorlátra skálázott másolat a már dekódolt képből. A hívó ugyanazt a
 * dekódolt képet adhatja át többször — a fájl így egyszer dekódolódik, a
 * második, kisebb rajzolás szinte ingyen van.
 */
async function scaleDecodedImage(
  decoded: DecodedImage,
  orientation: ExifOrientation,
  size: ImageSize,
  maxSide: number,
  contentType: string,
  signal?: AbortSignal,
): Promise<PreparedImageThumbnail> {
  throwIfAborted(signal);
  const scale = maxSide / Math.max(size.width, size.height);
  const targetWidth = Math.max(1, Math.round(size.width * scale));
  const targetHeight = Math.max(1, Math.round(size.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Nem sikerült előkészíteni a kép átméretezését.');
  }

  // Az átméretezett kép már nem hordoz EXIF-et, ezért ha a forgatás ránk maradt,
  // bele kell égetni a pixelekbe. A bélyegre ugyanez a szabály áll.
  const draw = orientationDraw(orientation, targetWidth, targetHeight);
  context.setTransform(...draw.transform);
  context.drawImage(decoded.image, 0, 0, draw.drawWidth, draw.drawHeight);

  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal?.addEventListener('abort', abort, { once: true });
    canvas.toBlob(
      (nextBlob) => {
        signal?.removeEventListener('abort', abort);
        if (!signal?.aborted) resolve(nextBlob);
      },
      contentType,
      contentType === 'image/jpeg' ? JPEG_QUALITY : undefined,
    );
  });

  if (!blob) {
    throw new Error('Nem sikerült átméretezni a képet.');
  }

  return { blob, width: targetWidth, height: targetHeight };
}

export async function prepareImageUpload(
  file: File,
  options: PrepareImageUploadOptions = {},
): Promise<PreparedImageUpload> {
  const maxImageSide = options.maxImageSide ?? DEFAULT_MAX_IMAGE_SIDE;
  const thumbnailMaxSide = options.thumbnailMaxSide;
  const signal = options.signal;
  throwIfAborted(signal);
  // A három lépés független egymástól: az EXIF-olvasás, a kép dekódolása és a
  // dekóder-mérés párhuzamosan fut, hogy a lassú dekódolás ne szerializálódjon.
  const [exif, decoded, decoderRotates] = await Promise.all([
    readImageExif(file),
    decodeImageElement(file, signal),
    decoderAppliesExifOrientation(),
  ]);
  throwIfAborted(signal);
  // Ha a dekóder már elforgatta a képet, a dekódolt méret és a pixelek is
  // helyesek: ilyenkor nincs mit alkalmaznunk. Ha nem, ránk marad a forgatás.
  const pendingOrientation = decoderRotates
    ? DEFAULT_ORIENTATION
    : exif.orientation ?? DEFAULT_ORIENTATION;
  // png/webp esetén megtartjuk az eredeti formátumot, minden mást jpeg-be viszünk.
  const contentType =
    file.type === 'image/webp' || file.type === 'image/png' ? file.type : 'image/jpeg';

  const size = orientedSize(decoded, pendingOrientation);
  const longestSide = Math.max(size.width, size.height);

  // A nagy kép előbb készül el, a bélyeg utána: a hívók a nagy kép rajzolását
  // látják elsőnek, és a bélyeg a nagy képhez képest opcionális ráadás.
  const prepared =
    longestSide <= maxImageSide
      ? // Az eredeti fájl megy tovább, benne az EXIF-fel: a megjelenítésnél a
        // böngésző forgatja el. A méretet viszont már elforgatva adjuk vissza,
        // hogy a néző jó képarányt kapjon.
        { blob: file, width: size.width, height: size.height }
      : await scaleDecodedImage(decoded, pendingOrientation, size, maxImageSide, contentType, signal);

  // A bélyegméretnél nem nagyobb eredetihez nem készül külön változat: a
  // felület ilyenkor a nagy képre esik vissza, ami maga is elég kicsi.
  const thumbnail =
    thumbnailMaxSide !== undefined && longestSide > thumbnailMaxSide
      ? await scaleDecodedImage(
          decoded,
          pendingOrientation,
          size,
          thumbnailMaxSide,
          contentType,
          signal,
        )
      : null;

  return {
    ...prepared,
    contentType,
    capturedAt: exif.capturedAt,
    thumbnail,
  };
}
