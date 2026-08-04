import { describe, expect, it } from 'vitest';
import {
  photoDateLabel,
  photoDateText,
  photoLightboxCaption,
  photoThumbnailUrl,
  toPhotoRecord,
} from './photoMetadata';

const CAPTURED_AT = new Date(2026, 4, 2, 10, 11, 12).toISOString();
const UPLOADED_AT = new Date(2026, 7, 3, 17, 0, 0).toISOString();
const THUMBNAIL = {
  storagePath: 'cuttings/c1/photos/photo-1_thumb.jpg',
  downloadUrl: 'https://example.test/photo-1_thumb.jpg',
  width: 320,
  height: 240,
};

describe('photoDateLabel', () => {
  it('a készítési időt mutatja, ha az EXIF-ből megvan', () => {
    expect(
      photoDateLabel({
        capturedAt: '2026-05-02T08:11:12.000Z',
        uploadedAt: '2026-08-03T15:00:00.000Z',
      }),
    ).toEqual({
      isCaptured: true,
      prefix: 'Készült',
      value: '2026-05-02T08:11:12.000Z',
    });
  });

  it('készítési idő nélkül a feltöltés idejét mutatja, és ezt ki is mondja', () => {
    expect(
      photoDateLabel({ capturedAt: null, uploadedAt: '2026-08-03T15:00:00.000Z' }),
    ).toEqual({
      isCaptured: false,
      prefix: 'Feltöltve',
      value: '2026-08-03T15:00:00.000Z',
    });
  });
});

describe('photoDateText', () => {
  it('a címkét és a formázott dátumot egy sorba fűzi', () => {
    expect(photoDateText({ capturedAt: CAPTURED_AT, uploadedAt: UPLOADED_AT })).toBe(
      'Készült: 2026.05.02. 10:11',
    );
    expect(photoDateText({ capturedAt: null, uploadedAt: UPLOADED_AT })).toBe(
      'Feltöltve: 2026.08.03. 17:00',
    );
  });
});

describe('photoLightboxCaption', () => {
  it('az extra részeket, a feliratot és a dátumsort fűzi össze', () => {
    expect(
      photoLightboxCaption(
        { capturedAt: CAPTURED_AT, uploadedAt: UPLOADED_AT, caption: 'Első fürt' },
        'Megfigyelés',
      ),
    ).toBe('Megfigyelés • Első fürt • Készült: 2026.05.02. 10:11');
  });

  it('az üres részeket kihagyja', () => {
    expect(photoLightboxCaption({ capturedAt: null, uploadedAt: UPLOADED_AT, caption: '' })).toBe(
      'Feltöltve: 2026.08.03. 17:00',
    );
  });
});

describe('toPhotoRecord', () => {
  it('a feltöltés eredményéből üres felirattal képez rekordot', () => {
    expect(
      toPhotoRecord(
        {
          id: 'photo-1',
          storagePath: 'cuttings/c1/photos/photo-1.jpg',
          downloadUrl: 'https://example.test/photo-1.jpg',
          width: 1000,
          height: 750,
          thumbnail: THUMBNAIL,
          capturedAt: CAPTURED_AT,
        },
        UPLOADED_AT,
      ),
    ).toEqual({
      id: 'photo-1',
      storagePath: 'cuttings/c1/photos/photo-1.jpg',
      downloadUrl: 'https://example.test/photo-1.jpg',
      width: 1000,
      height: 750,
      thumbnail: THUMBNAIL,
      capturedAt: CAPTURED_AT,
      uploadedAt: UPLOADED_AT,
      caption: '',
    });
  });

  it('bélyeg nélküli feltöltésből bélyeg nélküli rekord lesz', () => {
    expect(
      toPhotoRecord(
        {
          id: 'photo-2',
          storagePath: 'cuttings/c1/photos/photo-2.jpg',
          downloadUrl: 'https://example.test/photo-2.jpg',
          width: 200,
          height: 150,
          thumbnail: null,
          capturedAt: null,
        },
        UPLOADED_AT,
      ).thumbnail,
    ).toBeNull();
  });
});

describe('photoThumbnailUrl', () => {
  it('a bélyeg URL-jét adja, ha van bélyeg', () => {
    expect(
      photoThumbnailUrl({ downloadUrl: 'https://example.test/photo-1.jpg', thumbnail: THUMBNAIL }),
    ).toBe(THUMBNAIL.downloadUrl);
  });

  it('bélyeg nélkül a nagy képre esik vissza', () => {
    expect(
      photoThumbnailUrl({ downloadUrl: 'https://example.test/photo-1.jpg', thumbnail: null }),
    ).toBe('https://example.test/photo-1.jpg');
  });

  it('üres bélyeg-URL esetén is a nagy képet adja, nem üres keretet', () => {
    expect(
      photoThumbnailUrl({
        downloadUrl: 'https://example.test/photo-1.jpg',
        thumbnail: { ...THUMBNAIL, downloadUrl: '' },
      }),
    ).toBe('https://example.test/photo-1.jpg');
  });
});
