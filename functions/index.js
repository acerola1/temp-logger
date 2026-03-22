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

async function getActiveSessionId() {
  const snapshot = await db
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

    const providedToken = req.get("X-Device-Token");
    const expectedToken = process.env.FUNCTIONS_EMULATOR
      ? LOCAL_DEVICE_TOKEN
      : DEVICE_TOKEN.value();

    if (!providedToken || providedToken !== expectedToken) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const { deviceId, temperatureC, humidity, recordedAt } = req.body || {};

    if (
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
