// Kiméri, hogy a böngésző dekódolója maga alkalmazza-e az EXIF-orientációt.
//
// Erre azért van szükség, mert a mai böngészők (Chrome, Safari, Firefox) az
// `image-orientation: from-image` alapértelmezés miatt már elforgatva adják a
// képet — méretben és pixelben is. Ha ilyenkor mi is elforgatnánk, kétszer
// fordulna el. A régebbi motorok viszont a nyers pixeleket adják, és ott ránk
// marad a forgatás. Mérünk, nem feltételezünk.
import { decodeImageElement } from './imageDecode';

// 2×1 nyers méretű jpeg `Orientation = 6` EXIF-fel. Ha a dekóder alkalmazza az
// orientációt, 1×2-ként (állóként) jön vissza.
const PROBE_JPEG_BASE64 =
  '/9j/4QAoRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAAAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAaEAEAAQUAAAAAAAAAAAAAAAAAAQIDM3Kx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwb/xAAZEQABBQAAAAAAAAAAAAAAAAAAAQIDM3H/2gAMAwEAAhEDEQA/AJC9mr2noC3gqbiAzWO1T//Z';

let probe: Promise<boolean> | null = null;

/** A mérés eredménye, munkamenetenként egyszer kiszámolva. */
export function decoderAppliesExifOrientation(): Promise<boolean> {
  probe ??= runProbe();

  return probe;
}

/** Csak tesztekhez: eldobja a gyorsítótárazott mérést. */
export function resetDecoderOrientationProbe(): void {
  probe = null;
}

async function runProbe(): Promise<boolean> {
  try {
    const { width, height } = await decodeImageElement(toProbeBlob());

    return height > width;
  } catch {
    // Ha a mérés nem megy (nincs `Image`, nem dekódolható), inkább nem
    // forgatunk: a duplán elfordított kép rosszabb, mint az érintetlen.
    return true;
  }
}

function toProbeBlob(): Blob {
  const binary = atob(PROBE_JPEG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: 'image/jpeg' });
}
