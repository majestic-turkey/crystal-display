import './env.js'
import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'
import { getCachedRender } from './render/cache.js'
import { startScheduler } from './render/job.js'
import { closeBrowser } from './browser.js'
import { ditherModeFor, isPageType, randomPage, renderPageHtml, type PageType } from './render/pages.js'

import { renderWeatherTemplate, renderCalendarTemplate, renderPhotoTemplate, renderNewsTemplate } from './render/template.js'

const PAGE_TYPES = ['weather', 'calendar', 'photo', 'news']
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

  const page: PageType = requested !== null
    ? (requested as PageType)
    : PAGE_TYPES[Math.floor(Math.random() * PAGE_TYPES.length)] as PageType

  const requestBaseUrl = `${req.protocol}://${req.get('host')}`
  if (page === 'weather') {
    const { getWeatherData } = await import('./adapters/weather.js')
    const weather = await getWeatherData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderWeatherTemplate(weather))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderWeatherTemplate(weather, requestBaseUrl))
  } else if (page === 'calendar') {
    const { getCalendarData } = await import('./adapters/calendar.js')
    const calendar = await getCalendarData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderCalendarTemplate(calendar))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderCalendarTemplate(calendar, requestBaseUrl))
  } else if (page === 'photo') {
    const { getPhotoData } = await import('./adapters/photos.js')
    const photo = await getPhotoData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderPhotoTemplate(photo))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderPhotoTemplate(photo, requestBaseUrl))
  } else if (page === 'news') {
    const { getNewsData } = await import('./adapters/news.js')
    const news = await getNewsData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderNewsTemplate(news))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderNewsTemplate(news, requestBaseUrl))
  }

  const html = await renderPageHtml(page)
  if (mode !== '1bit') return res.send(html)

  const png = await capture(html)
  return res.type('image/png').send(reencodePng(png, ditherModeFor(page)))
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
