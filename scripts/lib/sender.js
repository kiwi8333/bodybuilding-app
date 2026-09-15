// One run of the reminder sender: list sealed records, decide what is due,
// send pushes, then report what was sent and which subscriptions are dead.
// Dependencies are injected so the whole flow is unit-tested.

import { open } from '../../src/reminders/crypto.js'
import { dueNotification } from '../../src/reminders/schedule.js'

export async function runSender({ callWorker, sendPush, sealingPrivateJwk, now = new Date(), log = console }) {
  const { records } = await callWorker({ action: 'list' })
  const marks = []
  const removeIds = []
  let sent = 0

  for (const record of records) {
    let payload
    try {
      payload = await open(sealingPrivateJwk, record.sealed)
    } catch {
      log.warn(`reminders: could not decrypt record ${record.id.slice(0, 8)}…, skipping`)
      continue
    }
    const note = dueNotification(payload.prefs, record.lastSent ?? {}, now)
    if (!note) continue
    try {
      await sendPush(payload.subscription, JSON.stringify({ title: note.title, body: note.body, url: note.url, tag: `forge-${note.type}` }))
      marks.push({ id: record.id, type: note.type, date: note.date })
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        removeIds.push(record.id)
      } else {
        log.error(`reminders: push failed for ${record.id.slice(0, 8)}… (status ${err.statusCode ?? '?'}): ${err.message ?? err}`)
      }
    }
  }

  if (marks.length) await callWorker({ action: 'mark', marks })
  if (removeIds.length) await callWorker({ action: 'remove', ids: removeIds })
  return { checked: records.length, sent, removed: removeIds.length }
}
