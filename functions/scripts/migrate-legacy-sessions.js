#!/usr/bin/env node

/*
  Legacy -> v2 sessions migration
  Source: sessions/{sessionId}
  Target: devices/{deviceId}/sessions/{sessionId}

  Device mapping priority:
  1) sensorReadings.sessionId -> sensorReadings.deviceId mapping
  2) sessions/{sessionId}.deviceId field
  3) --default-device (default: legacy-device)

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
    sessionFilter: null,
    defaultDevice: 'legacy-device',
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

    if (arg.startsWith('--session=')) {
      const value = arg.split('=')[1]?.trim();
      if (value) {
        args.sessionFilter = value;
      }
      continue;
    }

    if (arg.startsWith('--default-device=')) {
      const value = arg.split('=')[1]?.trim();
      if (value) {
        args.defaultDevice = value;
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

function normalizeLegacySession(sessionId, data) {
  const startDate =
    toIsoString(data.startDate) || toIsoString(data.createdAt) || new Date().toISOString();

  const endDate = toIsoString(data.endDate);

  let status = data.status;
  if (status !== 'active' && status !== 'archived') {
    status = endDate ? 'archived' : 'active';
  }

  return {
    name:
      typeof data.name === 'string' && data.name.trim().length > 0
        ? data.name.trim()
        : `Legacy session ${sessionId}`,
    sessionTypeId:
      typeof data.sessionTypeId === 'string' && data.sessionTypeId.trim().length > 0
        ? data.sessionTypeId.trim()
        : 'callusing',
    status,
    startDate,
    endDate: endDate || null,
    legacySourceId: sessionId,
    migratedFromLegacy: true,
    legacyCreatedAt: toIsoString(data.createdAt),
    legacyUpdatedAt: toIsoString(data.updatedAt),
  };
}

function pickLegacyDeviceId(data) {
  if (typeof data.deviceId === 'string' && data.deviceId.trim().length > 0) {
    return data.deviceId.trim();
  }
  return null;
}

async function buildSessionDeviceMap(pageSize, debug) {
  const map = new Map();
  let lastDoc = null;
  let scanned = 0;

  while (true) {
    let query = db
      .collection('sensorReadings')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      scanned += 1;
      const data = doc.data();
      const sessionId =
        typeof data.sessionId === 'string' && data.sessionId.trim().length > 0
          ? data.sessionId.trim()
          : null;
      const deviceId =
        typeof data.deviceId === 'string' && data.deviceId.trim().length > 0
          ? data.deviceId.trim()
          : null;

      if (!sessionId || !deviceId) {
        continue;
      }

      if (!map.has(sessionId)) {
        map.set(sessionId, new Set());
      }
      map.get(sessionId).add(deviceId);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  if (debug) {
    console.log(`Session-device mapping built from sensorReadings, scanned: ${scanned}`);
    console.log(`Mapped session IDs: ${map.size}`);
  }

  return map;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const projectId =
    admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG || 'unknown';

  console.log('Legacy sessions migration');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Page size: ${args.pageSize}`);
  console.log(`Default device: ${args.defaultDevice}`);
  if (args.limit) {
    console.log(`Limit: ${args.limit}`);
  }
  if (args.sessionFilter) {
    console.log(`Session filter: ${args.sessionFilter}`);
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
      const probe = await db.collection('sessions').limit(args.sampleSize).get();
      console.log(`sessions probe size: ${probe.size}`);
      if (!probe.empty) {
        for (const doc of probe.docs) {
          const keys = Object.keys(doc.data()).sort().join(', ');
          console.log(`- sample session: ${doc.id} | keys: ${keys}`);
        }
      }
    } catch (error) {
      console.log(`sessions probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const sessionToDevices = await buildSessionDeviceMap(args.pageSize, args.debug);

  let scanned = 0;
  let matchedFilter = 0;
  let prepared = 0;
  let sessionsWithNoMapping = 0;
  let writes = 0;
  let ensuredDeviceWrites = 0;
  let targetDocsPrepared = 0;

  const touchedDevices = new Set();
  const ensuredDeviceDocs = new Set();

  let lastDoc = null;
  let done = false;

  while (!done) {
    let query = db.collection('sessions').orderBy(admin.firestore.FieldPath.documentId()).limit(args.pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    let batch = args.apply ? db.batch() : null;
    let batchOps = 0;

    for (const doc of snapshot.docs) {
      if (args.limit && scanned >= args.limit) {
        done = true;
        break;
      }

      scanned += 1;

      if (args.sessionFilter && doc.id !== args.sessionFilter) {
        continue;
      }

      matchedFilter += 1;

      const data = doc.data();
      const normalized = normalizeLegacySession(doc.id, data);
      const explicitDevice = pickLegacyDeviceId(data);
      const mappedDevices = sessionToDevices.get(doc.id) ? Array.from(sessionToDevices.get(doc.id)) : [];

      let targetDevices = [...mappedDevices];
      if (explicitDevice && !targetDevices.includes(explicitDevice)) {
        targetDevices.push(explicitDevice);
      }
      if (targetDevices.length === 0) {
        targetDevices = [args.defaultDevice];
        sessionsWithNoMapping += 1;
      }

      prepared += 1;
      targetDocsPrepared += targetDevices.length;

      for (const deviceId of targetDevices) {
        touchedDevices.add(deviceId);

        if (args.apply && batch) {
          if (!ensuredDeviceDocs.has(deviceId)) {
            const deviceRef = db.collection('devices').doc(deviceId);
            batch.set(
              deviceRef,
              {
                name: deviceId,
                updatedAt: startedAt,
                legacyMigratedAt: startedAt,
              },
              { merge: true },
            );
            ensuredDeviceDocs.add(deviceId);
            ensuredDeviceWrites += 1;
            batchOps += 1;
          }

          const targetRef = db.collection('devices').doc(deviceId).collection('sessions').doc(doc.id);
          batch.set(
            targetRef,
            {
              ...normalized,
              deviceId,
              migratedAt: startedAt,
              updatedAt: startedAt,
            },
            { merge: true },
          );

          writes += 1;
          batchOps += 1;

          if (batchOps >= 450) {
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
          }
        }
      }
    }

    if (args.apply && batch && batchOps > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log('\nSummary');
  console.log(`- scanned: ${scanned}`);
  console.log(`- matched-filter: ${matchedFilter}`);
  console.log(`- prepared-sessions: ${prepared}`);
  console.log(`- target-session-docs: ${targetDocsPrepared}`);
  console.log(`- sessions-without-mapping: ${sessionsWithNoMapping}`);
  console.log(`- devices-touched: ${touchedDevices.size}`);
  console.log(`- device-doc-upserts: ${args.apply ? ensuredDeviceWrites : 0}`);
  console.log(`- written-session-docs: ${args.apply ? writes : 0}`);

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
