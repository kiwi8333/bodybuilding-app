import { get, put } from '@vercel/blob'

// All reminder records live in one small private JSON blob. Writes are
// conditional on the ETag read (ifMatch) so concurrent writers never silently
// overwrite each other; update() retries a pure mutation on fresh state.
// This mirrors the proven pattern in the Grace Daily app.
const PATHNAME = 'forge-reminders.json'
const MAX_ATTEMPTS = 5
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function readWithEtag() {
  // useCache: false avoids CDN-stale reads (which would also carry stale etags).
  const result = await get(PATHNAME, { access: 'private', useCache: false })
  if (!result || result.statusCode !== 200) return { records: [], etag: null }
  const records = await new Response(result.stream).json()
  // get() returns a weak etag; put()'s ifMatch needs the strong form.
  return { records: Array.isArray(records) ? records : [], etag: result.blob.etag.replace(/^W\//, '') }
}

async function write(records, etag) {
  await put(PATHNAME, JSON.stringify(records), {
    access: 'private',
    contentType: 'application/json',
    allowOverwrite: true,
    ifMatch: etag ?? undefined,
  })
}

export const blobStore = {
  async read() {
    return (await readWithEtag()).records
  },
  async update(mutate) {
    let lastError
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { records, etag } = await readWithEtag()
      // Errors thrown by mutate (e.g. 403) are not write conflicts: rethrow.
      const next = mutate(records)
      try {
        await write(next, etag)
        return next
      } catch (err) {
        lastError = err
        if (attempt < MAX_ATTEMPTS) await sleep(30 * attempt + Math.random() * 50)
      }
    }
    throw lastError
  },
}
