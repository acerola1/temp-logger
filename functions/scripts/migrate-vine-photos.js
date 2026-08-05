#!/usr/bin/env node

/*
  Vine event photos -> standalone vine photos migration
  Source: vines/{vineId}.events[].photos[] and vines/{vineId}.coverPhoto
  Target: vines/{vineId}.photos[] and vines/{vineId}.coverPhotoId

  Storage objects are never read, copied, renamed or deleted. Migrated records
  keep their existing storagePath, downloadUrl and thumbnail values, so the old
  binaries stay exactly where they are.

  Modes:
    (default)  dry-run: reports what would change, writes nothing
    --verify   reports every vine that is not fully migrated, writes nothing
    --apply    migrates each pending vine in a single Firestore transaction

  --apply also requires --backup-verified=<reference>: the Firestore export or
  checked JSON dump the run can be rolled back to. The reference is echoed into
  the run header so the log shows which backup the write was based on.

  See docs/runbooks/migrate-vine-photos.md for the full cutover order.
*/

const admin = require('firebase-admin');

const VINES_COLLECTION = 'vines';
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
// Findings are printed per vine. A broken collection would otherwise bury the
// summary, so the listing is capped -- and the cap reports what it left out.
const MAX_LISTED_FINDINGS = 50;

const MODE_DRY_RUN = 'dry-run';
const MODE_APPLY = 'apply';
const MODE_VERIFY = 'verify';

const REQUIRED_PHOTO_STRINGS = ['id', 'storagePath', 'downloadUrl'];

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgs(argv) {
  const args = {
    mode: MODE_DRY_RUN,
    projectId: null,
    pageSize: DEFAULT_PAGE_SIZE,
    limit: null,
    vineFilter: null,
    backupVerified: null,
    errors: [],
  };

  let apply = false;
  let verify = false;

  for (const arg of argv) {
    const separator = arg.indexOf('=');
    const flag = separator === -1 ? arg : arg.slice(0, separator);
    const rawValue = separator === -1 ? null : arg.slice(separator + 1).trim();

    if (flag === '--apply' && rawValue === null) {
      apply = true;
      continue;
    }

    if (flag === '--verify' && rawValue === null) {
      verify = true;
      continue;
    }

    if (flag === '--project') {
      if (!rawValue) args.errors.push('--project needs a project id');
      else args.projectId = rawValue;
      continue;
    }

    if (flag === '--backup-verified') {
      if (!rawValue) args.errors.push('--backup-verified needs a backup reference');
      else args.backupVerified = rawValue;
      continue;
    }

    if (flag === '--vine') {
      if (!rawValue) args.errors.push('--vine needs a vine id');
      else args.vineFilter = rawValue;
      continue;
    }

    if (flag === '--page-size') {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value <= 0 || value > MAX_PAGE_SIZE) {
        args.errors.push(`--page-size must be between 1 and ${MAX_PAGE_SIZE}`);
      } else {
        args.pageSize = Math.floor(value);
      }
      continue;
    }

    if (flag === '--limit') {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value <= 0) {
        args.errors.push('--limit must be a positive number');
      } else {
        args.limit = Math.floor(value);
      }
      continue;
    }

    // An unknown flag is never treated as a harmless extra: a mistyped --verify
    // would otherwise dry-run, exit zero and read as a green cutover gate.
    args.errors.push(`unknown argument: ${arg}`);
  }

  if (apply && verify) {
    args.errors.push('--apply and --verify cannot be combined');
  }
  if (apply) args.mode = MODE_APPLY;
  else if (verify) args.mode = MODE_VERIFY;

  // --verify gates the dashboard deploy, so it must always see the whole
  // collection: a scoped verify would exit zero while legacy vines remain.
  if (args.mode === MODE_VERIFY && args.limit !== null) {
    args.errors.push('--verify cannot be scoped with --limit');
  }
  if (args.mode === MODE_VERIFY && args.vineFilter) {
    args.errors.push('--verify cannot be scoped with --vine');
  }

  if (args.mode === MODE_APPLY && !args.backupVerified) {
    args.errors.push(
      '--apply requires --backup-verified=<reference>: a Firestore export or checked JSON dump',
    );
  }

  return args;
}

function photoProblem(photo, location) {
  if (!isPlainObject(photo)) {
    return `${location}: the photo record is not an object`;
  }

  for (const field of REQUIRED_PHOTO_STRINGS) {
    const value = photo[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return `${location}: missing or invalid \`${field}\``;
    }
  }

  return null;
}

function sourceKey(eventId, photoId) {
  // JSON keeps the pair unambiguous: no id containing the separator character
  // can collide with a different event/photo pair.
  return JSON.stringify([eventId, photoId]);
}

function invalidPlan(reasons) {
  return {
    state: 'invalid',
    reasons,
    photos: null,
    coverPhotoId: null,
    events: null,
    rewriteEvents: false,
    hasLegacyCoverField: false,
    legacyPhotoCount: 0,
    renamedPhotoCount: 0,
    coverIssue: false,
    partiallyMigrated: false,
  };
}

/**
 * The whole per-vine decision, as a pure function of the stored document. The
 * apply path recomputes it inside the transaction, so a dry-run and the real
 * write can never disagree about what a vine should become.
 */
function planVineMigration(data) {
  const shapeErrors = [];

  const rawEvents = hasOwn(data, 'events') ? data.events : [];
  if (!Array.isArray(rawEvents)) {
    shapeErrors.push('the `events` field is not an array');
  }

  const hasRootPhotosField = hasOwn(data, 'photos');
  const rawRootPhotos = hasRootPhotosField ? data.photos : [];
  if (!Array.isArray(rawRootPhotos)) {
    shapeErrors.push('the root `photos` field is not an array');
  }

  if (shapeErrors.length > 0) {
    return invalidPlan(shapeErrors);
  }

  const recordErrors = [];
  // Photo order: whatever already sits at the root first, then the event photos
  // in event order. The stored order carries no domain meaning, but a stable one
  // keeps reruns and dry-run output comparable.
  const entries = [];

  rawRootPhotos.forEach((photo, index) => {
    const problem = photoProblem(photo, `photos[${index}]`);
    if (problem) recordErrors.push(problem);
    else entries.push({ photo, sourceEventId: null, sourcePhotoId: photo.id });
  });

  const events = [];
  let rewriteEvents = false;
  let legacyPhotoCount = 0;
  let eventsWithPhotoField = 0;

  rawEvents.forEach((event, eventIndex) => {
    if (!isPlainObject(event)) {
      recordErrors.push(`events[${eventIndex}]: the event is not an object`);
      return;
    }

    if (!hasOwn(event, 'photos')) {
      events.push(event);
      return;
    }

    rewriteEvents = true;
    eventsWithPhotoField += 1;

    const eventPhotos = event.photos;
    const eventId = typeof event.id === 'string' ? event.id : null;

    if (Array.isArray(eventPhotos)) {
      eventPhotos.forEach((photo, photoIndex) => {
        const problem = photoProblem(photo, `events[${eventIndex}].photos[${photoIndex}]`);
        if (problem) {
          recordErrors.push(problem);
          return;
        }
        legacyPhotoCount += 1;
        entries.push({ photo, sourceEventId: eventId, sourcePhotoId: photo.id });
      });
    } else if (eventPhotos !== null) {
      recordErrors.push(`events[${eventIndex}].photos: the field is neither null nor an array`);
    }

    const migratedEvent = { ...event };
    delete migratedEvent.photos;
    events.push(migratedEvent);
  });

  if (recordErrors.length > 0) {
    return invalidPlan(recordErrors);
  }

  const originalIds = new Set(entries.map((entry) => entry.photo.id));
  const assignedIds = new Set();
  const idBySource = new Map();
  const photos = [];
  let renamedPhotoCount = 0;

  for (const entry of entries) {
    const originalId = entry.photo.id;
    let assignedId = originalId;

    if (assignedIds.has(assignedId)) {
      // Deterministic and collision-free: the suffix walks up until it hits an
      // id that neither an earlier photo nor a still unprocessed one owns.
      let suffix = 2;
      do {
        assignedId = `${originalId}-${suffix}`;
        suffix += 1;
      } while (assignedIds.has(assignedId) || originalIds.has(assignedId));
      renamedPhotoCount += 1;
    }

    assignedIds.add(assignedId);
    photos.push(assignedId === originalId ? entry.photo : { ...entry.photo, id: assignedId });

    const key = sourceKey(entry.sourceEventId, entry.sourcePhotoId);
    if (!idBySource.has(key)) idBySource.set(key, assignedId);
  }

  const hasLegacyCoverField = hasOwn(data, 'coverPhoto');
  const legacyCover = hasLegacyCoverField ? data.coverPhoto : null;
  let coverPhotoId = null;
  let coverIssue = false;

  if (isPlainObject(legacyCover)) {
    if (typeof legacyCover.eventId === 'string' && typeof legacyCover.photoId === 'string') {
      // The pointer follows the same id mapping the photos went through, so a
      // renamed photo does not lose its manual cover.
      const mapped = idBySource.get(sourceKey(legacyCover.eventId, legacyCover.photoId));
      if (mapped) coverPhotoId = mapped;
      else coverIssue = true;
    } else {
      coverIssue = true;
    }
  } else if (hasLegacyCoverField && legacyCover !== null) {
    coverIssue = true;
  } else if (typeof data.coverPhotoId === 'string') {
    if (assignedIds.has(data.coverPhotoId)) coverPhotoId = data.coverPhotoId;
    else coverIssue = true;
  } else if (hasOwn(data, 'coverPhotoId') && data.coverPhotoId !== null) {
    coverIssue = true;
  }

  const coverPhotoIdUpToDate = hasOwn(data, 'coverPhotoId') && data.coverPhotoId === coverPhotoId;
  const reasons = [];

  if (legacyPhotoCount > 0) {
    reasons.push(
      `legacy event photos: ${legacyPhotoCount} photo(s) in ${eventsWithPhotoField} event(s)`,
    );
  } else if (eventsWithPhotoField > 0) {
    reasons.push(`empty legacy \`photos\` field in ${eventsWithPhotoField} event(s)`);
  }
  if (hasLegacyCoverField) reasons.push('legacy `coverPhoto` field');
  if (!hasRootPhotosField) reasons.push('missing root `photos` array');
  if (!coverPhotoIdUpToDate) reasons.push('missing or stale `coverPhotoId`');
  if (renamedPhotoCount > 0) reasons.push(`duplicate photo ids: ${renamedPhotoCount}`);

  const partiallyMigrated = hasRootPhotosField && (eventsWithPhotoField > 0 || hasLegacyCoverField);
  if (partiallyMigrated) reasons.push('partially migrated: root and legacy photos coexist');

  return {
    state: reasons.length === 0 ? 'migrated' : 'legacy',
    reasons,
    photos,
    coverPhotoId,
    events,
    rewriteEvents,
    hasLegacyCoverField,
    legacyPhotoCount,
    renamedPhotoCount,
    coverIssue,
    partiallyMigrated,
  };
}

/**
 * One vine, one atomic write. The plan is recomputed from the transactional
 * read, so a vine either lands fully migrated or stays exactly as it was.
 */
async function migrateVine(db, fieldValue, vineId) {
  return db.runTransaction(async (transaction) => {
    const ref = db.collection(VINES_COLLECTION).doc(vineId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      return { state: 'vanished', reasons: ['the vine disappeared during the run'] };
    }

    const plan = planVineMigration(snapshot.data());
    if (plan.state !== 'legacy') {
      return plan;
    }

    const update = { photos: plan.photos, coverPhotoId: plan.coverPhotoId };
    if (plan.rewriteEvents) update.events = plan.events;
    if (plan.hasLegacyCoverField) update.coverPhoto = fieldValue.delete();

    transaction.update(ref, update);
    return plan;
  });
}

async function* iterateVines({ db, pageSize, limit, vineFilter }) {
  if (vineFilter) {
    const snapshot = await db.collection(VINES_COLLECTION).doc(vineFilter).get();
    if (snapshot.exists) yield snapshot;
    return;
  }

  let lastDoc = null;
  let yielded = 0;

  while (true) {
    let query = db
      .collection(VINES_COLLECTION)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) return;

    for (const doc of snapshot.docs) {
      if (limit !== null && yielded >= limit) return;
      yielded += 1;
      yield doc;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
}

async function runVinePhotoMigration({
  db,
  fieldValue,
  mode = MODE_DRY_RUN,
  pageSize = DEFAULT_PAGE_SIZE,
  limit = null,
  vineFilter = null,
  log = console.log,
}) {
  const summary = {
    mode,
    scanned: 0,
    alreadyMigrated: 0,
    pending: 0,
    migrated: 0,
    invalid: 0,
    failed: 0,
    photosMigrated: 0,
    renamedPhotos: 0,
    coverIssues: 0,
    partiallyMigrated: 0,
  };
  const findings = [];

  for await (const doc of iterateVines({ db, pageSize, limit, vineFilter })) {
    summary.scanned += 1;
    const plan = planVineMigration(doc.data());

    if (plan.state === 'invalid') {
      summary.invalid += 1;
      findings.push({ vineId: doc.id, kind: 'invalid', reasons: plan.reasons });
      continue;
    }

    if (plan.state === 'migrated') {
      summary.alreadyMigrated += 1;
      continue;
    }

    summary.pending += 1;
    summary.photosMigrated += plan.legacyPhotoCount;
    summary.renamedPhotos += plan.renamedPhotoCount;
    if (plan.coverIssue) summary.coverIssues += 1;
    if (plan.partiallyMigrated) summary.partiallyMigrated += 1;
    findings.push({ vineId: doc.id, kind: 'pending', reasons: plan.reasons });

    if (mode !== MODE_APPLY) continue;

    try {
      const applied = await migrateVine(db, fieldValue, doc.id);
      if (applied.state === 'legacy') {
        summary.migrated += 1;
      } else {
        // The transactional read disagreed with the scan: something wrote to the
        // vine mid-run, which the documented write-stop should have prevented.
        summary.failed += 1;
        findings.push({
          vineId: doc.id,
          kind: 'failed',
          reasons: [`skipped, the document changed during the run (${applied.state})`],
        });
      }
    } catch (error) {
      summary.failed += 1;
      findings.push({
        vineId: doc.id,
        kind: 'failed',
        reasons: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  if (vineFilter && summary.scanned === 0) {
    // A mistyped vine id would otherwise scan nothing and report a clean run.
    findings.push({
      vineId: vineFilter,
      kind: 'failed',
      reasons: ['the requested vine does not exist'],
    });
    summary.failed += 1;
  }

  const blocking = findings.filter((finding) => finding.kind !== 'pending');
  const listed = mode === MODE_APPLY ? blocking : findings;

  if (listed.length > 0) {
    log('\nFindings');
    for (const finding of listed.slice(0, MAX_LISTED_FINDINGS)) {
      log(`- ${finding.vineId} [${finding.kind}]: ${finding.reasons.join('; ')}`);
    }
    if (listed.length > MAX_LISTED_FINDINGS) {
      log(`- ... and ${listed.length - MAX_LISTED_FINDINGS} more vine(s) not listed`);
    }
  }

  log('\nSummary');
  log(`- scanned: ${summary.scanned}`);
  log(`- already-migrated: ${summary.alreadyMigrated}`);
  log(`- ${mode === MODE_APPLY ? 'pending-before-run' : 'needs-migration'}: ${summary.pending}`);
  if (mode === MODE_APPLY) log(`- migrated: ${summary.migrated}`);
  log(`- skipped-invalid: ${summary.invalid}`);
  log(`- failed: ${summary.failed}`);
  log(`- photos-migrated: ${summary.photosMigrated}`);
  log(`- photo-id-collisions: ${summary.renamedPhotos}`);
  log(`- broken-cover-references: ${summary.coverIssues}`);
  log(`- partially-migrated: ${summary.partiallyMigrated}`);

  const hasErrors = summary.invalid > 0 || summary.failed > 0;
  let exitCode = hasErrors ? 1 : 0;

  if (mode === MODE_VERIFY) {
    // The cutover gate: anything short of a fully migrated collection blocks the
    // dashboard deploy.
    if (summary.pending > 0) exitCode = 1;
    log(
      exitCode === 0
        ? '\nVerify passed. Every vine uses the standalone photo model.'
        : '\nVerify failed. The dashboard must not be deployed yet.',
    );
  } else if (mode === MODE_APPLY) {
    log(
      hasErrors
        ? '\nApply finished with errors. Re-run after fixing the listed vines.'
        : '\nApply finished. No Storage object was touched.',
    );
  } else {
    log('\nDry-run only. No data was written.');
    log('Run with --apply --backup-verified=<reference> to migrate.');
  }

  return { ...summary, findings, exitCode };
}

function createAdminContext({ projectId = null, appName = null } = {}) {
  const options = projectId ? { projectId } : {};
  const app = appName ? admin.initializeApp(options, appName) : admin.initializeApp(options);

  return {
    app,
    db: app.firestore(),
    fieldValue: admin.firestore.FieldValue,
    projectId: app.options.projectId || process.env.GCLOUD_PROJECT || 'unknown',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Vine photo migration: events[].photos[] -> photos[]');

  if (args.errors.length > 0) {
    for (const error of args.errors) console.error(`Argument error: ${error}`);
    console.error('Nothing was read or written.');
    process.exitCode = 1;
    return;
  }

  const { db, fieldValue, projectId } = createAdminContext({ projectId: args.projectId });
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || null;

  // The target has to be unmistakable before anything is read: this script can
  // rewrite every vine document in the project it is pointed at.
  console.log(`Project: ${projectId}`);
  console.log(`Target: ${emulatorHost ? `Firestore emulator ${emulatorHost}` : 'LIVE Firestore'}`);
  console.log(`Mode: ${args.mode}`);
  console.log(`Page size: ${args.pageSize}`);
  if (args.limit !== null) console.log(`Limit: ${args.limit}`);
  if (args.vineFilter) console.log(`Vine filter: ${args.vineFilter}`);
  if (args.backupVerified) console.log(`Backup verified: ${args.backupVerified}`);

  const summary = await runVinePhotoMigration({
    db,
    fieldValue,
    mode: args.mode,
    pageSize: args.pageSize,
    limit: args.limit,
    vineFilter: args.vineFilter,
  });

  process.exitCode = summary.exitCode;
}

module.exports = {
  MODE_APPLY,
  MODE_DRY_RUN,
  MODE_VERIFY,
  createAdminContext,
  migrateVine,
  parseArgs,
  planVineMigration,
  runVinePhotoMigration,
};

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}
