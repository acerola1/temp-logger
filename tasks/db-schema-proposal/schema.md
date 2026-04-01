# Firestore schema

## Fő irány

Külön `sessionTypes` kollekció van a mérési típusoknak, és minden device alatt saját `sessions` és `readings` alkollekció marad.

```text
sessionTypes
├── callusing
│   ├── name: "Kalluszosítás"
│   ├── temperatureMin: 24
│   ├── temperatureMax: 27
│   ├── humidityMin: 85
│   └── humidityMax: 95
└── rooted-grapes
    ├── name: "Begyökeresedett szőlők"
    ├── temperatureMin: 20
    ├── temperatureMax: 28
    ├── humidityMin: 60
    └── humidityMax: 80

devices
├── esp32-lab
│   ├── document
│   │   └── name: "Kalluszosító sátor 1"
│   ├── sessions
│   │   ├── spring-2026-callusing-a
│   │   │   ├── name: "2026 tavaszi kalluszosítás A"
│   │   │   ├── sessionTypeId: "callusing"
│   │   │   ├── status: "active"
│   │   │   ├── startDate: "2026-03-20T08:00:00.000Z"
│   │   │   └── endDate: null
│   │   └── test-session
│   │       ├── name: "Próba mérés"
│   │       ├── sessionTypeId: "callusing"
│   │       ├── status: "archived"
│   │       ├── startDate: "2026-03-10T09:00:00.000Z"
│   │       └── endDate: "2026-03-10T14:00:00.000Z"
│   └── readings
│       ├── reading-001
│       │   ├── sessionId: "spring-2026-callusing-a"
│       │   ├── temperatureC: 25.1
│       │   ├── humidity: 90.3
│       │   └── recordedAt: "2026-03-31T08:00:00.000Z"
│       └── reading-002
│           ├── sessionId: null
│           ├── temperatureC: 24.9
│           ├── humidity: 91.1
│           └── recordedAt: "2026-03-19T18:00:00.000Z"
└── esp32-lab-2
    ├── document
    │   └── name: "Kalluszosító sátor 2"
    ├── sessions
    │   └── spring-2026-callusing-b
    │       ├── name: "2026 tavaszi kalluszosítás B"
    │       ├── sessionTypeId: "callusing"
    │       ├── status: "active"
    │       ├── startDate: "2026-03-22T08:00:00.000Z"
    │       └── endDate: null
    └── readings
        └── reading-101
            ├── sessionId: "spring-2026-callusing-b"
            ├── temperatureC: 25.0
            ├── humidity: 89.7
            └── recordedAt: "2026-03-31T08:00:00.000Z"

devices
└── esp32-growtent
    ├── document
    │   └── name: "Növénysátor"
    ├── sessions
    │   └── rooted-grapes-2026
    │       ├── name: "Növénysátor monitorozás"
    │       ├── sessionTypeId: "rooted-grapes"
    │       ├── status: "active"
    │       ├── startDate: "2026-03-31T07:30:00.000Z"
    │       └── endDate: null
    └── readings
        ├── reading-201
        │   ├── sessionId: "rooted-grapes-2026"
        │   ├── temperatureC: 22.7
        │   ├── humidity: 67.4
        │   └── recordedAt: "2026-03-31T08:00:00.000Z"
        └── reading-202
            ├── sessionId: null
            ├── temperatureC: 23.0
            ├── humidity: 65.9
            └── recordedAt: "2026-03-30T16:15:00.000Z"
```

## Dokumentumok

### `sessionTypes/{sessionTypeId}`

- `name`
- `temperatureMin`
- `temperatureMax`
- `humidityMin`
- `humidityMax`

### `devices/{deviceId}`

- `name`

### `devices/{deviceId}/sessions/{sessionId}`

- `name`
- `sessionTypeId`
- `status`: `active` | `archived`
- `startDate`
- `endDate`

Szabály:

- egy device-hoz legfeljebb egy aktív session legyen egyszerre

### `devices/{deviceId}/readings/{readingId}`

- `sessionId`: opcionális, lehet `null`
- `temperatureC`
- `humidity`
- `recordedAt`

## Lekérdezések

### Egy device összes mérése

- `devices/{deviceId}/readings`
- `orderBy(recordedAt asc vagy desc)`

### Egy device aktív sessionje

- `devices/{deviceId}/sessions`
- `where(status == "active")`
- `limit(1)`

### Egy device mérései adott sessionre

- `devices/{deviceId}/readings`
- `where(sessionId == "...")`
- `orderBy(recordedAt asc)`

### Egy device session nélküli mérései

- `devices/{deviceId}/readings`
- `where(sessionId == null)`

### Összes device összes mérése

- collection group query a `readings` alkollekciókra

## Indexek

- `readings`: `sessionId + recordedAt`
- `sessions`: `status + startDate`

## Megjegyzések

- ugyanaz a `sessionTypeId` több külön device külön sessionjében is használható
- ez jól kezeli a párhuzamos kalluszosítási méréseket
- az első körben a session nélküli mérések `sessionId: null` formában maradnak
- Firestore-ban a szülő dokumentum törlése nem törli automatikusan az alkollekciókat
