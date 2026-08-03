// A kliensoldali kép-előkészítés egyetlen helye: a hívó adja a méretkorlátot,
// alapértelmezésben a dugvány- és munkamenetfotók 1000 px-e érvényes.
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
}

export function getFileExtension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function loadImage(file: File): Promise<{
  width: number;
  height: number;
  image: HTMLImageElement;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        image,
      });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Nem sikerült beolvasni a képet.'));
    };

    image.src = objectUrl;
  });
}

export async function prepareImageUpload(
  file: File,
  options: PrepareImageUploadOptions = {},
): Promise<PreparedImageUpload> {
  const maxImageSide = options.maxImageSide ?? DEFAULT_MAX_IMAGE_SIDE;
  const { width, height, image } = await loadImage(file);
  const longestSide = Math.max(width, height);
  // png/webp esetén megtartjuk az eredeti formátumot, minden mást jpeg-be viszünk.
  const contentType =
    file.type === 'image/webp' || file.type === 'image/png' ? file.type : 'image/jpeg';

  if (longestSide <= maxImageSide) {
    return {
      blob: file,
      width,
      height,
      contentType,
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

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

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
  };
}
