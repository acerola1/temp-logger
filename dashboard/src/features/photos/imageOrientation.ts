// Az EXIF-orientáció vászonra fordítása. DOM nélküli, tiszta matematika, hogy a
// forgatás és a tükrözés egységteszttel bizonyítható legyen; a hívó csak megméri
// a képet, és a kapott transzformációt állítja be a 2d kontextusra.

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const DEFAULT_ORIENTATION: ExifOrientation = 1;

export interface ImageSize {
  width: number;
  height: number;
}

export interface OrientationDraw {
  /** `setTransform(a, b, c, d, e, f)` paraméterei. */
  transform: [number, number, number, number, number, number];
  /** A `drawImage` cél-szélessége, még a transzformáció előtti tengelyeken. */
  drawWidth: number;
  /** A `drawImage` cél-magassága, még a transzformáció előtti tengelyeken. */
  drawHeight: number;
}

export function isSupportedOrientation(value: number | null | undefined): value is ExifOrientation {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 8;
}

/** Az 5..8 orientációk 90 fokot forgatnak, tehát felcserélik a tengelyeket. */
export function orientationSwapsAxes(orientation: ExifOrientation): boolean {
  return orientation >= 5;
}

/** A nyers pixelméretből a megjelenítendő (elforgatás utáni) méret. */
export function orientedSize(size: ImageSize, orientation: ExifOrientation): ImageSize {
  return orientationSwapsAxes(orientation)
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * A `targetWidth`/`targetHeight` már a megjelenítendő (elforgatás utáni) vászon
 * mérete, a visszaadott `drawWidth`/`drawHeight` pedig a nyers kép mérete
 * ugyanabban a léptékben.
 */
export function orientationDraw(
  orientation: ExifOrientation,
  targetWidth: number,
  targetHeight: number,
): OrientationDraw {
  const swapped = orientationSwapsAxes(orientation);

  return {
    transform: orientationTransform(orientation, targetWidth, targetHeight),
    drawWidth: swapped ? targetHeight : targetWidth,
    drawHeight: swapped ? targetWidth : targetHeight,
  };
}

function orientationTransform(
  orientation: ExifOrientation,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0]; // vízszintes tükrözés
    case 3:
      return [-1, 0, 0, -1, width, height]; // 180 fok
    case 4:
      return [1, 0, 0, -1, 0, height]; // függőleges tükrözés
    case 5:
      return [0, 1, 1, 0, 0, 0]; // átló menti tükrözés
    case 6:
      return [0, 1, -1, 0, width, 0]; // 90 fok az óramutató irányába
    case 7:
      return [0, -1, -1, 0, width, height]; // ellenátló menti tükrözés
    case 8:
      return [0, -1, 1, 0, 0, height]; // 90 fok az óramutatóval szemben
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}
