import type { DataAdapter, Headline, NewsData } from "../types.js"
import fs from "fs/promises"
import { XMLParser } from "fast-xml-parser"

const FEED_URL = "https://www.goodnewsnetwork.org/feed/"
const HEADLINE_COUNT = 5

function parseFeed(xml: string): Headline[] {
    const parser = new XMLParser({ htmlEntities: true })
    const feed = parser.parse(xml)
    const items = feed?.rss?.channel?.item
    const itemList = Array.isArray(items) ? items : items ? [items] : []

    return itemList.slice(0, HEADLINE_COUNT).map((item: any) => ({
        title: String(item.title),
        url: String(item.link),
        publishedAt: new Date(item.pubDate).toISOString()
    }))
}

export async function getNewsData(): Promise<DataAdapter<NewsData>> {
    try {
        const flag = process.env.MODE === "production" ? "prod" : "test"
        let headlines: Headline[]

        if (flag === "test") {
            console.log("Using test data for news")
            const raw = await fs.readFile(new URL("../fixtures/news.json", import.meta.url), "utf-8")
            headlines = (JSON.parse(raw) as NewsData).headlines
        } else {
            const response = await fetch(FEED_URL, {
                headers: { "User-Agent": "display.thesaltworks.io (contact: sodium.smith@gmail.com)" },
                signal: AbortSignal.timeout(5000)
            })
            if (!response.ok) throw new Error(`Failed to fetch news feed: ${response.status} ${response.statusText}`)
            headlines = parseFeed(await response.text())
        }

        return {
            name: "News",
            fetchedAt: new Date().toISOString(),
            data: { headlines }
        }
    } catch (error) {
        console.error("Failed to load news data:", error)
        return {
            name: "News",
            fetchedAt: new Date().toISOString(),
            data: null
        }
    }
}
