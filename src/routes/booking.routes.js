
import { Router } from 'express'
import {
  createBooking,
  getMyBookings,
  cancelBooking,
} from '../controllers/booking.controller.js'
import { verifyAuth } from '../middleware/auth.middleware.js'

const router = Router()

// Protected routes
router.post('/', verifyAuth, createBooking)
router.get('/my-bookings', verifyAuth, getMyBookings)
router.patch('/:id/cancel', verifyAuth, cancelBooking)

export default router
