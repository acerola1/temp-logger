const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

initializeApp();

const db = getFirestore();
const DEVICE_TOKEN = defineSecret("DEVICE_TOKEN");
const LOCAL_DEVICE_TOKEN = process.env.LOCAL_DEVICE_TOKEN || "dev-token";

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Device-Token");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function pickDefined(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

async function getActiveSessionId() {
  const snapshot = await db
    .collection("sessions")
    .where("status", "==", "active")
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

function getExpectedToken() {
  return process.env.FUNCTIONS_EMULATOR
    ? LOCAL_DEVICE_TOKEN
    : DEVICE_TOKEN.value();
}

function isAuthorized(req) {
  const providedToken = req.get("X-Device-Token");
  const expectedToken = getExpectedToken();
  return !!providedToken && providedToken === expectedToken;
}

function logUnauthorizedRequest(req) {
  logger.warn("Unauthorized device request", {
    path: req.path,
    hasToken: !!req.get("X-Device-Token"),
    userAgent: req.get("User-Agent") || null,
  });
}

async function storeHealthReport(body) {
  const {
    deviceId,
    eventType,
    recordedAt,
    wakeupCause,
    resetReason,
    wifiStatus,
    rssi,
    ip,
    connectDurationMs,
    queuedReadingsCount,
    flushedReadingsCount,
    droppedReadingsCount,
    consecutiveFailures,
    lastHttpStatus,
    lastFailureReason,
    lastSuccessAt,
    lastFailureAt,
    freeHeap,
    recovered,
    note
  } = body || {};

  if (typeof deviceId !== "string" || typeof eventType !== "string") {
    return { ok: false, error: "invalid-health-payload", status: 400 };
  }

  const healthReport = pickDefined({
    deviceId,
    eventType,
    recordedAt: recordedAt || new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
    wakeupCause: typeof wakeupCause === "string" ? wakeupCause : undefined,
    resetReason: typeof resetReason === "string" ? resetReason : undefined,
    wifiStatus: typeof wifiStatus === "string" ? wifiStatus : undefined,
    rssi: typeof rssi === "number" ? rssi : undefined,
    ip: typeof ip === "string" ? ip : undefined,
    connectDurationMs:
      typeof connectDurationMs === "number" ? connectDurationMs : undefined,
    queuedReadingsCount:
      typeof queuedReadingsCount === "number" ? queuedReadingsCount : undefined,
    flushedReadingsCount:
      typeof flushedReadingsCount === "number" ? flushedReadingsCount : undefined,
    droppedReadingsCount:
      typeof droppedReadingsCount === "number" ? droppedReadingsCount : undefined,
    consecutiveFailures:
      typeof consecutiveFailures === "number" ? consecutiveFailures : undefined,
    lastHttpStatus:
      typeof lastHttpStatus === "number" ? lastHttpStatus : undefined,
    lastFailureReason:
      typeof lastFailureReason === "string" ? lastFailureReason : undefined,
    lastSuccessAt:
      typeof lastSuccessAt === "string" ? lastSuccessAt : undefined,
    lastFailureAt:
      typeof lastFailureAt === "string" ? lastFailureAt : undefined,
    freeHeap: typeof freeHeap === "number" ? freeHeap : undefined,
    recovered: typeof recovered === "boolean" ? recovered : undefined,
    note: typeof note === "string" ? note : undefined,
  });

  const docRef = await db.collection("deviceHealthReports").add(healthReport);
  logger.info("Stored device health report", {
    id: docRef.id,
    deviceId,
    eventType
  });

  return { ok: true, id: docRef.id, status: 201 };
}

async function ensureDeviceDocument(deviceId) {
  const deviceRef = db.collection("devices").doc(deviceId);
  const deviceSnapshot = await deviceRef.get();
  if (deviceSnapshot.exists) {
    return deviceRef;
  }

  await deviceRef.set({ name: deviceId });
  logger.info("Created device document", { deviceId });
  return deviceRef;
}

async function getActiveDeviceSessionId(deviceRef) {
  const snapshot = await deviceRef
    .collection("sessions")
    .where("status", "==", "active")
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

exports.ingestReading = onRequest(
  {
    region: "europe-west1",
    cors: false,
    secrets: [DEVICE_TOKEN]
  },
  async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    if (!isAuthorized(req)) {
      logUnauthorizedRequest(req);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const {
      kind = "reading",
      deviceId,
      temperatureC,
      humidity,
      recordedAt
    } = req.body || {};

    if (kind === "health") {
      const result = await storeHealthReport(req.body || {});
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.status(result.status).json({ ok: true, id: result.id });
      return;
    }

    if (
      kind !== "reading" ||
      typeof deviceId !== "string" ||
      typeof temperatureC !== "number" ||
      typeof humidity !== "number"
    ) {
      res.status(400).json({ error: "invalid-payload" });
      return;
    }

    const sessionId = await getActiveSessionId();

    const reading = {
      deviceId,
      temperatureC,
      humidity,
      recordedAt: recordedAt || new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      ...(sessionId && { sessionId })
    };

    const docRef = await db.collection("sensorReadings").add(reading);
    logger.info("Stored reading", { id: docRef.id, deviceId, sessionId });
    res.status(201).json({ ok: true, id: docRef.id });
  }
);

exports.ingestReadingV2 = onRequest(
  {
    region: "europe-west1",
    cors: false,
    secrets: [DEVICE_TOKEN]
  },
  async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    if (!isAuthorized(req)) {
      logUnauthorizedRequest(req);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const {
      kind = "reading",
      deviceId,
      temperatureC,
      humidity,
      recordedAt
    } = req.body || {};

    if (kind === "health") {
      const result = await storeHealthReport(req.body || {});
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.status(result.status).json({ ok: true, id: result.id });
      return;
    }

    if (
      kind !== "reading" ||
      typeof deviceId !== "string" ||
      typeof temperatureC !== "number" ||
      typeof humidity !== "number"
    ) {
      res.status(400).json({ error: "invalid-payload" });
      return;
    }

    const deviceRef = await ensureDeviceDocument(deviceId);
    const sessionId = await getActiveDeviceSessionId(deviceRef);

    const reading = {
      sessionId,
      temperatureC,
      humidity,
      recordedAt: recordedAt || new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    };

    const docRef = await deviceRef.collection("readings").add(reading);
    logger.info("Stored v2 reading", { id: docRef.id, deviceId, sessionId });
    res.status(201).json({ ok: true, id: docRef.id, sessionId });
  }
);
