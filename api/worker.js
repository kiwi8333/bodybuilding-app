import { handleWorker, readRawBody, sendError, HttpError } from './_lib/handlers.js'
import { blobStore } from './_lib/store.js'
import { WORKER_PUBLIC_KEY_PEM } from './_lib/keys.js'

// Called only by the scheduled GitHub Action, authenticated by signature.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    const raw = await readRawBody(req)
    const result = await handleWorker(blobStore, raw, req.headers['x-signature'], WORKER_PUBLIC_KEY_PEM)
    res.status(result.status).json(result.body)
  } catch (err) {
    sendError(res, err)
  }
}
