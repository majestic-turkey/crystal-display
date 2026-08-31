import Express from 'express'

const PORT = process.env.PORT || 7000

const app = Express()

app.get('/', (req, res) => {
  res.send('Hello World! This is a test server for Crystal Display.')
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})