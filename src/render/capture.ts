import pngjs from 'pngjs'
import { getBrowser, closeBrowser } from '../browser.js'
import { BASE_URL } from '../config.js'

// Capture a screenshot of the given URL and return the path to the saved PNG file
export async function capture(url: string): Promise<{ data: Buffer, width: number, height: number }> {
    const browser = await getBrowser()
    const page = await browser.newPage({
        viewport: { width: 800, height: 480 },
        deviceScaleFactor: 1,
    })
    try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' })
        const pngBuffer = await page.screenshot({
            clip: { x: 0, y: 0, width: 800, height: 480 },
        })
        const png = pngjs.PNG.sync.read(pngBuffer)
        return { data: png.data, width: png.width, height: png.height }
    } finally {
        await page.close()
    }
}