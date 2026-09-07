import pngjs from 'pngjs'
import { getBrowser } from '../browser.js'

// Each open page costs a renderer process, so cap how many exist at once.
// Two lets a manual preview overlap the hourly job without stacking up.
const MAX_CONCURRENT_CAPTURES = 2
// Past this, shed load instead of queueing forever: every waiting request pins
// an open connection and its HTML until it runs.
const MAX_QUEUED_CAPTURES = 6

export class CaptureBusyError extends Error {
    constructor() {
        super('Renderer is busy')
        this.name = 'CaptureBusyError'
    }
}

let active = 0
const waiting: Array<() => void> = []

/** Reserve a page slot. Rejects with CaptureBusyError once the queue is full. */
function acquire(priority: boolean): Promise<void> {
    if (active < MAX_CONCURRENT_CAPTURES) {
        active++
        return Promise.resolve()
    }
    // The scheduled render is what keeps the wall current, so it always queues
    // rather than being shed by a burst of preview traffic.
    if (!priority && waiting.length >= MAX_QUEUED_CAPTURES) {
        return Promise.reject(new CaptureBusyError())
    }
    return new Promise<void>(resolve => waiting.push(() => { active++; resolve() }))
}

function release(): void {
    active--
    waiting.shift()?.()
}

export type CaptureOptions = {
    /** Never shed this capture when the queue is full; wait for a slot instead. */
    priority?: boolean
}

export async function capture(html: string, options: CaptureOptions = {}): Promise<{ data: Buffer, width: number, height: number }> {
    await acquire(options.priority ?? false)
    try {
        const browser = await getBrowser()
        const page = await browser.newPage({
            viewport: { width: 800, height: 480 },
            deviceScaleFactor: 1,
        })
        try {
            await page.setContent(html, { waitUntil: 'networkidle' })
            await page.evaluate(() => document.fonts.ready)
            const pngBuffer = await page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 480 } })
            const png = pngjs.PNG.sync.read(pngBuffer)
            return { data: png.data, width: png.width, height: png.height }
        } finally {
            await page.close()
        }
    } finally {
        release()
    }
}
