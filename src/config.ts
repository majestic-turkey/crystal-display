const PORT = Number(process.env.PORT || 7000)
const HOST = '0.0.0.0'
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}`

export { PORT, HOST, BASE_URL }