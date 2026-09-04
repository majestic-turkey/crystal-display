import './env.js'
import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'
import { renderWeatherTemplate, renderCalendarTemplate, renderPhotoTemplate, renderNewsTemplate } from './render/template.js'

const PAGE_TYPES = ['weather', 'calendar', 'photo', 'news']
const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

app.get('/preview', async (req, res) => {
  const mode = req.query.mode ? req.query.mode.toString() : null
  const page = req.query.page ? req.query.page.toString() : PAGE_TYPES[Math.floor(Math.random() * PAGE_TYPES.length)]
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
})

app.use('/assets', Express.static('public/assets'))

app.use((_req, res) => {
  res.status(404).send('Not Found. If you are trying to access the preview, please use the /preview route.')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})