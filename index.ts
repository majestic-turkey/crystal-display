import Express from 'express'

const PORT = Number(process.env.PORT || 7000)
const HOST = '0.0.0.0'

const app = Express()

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

app.use(Express.static('public'))

app.use((_req, res) => {
  res.status(404).send('Not Found')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})