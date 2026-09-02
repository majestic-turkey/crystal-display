import type { DataAdapter, WeatherData } from "./types.js"
import fs from "fs/promises"

const nwsUrl = "https://api.weather.gov/gridpoints/ILN/86,88/forecast/hourly" // Coordinates represent Westerville, OH

export async function getWeatherData(): Promise<DataAdapter<WeatherData>> {
    try {
        const flag = process.env.MODE === "production" ? "prod" : "test";
        if (flag === "test") {
            console.log("Using test data for weather");
            const testData = await fs.readFile(new URL("../fixtures/weatherData.json", import.meta.url), "utf-8");
            return {
                name: "Weather",
                fetchedAt: new Date().toISOString(),
                data: parseWeatherData(JSON.parse(testData))
            };
        } else {
            const response = await fetch(nwsUrl, {
                method: "GET",
                headers: {
                    "User-Agent": "display.thesaltworks.io (contact: sodium.smith@gmail.com)",
                    "Accept": "application/geo+json"
                },
                signal: AbortSignal.timeout(5000) // Set a timeout of 5 seconds, since the API won't time out
            });

            if (!response.ok) throw new Error(`Failed to fetch weather data: ${response.status} ${response.statusText}`);
            const data = await response.json();

            return {
                name: "Weather",
                fetchedAt: new Date().toISOString(),
                data: parseWeatherData(data)
            }
        }
    } catch (error) {
        console.error("Failed to fetch weather data:", error);
        return {
            name: "Weather",
            fetchedAt: new Date().toISOString(),
            data: null
        };
    }
}

export function parseWeatherData(data: any): WeatherData {
    if (!data?.properties?.periods?.[0]) throw new Error(`Failed to fetch weather data: Missing periods data`);
    const period = data.properties.periods[0];
    return {
        temperature: period.temperature,
        windSpeed: period.windSpeed,
        windDirection: period.windDirection,
        shortForecast: period.shortForecast,
        precipitationProbability: period.probabilityOfPrecipitation?.value ?? null
    };
}