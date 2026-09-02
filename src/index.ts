import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'
import { renderTemplate } from './render/template.js'
import { getWeatherData } from './adapters/weather.js'

const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

// Send the index.html file for the preview route
app.get('/preview', async (req, res) => {
  const mode = req.query.mode ? req.query.mode.toString() : null
  const weather = await getWeatherData()
  if (mode === '1bit') {
    const pngBuffer = await capture(renderTemplate(weather))
    return res.type('image/png').send(reencodePng(pngBuffer))
  }
  res.send(renderTemplate(weather))
})

app.use('/assets', Express.static('public/assets'))

app.use((_req, res) => {
  res.status(404).send('Not Found. If you are trying to access the preview, please use the /preview route.')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})