#include <Arduino.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

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
constexpr unsigned long kHeartbeatIntervalMs = 5000;
constexpr unsigned long kReadIntervalMs = 15UL * 60UL * 1000UL;
constexpr unsigned long kWifiReconnectIntervalMs = 10000;
constexpr char kConfigPortalName[] = "ESP32-DHT22-Setup";
constexpr char kIngestUrl[] = FIREBASE_INGEST_URL;
constexpr char kDeviceToken[] = FIREBASE_DEVICE_TOKEN;
constexpr char kDeviceId[] = DEVICE_ID;

DHT dht(kDhtPin, kDhtType);
WiFiManager wifiManager;
unsigned long lastHeartbeatAt = 0;
unsigned long lastReadAt = 0;
unsigned long lastWifiAttemptAt = 0;
bool configPortalStarted = false;

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
    wifiManager.setConfigPortalTimeout(180);

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
}

void setup() {
  Serial.begin(115200);
  delay(3000);
  Serial.println("ESP32 + DHT22 indul.");
  dht.begin();
  lastReadAt = millis() - kReadIntervalMs;
  WiFi.mode(WIFI_STA);
  wifiManager.setConfigPortalBlocking(false);
  wifiManager.setConnectTimeout(20);
  wifiManager.setConfigPortalTimeout(180);
  ensureWifiConnected();
}

void loop() {
  const unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED &&
      now - lastWifiAttemptAt >= kWifiReconnectIntervalMs) {
    lastWifiAttemptAt = now;
    ensureWifiConnected();
  }

  wifiManager.process();

  if (now - lastHeartbeatAt >= kHeartbeatIntervalMs) {
    lastHeartbeatAt = now;
    Serial.println("el a program");
    Serial.print("Wi-Fi statusz: ");
    Serial.println(wifiStatusText(WiFi.status()));
    if (WiFi.status() != WL_CONNECTED) {
      Serial.print("Setup AP: ");
      Serial.println(kConfigPortalName);
    }
  }

  if (now - lastReadAt < kReadIntervalMs) {
    return;
  }

  lastReadAt = now;

  const float humidity = dht.readHumidity();
  const float temperatureC = dht.readTemperature();

  if (isnan(humidity) || isnan(temperatureC)) {
    Serial.println("DHT olvasasi hiba.");
    return;
  }

  if (!ensureWifiConnected()) {
    return;
  }

  Serial.print("Homerseklet: ");
  Serial.print(temperatureC, 1);
  Serial.print(" C, Paratartalom: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  if (!postReading(temperatureC, humidity)) {
    Serial.println("Firebase kuldes sikertelen.");
    return;
  }

  Serial.println("Firebase kuldes sikeres.");
}
