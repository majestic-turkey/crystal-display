import fs from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '../config.js'
import { PAGE_TYPES, isPageType, type PageType } from './pages.js'

const BMP_PATH = path.join(DATA_DIR, 'render.bmp')
const META_PATH = path.join(DATA_DIR, 'render.json')

export type RenderMeta = {
    generatedAt: string   // ISO timestamp of the render that produced render.bmp
    page: PageType        // which page that render shows
    rotationIndex: number // index into PAGE_TYPES of the page *after* this one
}

export type CachedRender = {
    buffer: Buffer
    meta: RenderMeta
}

// Served from memory so a device request never touches the disk or the browser.
let cached: CachedRender | null = null
// Tracked separately from the bitmap: losing render.bmp must not reset the page
// rotation, or every cold start would show weather again.
let lastMeta: RenderMeta | null = null

export function getCachedRender(): CachedRender | null {
    return cached
}

export function getLastMeta(): RenderMeta | null {
    return lastMeta
}

export function parseMeta(raw: string): RenderMeta | null {
    try {
        const meta = JSON.parse(raw)
        if (typeof meta?.generatedAt !== 'string') return null
        if (typeof meta?.page !== 'string' || !isPageType(meta.page)) return null
        const rotationIndex = Number(meta?.rotationIndex)
        if (!Number.isInteger(rotationIndex)) return null
        return { generatedAt: meta.generatedAt, page: meta.page, rotationIndex: rotationIndex % PAGE_TYPES.length }
    } catch {
        return null
    }
}

/**
 * Repopulate the in-memory cache from disk. Lets a restart mid-hour keep serving
 * the last good render instead of 503ing until the next scheduled regeneration.
 */
export async function loadCache(): Promise<CachedRender | null> {
    // Read the two independently: a missing or unreadable bitmap still leaves the
    // rotation index usable, and vice versa.
    const meta = await fs.readFile(META_PATH, 'utf-8').then(parseMeta).catch(() => null)
    if (meta) lastMeta = meta

    const buffer = await fs.readFile(BMP_PATH).catch(() => null)
    if (!buffer || !meta) return null

    cached = { buffer, meta }
    return cached
}

/**
 * Write atomically: a crash mid-write must not leave a truncated bitmap that the
 * device would happily draw as garbage.
 */
export async function writeCache(buffer: Buffer, meta: RenderMeta): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const tmpBmp = `${BMP_PATH}.tmp`
    const tmpMeta = `${META_PATH}.tmp`

    await fs.writeFile(tmpBmp, buffer)
    await fs.rename(tmpBmp, BMP_PATH)
    await fs.writeFile(tmpMeta, JSON.stringify(meta, null, 2))
    await fs.rename(tmpMeta, META_PATH)

    cached = { buffer, meta }
    lastMeta = meta
}
