type DataAdapter<T> = {
    name: "Weather" | "News" | "Calendar" | "Photo" | "Scores" | "Psalm"
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

type TeamScore = {
    id: string
    name: string
    score: number
    rank: number | null
}

type GameScore = {
    state: "pre" | "in" | "post"
    detail: string
    home: TeamScore
    away: TeamScore
}

type ScoresData = {
    ohioState: GameScore | null
    others: GameScore[]
}

type PsalmData = {
    day: string           // liturgical day, e.g. "Thirtieth Sunday in Ordinary Time"
    citation: string      // "Psalm 18:2-3, 3-4, 47, 51"
    response: string      // the refrain the congregation sings back
    stanzas: string[][]   // each stanza's lines, refrains removed
}

export type { DataAdapter, WeatherData, CalendarData, PhotoData, Headline, NewsData, TeamScore, GameScore, ScoresData, PsalmData }