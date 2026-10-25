import type { DataAdapter, GameScore, ScoresData, TeamScore } from "../types.js"
import fs from "fs/promises"

const TIME_ZONE = "America/New_York"
const BIG_TEN_GROUP = 5
const OHIO_STATE_ID = "194"
const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard"

function espnDateKey(now: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now).replaceAll("-", "") // returns YYYYMMDD
}
function kickoffTime(iso: string): string {
    return new Intl.DateTimeFormat("en_US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso))
}

function parseTeam(competitor: any): TeamScore {
    const rank = competitor.curatedRank?.current
    return {
        id: String(competitor.team.id),
        name: String(competitor.team.abbreviation),
        score: Number(competitor.score ?? 0),
        rank: rank && rank <= 25 ? rank : null
    }
}

const involvesOhioState = (game: GameScore) => game.home.id === OHIO_STATE_ID || game.away.id === OHIO_STATE_ID

export function parseScores(data: any): ScoresData {
    const events = Array.isArray(data?.events) ? data.events : []
    const games: GameScore[] = events.map((event: any) => {
        const competition = event.competitions[0]
        const status = competition.status.type
        return {
            state: status.state,
            detail: status.state === "pre" ? kickoffTime(event.date) : status.shortDetail,
            home: parseTeam(competition.competitors.find((c: any) => c.homeAway === "home")),
            away: parseTeam(competition.competitors.find((c: any) => c.homeAway === "away"))
        }
    })
    const ohioState = games.find(involvesOhioState) ?? null
    return { ohioState, others: games.filter(game => game !== ohioState) }
}

export async function getScoresData(): Promise<DataAdapter<ScoresData>> {
    try {
        const flag = process.env.MODE === "production" ? "prod" : "test"
        let scores: ScoresData

        if (flag === "test") {
            console.log("Using test data for scores")
            const raw = await fs.readFile(new URL("../fixtures/scores.json", import.meta.url), "utf-8")
            scores = JSON.parse(raw) as ScoresData
        } else {
            const response = await fetch(`${SCOREBOARD_URL}?groups=${BIG_TEN_GROUP}&dates=${espnDateKey(new Date())}`, {
                headers: { "User-Agent": "display.thesaltworks.io (contact: sodium.smith@gmail.com)" },
                signal: AbortSignal.timeout(5000)
            })
            if (!response.ok) throw new Error(`Failed to fetch scores feed: ${response.status} ${response.statusText}`)
            scores = parseScores(await response.json())
        }

        return {
            name: "Scores",
            fetchedAt: new Date().toISOString(),
            data: scores
        }
    } catch (error) {
        console.error("Failed to load scores data:", error)
        return {
            name: "Scores",
            fetchedAt: new Date().toISOString(),
            data: null
        }
    }
}