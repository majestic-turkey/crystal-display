import type { DataAdapter, PsalmData } from "../types.js"
import fs from "fs/promises"
import { XMLParser } from "fast-xml-parser"

const TIME_ZONE = "America/New_York"
// The RSS feed is USCCB's published machine-readable source; the HTML reading
// pages sit behind a bot challenge. It carries the last ten days, and each day's
// item appears shortly after midnight Eastern.
const FEED_URL = "https://bible.usccb.org/readings.rss"

// "R. (2) <strong>I love you, Lord, my strength.</strong>" — the verse number in
// parentheses only appears on the first refrain, and some days pad with &nbsp;.
const RESPONSE_PATTERN = /R\.(?:\s|&nbsp;)*(?:\([^)]*\)(?:\s|&nbsp;)*)?<strong>([\s\S]*?)<\/strong>/g
const PSALM_SECTION_PATTERN = /<h4>\s*Responsorial Psalm\b[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div class="poetry">([\s\S]*?)<\/div>/

// The psalm is fixed for the day, so fetch it once rather than every render.
// Only successes are cached: a failed fetch is retried on the next render.
let cached: { dateKey: string, psalm: PsalmData } | null = null

/** USCCB names each day's readings MMDDYY, e.g. /bible/readings/102526.cfm */
function usccbDateKey(now: Date): string {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "2-digit", day: "2-digit", year: "2-digit" }).formatToParts(now)
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? ""
    return `${part("month")}${part("day")}${part("year")}`
}

/** Strip tags and decode the few entities the feed's HTML uses. */
function toText(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Pull the responsorial psalm out of one day's readings HTML. Throws rather than
 * returning a half-parsed psalm, so a format change falls back to the rotation
 * instead of putting a broken page on the wall.
 */
export function parsePsalm(day: string, readingsHtml: string): PsalmData {
    const section = readingsHtml.match(PSALM_SECTION_PATTERN)
    if (!section) throw new Error("No responsorial psalm in readings")
    const [, citationHtml = "", body = ""] = section

    const response = body.match(new RegExp(RESPONSE_PATTERN.source))?.[1]
    // Refrains mark the stanza boundaries; "or:" introduces an alternate refrain.
    const stanzas = body
        .split(RESPONSE_PATTERN)
        .filter((_, index) => index % 2 === 0) // split() interleaves the captured refrains; keep only the text between them
        .map(chunk => chunk.split(/<br\s*\/?>|<\/p>/i).map(toText).filter(line => line && line.toLowerCase() !== "or:"))
        .filter(stanza => stanza.length > 0)

    if (!response || stanzas.length === 0) throw new Error("Unrecognized responsorial psalm format")
    return { day: toText(day), citation: toText(citationHtml), response: toText(response), stanzas }
}

async function fetchPsalm(dateKey: string): Promise<PsalmData> {
    const response = await fetch(FEED_URL, {
        // No email or URL here: like ESPN, the USCCB CDN rejects user agents containing them.
        headers: { "User-Agent": "display.thesaltworks.io" },
        signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) throw new Error(`Failed to fetch readings feed: ${response.status} ${response.statusText}`)

    const feed = new XMLParser({ htmlEntities: true }).parse(await response.text())
    const items = feed?.rss?.channel?.item
    const itemList: any[] = Array.isArray(items) ? items : items ? [items] : []
    const today = itemList.find(item => String(item.link).includes(`/readings/${dateKey}`))
    if (!today) throw new Error(`No readings for ${dateKey} in feed yet`)

    return parsePsalm(String(today.title), String(today.description))
}

export async function getPsalmData(): Promise<DataAdapter<PsalmData>> {
    const now = new Date()
    try {
        const flag = process.env.MODE === "production" ? "prod" : "test"
        let psalm: PsalmData

        if (flag === "test") {
            console.log("Using test data for psalm")
            const raw = await fs.readFile(new URL("../fixtures/psalm.json", import.meta.url), "utf-8")
            psalm = JSON.parse(raw) as PsalmData
        } else {
            const dateKey = usccbDateKey(now)
            if (cached?.dateKey !== dateKey) {
                cached = { dateKey, psalm: await fetchPsalm(dateKey) }
            }
            psalm = cached.psalm
        }

        return {
            name: "Psalm",
            fetchedAt: now.toISOString(),
            data: psalm
        }
    } catch (error) {
        console.error("Failed to load psalm data:", error)
        return {
            name: "Psalm",
            fetchedAt: now.toISOString(),
            data: null
        }
    }
}
