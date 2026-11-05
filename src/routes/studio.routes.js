
import { Router } from 'express'
import {
  createStudio,
  deleteStudio,
  getStudio,
  listStudios,
  updateStudio,
} from '../controllers/studio.controller.js'
import { verifyAuth } from '../middleware/auth.middleware.js'

const router = Router()

// Public routes
router.get('/', listStudios)
router.get('/:id', getStudio)

// Protected routes
router.post('/', verifyAuth, createStudio)
router.put('/:id', verifyAuth, updateStudio)
router.delete('/:id', verifyAuth, deleteStudio)

export default router
