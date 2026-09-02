type DataAdapter<T> = {
    name: "Weather" | "News" | "Calendar"
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

type CalendarData = {
    date: string
    dayOfWeek: string
    holidays: string[]
}

export type { DataAdapter, WeatherData, CalendarData }