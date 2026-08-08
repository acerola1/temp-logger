// Egyetlen kép-dekódolási út: `<img>` elem egy object URL-lel. A dekódolt méret
// az, amit a böngésző megjelenítendőnek tart, tehát ha a böngésző alkalmazza az
// EXIF-orientációt, akkor ez már az elforgatott méret.

export interface DecodedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
}

function abortError(): DOMException {
  return new DOMException('A kép előkészítése megszakadt.', 'AbortError');
}

export function decodeImageElement(source: Blob, signal?: AbortSignal): Promise<DecodedImage> {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(source);
    const image = new Image();

    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      URL.revokeObjectURL(objectUrl);
    };

    const abort = () => {
      image.onload = null;
      image.onerror = null;
      image.src = '';
      cleanup();
      reject(abortError());
    };

    signal?.addEventListener('abort', abort, { once: true });

    image.onload = () => {
      cleanup();
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      cleanup();
      reject(new Error('Nem sikerült beolvasni a képet.'));
    };

    image.src = objectUrl;
  });
}
