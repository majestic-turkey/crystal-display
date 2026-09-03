import type { CalendarData, DataAdapter, WeatherData } from "../types.js";
import { escapeHtml } from "../helpers.js"
import { BASE_URL } from "../config.js"

function windDirectionToArrow(direction: string): string {
    const normalized = direction.trim().toUpperCase();

    if (["S", "SSW", "SSE"].includes(normalized)) return "↑";
    if (["SW", "WSW"].includes(normalized)) return "↗";
    if (["W", "WNW"].includes(normalized)) return "→";
    if (["NW", "NNW"].includes(normalized)) return "↘";
    if (["N", "NNE"].includes(normalized)) return "↓";
    if (["NE", "ENE"].includes(normalized)) return "↙";
    if (["E", "ESE"].includes(normalized)) return "←";
    if (["SE"].includes(normalized)) return "↖";

    return "?";
}

export function renderWeatherTemplate(weatherData: DataAdapter<WeatherData>, baseUrl: string = BASE_URL): string {
    const weather = weatherData.data;
    const temperature = weather ? `${Math.round(weather.temperature)}F` : "--F";
    const windSpeed = weather?.windSpeed ? escapeHtml(`${weather.windSpeed}`) : "-- mph";
    const windDirection = weather?.windDirection ? escapeHtml(weather.windDirection) : "--";
    const windArrow = weather ? windDirectionToArrow(weather?.windDirection) : "?";
    const shortForecast = weather?.shortForecast ? escapeHtml(weather?.shortForecast) : "Forecast unavailable";
    const precipitationProbability = weather?.precipitationProbability;
    const precipitationDisplay = precipitationProbability === null || precipitationProbability === undefined
        ? "--%"
        : `${Math.round(precipitationProbability)}%`;
    const fetchedAt = new Date(weatherData.fetchedAt).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/New_York",
    });

    const weatherTemplate = `<!DOCTYPE html>
<html>
    <head>
    <base href="${baseUrl}/">
        <meta charset="utf-8">
        <link rel="stylesheet" href="/assets/styles.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Ink Weather</title>
    </head>
    <body>
        <main class="panel">
            <header class="topbar" id="cell-0">
                <div class="clock">Weather</div>
                <div class="status">Current Conditions</div>
                <div class="wifi">${fetchedAt}</div>
            </header>

            <section class="metrics" id="cell-1">
                <article class="metric metric-invert" id="cell-2">
                    <h2>Temp</h2>
                    <p>${temperature}</p>
                </article>
                <article class="metric" id="cell-3">
                    <h2>Wind Speed</h2>
                    <p>${windSpeed}</p>
                </article>
                <article class="metric" id="cell-4">
                    <h2>Precip Chance</h2>
                    <p class="precipitation">${precipitationDisplay}</p>
                </article>
            </section>

            <section class="content-grid">
                <article class="card" id="cell-5">
                    <h3>Wind</h3>
                    <ul>
                        <li>Direction: From the ${windDirection}</li>
                        <li class="wind-arrow">${windArrow}</li>
                        <li>Summary: ${windDirection} ${windArrow} at ${windSpeed}</li>
                    </ul>
                </article>

                <article class="card" id="cell-6">
                    <h3>Short Forecast</h3>
                    <p>${shortForecast}</p>
                </article>
            </section>

            <footer class="footer" id="cell-7">
                <span>Source: NWS Hourly Forecast</span>
                <span class="badge" id="cell-8">${weather ? "OK" : "no data"}</span>
            </footer>
        </main>
    </body>
</html>`
    return weatherTemplate
}

export function renderCalendarTemplate(calendarData: DataAdapter<CalendarData>, baseUrl: string = BASE_URL): string {
    const calendar = calendarData.data
    const date = calendar ? escapeHtml(calendar.date) : "Date unavailable"

    const dayOfWeek = calendar ? escapeHtml(calendar.dayOfWeek) : "Day unavailable"
    const holidays = calendar ? calendar.holidays.slice(0, 8) : []
    const holidayColumnOne = holidays.slice(0, 4)
    const holidayColumnTwo = holidays.slice(4, 8)
    const holidaysColumnOneMarkup = holidayColumnOne.length > 0
        ? holidayColumnOne.map(holiday => `<li>${escapeHtml(holiday)}</li>`).join("")
        : "<li>No holidays today</li>"
    const holidaysColumnTwoMarkup = holidayColumnTwo
        .map(holiday => `<li>${escapeHtml(holiday)}</li>`)
        .join("")
    return `<!DOCTYPE html>
<html>
    <head>
        <base href="${baseUrl}/">
        <meta charset="utf-8">
        <link rel="stylesheet" href="/assets/styles.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Ink Calendar</title>
    </head>
    <body>
        <main class="panel">
            <header class="topbar" id="cell-0">
                <div class="clock">Calendar</div>
                <div class="status">Current Date</div>
                <div class="wifi"></div>
            </header>
            <section class="metrics metrics-calendar" id="cell-1">
                <article class="metric metric-invert" id="cell-2">
                    <h2>Day of Week</h2>
                    <p>${dayOfWeek}</p>
                </article>
                <article class="metric" id="cell-3">
                    <h2>Date</h2>
                    <p>${date}</p>
                </article>
            </section>
            <section class="content-grid">
                <article class="card card-calendar-holidays" id="cell-4">
                    <h3>Holidays</h3>
                    <div class="holiday-columns">
                        <ul class="holiday-list">
                            ${holidaysColumnOneMarkup}
                        </ul>
                        <ul class="holiday-list">
                            ${holidaysColumnTwoMarkup}
                        </ul>
                    </div>
                </article>
            </section>
            <footer class="footer" id="cell-5">
                <span>Source: Calendar Data</span>
                <span class="badge" id="cell-6">${calendar ? "OK" : "no data"}</span>
            </footer>
        </main>
    </body>
</html>`   
}

export const renderPhotoTemplate = (photoData: DataAdapter<{ src: string | null }>, baseUrl: string = BASE_URL): string => {
    const photo = photoData.data;
    const photoSrc = photo?.src ? escapeHtml(photo.src) : null;

    return `<!DOCTYPE html>
<html>
    <head>
        <base href="${baseUrl}/">
        <meta charset="utf-8">
        <link rel="stylesheet" href="/assets/styles.css">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Ink Photo</title>
    </head>
    <body class="photo-screen">
        <main class="photo-panel" id="cell-0">
            ${photoSrc
        ? `<img src="${photoSrc}" alt="Random Photo" class="photo-image photo-image-full">`
        : `<p class="photo-empty">No photo available</p>`}
        </main>
    </body>
</html>`;
}