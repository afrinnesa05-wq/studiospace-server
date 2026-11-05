
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'

const COLLECTION_NAME = 'studios'

export function getStudiosCollection() {
  return getDb().collection(COLLECTION_NAME)
}

// Fields a client may send when creating or updating a studio.
const UPDATABLE_FIELDS = new Set([
  'title',
  'category',
  'description',
  'hourlyRate',
  'securityDeposit',
  'maxCapacity',
  'location',
  'imageUrl',
  'images',
  'amenities',
  'hostName',
  'hostEmail',
  'rating',
])

// Server-managed fields
const SERVER_MANAGED_FIELDS = new Set([
  '_id',
  'createdAt',
  'updatedAt',
])

// Required when creating a studio
const REQUIRED_FIELDS = [
  'title',
  'category',
  'description',
  'hourlyRate',
  'location',
  'hostName',
  'hostEmail',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidObjectId(id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validateField(name, value) {
  switch (name) {
    case 'title':
    case 'category':
    case 'description':
    case 'location':
    case 'hostName':
      return isNonEmptyString(value)
        ? null
        : `"${name}" must be a non-empty string.`

    case 'hostEmail':
      return isNonEmptyString(value) &&
        EMAIL_PATTERN.test(value.trim())
        ? null
        : '"hostEmail" must be a valid email address.'

    case 'hourlyRate':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
        ? null
        : '"hourlyRate" must be a number greater than or equal to 0.'

    case 'securityDeposit':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0
        ? null
        : '"securityDeposit" must be a number greater than or equal to 0.'

    case 'maxCapacity':
      return Number.isInteger(value) && value >= 1
        ? null
        : '"maxCapacity" must be an integer of at least 1.'

    case 'rating':
      return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 5
        ? null
        : '"rating" must be a number between 0 and 5.'

    case 'imageUrl': {
      if (typeof value !== 'string') {
        return '"imageUrl" must be a string.'
      }

      if (value.trim() === '') return null

      try {
        const url = new URL(value.trim())

        return ['http:', 'https:'].includes(url.protocol)
          ? null
          : '"imageUrl" must use HTTP or HTTPS.'
      } catch {
        return '"imageUrl" must be a valid URL.'
      }
    }

    case 'images':
    case 'amenities':
      return Array.isArray(value) &&
        value.every((item) => isNonEmptyString(item))
        ? null
        : `"${name}" must be an array of non-empty strings.`

    default:
      return null
  }
}

// Validate a POST body (full) or a PUT body (partial).
export function validateStudioInput(body, { partial = false } = {}) {
  const errors = []

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      valid: false,
      errors: ['Request body must be a JSON object.'],
    }
  }

  for (const key of Object.keys(body)) {
    if (SERVER_MANAGED_FIELDS.has(key)) {
      errors.push(`"${key}" is managed by the server and cannot be set.`)
      continue
    }

    if (!UPDATABLE_FIELDS.has(key)) {
      errors.push(`"${key}" is not a valid studio field.`)
      continue
    }

    const fieldError = validateField(key, body[key])

    if (fieldError) errors.push(fieldError)
  }

  if (partial) {
    const provided = Object.keys(body).filter((key) =>
      UPDATABLE_FIELDS.has(key)
    )

    if (provided.length === 0) {
      errors.push('Provide at least one studio field to update.')
    }
  } else {
    for (const field of REQUIRED_FIELDS) {
      const value = body[field]

      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')

      if (missing) {
        errors.push(`"${field}" is required.`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Build a document for a new studio.
export function buildStudioDocument(body) {
  const now = new Date()

  return {
    title: body.title.trim(),
    category: body.category.trim(),
    description: body.description.trim(),
    hourlyRate: body.hourlyRate,
    securityDeposit: body.securityDeposit ?? 0,
    maxCapacity: body.maxCapacity ?? 1,
    location: body.location.trim(),
    imageUrl: typeof body.imageUrl === 'string'
      ? body.imageUrl.trim()
      : '',
    images: (body.images ?? []).map((image) => image.trim()),
    amenities: (body.amenities ?? []).map((amenity) => amenity.trim()),
    hostName: body.hostName.trim(),
    hostEmail: body.hostEmail.trim().toLowerCase(),
    rating: body.rating ?? 0,
    createdAt: now,
    updatedAt: now,
  }
}

// Build the $set object for a partial update.
export function buildUpdateSet(body) {
  const set = {}

  for (const key of UPDATABLE_FIELDS) {
    if (!(key in body)) continue

    const value = body[key]

    if (typeof value === 'string') {
      set[key] = value.trim()
    } else if (Array.isArray(value)) {
      set[key] = value.map((item) =>
        typeof item === 'string' ? item.trim() : item
      )
    } else {
      set[key] = value
    }
  }

  if (typeof set.hostEmail === 'string') {
    set.hostEmail = set.hostEmail.toLowerCase()
  }

  return set
}
