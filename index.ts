import Express from 'express'

const PORT = Number(process.env.PORT || 7000)
const HOST = '0.0.0.0'

const app = Express()

app.get('/', (req, res) => {
  res.send('Hello World! This is a test server for Crystal Display.')
})

app.get('/health', (_req, res) => {
  res.status(200).send('ok')
})

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`)
})