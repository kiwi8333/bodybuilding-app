import { get, put } from '@vercel/blob'

// Small private JSON blobs. Writes are conditional on the ETag read (ifMatch)
// so concurrent writers never silently overwrite each other; update() retries a
// pure mutation on fresh state. This mirrors the proven pattern in the Grace
// Daily app.
const MAX_ATTEMPTS = 5
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function jsonBlob(pathname, empty, coerce = (v) => v) {
  async function readWithEtag() {
    // useCache: false avoids CDN-stale reads (which would also carry stale etags).
    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) return { value: empty(), etag: null }
    const value = coerce(await new Response(result.stream).json())
    // get() returns a weak etag; put()'s ifMatch needs the strong form.
    return { value: value ?? empty(), etag: result.blob.etag.replace(/^W\//, '') }
  }

  return {
    async read() {
      return (await readWithEtag()).value
    },
    async update(mutate) {
      let lastError
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { value, etag } = await readWithEtag()
        // Errors thrown by mutate (e.g. 403) are not write conflicts: rethrow.
        const next = mutate(value)
        try {
          await put(pathname, JSON.stringify(next), {
            access: 'private',
            contentType: 'application/json',
            allowOverwrite: true,
            ifMatch: etag ?? undefined,
          })
          return next
        } catch (err) {
          lastError = err
          if (attempt < MAX_ATTEMPTS) await sleep(30 * attempt + Math.random() * 50)
        }
      }
      throw lastError
    },
  }
}

export const blobStore = jsonBlob('forge-reminders.json', () => [], (v) => (Array.isArray(v) ? v : []))
