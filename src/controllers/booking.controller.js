
import { ObjectId } from 'mongodb'
import {
  getBookingsCollection,
  buildBookingDocument,
  isValidObjectId,
} from '../models/booking.model.js'
import { getStudiosCollection } from '../models/studio.model.js'

// Create a new booking
export async function createBooking(req, res, next) {
  try {
    const {
      studioId,
      bookingDate,
      startTime,
      endTime,
    } = req.body

    // Validate required fields
    if (!studioId || !bookingDate || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided.',
      })
    }

    // Validate studio ID
    if (!isValidObjectId(studioId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid studio ID.',
      })
    }

    // Validate booking date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking date format.',
      })
    }

    // Validate time format
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/

    if (!validTime.test(startTime) || !validTime.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format. Use HH:mm.',
      })
    }

    // Validate time range
    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be later than start time.',
      })
    }

    // Get authenticated user from JWT
    const user = req.user

    // Find studio
    const studio = await getStudiosCollection().findOne({
      _id: new ObjectId(studioId),
    })

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: 'Studio not found.',
      })
    }

    // Check overlapping pending or confirmed bookings
    const overlappingBooking = await getBookingsCollection().findOne({
      studioId: new ObjectId(studioId),
      bookingDate,
      status: {
        $in: ['Pending', 'Confirmed'],
      },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    })

    if (overlappingBooking) {
      return res.status(409).json({
        success: false,
        message: 'This studio is already booked for the selected time.',
      })
    }

    // Build booking document
    const bookingDocument = buildBookingDocument({
      studio,
      user,
      bookingDate,
      startTime,
      endTime,
    })

    // Save booking
    const result = await getBookingsCollection().insertOne(
      bookingDocument
    )

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully.',
      data: {
        ...bookingDocument,
        _id: result.insertedId,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get bookings for the authenticated user
export async function getMyBookings(req, res, next) {
  try {
    const email = req.user.email

    const bookings = await getBookingsCollection()
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray()

    return res.status(200).json({
      success: true,
      data: bookings,
    })
  } catch (error) {
    next(error)
  }
}

// Cancel only the authenticated user's pending booking
export async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params
    const email = req.user.email

    // Validate booking ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID.',
      })
    }

    // Cancel only the user's pending booking
    const result = await getBookingsCollection().updateOne(
      {
        _id: new ObjectId(id),
        userEmail: email,
        status: 'Pending',
      },
      {
        $set: {
          status: 'Cancelled',
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending booking not found.',
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
    })
  } catch (error) {
    next(error)
  }
}