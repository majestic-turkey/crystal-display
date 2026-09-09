#include <Arduino.h>
#include <string.h>
#include "esp_sleep.h"
#include "DEV_Config.h"
#include "EPD.h"

// From the library's constants
#define FB_ROW_BYTES (EPD_7IN5_V2_WIDTH / 8) // 100
#define FB_SIZE (FB_ROW_BYTES * EPD_7IN5_V2_HEIGHT) // 100 * 480 = 48000

// 60 seconds while testing. Change to 3600 once the full cucle works.
// uint64_t keeps microsecond math from overflowing
static const uint64_t SLEEP_SECONDS = 60;

// Survives deep sleep. Stored in RTC memory.
RTC_DATA_ATTR int bootCount = 0;

// Reserve at link-time, zero-filled. Prevents runtime nulls.
static uint8_t framebuffer[FB_SIZE];

void setup() {
    Serial.begin(115200);
    delay(100); // lets the USB serial connection establish
    
    bootCount++;
    Serial.printf("wake #%d\n", bootCount);

    // Top quarter black, rest white. Confirms black/white bit polarity and vertical orientation.
    const size_t bar = FB_SIZE / 4; // Exactly 120 rows
    memset(framebuffer, 0x00, bar);
    memset(framebuffer + bar, 0xFF, FB_SIZE - bar);

    Serial.println("panel init");
    DEV_Module_Init();
    EPD_7IN5_V2_Init();
    EPD_7IN5_V2_Clear();

    Serial.println("drawing");
    EPD_7IN5_V2_Display(framebuffer);

    // Required before ESP32 sleeps
    EPD_7IN5_V2_Sleep();

    Serial.printf("sleeping %llu seconds\n", SLEEP_SECONDS);
    Serial.flush();

    esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000ULL);
    esp_deep_sleep_start();
    // Nothing past this point is reached; deep sleep never returns
}

void loop() {
    // Nothing to do here; all work is done in setup() before deep sleep
}