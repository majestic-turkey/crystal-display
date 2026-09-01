import Express from 'express'
import { capture } from './render/capture.js'
import { reencodePng } from './render/converter.js'
import { PORT, HOST } from './config.js'

const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

// Send the index.html file for the preview route
app.get('/preview', async (req, res) => {
  if (req.query.mode === '1bit') {
    const pngBuffer = await capture(req.path)
    return res.type('image/png').send(reencodePng(pngBuffer))
  }
  res.sendFile('public/index.html', { root: process.cwd() })
})

app.use('/assets', Express.static('public/assets'))

app.use((_req, res) => {
  res.status(404).send('Not Found. If you are trying to access the preview, please use the /preview route.')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})