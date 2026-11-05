
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import dns from 'node:dns'

dns.setServers(['8.8.8.8', '1.1.1.1'])

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error('MONGODB_URI is missing from .env')
}

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
})

const db = client.db('studiospace')

let isConnected = false

export async function connectToMongoDB() {
  try {
    await client.connect()
    await db.command({ ping: 1 })

    isConnected = true
    console.log('You successfully connected to MongoDB!')

    return client
  } catch (err) {
    isConnected = false
    console.error('MongoDB connection failed:', err)
    throw err
  }
}

export function getDb() {
  if (!isConnected) {
    throw new Error('MongoDB is not connected yet.')
  }

  return db
}
