type DataAdapter<T> = {
    name: "Weather" | "News" | "Calendar" | "Photo"
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

type PhotoData = {
    src: string
}

type Headline = {
    title: string
    url: string
    publishedAt: string
}

type NewsData = {
    headlines: Headline[]
}

export type { DataAdapter, WeatherData, CalendarData, PhotoData, Headline, NewsData }