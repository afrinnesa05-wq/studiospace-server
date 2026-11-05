
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error('MONGODB_URI is missing from environment variables.')
}

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
})

const db = client.db('studiospace')

let isConnected = false

export async function connectToMongoDB() {
  try {
    if (isConnected) {
      return client
    }

    await client.connect()
    await db.command({ ping: 1 })

    isConnected = true

    console.log('Successfully connected to MongoDB!')

    return client
  } catch (error) {
    isConnected = false

    console.error('MongoDB connection failed:', error)

    throw error
  }
}

export function getDb() {
  if (!isConnected) {
    throw new Error('MongoDB is not connected yet.')
  }

  return db
}
