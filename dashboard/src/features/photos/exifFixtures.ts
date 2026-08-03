// Csak tesztekhez: minimális, valódi bájtszerkezetű jpeg-eket állít elő EXIF
// APP1 szegmenssel, hogy a parser ne mockolt adatot kapjon.

/** Saját (nem megosztott) bufferre mutató bájtsor, hogy `Blob`-ba is átadható legyen. */
export type JpegBytes = Uint8Array<ArrayBuffer>;

export interface ExifTiffOptions {
  littleEndian?: boolean;
  orientation?: number | null;
  dateTimeOriginal?: string | null;
  /** Elrontott TIFF-magic: a parsernek `null`-t kell adnia. */
  brokenMagic?: boolean;
  /** Elrontott bájtsorrend-jelölő. */
  brokenByteOrder?: boolean;
}

const TAG_ORIENTATION = 0x0112;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_LENGTH = 20; // 19 karakter + záró NUL

export function buildExifTiff(options: ExifTiffOptions = {}): JpegBytes {
  const littleEndian = options.littleEndian ?? true;
  const orientation = options.orientation ?? null;
  const dateTimeOriginal = options.dateTimeOriginal ?? null;

  const ifd0Offset = 8;
  const ifd0Count = (orientation === null ? 0 : 1) + (dateTimeOriginal === null ? 0 : 1);
  const exifIfdOffset = ifd0Offset + 2 + ifd0Count * 12 + 4;
  const exifCount = dateTimeOriginal === null ? 0 : 1;
  const asciiOffset = exifIfdOffset + 2 + exifCount * 12 + 4;
  const bytes = new Uint8Array(asciiOffset + (dateTimeOriginal === null ? 0 : DATE_TIME_LENGTH));
  const view = new DataView(bytes.buffer);

  view.setUint16(0, options.brokenByteOrder ? 0x0000 : littleEndian ? 0x4949 : 0x4d4d);
  view.setUint16(2, options.brokenMagic ? 0x0000 : 0x002a, littleEndian);
  view.setUint32(4, ifd0Offset, littleEndian);

  view.setUint16(ifd0Offset, ifd0Count, littleEndian);
  let entry = ifd0Offset + 2;
  if (orientation !== null) {
    view.setUint16(entry, TAG_ORIENTATION, littleEndian);
    view.setUint16(entry + 2, 3, littleEndian); // SHORT
    view.setUint32(entry + 4, 1, littleEndian);
    view.setUint16(entry + 8, orientation, littleEndian);
    entry += 12;
  }
  if (dateTimeOriginal !== null) {
    view.setUint16(entry, TAG_EXIF_IFD_POINTER, littleEndian);
    view.setUint16(entry + 2, 4, littleEndian); // LONG
    view.setUint32(entry + 4, 1, littleEndian);
    view.setUint32(entry + 8, exifIfdOffset, littleEndian);
  }
  view.setUint32(ifd0Offset + 2 + ifd0Count * 12, 0, littleEndian); // nincs IFD1

  view.setUint16(exifIfdOffset, exifCount, littleEndian);
  if (dateTimeOriginal !== null) {
    const exifEntry = exifIfdOffset + 2;
    view.setUint16(exifEntry, TAG_DATE_TIME_ORIGINAL, littleEndian);
    view.setUint16(exifEntry + 2, 2, littleEndian); // ASCII
    view.setUint32(exifEntry + 4, DATE_TIME_LENGTH, littleEndian);
    view.setUint32(exifEntry + 8, asciiOffset, littleEndian);
    for (let index = 0; index < DATE_TIME_LENGTH - 1; index += 1) {
      bytes[asciiOffset + index] = dateTimeOriginal.charCodeAt(index) || 0x20;
    }
  }
  view.setUint32(exifIfdOffset + 2 + exifCount * 12, 0, littleEndian);

  return bytes;
}

export function buildJpegSegment(marker: number, payload: JpegBytes): JpegBytes {
  const segment = new Uint8Array(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = marker;
  new DataView(segment.buffer).setUint16(2, payload.length + 2);
  segment.set(payload, 4);

  return segment;
}

export function buildExifApp1(tiff: JpegBytes): JpegBytes {
  const payload = new Uint8Array(6 + tiff.length);
  payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0); // "Exif\0\0"
  payload.set(tiff, 6);

  return buildJpegSegment(0xe1, payload);
}

export function buildJpeg(...segments: JpegBytes[]): JpegBytes {
  const parts = [new Uint8Array([0xff, 0xd8]), ...segments, new Uint8Array([0xff, 0xd9])];
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

/** Kész jpeg a megadott EXIF-tagokkal. */
export function buildExifJpeg(options: ExifTiffOptions = {}): JpegBytes {
  return buildJpeg(buildExifApp1(buildExifTiff(options)));
}

export function toArrayBuffer(bytes: JpegBytes): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
