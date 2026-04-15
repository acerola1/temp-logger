#!/usr/bin/env node

/*
  Legacy -> v2 readings migration
  Source: sensorReadings/{readingId}
  Target: devices/{deviceId}/readings/legacy-{readingId}

  Default mode is dry-run. Use --apply to write.
*/

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    debug: false,
    pageSize: 400,
    limit: null,
    deviceFilter: null,
    sampleSize: 3,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      args.apply = true;
      continue;
    }

    if (arg === '--debug') {
      args.debug = true;
      continue;
    }

    if (arg.startsWith('--page-size=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0 && value <= 500) {
        args.pageSize = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0) {
        args.limit = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith('--device=')) {
      const value = arg.split('=')[1]?.trim();
      if (value) {
        args.deviceFilter = value;
      }
      continue;
    }

    if (arg.startsWith('--sample-size=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isFinite(value) && value > 0 && value <= 20) {
        args.sampleSize = Math.floor(value);
      }
    }
  }

  return args;
}

function toIsoString(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : value;
  }

  if (typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch (_err) {
      return null;
    }
  }

  return null;
}

function normalizeReading(sourceId, data) {
  const deviceId =
    typeof data.deviceId === 'string' && data.deviceId.trim().length > 0
      ? data.deviceId.trim()
      : 'legacy-device';

  const temperatureC = Number(data.temperatureC);
  const humidity = Number(data.humidity);

  if (!Number.isFinite(temperatureC) || !Number.isFinite(humidity)) {
    return { ok: false, reason: 'invalid-numeric', sourceId };
  }

  const recordedAt = toIsoString(data.recordedAt) || toIsoString(data.createdAt) || new Date().toISOString();

  const sessionId =
    typeof data.sessionId === 'string' && data.sessionId.trim().length > 0
      ? data.sessionId.trim()
      : null;

  const legacyCreatedAt = toIsoString(data.createdAt);

  return {
    ok: true,
    sourceId,
    deviceId,
    payload: {
      deviceId,
      temperatureC,
      humidity,
      recordedAt,
      sessionId,
      legacySourceId: sourceId,
      migratedFromLegacy: true,
      legacyCreatedAt,
    },
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const projectId =
    admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG || 'unknown';

  console.log('Legacy readings migration');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Page size: ${args.pageSize}`);
  if (args.limit) {
    console.log(`Limit: ${args.limit}`);
  }
  if (args.deviceFilter) {
    console.log(`Device filter: ${args.deviceFilter}`);
  }
  if (args.debug) {
    console.log(`Debug: on (sample-size=${args.sampleSize})`);
  }

  if (args.debug) {
    try {
      const topLevelCollections = await db.listCollections();
      const names = topLevelCollections.map((col) => col.id).sort();
      console.log(`Top-level collections (${names.length}): ${names.join(', ') || '(none)'}`);
    } catch (error) {
      console.log(`Top-level collections list failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const probe = await db.collection('sensorReadings').limit(args.sampleSize).get();
      console.log(`sensorReadings probe size: ${probe.size}`);
      if (!probe.empty) {
        for (const doc of probe.docs) {
          const data = doc.data();
          const keys = Object.keys(data).sort().join(', ');
          console.log(`- sample doc: ${doc.id} | keys: ${keys}`);
        }
      }
    } catch (error) {
      console.log(`sensorReadings probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let scanned = 0;
  let matchedFilter = 0;
  let prepared = 0;
  let skippedInvalid = 0;
  let written = 0;
  let writeOps = 0;

  const touchedDevices = new Set();
  const ensuredDeviceDocs = new Set();

  let lastDoc = null;
  let done = false;

  while (!done) {
    let query = db.collection('sensorReadings').orderBy(admin.firestore.FieldPath.documentId()).limit(args.pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    let batch = args.apply ? db.batch() : null;

    for (const doc of snapshot.docs) {
      if (args.limit && scanned >= args.limit) {
        done = true;
        break;
      }

      scanned += 1;
      const normalized = normalizeReading(doc.id, doc.data());

      if (!normalized.ok) {
        skippedInvalid += 1;
        continue;
      }

      if (args.deviceFilter && normalized.deviceId !== args.deviceFilter) {
        continue;
      }

      matchedFilter += 1;
      prepared += 1;
      touchedDevices.add(normalized.deviceId);

      if (args.apply && batch) {
        const readingRef = db
          .collection('devices')
          .doc(normalized.deviceId)
          .collection('readings')
          .doc(`legacy-${normalized.sourceId}`);

        if (!ensuredDeviceDocs.has(normalized.deviceId)) {
          const deviceRef = db.collection('devices').doc(normalized.deviceId);
          batch.set(
            deviceRef,
            {
              name: normalized.deviceId,
              updatedAt: startedAt,
              legacyMigratedAt: startedAt,
            },
            { merge: true },
          );
          writeOps += 1;
          ensuredDeviceDocs.add(normalized.deviceId);
        }

        batch.set(readingRef, {
          ...normalized.payload,
          updatedAt: startedAt,
          migratedAt: startedAt,
        });
        writeOps += 1;
        written += 1;

        if (writeOps >= 450) {
          await batch.commit();
          batch = db.batch();
          writeOps = 0;
        }
      }
    }

    if (args.apply && batch && writeOps > 0) {
      await batch.commit();
      writeOps = 0;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log('\nSummary');
  console.log(`- scanned: ${scanned}`);
  console.log(`- matched-filter: ${matchedFilter}`);
  console.log(`- prepared: ${prepared}`);
  console.log(`- skipped-invalid: ${skippedInvalid}`);
  console.log(`- devices-touched: ${touchedDevices.size}`);
  console.log(`- written: ${args.apply ? written : 0}`);

  if (!args.apply) {
    console.log('\nDry-run only. No data was written.');
    console.log('Run with --apply to execute the migration copy step.');
  } else {
    console.log('\nApply finished. Legacy data was NOT deleted.');
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
