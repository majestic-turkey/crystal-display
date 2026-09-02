import type { DataAdapter, CalendarData } from "../types.js"
import fs from "fs/promises"
import path from "path"
import { Holidays } from "holiday-event-api"
import { DATA_DIR } from "../config.js"

const TIME_ZONE = "America/New_York"
const CACHE_PATH = path.join(DATA_DIR, "holidays-cache.json")

type HolidayCache = {
    date: string       // "YYYY-MM-DD", the day this cache entry was fetched for
    holidays: string[]
}

function isoDateKey(now: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now) // "YYYY-MM-DD"
}

async function readCachedHolidays(dateKey: string): Promise<string[] | null> {
    try {
        const raw = await fs.readFile(CACHE_PATH, "utf-8")
        const cache: HolidayCache = JSON.parse(raw)
        return cache.date === dateKey ? cache.holidays : null
    } catch {
        return null
    }
}

async function writeCachedHolidays(dateKey: string, holidays: string[]): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(CACHE_PATH, JSON.stringify({ date: dateKey, holidays } satisfies HolidayCache))
}

async function fetchLiveHolidays(): Promise<string[]> {
    const api = new Holidays({ apiKey: process.env.CHECKIDAY_API_KEY ?? "" })
    // The `timezone` param is a paid-plan feature; the free tier always resolves
    // "today" in America/Chicago, which can lag Eastern by up to an hour near midnight.
    const response = await api.getEvents()
    return response.events.map(event => event.name)
}

async function getHolidays(dateKey: string): Promise<string[]> {
    const flag = process.env.MODE === "production" ? "prod" : "test"
    if (flag === "test") {
        console.log("Using test data for calendar")
        const raw = await fs.readFile(new URL("../fixtures/holidays.json", import.meta.url), "utf-8")
        const holidaysByDate: Record<string, string[]> = JSON.parse(raw)
        return holidaysByDate[dateKey.slice(5)] ?? [] // fixture is keyed by "MM-DD"
    }

    const cached = await readCachedHolidays(dateKey)
    if (cached) return cached

    const holidays = await fetchLiveHolidays()
    await writeCachedHolidays(dateKey, holidays)
    return holidays
}

export async function getCalendarData(): Promise<DataAdapter<CalendarData>> {
    const now = new Date()
    const dateKey = isoDateKey(now)
    try {
        const holidays = await getHolidays(dateKey)
        return {
            name: "Calendar",
            fetchedAt: now.toISOString(),
            data: {
                date: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TIME_ZONE }).format(now),
                dayOfWeek: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TIME_ZONE }).format(now),
                holidays
            }
        }
    } catch (error) {
        console.error("Failed to load calendar data:", error)
        return {
            name: "Calendar",
            fetchedAt: now.toISOString(),
            data: null
        }
    }
}
