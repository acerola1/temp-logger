// Minimális, függőség nélküli EXIF-olvasó. Szándékosan csak két tagot fejt ki:
// a `DateTimeOriginal`-t (a kép valódi készítési ideje) és az `Orientation`-t (a
// telefonnal elforgatva készült kép álló/fekvő helyzete). Minden más tagot
// átlép, és bármilyen hibás bemenetre `null`-okat ad vissza, sosem dob.
import { isValid, parse } from 'date-fns';
import type { IsoDateTimeString } from '../../types/datetime';
import { isSupportedOrientation, type ExifOrientation } from './imageOrientation';

export interface ExifMetadata {
  /** A `DateTimeOriginal` ISO-ban, vagy `null`, ha nincs vagy értelmezhetetlen. */
  capturedAt: IsoDateTimeString | null;
  /** Az `Orientation` 1..8 között, vagy `null`. */
  orientation: ExifOrientation | null;
}

export const EMPTY_EXIF_METADATA: ExifMetadata = { capturedAt: null, orientation: null };

// Az APP1 szegmens a jpeg elején van, és maga is legfeljebb 64 KB. 256 KB-ot
// olvasunk be belőle, hogy egy JFIF- vagy ICC-szegmens se szoríthassa ki.
const EXIF_SCAN_BYTES = 256 * 1024;

const JPEG_SOI = 0xffd8;
const MARKER_APP1 = 0xe1;
const MARKER_SOS = 0xda;
const TIFF_LITTLE_ENDIAN = 0x4949;
const TIFF_BIG_ENDIAN = 0x4d4d;
const TIFF_MAGIC = 0x002a;

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;

const TYPE_ASCII = 2;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
// `YYYY:MM:DD HH:MM:SS` + záró NUL; a NUL nélküli írókat is elfogadjuk.
const DATE_TIME_MIN_COUNT = 19;

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

interface IfdEntry {
  count: number;
  /** Az érték (vagy az értékre mutató offset) helye a bejegyzésben. */
  valueOffset: number;
}

/** Beolvassa a fájl elejét, és kiolvassa belőle a két EXIF-tagot. */
export async function readImageExif(file: Blob): Promise<ExifMetadata> {
  try {
    const head = file.slice(0, EXIF_SCAN_BYTES);
    return readExifMetadata(await head.arrayBuffer());
  } catch {
    return EMPTY_EXIF_METADATA;
  }
}

export function readExifMetadata(buffer: ArrayBuffer): ExifMetadata {
  try {
    return parseJpeg(new DataView(buffer));
  } catch {
    // Csonka vagy sérült blokk: a hívónak ugyanaz, mint a hiányzó EXIF.
    return EMPTY_EXIF_METADATA;
  }
}

// A jpeg szegmenslánc bejárása az első APP1/Exif szegmensig.
function parseJpeg(view: DataView): ExifMetadata {
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) {
    return EMPTY_EXIF_METADATA;
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      return EMPTY_EXIF_METADATA;
    }

    const marker = view.getUint8(offset + 1);
    if (marker === 0xff) {
      offset += 1; // Kitöltő bájt két marker között.
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2; // Hossz nélküli marker.
      continue;
    }
    if (marker === MARKER_SOS) {
      return EMPTY_EXIF_METADATA; // Innen már a képadat jön.
    }

    const length = view.getUint16(offset + 2);
    if (length < 2) {
      return EMPTY_EXIF_METADATA;
    }

    if (marker === MARKER_APP1 && hasExifHeader(view, offset + 4)) {
      const segmentEnd = Math.min(offset + 2 + length, view.byteLength);
      return parseTiff(view, offset + 4 + EXIF_HEADER.length, segmentEnd);
    }

    offset += 2 + length;
  }

  return EMPTY_EXIF_METADATA;
}

function hasExifHeader(view: DataView, offset: number): boolean {
  if (offset + EXIF_HEADER.length > view.byteLength) {
    return false;
  }

  return EXIF_HEADER.every((byte, index) => view.getUint8(offset + index) === byte);
}

// A TIFF-fejléc után az IFD0-ban van az Orientation és az Exif IFD mutatója, a
// DateTimeOriginal pedig már az Exif IFD-ben.
function parseTiff(view: DataView, tiffStart: number, end: number): ExifMetadata {
  if (tiffStart + 8 > end) {
    return EMPTY_EXIF_METADATA;
  }

  const byteOrder = view.getUint16(tiffStart);
  if (byteOrder !== TIFF_LITTLE_ENDIAN && byteOrder !== TIFF_BIG_ENDIAN) {
    return EMPTY_EXIF_METADATA;
  }

  const littleEndian = byteOrder === TIFF_LITTLE_ENDIAN;
  if (view.getUint16(tiffStart + 2, littleEndian) !== TIFF_MAGIC) {
    return EMPTY_EXIF_METADATA;
  }

  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
  const orientationEntry = findIfdEntry(view, tiffStart, ifd0Offset, littleEndian, end, {
    tag: TAG_ORIENTATION,
    type: TYPE_SHORT,
  });
  const exifPointerEntry = findIfdEntry(view, tiffStart, ifd0Offset, littleEndian, end, {
    tag: TAG_EXIF_IFD_POINTER,
    type: TYPE_LONG,
  });

  const orientation = orientationEntry
    ? view.getUint16(orientationEntry.valueOffset, littleEndian)
    : null;

  return {
    capturedAt: exifPointerEntry
      ? readDateTimeOriginal(
          view,
          tiffStart,
          view.getUint32(exifPointerEntry.valueOffset, littleEndian),
          littleEndian,
          end,
        )
      : null,
    orientation: isSupportedOrientation(orientation) ? orientation : null,
  };
}

function readDateTimeOriginal(
  view: DataView,
  tiffStart: number,
  exifIfdOffset: number,
  littleEndian: boolean,
  end: number,
): IsoDateTimeString | null {
  const entry = findIfdEntry(view, tiffStart, exifIfdOffset, littleEndian, end, {
    tag: TAG_DATE_TIME_ORIGINAL,
    type: TYPE_ASCII,
    minCount: DATE_TIME_MIN_COUNT,
  });
  if (!entry) {
    return null;
  }

  // A négy bájtnál hosszabb érték nem fér az bejegyzésbe, ott offset áll.
  const textStart =
    entry.count > 4 ? tiffStart + view.getUint32(entry.valueOffset, littleEndian) : entry.valueOffset;

  return parseExifDateTime(readAscii(view, textStart, entry.count - 1, end));
}

function findIfdEntry(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
  end: number,
  wanted: { tag: number; type: number; minCount?: number },
): IfdEntry | null {
  const base = tiffStart + ifdOffset;
  if (base < tiffStart || base + 2 > end) {
    return null;
  }

  const entryCount = view.getUint16(base, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entry = base + 2 + index * 12;
    if (entry + 12 > end) {
      return null;
    }
    if (view.getUint16(entry, littleEndian) !== wanted.tag) {
      continue;
    }

    const count = view.getUint32(entry + 4, littleEndian);
    if (view.getUint16(entry + 2, littleEndian) !== wanted.type || count < (wanted.minCount ?? 1)) {
      return null;
    }

    return { count, valueOffset: entry + 8 };
  }

  return null;
}

function readAscii(view: DataView, offset: number, length: number, end: number): string {
  if (offset < 0 || offset + length > end) {
    return '';
  }

  let text = '';
  for (let index = 0; index < length; index += 1) {
    const byte = view.getUint8(offset + index);
    if (byte === 0) {
      break;
    }
    text += String.fromCharCode(byte);
  }

  return text;
}

// A kamera helyi idejét írja a tagba időzóna nélkül, ezért a böngésző helyi
// idejeként értelmezzük. A naptárilag lehetetlen érték (`0000:00:00 00:00:00`,
// `2026:02:30`) érvénytelen dátumot ad, azt `null`-ra fordítjuk.
function parseExifDateTime(value: string): IsoDateTimeString | null {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }

  const date = parse(
    `${match[1]}-${match[2]}-${match[3]} ${match[4]}`,
    'yyyy-MM-dd HH:mm:ss',
    new Date(),
  );

  return isValid(date) ? date.toISOString() : null;
}
