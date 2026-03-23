#include <Arduino.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <esp_sleep.h>

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
constexpr unsigned long kReadIntervalMs = 15UL * 60UL * 1000UL;
constexpr uint64_t kSleepDurationUs =
    static_cast<uint64_t>(kReadIntervalMs) * 1000ULL;
constexpr char kConfigPortalName[] = "ESP32-DHT22-Setup";
constexpr char kIngestUrl[] = FIREBASE_INGEST_URL;
constexpr char kDeviceToken[] = FIREBASE_DEVICE_TOKEN;
constexpr char kDeviceId[] = DEVICE_ID;

DHT dht(kDhtPin, kDhtType);
WiFiManager wifiManager;
unsigned long lastPortalHeartbeatAt = 0;
bool configPortalStarted = false;

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

bool ensureWifiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  if (!configPortalStarted) {
    WiFi.mode(WIFI_STA);
    wifiManager.setConfigPortalBlocking(false);
    wifiManager.setConnectTimeout(20);
    wifiManager.setConfigPortalTimeout(0);

    if (wifiManager.autoConnect(kConfigPortalName)) {
      Serial.print("Wi-Fi kapcsolodva, IP: ");
      Serial.println(WiFi.localIP());
      return true;
    }

    configPortalStarted = true;
    Serial.print("Setup AP elindult: ");
    Serial.println(kConfigPortalName);
    Serial.print("Setup AP IP: ");
    Serial.println(WiFi.softAPIP());
  }

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  Serial.print("Wi-Fi kapcsolodva, IP: ");
  Serial.println(WiFi.localIP());
  return true;
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

bool postReading(float temperatureC, float humidity) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, kIngestUrl)) {
    Serial.println("HTTP begin hiba.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", kDeviceToken);

  String payload = "{\"deviceId\":\"";
  payload += kDeviceId;
  payload += "\",\"temperatureC\":";
  payload += String(temperatureC, 1);
  payload += ",\"humidity\":";
  payload += String(humidity, 1);
  payload += "}";

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  Serial.print("HTTP status: ");
  Serial.println(statusCode);
  Serial.print("Valasz: ");
  Serial.println(responseBody);
  return statusCode >= 200 && statusCode < 300;
}

void readAndSendThenSleep() {
  const float humidity = dht.readHumidity();
  const float temperatureC = dht.readTemperature();

  if (isnan(humidity) || isnan(temperatureC)) {
    Serial.println("DHT olvasasi hiba.");
    enterDeepSleep();
    return;
  }

  Serial.print("Homerseklet: ");
  Serial.print(temperatureC, 1);
  Serial.print(" C, Paratartalom: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  if (!postReading(temperatureC, humidity)) {
    Serial.println("Firebase kuldes sikertelen.");
    enterDeepSleep();
    return;
  }

  Serial.println("Firebase kuldes sikeres.");
  enterDeepSleep();
}
}

void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("ESP32 + DHT22 indul.");
  Serial.print("Wakeup ok: ");
  Serial.println(wakeupCauseText(esp_sleep_get_wakeup_cause()));
  dht.begin();
  WiFi.mode(WIFI_STA);
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConnectTimeout(20);
  wifiManager.setConfigPortalTimeout(0);

  if (ensureWifiConnected()) {
    readAndSendThenSleep();
  }
}

void loop() {
  wifiManager.process();

  if (WiFi.status() == WL_CONNECTED) {
    readAndSendThenSleep();
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
