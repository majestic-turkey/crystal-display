import './env.js'
import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'
import { renderWeatherTemplate, renderCalendarTemplate } from './render/template.js'
import { getWeatherData } from './adapters/weather.js'

const PAGE_TYPES = ['weather', 'calendar']
const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

app.get('/preview', async (req, res) => {
  const mode = req.query.mode ? req.query.mode.toString() : null
  const page = req.query.page ? req.query.page.toString() : PAGE_TYPES[Math.floor(Math.random() * PAGE_TYPES.length)]
  if (page === 'weather') {
    const weather = await getWeatherData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderWeatherTemplate(weather))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderWeatherTemplate(weather))
  } else if (page === 'calendar') {
    const { getCalendarData } = await import('./adapters/calendar.js')
    const calendar = await getCalendarData()
    if (mode === '1bit') {
      const pngBuffer = await capture(renderCalendarTemplate(calendar))
      return res.type('image/png').send(reencodePng(pngBuffer))
    }
    res.send(renderCalendarTemplate(calendar))
  }
})

app.use('/assets', Express.static('public/assets'))

app.use((_req, res) => {
  res.status(404).send('Not Found. If you are trying to access the preview, please use the /preview route.')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})