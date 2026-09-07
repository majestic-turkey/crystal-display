import './env.js'
import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'
import { getCachedRender } from './render/cache.js'
import { startScheduler } from './render/job.js'
import { closeBrowser } from './browser.js'
import { ditherModeFor, isPageType, randomPage, renderPageHtml } from './render/pages.js'

const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

app.get('/preview', async (req, res) => {
  const mode = req.query.mode ? req.query.mode.toString() : null
  const requested = req.query.page ? req.query.page.toString() : null

  if (requested !== null && !isPageType(requested)) {
    return res.status(400).send(`Unknown page: ${requested}`)
  }
  const page = requested ?? randomPage()

  // Captures omit the request base URL so the screenshot browser loads assets
  // over the loopback BASE_URL rather than back through nginx.
  if (mode === '1bit') {
    const png = await capture(await renderPageHtml(page))
    return res.type('image/png').send(reencodePng(png, ditherModeFor(page)))
  }

  const requestBaseUrl = `${req.protocol}://${req.get('host')}`
  return res.send(await renderPageHtml(page))
})

// The device's endpoint. Serves only what is already on disk — a browser must
// never be launched while the panel is awake waiting on the response.
app.get('/render.bmp', (_req, res) => {
  const cached = getCachedRender()
  if (!cached) {
    return res.status(503).set('Retry-After', '3600').send('No render available yet')
  }

  res.type('image/bmp')
    .set('Last-Modified', new Date(cached.meta.generatedAt).toUTCString())
    .set('ETag', `"${cached.meta.page}-${cached.meta.generatedAt}"`)
    .set('Cache-Control', 'no-cache')
    .send(cached.buffer)
})

app.use('/assets', Express.static('public/assets'))

app.use((_req, res) => {
  res.status(404).send('Not Found. If you are trying to access the preview, please use the /preview route.')
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
  void startScheduler()
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`)
    server.close(() => {
      void closeBrowser().then(() => process.exit(0))
    })
  })
}
