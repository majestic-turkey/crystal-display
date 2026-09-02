type DataAdapter<T> = {
    name: "Weather" | "News"
    fetchedAt: string
    data: T | null
}

type WeatherData = {
    temperature: number
    windSpeed: string          // NWS sends a string (e.g., "5 mph") instead of a number, funny enough
    windDirection: string
    shortForecast: string
    precipitationProbability: number | null
}

export type { DataAdapter, WeatherData }