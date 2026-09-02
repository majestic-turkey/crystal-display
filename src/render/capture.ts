import pngjs from 'pngjs'
import { getBrowser } from '../browser.js'

// Capture a screenshot of the given URL and return the path to the saved PNG file
export async function capture(html: string): Promise<{ data: Buffer, width: number, height: number }> {
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
}