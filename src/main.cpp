#include <Arduino.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <esp_sleep.h>
#include <esp_system.h>
#include <time.h>

#ifndef FIREBASE_INGEST_URL
#error "FIREBASE_INGEST_URL is not defined. Create platformio.local.ini."
#endif

#ifndef FIREBASE_DEVICE_TOKEN
#error "FIREBASE_DEVICE_TOKEN is not defined. Create platformio.local.ini."
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "esp32-lab"
#endif

namespace {
constexpr int kDhtPin = 27;
constexpr int kDhtType = DHT22;
constexpr unsigned long kPortalHeartbeatIntervalMs = 5000;
constexpr unsigned long kWifiConnectTimeoutMs = 20000;
constexpr unsigned long kReadIntervalMs = 15UL * 60UL * 1000UL;
constexpr uint8_t kSensorReadAttempts = 3;
constexpr unsigned long kSensorRetryDelayMs = 2000;
constexpr uint64_t kSleepDurationUs =
    static_cast<uint64_t>(kReadIntervalMs) * 1000ULL;
constexpr uint32_t kTelemetryStateMagic = 0x544C4D31UL;
constexpr uint16_t kTelemetryStateVersion = 1;
constexpr size_t kMaxPendingReadings = 96;
constexpr time_t kMinValidEpoch = 1704067200;
constexpr char kConfigPortalName[] = "ESP32-DHT22-Setup";
constexpr char kTelemetryNamespace[] = "telemetry";
constexpr char kIngestUrl[] = FIREBASE_INGEST_URL;
constexpr char kDeviceToken[] = FIREBASE_DEVICE_TOKEN;
constexpr char kDeviceId[] = DEVICE_ID;

struct PendingReading {
  int64_t recordedAtEpochMs;
  float temperatureC;
  float humidity;
};

enum FailureReason : uint8_t {
  kFailureNone = 0,
  kFailureWifiConnect = 1,
  kFailureDhtRead = 2,
  kFailureHttpPost = 3,
};

struct TelemetryState {
  uint32_t magic;
  uint16_t version;
  uint16_t pendingCount;
  uint16_t consecutiveFailures;
  uint16_t reserved;
  int32_t lastWifiStatus;
  int32_t lastHttpStatus;
  uint32_t bootCount;
  uint32_t droppedReadingsCount;
  uint8_t lastFailureReason;
  uint8_t reserved2[3];
  int64_t lastSuccessEpochMs;
  int64_t lastFailureEpochMs;
  PendingReading pending[kMaxPendingReadings];
};

DHT dht(kDhtPin, kDhtType);
WiFiManager wifiManager;
Preferences preferences;
unsigned long lastPortalHeartbeatAt = 0;
unsigned long connectAttemptStartedAt = 0;
bool configPortalStarted = false;
TelemetryState telemetryState{};

const char* failureReasonText(FailureReason reason) {
  switch (reason) {
    case kFailureWifiConnect:
      return "wifi_connect_failed";
    case kFailureDhtRead:
      return "dht_read_failed";
    case kFailureHttpPost:
      return "http_post_failed";
    case kFailureNone:
    default:
      return "none";
  }
}

const char* resetReasonText(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:
      return "power-on";
    case ESP_RST_EXT:
      return "external";
    case ESP_RST_SW:
      return "software";
    case ESP_RST_PANIC:
      return "panic";
    case ESP_RST_INT_WDT:
      return "int-wdt";
    case ESP_RST_TASK_WDT:
      return "task-wdt";
    case ESP_RST_WDT:
      return "wdt";
    case ESP_RST_DEEPSLEEP:
      return "deep-sleep";
    case ESP_RST_BROWNOUT:
      return "brownout";
    case ESP_RST_SDIO:
      return "sdio";
    default:
      return "unknown";
  }
}

const char* wakeupCauseText(esp_sleep_wakeup_cause_t cause) {
  switch (cause) {
    case ESP_SLEEP_WAKEUP_TIMER:
      return "timer";
    case ESP_SLEEP_WAKEUP_UNDEFINED:
      return "power-on/reset";
    case ESP_SLEEP_WAKEUP_EXT0:
      return "ext0";
    case ESP_SLEEP_WAKEUP_EXT1:
      return "ext1";
    case ESP_SLEEP_WAKEUP_TOUCHPAD:
      return "touchpad";
    case ESP_SLEEP_WAKEUP_ULP:
      return "ulp";
    case ESP_SLEEP_WAKEUP_GPIO:
      return "gpio";
    case ESP_SLEEP_WAKEUP_UART:
      return "uart";
    case ESP_SLEEP_WAKEUP_WIFI:
      return "wifi";
    case ESP_SLEEP_WAKEUP_COCPU:
      return "cocpu";
    case ESP_SLEEP_WAKEUP_COCPU_TRAP_TRIG:
      return "cocpu-trap";
    case ESP_SLEEP_WAKEUP_BT:
      return "bt";
    default:
      return "ismeretlen";
  }
}

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_CONNECTED:
      return "kapcsolodva";
    case WL_NO_SSID_AVAIL:
      return "ssid-nem-lathato";
    case WL_CONNECT_FAILED:
      return "kapcsolodas-sikertelen";
    case WL_CONNECTION_LOST:
      return "kapcsolat-megszakadt";
    case WL_DISCONNECTED:
      return "szetkapcsolva";
    case WL_IDLE_STATUS:
      return "varakozik";
    default:
      return "ismeretlen";
  }
}

bool hasSavedWifiCredentials() {
  return wifiManager.getWiFiIsSaved();
}

void resetTelemetryState() {
  memset(&telemetryState, 0, sizeof(telemetryState));
  telemetryState.magic = kTelemetryStateMagic;
  telemetryState.version = kTelemetryStateVersion;
  telemetryState.lastWifiStatus = WL_DISCONNECTED;
  telemetryState.lastHttpStatus = -1;
  telemetryState.lastFailureReason = kFailureNone;
}

bool saveTelemetryState() {
  return preferences.putBytes("state", &telemetryState, sizeof(telemetryState)) ==
         sizeof(telemetryState);
}

void loadTelemetryState() {
  resetTelemetryState();

  const size_t storedSize = preferences.getBytesLength("state");
  if (storedSize != sizeof(telemetryState)) {
    saveTelemetryState();
    return;
  }

  TelemetryState storedState{};
  if (preferences.getBytes("state", &storedState, sizeof(storedState)) !=
      sizeof(storedState)) {
    saveTelemetryState();
    return;
  }

  if (storedState.magic != kTelemetryStateMagic ||
      storedState.version != kTelemetryStateVersion ||
      storedState.pendingCount > kMaxPendingReadings) {
    saveTelemetryState();
    return;
  }

  telemetryState = storedState;
}

bool isClockValid() {
  return time(nullptr) >= kMinValidEpoch;
}

int64_t currentEpochMs() {
  if (!isClockValid()) {
    return 0;
  }

  struct timeval now {};
  gettimeofday(&now, nullptr);
  return static_cast<int64_t>(now.tv_sec) * 1000LL +
         static_cast<int64_t>(now.tv_usec) / 1000LL;
}

String isoFromEpochMs(int64_t epochMs) {
  if (epochMs <= 0) {
    return "";
  }

  const time_t seconds = static_cast<time_t>(epochMs / 1000LL);
  const int millis = static_cast<int>(epochMs % 1000LL);
  struct tm utcTime {};
  gmtime_r(&seconds, &utcTime);

  char buffer[32];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S", &utcTime);

  char isoBuffer[40];
  snprintf(isoBuffer, sizeof(isoBuffer), "%s.%03dZ", buffer, millis);
  return String(isoBuffer);
}

bool ensureTimeSynced() {
  if (isClockValid()) {
    return true;
  }

  configTime(0, 0, "pool.ntp.org", "time.google.com", "time.cloudflare.com");
  const unsigned long startedAt = millis();
  while (!isClockValid() && millis() - startedAt < 10000UL) {
    delay(250);
  }

  return isClockValid();
}

bool queuePendingReading(const PendingReading& reading) {
  if (telemetryState.pendingCount >= kMaxPendingReadings) {
    memmove(&telemetryState.pending[0], &telemetryState.pending[1],
            sizeof(PendingReading) * (kMaxPendingReadings - 1));
    telemetryState.pendingCount = kMaxPendingReadings - 1;
    telemetryState.droppedReadingsCount += 1;
  }

  telemetryState.pending[telemetryState.pendingCount] = reading;
  telemetryState.pendingCount += 1;
  return saveTelemetryState();
}

void popPendingReading() {
  if (telemetryState.pendingCount == 0) {
    return;
  }

  if (telemetryState.pendingCount > 1) {
    memmove(&telemetryState.pending[0], &telemetryState.pending[1],
            sizeof(PendingReading) * (telemetryState.pendingCount - 1));
  }

  telemetryState.pendingCount -= 1;
  telemetryState.pending[telemetryState.pendingCount] = PendingReading{};
  saveTelemetryState();
}

void markCycleFailure(FailureReason reason, wl_status_t wifiStatus,
                      int httpStatus = -1) {
  telemetryState.consecutiveFailures += 1;
  telemetryState.lastFailureReason = static_cast<uint8_t>(reason);
  telemetryState.lastWifiStatus = static_cast<int32_t>(wifiStatus);
  telemetryState.lastHttpStatus = httpStatus;
  telemetryState.lastFailureEpochMs = currentEpochMs();
  saveTelemetryState();
}

void markCycleSuccess(int httpStatus) {
  telemetryState.consecutiveFailures = 0;
  telemetryState.lastFailureReason = kFailureNone;
  telemetryState.lastWifiStatus = WL_CONNECTED;
  telemetryState.lastHttpStatus = httpStatus;
  telemetryState.lastSuccessEpochMs = currentEpochMs();
  saveTelemetryState();
}

bool tryConnectSavedWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  connectAttemptStartedAt = millis();
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin();

  while (millis() - connectAttemptStartedAt < kWifiConnectTimeoutMs) {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("Wi-Fi kapcsolodva, IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }
    delay(250);
  }

  return false;
}

void enterDeepSleep() {
  Serial.printf("%lu masodperc deep sleep indul.\n", kReadIntervalMs / 1000UL);
  Serial.flush();

  // Ne toroljuk az NVS-ben mentett Wi-Fi credentialst deep sleep elott.
  WiFi.disconnect(false, false);
  WiFi.mode(WIFI_OFF);

  esp_sleep_enable_timer_wakeup(kSleepDurationUs);
  esp_deep_sleep_start();
}

int postJson(const String& payload) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, kIngestUrl)) {
    Serial.println("HTTP begin hiba.");
    return -1;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", kDeviceToken);

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  Serial.print("HTTP status: ");
  Serial.println(statusCode);
  Serial.print("Valasz: ");
  Serial.println(responseBody);
  return statusCode;
}

bool postReading(const PendingReading& reading, int* httpStatusOut = nullptr) {
  String payload = "{\"kind\":\"reading\",\"deviceId\":\"";
  payload += kDeviceId;
  payload += "\",\"temperatureC\":";
  payload += String(reading.temperatureC, 1);
  payload += ",\"humidity\":";
  payload += String(reading.humidity, 1);

  if (reading.recordedAtEpochMs > 0) {
    payload += ",\"recordedAt\":\"";
    payload += isoFromEpochMs(reading.recordedAtEpochMs);
    payload += "\"";
  }

  payload += "}";

  const int httpStatus = postJson(payload);
  if (httpStatusOut != nullptr) {
    *httpStatusOut = httpStatus;
  }
  return httpStatus >= 200 && httpStatus < 300;
}

bool postHealthReport(const char* eventType, uint16_t queuedReadingsCount,
                      uint16_t flushedReadingsCount, bool recovered) {
  String payload = "{\"kind\":\"health\",\"deviceId\":\"";
  payload += kDeviceId;
  payload += "\",\"eventType\":\"";
  payload += eventType;
  payload += "\",\"recordedAt\":\"";
  payload += isoFromEpochMs(currentEpochMs());
  payload += "\",\"wakeupCause\":\"";
  payload += wakeupCauseText(esp_sleep_get_wakeup_cause());
  payload += "\",\"resetReason\":\"";
  payload += resetReasonText(esp_reset_reason());
  payload += "\",\"wifiStatus\":\"";
  payload += wifiStatusText(WiFi.status());
  payload += "\",\"connectDurationMs\":";
  payload += String(millis() - connectAttemptStartedAt);
  payload += ",\"queuedReadingsCount\":";
  payload += String(queuedReadingsCount);
  payload += ",\"flushedReadingsCount\":";
  payload += String(flushedReadingsCount);
  payload += ",\"droppedReadingsCount\":";
  payload += String(telemetryState.droppedReadingsCount);
  payload += ",\"consecutiveFailures\":";
  payload += String(telemetryState.consecutiveFailures);
  payload += ",\"lastHttpStatus\":";
  payload += String(telemetryState.lastHttpStatus);
  payload += ",\"lastFailureReason\":\"";
  payload += failureReasonText(
      static_cast<FailureReason>(telemetryState.lastFailureReason));
  payload += "\",\"freeHeap\":";
  payload += String(ESP.getFreeHeap());
  payload += ",\"recovered\":";
  payload += recovered ? "true" : "false";

  if (WiFi.status() == WL_CONNECTED) {
    payload += ",\"rssi\":";
    payload += String(WiFi.RSSI());
    payload += ",\"ip\":\"";
    payload += WiFi.localIP().toString();
    payload += "\"";
  }

  if (telemetryState.lastSuccessEpochMs > 0) {
    payload += ",\"lastSuccessAt\":\"";
    payload += isoFromEpochMs(telemetryState.lastSuccessEpochMs);
    payload += "\"";
  }

  if (telemetryState.lastFailureEpochMs > 0) {
    payload += ",\"lastFailureAt\":\"";
    payload += isoFromEpochMs(telemetryState.lastFailureEpochMs);
    payload += "\"";
  }

  payload += "}";
  const int httpStatus = postJson(payload);
  return httpStatus >= 200 && httpStatus < 300;
}

bool readSensor(PendingReading* readingOut) {
  for (uint8_t attempt = 1; attempt <= kSensorReadAttempts; ++attempt) {
    if (attempt > 1) {
      Serial.printf("DHT ujraprobalas (%u/%u) %lu ms mulva.\n", attempt,
                    kSensorReadAttempts, kSensorRetryDelayMs);
      delay(kSensorRetryDelayMs);
    }

    const float humidity = dht.readHumidity();
    const float temperatureC = dht.readTemperature();

    if (isnan(humidity) || isnan(temperatureC)) {
      Serial.printf("DHT olvasasi hiba (%u/%u).\n", attempt,
                    kSensorReadAttempts);
      continue;
    }

    Serial.print("Homerseklet: ");
    Serial.print(temperatureC, 1);
    Serial.print(" C, Paratartalom: ");
    Serial.print(humidity, 1);
    Serial.println(" %");

    if (readingOut != nullptr) {
      readingOut->recordedAtEpochMs = currentEpochMs();
      readingOut->temperatureC = temperatureC;
      readingOut->humidity = humidity;
    }
    return true;
  }

  Serial.printf("DHT olvasas %u probalkozas utan sem sikerult.\n",
                kSensorReadAttempts);
  return false;
}

bool flushPendingReadings(uint16_t* flushedCountOut) {
  uint16_t flushedCount = 0;
  while (telemetryState.pendingCount > 0) {
    int httpStatus = -1;
    if (!postReading(telemetryState.pending[0], &httpStatus)) {
      telemetryState.lastHttpStatus = httpStatus;
      saveTelemetryState();
      if (flushedCountOut != nullptr) {
        *flushedCountOut = flushedCount;
      }
      return false;
    }

    popPendingReading();
    flushedCount += 1;
  }

  if (flushedCountOut != nullptr) {
    *flushedCountOut = flushedCount;
  }
  return true;
}

void handleOfflineCycle() {
  PendingReading reading{};
  if (!readSensor(&reading)) {
    markCycleFailure(kFailureDhtRead, WiFi.status());
    enterDeepSleep();
    return;
  }

  queuePendingReading(reading);
  markCycleFailure(kFailureWifiConnect, WiFi.status());
  enterDeepSleep();
}

void handleConnectedCycle() {
  ensureTimeSynced();

  const uint16_t queuedReadingsCount = telemetryState.pendingCount;
  const bool hadIncident =
      telemetryState.consecutiveFailures > 0 || telemetryState.pendingCount > 0 ||
      telemetryState.droppedReadingsCount > 0;

  uint16_t flushedReadingsCount = 0;
  if (hadIncident &&
      !postHealthReport("recovered", queuedReadingsCount, 0, true)) {
    Serial.println("Health report kuldes sikertelen.");
  }

  if (!flushPendingReadings(&flushedReadingsCount)) {
    Serial.println("Backlog kuldes sikertelen.");
    markCycleFailure(kFailureHttpPost, WiFi.status(), telemetryState.lastHttpStatus);
    enterDeepSleep();
    return;
  }

  if (flushedReadingsCount > 0) {
    postHealthReport("backlog_flushed", queuedReadingsCount, flushedReadingsCount,
                     true);
  }

  PendingReading currentReading{};
  if (!readSensor(&currentReading)) {
    markCycleFailure(kFailureDhtRead, WiFi.status());
    enterDeepSleep();
    return;
  }

  int httpStatus = -1;
  if (!postReading(currentReading, &httpStatus)) {
    Serial.println("Firebase kuldes sikertelen, mentes queue-ba.");
    queuePendingReading(currentReading);
    markCycleFailure(kFailureHttpPost, WiFi.status(), httpStatus);
    enterDeepSleep();
    return;
  }

  Serial.println("Firebase kuldes sikeres.");
  markCycleSuccess(httpStatus);
  enterDeepSleep();
}

void startConfigPortal() {
  if (configPortalStarted) {
    return;
  }

  configPortalStarted = true;
  connectAttemptStartedAt = millis();
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConnectTimeout(20);
  wifiManager.setConfigPortalTimeout(0);
  wifiManager.startConfigPortal(kConfigPortalName);

  Serial.print("Setup AP elindult: ");
  Serial.println(kConfigPortalName);
  Serial.print("Setup AP IP: ");
  Serial.println(WiFi.softAPIP());
}
}

void setup() {
  Serial.begin(115200);
  delay(3000);
  preferences.begin(kTelemetryNamespace, false);
  loadTelemetryState();
  telemetryState.bootCount += 1;
  saveTelemetryState();
  Serial.println("ESP32 + DHT22 indul.");
  Serial.print("Wakeup ok: ");
  Serial.println(wakeupCauseText(esp_sleep_get_wakeup_cause()));
  Serial.print("Reset ok: ");
  Serial.println(resetReasonText(esp_reset_reason()));
  Serial.print("Queue meret: ");
  Serial.println(telemetryState.pendingCount);
  dht.begin();
  WiFi.mode(WIFI_STA);
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConnectTimeout(20);
  wifiManager.setConfigPortalTimeout(0);

  if (hasSavedWifiCredentials()) {
    if (tryConnectSavedWifi()) {
      handleConnectedCycle();
      return;
    }

    Serial.print("Wi-Fi csatlakozas sikertelen: ");
    Serial.println(wifiStatusText(WiFi.status()));
    handleOfflineCycle();
    return;
  }

  startConfigPortal();
}

void loop() {
  if (!configPortalStarted) {
    delay(250);
    return;
  }

  wifiManager.process();

  if (WiFi.status() == WL_CONNECTED) {
    handleConnectedCycle();
    return;
  }

  const unsigned long now = millis();
  if (now - lastPortalHeartbeatAt >= kPortalHeartbeatIntervalMs) {
    lastPortalHeartbeatAt = now;
    Serial.print("Wi-Fi statusz: ");
    Serial.println(wifiStatusText(WiFi.status()));
    if (configPortalStarted) {
      Serial.print("Setup AP: ");
      Serial.println(kConfigPortalName);
    }
  }
}
