// A `functions/scripts/migrate-vine-photos.js` migráció emulátoros tesztje. A
// scriptet valódi alfolyamatként futtatja, mert az elfogadás nemcsak az átírt
// dokumentumról szól: a mód, a kilépési kód és a kiírt célpont is a szerződés
// része. A tesztek saját projektazonosítón dolgoznak, hogy a többi integrációs
// teszt tőkéi ne kerüljenek a migráció útjába.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applicationDefault,
  deleteApp as deleteAdminApp,
  initializeApp as initializeAdminApp,
} from 'firebase-admin/app';
import {
  FieldPath,
  getFirestore as getAdminFirestore,
  Timestamp as AdminTimestamp,
} from 'firebase-admin/firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const scriptPath = path.join(repoRoot, 'functions', 'scripts', 'migrate-vine-photos.js');

const BACKUP_REFERENCE = 'emulator-fixture-dump';

interface MigrationRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runMigration(projectId: string, args: string[]): MigrationRun {
  const result = spawnSync(process.execPath, [scriptPath, `--project=${projectId}`, ...args], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) throw result.error;

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A kulcsokat rendezve írja ki, hogy két olvasás lenyomata összevethető legyen. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

async function vinesDigest(db: AdminFirestore): Promise<string> {
  const snapshot = await db.collection('vines').orderBy(FieldPath.documentId()).get();
  return stableStringify(snapshot.docs.map((doc) => [doc.id, doc.data()]));
}

async function clearVines(db: AdminFirestore): Promise<void> {
  const snapshot = await db.collection('vines').get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

function legacyPhoto(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    storagePath: `vines/regi-tokel/events/regi-esemeny/photos/${id}.jpg`,
    downloadUrl: `https://example.test/${id}.jpg`,
    width: 1280,
    height: 960,
    thumbnail: {
      storagePath: `vines/regi-tokel/events/regi-esemeny/photos/${id}_thumb.jpg`,
      downloadUrl: `https://example.test/${id}_thumb.jpg`,
      width: 120,
      height: 90,
    },
    capturedAt: '2026-05-01T10:00:00.000Z',
    uploadedAt: '2026-05-02T10:00:00.000Z',
    caption: `${id} felirata`,
    ...overrides,
  };
}

/** A bélyeg és az EXIF előtti fotórekord: ezek a mezők nincsenek is benne. */
function photoWithoutExifOrThumbnail(id: string): Record<string, unknown> {
  const photo = legacyPhoto(id, { capturedAt: null });
  delete photo.thumbnail;
  return photo;
}

const EVENT_TIMESTAMP = AdminTimestamp.fromDate(new Date('2026-05-01T09:30:00.000Z'));

function legacyEvent(
  id: string,
  photos: unknown,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    type: 'observation',
    occurredAt: '2026-05-01T09:00:00.000Z',
    title: `${id} címe`,
    notes: `${id} jegyzete`,
    photos,
    createdAt: EVENT_TIMESTAMP,
    updatedAt: EVENT_TIMESTAMP,
    ...overrides,
  };
}

function withoutPhotos(event: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...event };
  delete copy.photos;
  return copy;
}

function legacyVine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    serialNumber: 1,
    variety: 'Migrációs teszt',
    hasFruited: false,
    rootType: 'unknown',
    rootstockVariety: '',
    plantingYear: null,
    areaDescription: 'Migrációs terület',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    events: [],
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    createdByUid: 'admin-1',
    ...overrides,
  };
}

// A migráció mindent a `vines` kollekcióból olvas, tehát nem szabad éles
// projektre mutatnia. Emulátor nélkül a teszt inkább elhasal, mint hogy kísérletezzen.
function requireEmulator(): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('A migrációs teszt csak Firestore-emulátorral futhat.');
  }
}

describe('Tőkefotó-migrációs script', () => {
  const projectId = 'demo-esp32-vine-photo-migration';
  const adminApp = initializeAdminApp(
    { credential: applicationDefault(), projectId },
    'vine-photo-migration',
  );
  const adminDb = getAdminFirestore(adminApp);

  const multiEventPhotos = [legacyPhoto('p-elso'), legacyPhoto('p-masodik')];
  const multiEventSecondPhotos = [legacyPhoto('p-harmadik')];
  const multiEventFirst = legacyEvent('esemeny-1', multiEventPhotos);
  const multiEventSecond = legacyEvent('esemeny-2', multiEventSecondPhotos);

  const noExifPhoto = photoWithoutExifOrThumbnail('p-exif-nelkul');
  const thumbnailPhoto = legacyPhoto('p-belyeggel');

  // Az ütköző fotó tartalma szándékosan más, hogy a teszt lássa, melyik példány
  // kapott új azonosítót.
  const collidingPhoto = legacyPhoto('kozos', {
    storagePath: 'vines/regi-tokel/events/utkozes-2/photos/kozos.jpg',
    caption: 'a második esemény fotója',
  });
  const collisionFirst = legacyEvent('utkozes-1', [legacyPhoto('kozos'), legacyPhoto('kozos-2')]);
  const collisionSecond = legacyEvent('utkozes-2', [collidingPhoto]);

  const migratedPhoto = legacyPhoto('p-mar-migralt');
  const partialRootPhoto = legacyPhoto('p-gyokeren');
  const partialEvent = legacyEvent('reszleges-1', [legacyPhoto('p-esemenyben')]);

  const fixtures: Array<[string, Record<string, unknown>]> = [
    // 1. több esemény több fotóval és érvényes kézi borítóval
    [
      'vine-01-multi-event',
      legacyVine({
        serialNumber: 1,
        events: [multiEventFirst, multiEventSecond],
        coverPhoto: { eventId: 'esemeny-2', photoId: 'p-harmadik' },
      }),
    ],
    // 2. EXIF nélküli, bélyeg nélküli régi fotó
    [
      'vine-02-no-exif',
      legacyVine({ serialNumber: 2, events: [legacyEvent('exif-1', [noExifPhoto])] }),
    ],
    // 3. bélyegképpel rendelkező fotó
    [
      'vine-03-thumbnail',
      legacyVine({ serialNumber: 3, events: [legacyEvent('belyeg-1', [thumbnailPhoto])] }),
    ],
    // 4a. hiányzó fotóra mutató borító
    [
      'vine-04-cover-dangling',
      legacyVine({
        serialNumber: 4,
        events: [legacyEvent('borito-1', [legacyPhoto('p-egyetlen')])],
        coverPhoto: { eventId: 'nincs-ilyen-esemeny', photoId: 'p-egyetlen' },
      }),
    ],
    // 4b. hibás alakú borító
    [
      'vine-05-cover-broken',
      legacyVine({
        serialNumber: 5,
        events: [legacyEvent('borito-2', [legacyPhoto('p-masik')])],
        coverPhoto: 'nem-objektum',
      }),
    ],
    // 5. két eseményben ütköző fotóazonosító, a borító a másodikra mutat
    [
      'vine-06-collision',
      legacyVine({
        serialNumber: 6,
        events: [collisionFirst, collisionSecond],
        coverPhoto: { eventId: 'utkozes-2', photoId: 'kozos' },
      }),
    ],
    // 6. fotó nélküli tőke
    [
      'vine-07-no-photos',
      legacyVine({ serialNumber: 7, events: [legacyEvent('fotomentes-1', [])] }),
    ],
    // 7. már migrált tőke
    [
      'vine-08-already-migrated',
      legacyVine({
        serialNumber: 8,
        events: [withoutPhotos(legacyEvent('kesz-1', []))],
        photos: [migratedPhoto],
        coverPhotoId: 'p-mar-migralt',
      }),
    ],
    // 8/a. részlegesen migrált tőke: gyökérszintű és eseményfotó egyszerre
    [
      'vine-09-partial',
      legacyVine({
        serialNumber: 9,
        events: [partialEvent],
        photos: [partialRootPhoto],
        coverPhotoId: 'p-gyokeren',
      }),
    ],
    // 8/b. részben hibás rekord: az eszköz nem írhat csonka eredményt
    [
      'vine-10-invalid',
      legacyVine({
        serialNumber: 10,
        events: [
          legacyEvent('hibas-1', [
            legacyPhoto('p-jo'),
            { id: 'p-hibas', downloadUrl: 'https://example.test/p-hibas.jpg' },
          ]),
        ],
      }),
    ],
  ];

  beforeAll(async () => {
    requireEmulator();
    await clearVines(adminDb);
    await Promise.all(
      fixtures.map(([vineId, data]) => adminDb.collection('vines').doc(vineId).set(data)),
    );
  });

  afterAll(async () => {
    await clearVines(adminDb);
    await deleteAdminApp(adminApp);
  });

  it('a `--verify` mód írás nélkül, nem nulla kóddal jelzi a hátralévő tőkéket', async () => {
    const digestBefore = await vinesDigest(adminDb);

    const run = runMigration(projectId, ['--verify']);

    expect(run.status).toBe(1);
    expect(run.stdout).toContain(`Project: ${projectId}`);
    expect(run.stdout).toContain(`Firestore emulator ${process.env.FIRESTORE_EMULATOR_HOST}`);
    expect(run.stdout).toContain('Mode: verify');
    expect(run.stdout).toContain('Verify failed. The dashboard must not be deployed yet.');
    expect(run.stdout).toContain('- needs-migration: 8');
    expect(run.stdout).toContain('- skipped-invalid: 1');
    expect(run.stdout).toContain('- already-migrated: 1');
    // A hibás és a részlegesen migrált tőke azonosítója is kiírásra kerül.
    expect(run.stdout).toContain('vine-10-invalid [invalid]');
    expect(run.stdout).toContain('vine-09-partial [pending]');
    expect(run.stdout).toContain('partially migrated');
    expect(await vinesDigest(adminDb)).toBe(digestBefore);
  });

  it('kapcsoló nélkül dry-runban fut, egyetlen dokumentumot sem ír, és a hibás tőkét megnevezi', async () => {
    const digestBefore = await vinesDigest(adminDb);

    const run = runMigration(projectId, []);

    // A hibás rekord miatt a dry-run sem hallgat: nem nulla kóddal lép ki.
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('Mode: dry-run');
    expect(run.stdout).toContain('Dry-run only. No data was written.');
    expect(run.stdout).toContain('Run with --apply --backup-verified=<reference> to migrate.');
    expect(run.stdout).toContain('- needs-migration: 8');
    expect(run.stdout).toContain('- photos-migrated: 11');
    expect(run.stdout).toContain('- photo-id-collisions: 1');
    expect(run.stdout).toContain('- broken-cover-references: 2');
    expect(run.stdout).toContain('- partially-migrated: 1');
    expect(run.stdout).toContain('vine-10-invalid [invalid]: events[0].photos[1]');
    expect(await vinesDigest(adminDb)).toBe(digestBefore);
  });

  it('ellenőrzött mentés hivatkozása nélkül nem indul el az `--apply`', async () => {
    const digestBefore = await vinesDigest(adminDb);

    const run = runMigration(projectId, ['--apply']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('--backup-verified');
    expect(run.stderr).toContain('Nothing was read or written.');
    expect(await vinesDigest(adminDb)).toBe(digestBefore);
  });

  it('elgépelt kapcsolóra nem esik vissza csendben dry-runra', async () => {
    const run = runMigration(projectId, ['--verfy']);

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('unknown argument: --verfy');
  });

  it('a cutover-kaput nem engedi leszűkíteni, és nem létező tőkére sem fut zöldre', async () => {
    // Szűkített `--verify` a hátralévő tőkék mellett is nullát adna.
    expect(runMigration(projectId, ['--verify', '--limit=1']).status).toBe(1);
    expect(runMigration(projectId, ['--verify', '--vine=vine-08-already-migrated']).stderr).toContain(
      '--verify cannot be scoped with --vine',
    );

    const missing = runMigration(projectId, ['--vine=nincs-ilyen-toke']);

    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain('the requested vine does not exist');
  });

  it('az `--apply` a dry-runban jelzett tőkéket alakítja át, a hibást kihagyja', async () => {
    const invalidBefore = (await adminDb.collection('vines').doc('vine-10-invalid').get()).data();

    const run = runMigration(projectId, ['--apply', `--backup-verified=${BACKUP_REFERENCE}`]);

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('Mode: apply');
    expect(run.stdout).toContain(`Backup verified: ${BACKUP_REFERENCE}`);
    expect(run.stdout).toContain('- pending-before-run: 8');
    expect(run.stdout).toContain('- migrated: 8');
    expect(run.stdout).toContain('- skipped-invalid: 1');
    expect(run.stdout).toContain('- failed: 0');
    expect(run.stdout).toContain('Apply finished with errors.');

    // A hibás tőke egyetlen mezője sem változott: nincs csonka eredmény.
    const invalidAfter = (await adminDb.collection('vines').doc('vine-10-invalid').get()).data();
    expect(stableStringify(invalidAfter)).toBe(stableStringify(invalidBefore));
  });

  it('a több eseményből származó fotókat metaadatostul a gyökérbe emeli', async () => {
    const data = (await adminDb.collection('vines').doc('vine-01-multi-event').get()).data();

    expect(data?.photos).toEqual([...multiEventPhotos, ...multiEventSecondPhotos]);
    expect(data?.coverPhotoId).toBe('p-harmadik');
    expect('coverPhoto' in (data ?? {})).toBe(false);
    // Az eseményekből csak a `photos` mező tűnt el.
    expect(data?.events).toEqual([withoutPhotos(multiEventFirst), withoutPhotos(multiEventSecond)]);
    expect(data?.events[0].createdAt).toEqual(EVENT_TIMESTAMP);
  });

  it('az EXIF és bélyeg nélküli régi fotót változatlanul, a bélyegest bélyegestül viszi át', async () => {
    const noExif = (await adminDb.collection('vines').doc('vine-02-no-exif').get()).data();
    const withThumbnail = (await adminDb.collection('vines').doc('vine-03-thumbnail').get()).data();

    expect(noExif?.photos).toEqual([noExifPhoto]);
    expect('thumbnail' in noExif!.photos[0]).toBe(false);
    expect(noExif?.photos[0].capturedAt).toBeNull();
    expect(noExif?.coverPhotoId).toBeNull();

    expect(withThumbnail?.photos).toEqual([thumbnailPhoto]);
    expect(withThumbnail?.photos[0].thumbnail).toEqual(thumbnailPhoto.thumbnail);
  });

  it('a hiányzó és a hibás alakú borítóhivatkozásból `null` lesz', async () => {
    const dangling = (await adminDb.collection('vines').doc('vine-04-cover-dangling').get()).data();
    const broken = (await adminDb.collection('vines').doc('vine-05-cover-broken').get()).data();

    expect(dangling?.coverPhotoId).toBeNull();
    expect('coverPhoto' in (dangling ?? {})).toBe(false);
    expect(dangling?.photos).toHaveLength(1);

    expect(broken?.coverPhotoId).toBeNull();
    expect('coverPhoto' in (broken ?? {})).toBe(false);
    expect(broken?.photos).toHaveLength(1);
  });

  it('azonosító-ütközésnél minden fotó megmarad, és a borító a helyes példányra mutat', async () => {
    const data = (await adminDb.collection('vines').doc('vine-06-collision').get()).data();

    // A már foglalt `kozos-2` nem lophatóel: az ütköző fotó `kozos-3` lesz.
    expect(data?.photos.map((photo: { id: string }) => photo.id)).toEqual([
      'kozos',
      'kozos-2',
      'kozos-3',
    ]);
    expect(data?.photos[0]).toEqual(legacyPhoto('kozos'));
    expect(data?.photos[2]).toEqual({ ...collidingPhoto, id: 'kozos-3' });
    expect(data?.coverPhotoId).toBe('kozos-3');
  });

  it('a fotó nélküli tőke üres galériát és automatikus borítót kap', async () => {
    const data = (await adminDb.collection('vines').doc('vine-07-no-photos').get()).data();

    expect(data?.photos).toEqual([]);
    expect(data?.coverPhotoId).toBeNull();
    expect('photos' in data!.events[0]).toBe(false);
  });

  it('a részlegesen migrált tőkét a gyökérfotók megtartásával fejezi be', async () => {
    const data = (await adminDb.collection('vines').doc('vine-09-partial').get()).data();

    expect(data?.photos).toEqual([partialRootPhoto, ...(partialEvent.photos as unknown[])]);
    expect(data?.coverPhotoId).toBe('p-gyokeren');
    expect('photos' in data!.events[0]).toBe(false);
  });

  it('a már migrált tőkét nem írja át', async () => {
    const data = (await adminDb.collection('vines').doc('vine-08-already-migrated').get()).data();

    expect(data?.photos).toEqual([migratedPhoto]);
    expect(data?.coverPhotoId).toBe('p-mar-migralt');
    expect(data?.updatedAt).toBe('2026-04-01T08:00:00.000Z');
  });

  it('másodszor futtatva nulla további módosítást jelez, és nem ír', async () => {
    const digestBefore = await vinesDigest(adminDb);

    const run = runMigration(projectId, ['--apply', `--backup-verified=${BACKUP_REFERENCE}`]);

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('- pending-before-run: 0');
    expect(run.stdout).toContain('- migrated: 0');
    expect(run.stdout).toContain('- already-migrated: 9');
    expect(await vinesDigest(adminDb)).toBe(digestBefore);
  });

  it('a hibás tőke rendezése után a `--verify` nullával zöldre fordul', async () => {
    await adminDb.collection('vines').doc('vine-10-invalid').delete();

    const run = runMigration(projectId, ['--verify']);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('- needs-migration: 0');
    expect(run.stdout).toContain('- skipped-invalid: 0');
    expect(run.stdout).toContain('Verify passed. Every vine uses the standalone photo model.');
  });

  it('a scriptben nincs Storage-művelet', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).not.toMatch(/\.storage\b/);
    expect(source).not.toMatch(/\bbucket\s*\(/);
    expect(source).not.toMatch(/firebase-admin\/storage/);
  });
});

describe('Tőkefotó-migráció megszakadt futás után', () => {
  const projectId = 'demo-esp32-vine-photo-migration-resume';
  const adminApp = initializeAdminApp(
    { credential: applicationDefault(), projectId },
    'vine-photo-migration-resume',
  );
  const adminDb = getAdminFirestore(adminApp);

  beforeAll(async () => {
    requireEmulator();
    await clearVines(adminDb);
    await Promise.all(
      ['vine-a', 'vine-b', 'vine-c'].map((vineId, index) =>
        adminDb
          .collection('vines')
          .doc(vineId)
          .set(
            legacyVine({
              serialNumber: index + 1,
              events: [legacyEvent(`${vineId}-esemeny`, [legacyPhoto(`${vineId}-foto`)])],
            }),
          ),
      ),
    );
  });

  afterAll(async () => {
    await clearVines(adminDb);
    await deleteAdminApp(adminApp);
  });

  it('a félbeszakadt futás után a migrált tőkék érvényesek, a futás pedig folytatható', async () => {
    // A `--limit` ugyanazt hagyja maga után, mint egy megszakított futás: az
    // első tőkék készen vannak, a többi érintetlen.
    const partial = runMigration(projectId, [
      '--apply',
      `--backup-verified=${BACKUP_REFERENCE}`,
      '--limit=2',
    ]);

    expect(partial.status).toBe(0);
    expect(partial.stdout).toContain('- migrated: 2');

    const migrated = await adminDb.collection('vines').doc('vine-a').get();
    expect(migrated.data()?.photos).toEqual([legacyPhoto('vine-a-foto')]);
    expect(migrated.data()?.coverPhotoId).toBeNull();

    const untouched = await adminDb.collection('vines').doc('vine-c').get();
    expect(untouched.data()?.events[0].photos).toHaveLength(1);
    expect('photos' in (untouched.data() ?? {})).toBe(false);

    // A közbenső állapot még nem cutover-kész.
    expect(runMigration(projectId, ['--verify']).status).toBe(1);

    const resumed = runMigration(projectId, ['--apply', `--backup-verified=${BACKUP_REFERENCE}`]);
    expect(resumed.status).toBe(0);
    expect(resumed.stdout).toContain('- already-migrated: 2');
    expect(resumed.stdout).toContain('- migrated: 1');

    const verify = runMigration(projectId, ['--verify']);
    expect(verify.status).toBe(0);
    expect(verify.stdout).toContain('Verify passed.');
  });
});
