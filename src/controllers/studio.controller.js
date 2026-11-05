
import { ObjectId } from 'mongodb'
import {
  buildStudioDocument,
  buildUpdateSet,
  getStudiosCollection,
  isValidObjectId,
  validateStudioInput,
} from '../models/studio.model.js'

// Named sort presets
const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { hourlyRate: 1 },
  price_desc: { hourlyRate: -1 },
  rating_desc: { rating: -1 },
  rating_asc: { rating: 1 },
}

function httpError(status, message, errors) {
  const error = new Error(message)
  error.status = status

  if (errors) error.errors = errors

  return error
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page)
  const limit = query.limit === undefined ? 10 : Number(query.limit)

  if (!Number.isInteger(page) || page < 1) {
    throw httpError(400, 'page must be a positive integer.')
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw httpError(400, 'limit must be an integer between 1 and 100.')
  }

  return { page, limit }
}

// GET /api/studios
export async function listStudios(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query)

    const sortKey = req.query.sort || 'newest'

    if (!SORT_OPTIONS[sortKey]) {
      throw httpError(
        400,
        `Invalid sort. Allowed values: ${Object.keys(SORT_OPTIONS).join(', ')}.`
      )
    }

    const filter = {}

    if (req.query.category) {
      const value = escapeRegex(String(req.query.category).trim())
      filter.category = {
        $regex: `^${value}$`,
        $options: 'i',
      }
    }

    if (req.query.location) {
      const value = escapeRegex(String(req.query.location).trim())
      filter.location = {
        $regex: value,
        $options: 'i',
      }
    }

    if (req.query.search) {
      const value = escapeRegex(String(req.query.search).trim())
      const rx = { $regex: value, $options: 'i' }

      filter.$or = [
        { title: rx },
        { description: rx },
        { location: rx },
      ]
    }

    if (req.query.minPrice !== undefined) {
      const value = Number(req.query.minPrice)

      if (!Number.isFinite(value)) {
        throw httpError(400, 'minPrice must be a number.')
      }

      filter.hourlyRate = {
        ...(filter.hourlyRate || {}),
        $gte: value,
      }
    }

    if (req.query.maxPrice !== undefined) {
      const value = Number(req.query.maxPrice)

      if (!Number.isFinite(value)) {
        throw httpError(400, 'maxPrice must be a number.')
      }

      filter.hourlyRate = {
        ...(filter.hourlyRate || {}),
        $lte: value,
      }
    }

    if (
      filter.hourlyRate?.$gte !== undefined &&
      filter.hourlyRate?.$lte !== undefined &&
      filter.hourlyRate.$gte > filter.hourlyRate.$lte
    ) {
      throw httpError(400, 'minPrice cannot be greater than maxPrice.')
    }

    const collection = getStudiosCollection()

    const total = await collection.countDocuments(filter)
    const totalPages = Math.ceil(total / limit)

    const data = await collection
      .find(filter)
      .sort(SORT_OPTIONS[sortKey])
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/studios/:id
export async function getStudio(req, res, next) {
  try {
    const { id } = req.params

    if (!isValidObjectId(id)) {
      throw httpError(
        400,
        'Invalid studio id. Expected a 24-character hexadecimal string.'
      )
    }

    const studio = await getStudiosCollection().findOne({
      _id: new ObjectId(id),
    })

    if (!studio) {
      throw httpError(404, 'Studio not found.')
    }

    return res.json({
      success: true,
      data: studio,
    })
  } catch (error) {
    next(error)
  }
}

// POST /api/studios
export async function createStudio(req, res, next) {
  try {
    const user = req.user

    // Never trust host identity from the frontend
    const studioInput = {
      ...req.body,
      hostName: user.name,
      hostEmail: user.email,
    }

    const { valid, errors } = validateStudioInput(studioInput, {
      partial: false,
    })

    if (!valid) {
      throw httpError(400, 'Validation failed.', errors)
    }

    const document = buildStudioDocument(studioInput)

    const result = await getStudiosCollection().insertOne(document)

    return res.status(201).json({
      success: true,
      message: 'Studio created successfully.',
      data: {
        ...document,
        _id: result.insertedId,
      },
    })
  } catch (error) {
    next(error)
  }
}

// PUT /api/studios/:id
export async function updateStudio(req, res, next) {
  try {
    const { id } = req.params
    const user = req.user

    if (!isValidObjectId(id)) {
      throw httpError(
        400,
        'Invalid studio id. Expected a 24-character hexadecimal string.'
      )
    }

    // Prevent changing studio ownership
    const updateBody = { ...req.body }

    delete updateBody.hostName
    delete updateBody.hostEmail

    const { valid, errors } = validateStudioInput(updateBody, {
      partial: true,
    })

    if (!valid) {
      throw httpError(400, 'Validation failed.', errors)
    }

    const set = buildUpdateSet(updateBody)
    const collection = getStudiosCollection()

    // Only the owner can update this studio
    const result = await collection.updateOne(
      {
        _id: new ObjectId(id),
        hostEmail: user.email,
      },
      {
        $set: {
          ...set,
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      throw httpError(404, 'Studio not found or you are not the owner.')
    }

    const updated = await collection.findOne({
      _id: new ObjectId(id),
      hostEmail: user.email,
    })

    return res.json({
      success: true,
      message: 'Studio updated successfully.',
      data: updated,
    })
  } catch (error) {
    next(error)
  }
}

// DELETE /api/studios/:id
export async function deleteStudio(req, res, next) {
  try {
    const { id } = req.params
    const user = req.user

    if (!isValidObjectId(id)) {
      throw httpError(
        400,
        'Invalid studio id. Expected a 24-character hexadecimal string.'
      )
    }

    // Only the owner can delete this studio
    const result = await getStudiosCollection().deleteOne({
      _id: new ObjectId(id),
      hostEmail: user.email,
    })

    if (result.deletedCount === 0) {
      throw httpError(404, 'Studio not found or you are not the owner.')
    }

    return res.json({
      success: true,
      message: 'Studio deleted successfully.',
    })
  } catch (error) {
    next(error)
  }
}
