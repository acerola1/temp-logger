#!/usr/bin/env node

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST nincs beállítva.')
  process.exit(1)
}

const projectId = process.env.GCLOUD_PROJECT || 'demo-esp32-e2e'
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const adminEmail = process.env.VITE_E2E_ADMIN_EMAIL || 'admin-e2e@example.com'
const adminPassword = process.env.VITE_E2E_ADMIN_PASSWORD || 'Admin1234!'
const webApiKey = process.env.VITE_FIREBASE_API_KEY || 'test-api-key'

initializeApp({ projectId })
const db = getFirestore()

const now = Date.now()
const iso = (offsetMs) => new Date(now + offsetMs).toISOString()

async function upsertE2EAdminUser() {
  const signUpUrl = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${webApiKey}`
  const signInUrl = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${webApiKey}`

  const signUpResp = await fetch(signUpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      returnSecureToken: true,
    }),
  })
  const signUpData = await signUpResp.json()

  if (signUpResp.ok && signUpData.localId) {
    return signUpData.localId
  }

  const message = signUpData?.error?.message
  if (message !== 'EMAIL_EXISTS') {
    throw new Error(`Auth signUp hiba: ${message ?? 'ismeretlen'}`)
  }

  const signInResp = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      returnSecureToken: true,
    }),
  })
  const signInData = await signInResp.json()

  if (!signInResp.ok || !signInData.localId) {
    throw new Error(`Auth signIn hiba: ${signInData?.error?.message ?? 'ismeretlen'}`)
  }

  return signInData.localId
}

async function seed() {
  const deviceId = 'device-e2e-1'
  const sessionId = 'session-e2e-1'
  const adminUid = await upsertE2EAdminUser()

  await db.doc(`admins/${adminUid}`).set({
    role: 'admin',
    source: 'e2e-seed',
    updatedAt: iso(0),
  })

  await db.doc(`sessionTypes/default`).set({
    name: 'Alap profil',
    temperatureMin: 18,
    temperatureMax: 28,
    humidityMin: 45,
    humidityMax: 85,
  })

  await db.doc(`devices/${deviceId}`).set({
    name: 'E2E teszt eszköz',
  })

  await db.doc(`devices/${deviceId}/sessions/${sessionId}`).set({
    name: 'E2E Aktív Session',
    sessionTypeId: 'default',
    status: 'active',
    startDate: iso(-12 * 60 * 60 * 1000),
    endDate: null,
  })

  const readings = [
    { id: 'reading-1', temperatureC: 21.2, humidity: 61.3, recordedAt: iso(-4 * 60 * 60 * 1000) },
    { id: 'reading-2', temperatureC: 22.1, humidity: 62.4, recordedAt: iso(-3 * 60 * 60 * 1000) },
    { id: 'reading-3', temperatureC: 22.8, humidity: 60.9, recordedAt: iso(-2 * 60 * 60 * 1000) },
    { id: 'reading-4', temperatureC: 23.0, humidity: 59.8, recordedAt: iso(-60 * 60 * 1000) },
  ]

  await Promise.all(
    readings.map((reading) =>
      db.doc(`devices/${deviceId}/readings/${reading.id}`).set({
        ...reading,
        sessionId,
      }),
    ),
  )

  await db.doc(`devices/${deviceId}/sessions/${sessionId}/events/event-1`).set({
    title: 'Permetezés',
    notes: 'E2E seed esemény',
    occurredAt: iso(-90 * 60 * 1000),
  })

  await db.doc('cuttings/cutting-e2e-1').set({
    serialNumber: 1,
    variety: 'Kékfrankos',
    plantType: 'cutting',
    plantedAt: iso(-24 * 60 * 60 * 1000),
    status: 'active',
    notes: 'Seedelt dugvány',
    photos: [
      {
        id: 'seed-photo-1',
        storagePath: '',
        downloadUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
        capturedAt: iso(-3 * 60 * 60 * 1000),
        uploadedAt: iso(-3 * 60 * 60 * 1000),
        width: 1,
        height: 1,
        caption: 'seed',
      },
    ],
    events: [
      {
        id: 'cutting-event-1',
        title: 'Öntözés',
        occurredAt: iso(-2 * 60 * 60 * 1000),
        notes: 'E2E seed',
      },
    ],
    createdAt: iso(-24 * 60 * 60 * 1000),
    updatedAt: iso(-2 * 60 * 60 * 1000),
    createdByUid: null,
  })
}

seed().catch((error) => {
  console.error('Seed hiba:', error)
  process.exit(1)
})
