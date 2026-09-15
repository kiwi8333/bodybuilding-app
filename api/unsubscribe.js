import { applyCors, handleUnsubscribe, readRawBody, sendError, HttpError } from './_lib/handlers.js'
import { blobStore } from './_lib/store.js'

export default async function handler(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    let body
    try {
      body = JSON.parse(await readRawBody(req))
    } catch (err) {
      if (err instanceof HttpError) throw err
      throw new HttpError(400, 'Invalid JSON')
    }
    const result = await handleUnsubscribe(blobStore, body)
    res.status(result.status).json(result.body)
  } catch (err) {
    sendError(res, err)
  }
}
