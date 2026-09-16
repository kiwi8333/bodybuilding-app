import { applyCors, handleSubscribe, readRawBody, sendError, HttpError } from './_lib/handlers.js'
import { blobStore, signupStore } from './_lib/store.js'
import { allowRequest, clientIp } from './_lib/rateLimit.js'

export default async function handler(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    if (!allowRequest(clientIp(req))) throw new HttpError(429, 'Too many requests, try again shortly')
    let body
    try {
      body = JSON.parse(await readRawBody(req))
    } catch (err) {
      if (err instanceof HttpError) throw err
      throw new HttpError(400, 'Invalid JSON')
    }
    const result = await handleSubscribe(blobStore, body, new Date(), { signupStore, ip: clientIp(req) })
    res.status(result.status).json(result.body)
  } catch (err) {
    sendError(res, err)
  }
}
