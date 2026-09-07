import { capture } from './capture.js'
import { encodeMonoBmp } from './bitmap.js'
import { ditherImage } from './dither.js'
import { getLastMeta, loadCache, writeCache, type RenderMeta } from './cache.js'
import { PAGE_TYPES, ditherModeFor, renderPageHtml, type PageType } from './pages.js'

const REFRESH_MINUTE = 50 // the device wakes on the hour; render just before it does
const STALE_AFTER_MS = 90 * 60 * 1000

// One render at a time: a boot render and a timer tick must not open two pages at once.
let inFlight: Promise<void> | null = null

function nextPage(): { page: PageType; rotationIndex: number } {
    const index = getLastMeta()?.rotationIndex ?? 0
    const page = PAGE_TYPES[index % PAGE_TYPES.length]!
    return { page, rotationIndex: (index + 1) % PAGE_TYPES.length }
}

async function renderOnce(): Promise<void> {
    const { page, rotationIndex } = nextPage()
    const started = Date.now()

    const html = await renderPageHtml(page)
    const png = await capture(html)
    const bits = ditherImage(png.data, png.width, png.height, ditherModeFor(page))
    const bmp = encodeMonoBmp(bits, png.width, png.height)

    const meta: RenderMeta = { generatedAt: new Date().toISOString(), page, rotationIndex }
    await writeCache(bmp, meta)
    console.log(`Rendered ${page} (${bmp.length} bytes) in ${Date.now() - started}ms`)
}

/**
 * Regenerate the cached bitmap. Never throws: a failed render must leave the
 * previous good BMP in place rather than blanking the wall.
 */
export function regenerate(): Promise<void> {
    if (inFlight) return inFlight

    inFlight = renderOnce()
        .catch(error => { console.error('Render failed, keeping previous bitmap:', error) })
        .finally(() => { inFlight = null })

    return inFlight
}

function msUntilNextRefresh(now: Date): number {
    const next = new Date(now)
    next.setMinutes(REFRESH_MINUTE, 0, 0)
    if (next <= now) next.setHours(next.getHours() + 1)
    return next.getTime() - now.getTime()
}

// setTimeout rather than setInterval so drift can't accumulate and push the
// render past the hour boundary the device wakes on.
function scheduleNext(): void {
    const delay = msUntilNextRefresh(new Date())
    console.log(`Next render in ${Math.round(delay / 1000)}s`)
    // unref so the timer alone never holds the process open; the HTTP listener does that.
    setTimeout(() => {
        void regenerate()
        scheduleNext()
    }, delay).unref()
}

export async function startScheduler(): Promise<void> {
    const existing = await loadCache()
    const age = existing ? Date.now() - new Date(existing.meta.generatedAt).getTime() : NaN
    const fresh = Number.isFinite(age) && age < STALE_AFTER_MS // NaN from an unparseable timestamp counts as stale

    if (fresh && existing) {
        console.log(`Serving cached ${existing.meta.page} render from ${existing.meta.generatedAt}`)
    } else {
        console.log(existing ? 'Cached render is stale, rendering now' : 'No cached render found, rendering now')
        void regenerate()
    }

    scheduleNext()
}
