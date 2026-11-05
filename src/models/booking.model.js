
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'

const COLLECTION_NAME = 'bookings'

export function getBookingsCollection() {
  return getDb().collection(COLLECTION_NAME)
}

// Validate a MongoDB ObjectId strictly
export function isValidObjectId(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(id)
  )
}

export function buildBookingDocument({
  studio,
  user,
  bookingDate,
  startTime,
  endTime,
}) {
  const now = new Date()

  return {
    studioId: new ObjectId(studio._id),
    studioTitle: studio.title,

    userId: user.id,
    userName: user.name,
    userEmail: user.email,

    bookingDate,
    startTime,
    endTime,

    hourlyRate: studio.hourlyRate,
    totalPrice: calculateTotalPrice(
      studio.hourlyRate,
      startTime,
      endTime
    ),

    status: 'Pending',
    createdAt: now,
    updatedAt: now,
  }
}

export function calculateTotalPrice(hourlyRate, startTime, endTime) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)

  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute

  const totalHours = (end - start) / 60

  return totalHours * hourlyRate
}

