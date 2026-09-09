#include <Arduino.h>
#include <string.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "esp_sleep.h"
#include "DEV_Config.h"
#include "EPD.h"
#include "secrets.h"

#define FB_ROW_BYTES (EPD_7IN5_V2_WIDTH / 8)        // 100
#define FB_SIZE (FB_ROW_BYTES * EPD_7IN5_V2_HEIGHT) // 100 * 480 = 48000
#define BMP_HEADER_BYTES 62
#define BMP_TOTAL_BYTES (BMP_HEADER_BYTES + FB_SIZE) // 48062
#define WIFI_TIMEOUT_MS 20000
#define READ_STALL_MS 5000

// 60 seconds while testing. Change to 3600 once the full cucle works.
// uint64_t keeps microsecond math from overflowing
static const uint64_t SLEEP_SECONDS = 60;

// Survives deep sleep. Stored in RTC memory.
RTC_DATA_ATTR int bootCount = 0;

// Reserve at link-time, zero-filled. Prevents runtime nulls.
static uint8_t framebuffer[FB_SIZE];

static bool connectWifi()
{
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    const unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED)
    {
        if (millis() - start > WIFI_TIMEOUT_MS)
        {
            Serial.println("wifi timeout");
            return false;
        }
        delay(250);
    }
    Serial.printf("wifi ok, ip %s\n", WiFi.localIP().toString().c_str());
    WiFi.setSleep(false);
    return true;
}

static bool readFully(WiFiClient *stream, uint8_t *dest, size_t count) {
    size_t got = 0;
    unsigned long lastData = millis();

    while (got < count) {
        const int n = stream->read(dest + got, count - got);
        if (n > 0) {
            got += (size_t)n;
            lastData = millis();
        } else {
            if (!stream->connected() && stream->available() == 0) {
                Serial.println("connection closed mid-read");
                return false;
            }
            if (millis() - lastData > READ_STALL_MS) {
                Serial.printf("stalled at %u of %u\n", (unsigned)got, (unsigned)count);
                return false;
            }
            delay(1);
        }
    }
    return true;
}

static bool fetchImage()
{
    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    http.begin(client, RENDER_URL);
    http.addHeader("Authorization", "Bearer " DEVICE_TOKEN);

    const int status = http.GET();
    if (status != 200)
    {
        Serial.printf("http status %d\n", status);
        http.end();
        return false;
    }
    if (http.getSize() != (int)BMP_TOTAL_BYTES)
    {
        Serial.printf("unexpected length %d\n", http.getSize());
        http.end();
        return false;
    }

    WiFiClient *stream = http.getStreamPtr();

    uint8_t header[BMP_HEADER_BYTES];
    if (!readFully(stream, header, sizeof(header)))
    {
        http.end();
        return false;
    }
    if (header[0] != 'B' || header[1] != 'M')
    {
        Serial.println("not a BMP");
        http.end();
        return false;
    }

    // Must invert the BMP pixel data when copying to the framebuffer.
    // The BMP format stores pixel data bottom-to-top, so the first row in the file
    // corresponds to the bottom row of the image. When copying to the framebuffer,
    // which expects top-to-bottom order, we need to invert the rows.
    for (int row = 0; row < EPD_7IN5_V2_HEIGHT; row++)
    {
        uint8_t *dest = framebuffer + (EPD_7IN5_V2_HEIGHT - 1 - row) * FB_ROW_BYTES;
        if (!readFully(stream, dest, FB_ROW_BYTES))
        {
            http.end();
            return false;
        }
    }
    http.end();
    return true;
}

static void goToSleep() {
    Serial.printf("sleeping %llu seconds\n", SLEEP_SECONDS);
    Serial.flush();
    esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000ULL);
    esp_deep_sleep_start();
    // Nothing past this point is reached; deep sleep never returns
}

void setup()
{
    Serial.begin(115200);
    delay(100); // lets the USB serial connection establish

    bootCount++;
    Serial.printf("wake #%d\n", bootCount);

    if (!connectWifi())
    {
        goToSleep();
    }
    const bool ok = fetchImage();
    WiFi.disconnect(true);

    if (ok)
    {
        Serial.println("panel init");
        DEV_Module_Init();
        EPD_7IN5_V2_Init();
        EPD_7IN5_V2_Display(framebuffer);
        // Required before ESP32 sleeps
        EPD_7IN5_V2_Sleep();
    } else {
        Serial.println("fetch failed, leaving previous image");
    }

    goToSleep();
}

void loop()
{
    // Nothing to do here; all work is done in setup() before deep sleep
}