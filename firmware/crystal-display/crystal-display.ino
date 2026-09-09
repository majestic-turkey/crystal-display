#include <Arduino.h>
#include "esp_sleep.h"

// 20 seconds while testing. Change to 3600 once the full cucle works.
// uint64_t keeps microsecond math from overflowing
static const uint64_t SLEEP_SECONDS = 20;

// Survives deep sleep. Stored in RTC memory.
RTC_DATA_ATTR int bootCount = 0;

void setup() {
    Serial.begin(115200);
    delay(100); // lets the USB serial connection establish
    
    bootCount++;
    Serial.printf("wake #%d\n", bootCount);
    Serial.printf("sleeping %11u seconds\n", SLEEP_SECONDS);
    Serial.flush();

    esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000ULL);
    esp_deep_sleep_start();
    // Nothing past this point is reached; deep sleep never returns
}

void loop() {
    // Nothing to do here; all work is done in setup() before deep sleep
}