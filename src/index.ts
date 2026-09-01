import Express from 'express'

const PORT = Number(process.env.PORT || 7000)
const HOST = '0.0.0.0'

const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

// Send the index.html file for the preview route
app.get('/preview', (req, res) => {
  if (req.query.mode === '1bit') {
    res.sendFile('public/preview-1bit.html', { root: process.cwd() })
    return
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