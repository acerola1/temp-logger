# Firebase setup

Ez a mappa egy egyszeru Firebase alapú logolási vázat tartalmaz:

- `functions/index.js`: HTTPS endpoint az ESP32-nek
- `web/`: Firebase Hosting oldal az adatok megjelenitesere
- `firestore.rules`: Firestore szabalyok

## Javasolt architektura

1. Az ESP32 HTTPS `POST` kéréssel elkuldi a mért adatot a `ingestReading` Cloud Functionnek.
2. A Function ellenorzi a titkos tokent, majd ir a `sensorReadings` Firestore kollekcioba.
3. A Firebase Hosting alatt futó weboldal a Firestore-bol olvassa ki az utolso mereseket.

Ez jobb, mint közvetlenül az ESP32-bol Firestore-ba irni, mert nem kell admin vagy kliens szintu Firebase hitelesitest tenni az eszkozre.

## Lokalis elokeszites

1. Jelentkezz be:

```bash
firebase login
```

2. Hozz letre egy Firebase projektet a konzolban, majd allitsd be ezt a mappat arra:

```bash
firebase use --add
```

3. Telepitsd a Functions dependency-ket:

```bash
cd functions
npm install
cd ..
```

4. Allitsd be a titkos tokent az ESP32-hoz:

```bash
firebase functions:secrets:set DEVICE_TOKEN
```

5. Hozz letre Firestore adatbazist a Firebase konzolban.

6. Töltsd ki a `web/firebase-config.js` fajlt a sajat Firebase web app konfiguracioddal.

## Deploy

```bash
firebase deploy --only functions,firestore:rules,hosting
```

## ESP32 HTTP payload

Az endpoint `POST` JSON payloadot var:

```json
{
  "deviceId": "esp32-lab",
  "temperatureC": 24.5,
  "humidity": 25.3,
  "recordedAt": "2026-03-22T12:45:00Z"
}
```

Header:

```text
X-Device-Token: <DEVICE_TOKEN titok>
Content-Type: application/json
```

## Vart Function URL

Deploy utan a function URL-ja tipikusan ehhez hasonlit:

```text
https://europe-west1-YOUR_PROJECT_ID.cloudfunctions.net/ingestReading
```

## Kovetkezo lepes

Ha ez az alap struktura megfelel, a kovetkezo korben az ESP32 firmware-t is atirjuk Wi-Fi + HTTPS POST kuldesre.
