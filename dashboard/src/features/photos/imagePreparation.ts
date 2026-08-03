// A kliensoldali kép-előkészítés egyetlen helye: a hívó adja a méretkorlátot,
// alapértelmezésben a dugvány- és munkamenetfotók 1000 px-e érvényes.
import type { IsoDateTimeString } from '../../types/datetime';
import { decoderAppliesExifOrientation } from './decoderOrientation';
import { readImageExif } from './exif';
import { decodeImageElement } from './imageDecode';
import { DEFAULT_ORIENTATION, orientationDraw, orientedSize } from './imageOrientation';

export const DEFAULT_MAX_IMAGE_SIDE = 1000;

const JPEG_QUALITY = 0.9;

export interface PrepareImageUploadOptions {
  maxImageSide?: number;
}

export interface PreparedImageUpload {
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  /** Az EXIF `DateTimeOriginal`, vagy `null`, ha a fájl nem hordozta. */
  capturedAt: IsoDateTimeString | null;
}

export function getFileExtension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function prepareImageUpload(
  file: File,
  options: PrepareImageUploadOptions = {},
): Promise<PreparedImageUpload> {
  const maxImageSide = options.maxImageSide ?? DEFAULT_MAX_IMAGE_SIDE;
  // A három lépés független egymástól: az EXIF-olvasás, a kép dekódolása és a
  // dekóder-mérés párhuzamosan fut, hogy a lassú dekódolás ne szerializálódjon.
  const [exif, decoded, decoderRotates] = await Promise.all([
    readImageExif(file),
    decodeImageElement(file),
    decoderAppliesExifOrientation(),
  ]);
  // Ha a dekóder már elforgatta a képet, a dekódolt méret és a pixelek is
  // helyesek: ilyenkor nincs mit alkalmaznunk. Ha nem, ránk marad a forgatás.
  const pendingOrientation = decoderRotates
    ? DEFAULT_ORIENTATION
    : exif.orientation ?? DEFAULT_ORIENTATION;
  // png/webp esetén megtartjuk az eredeti formátumot, minden mást jpeg-be viszünk.
  const contentType =
    file.type === 'image/webp' || file.type === 'image/png' ? file.type : 'image/jpeg';

  const { width, height } = orientedSize(decoded, pendingOrientation);
  const longestSide = Math.max(width, height);

  if (longestSide <= maxImageSide) {
    // Az eredeti fájl megy tovább, benne az EXIF-fel: a megjelenítésnél a
    // böngésző forgatja el. A méretet viszont már elforgatva adjuk vissza, hogy
    // a néző jó képarányt kapjon.
    return {
      blob: file,
      width,
      height,
      contentType,
      capturedAt: exif.capturedAt,
    };
  }

  const scale = maxImageSide / longestSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Nem sikerült előkészíteni a kép átméretezését.');
  }

  // Az átméretezett kép már nem hordoz EXIF-et, ezért ha a forgatás ránk maradt,
  // bele kell égetni a pixelekbe.
  const draw = orientationDraw(pendingOrientation, targetWidth, targetHeight);
  context.setTransform(...draw.transform);
  context.drawImage(decoded.image, 0, 0, draw.drawWidth, draw.drawHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (nextBlob) => resolve(nextBlob),
      contentType,
      contentType === 'image/jpeg' ? JPEG_QUALITY : undefined,
    );
  });

  if (!blob) {
    throw new Error('Nem sikerült átméretezni a képet.');
  }

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    contentType,
    capturedAt: exif.capturedAt,
  };
}
