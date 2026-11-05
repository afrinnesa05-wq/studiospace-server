
import express from 'express'
import 'dotenv/config'
import { connectToMongoDB } from './src/db.js'
import studioRoutes from './src/routes/studio.routes.js'
import bookingRoutes from './src/routes/booking.routes.js'
import { verifyAuth } from './src/middleware/auth.middleware.js'

const app = express()
const port = 8000

// Connect MongoDB
connectToMongoDB()

// CORS configuration
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin

  console.log('Request Origin:', origin)
  console.log('Allowed Origins:', allowedOrigins)

  if (origin && allowedOrigins.includes(origin.replace(/\/$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    )
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    )
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  next()
})

// Limit JSON request body size to 1MB
app.use(express.json({ limit: '1mb' }))

// Request logger
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.originalUrl)
  next()
})

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running fine!' })
})

// Authentication check
app.get('/api/auth-check', verifyAuth, (req, res) => {
  res.json({
    success: true,
    message: 'JWT verified successfully!',
  })
})

// API routes
app.use('/api/studios', studioRoutes)
app.use('/api/bookings', bookingRoutes)

console.log('Booking routes mounted successfully')
console.log(
  'Registered booking routes:',
  bookingRoutes.stack.map((layer) => layer.route?.path).filter(Boolean)
)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  })
})

// Central error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err)

  const status = err.status || 500

  res.status(status).json({
    success: false,
    message:
      status === 413
        ? 'Request body is too large. Maximum allowed size is 1MB.'
        : err.message || 'Internal server error',
    ...(err.errors ? { errors: err.errors } : {}),
  })
})

// Start server
app.listen(port, () => {
  console.log(`Server is running at port ${port}`)
})