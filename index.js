
import express from 'express'
import 'dotenv/config'
import { connectToMongoDB } from './src/db.js'
import studioRoutes from './src/routes/studio.routes.js'
import bookingRoutes from './src/routes/booking.routes.js'
import { verifyAuth } from './src/middleware/auth.middleware.js'

const app = express()
const port = process.env.PORT || 8000

// CORS configuration
const allowedOrigins = [
  'https://studiospace-six.vercel.app',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL || '').split(','),
]
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (origin && allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    )

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    )
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  next()
})

// JSON body limit
app.use(express.json({ limit: '1mb' }))

// Request logger
app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.originalUrl)
  next()
})

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'StudioSpace server is running!',
  })
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

// Start server after MongoDB connection
async function startServer() {
  try {
    await connectToMongoDB()

    app.listen(port, '0.0.0.0', () => {
      console.log(`StudioSpace server is running on port ${port}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error)
    process.exit(1)
  }
}

startServer()

