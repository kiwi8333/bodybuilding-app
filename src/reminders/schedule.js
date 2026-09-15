// Decides which notification (if any) is due for one subscriber right now.
// Pure and timezone-aware; shared by the app (to preview) and the scheduled
// sender (to decide). The sender runs every ~15 minutes, and scheduled runs
// can be late, so each reminder has a 3-hour window and is sent at most once
// per day per type.

export const WINDOW_MINUTES = 180
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function localParts(now, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function addDays(dateKey, days) {
  const t = Date.UTC(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)))
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(fromKey, toKey) {
  const t = (k) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)))
  return Math.round((t(toKey) - t(fromKey)) / DAY_MS)
}

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * prefs = { timezone, days: [0-6], time: 'HH:MM', nudgeMissed, nudgeBackup,
 *           since: 'YYYY-MM-DD', lastWorkoutDate, lastBackupDate,
 *           nextWorkoutName, nextWorkoutMinutes, deloadActive }
 * lastSent = { train?, missed?, backup? } (local dates already sent)
 * Returns null or { type, date, title, body, url }.
 */
export function dueNotification(prefs, lastSent = {}, now = new Date()) {
  if (!isValidTimeZone(prefs.timezone)) return null
  const { date, weekday, minutes } = localParts(now, prefs.timezone)
  const [h, m] = prefs.time.split(':').map(Number)
  const start = h * 60 + m
  if (minutes < start || minutes >= start + WINDOW_MINUTES) return null

  const days = new Set(prefs.days)
  const trainedToday = prefs.lastWorkoutDate === date
  const workoutName = prefs.nextWorkoutName || 'your workout'

  if (days.has(weekday) && !trainedToday && lastSent.train !== date) {
    return {
      type: 'train',
      date,
      title: prefs.deloadActive ? `Deload session: ${workoutName}` : `Time to train: ${workoutName}`,
      body: prefs.deloadActive
        ? 'Lighter week. One set fewer, easy weights. Tap to start.'
        : `About ${prefs.nextWorkoutMinutes || 60} min: warm-up, lifting and treadmill. Tap to start.`,
      url: '#/',
    }
  }

  const yesterday = addDays(date, -1)
  const yesterdayWeekday = (weekday + 6) % 7
  const missedYesterday =
    prefs.nudgeMissed &&
    days.has(yesterdayWeekday) &&
    !days.has(weekday) &&
    prefs.since <= yesterday &&
    (!prefs.lastWorkoutDate || prefs.lastWorkoutDate < yesterday) &&
    !trainedToday
  if (missedYesterday && lastSent.missed !== date) {
    return {
      type: 'missed',
      date,
      title: 'Missed yesterday’s session?',
      body: `No problem. Do ${workoutName} today to stay on track.`,
      url: '#/',
    }
  }

  const backupOverdue = !prefs.lastBackupDate || daysBetween(prefs.lastBackupDate, date) >= 7
  if (prefs.nudgeBackup && weekday === 0 && backupOverdue && daysBetween(prefs.since, date) >= 7 && lastSent.backup !== date) {
    return {
      type: 'backup',
      date,
      title: 'Back up your progress',
      body: 'It has been a week. Tap to save a backup to Google Drive, iCloud or email.',
      url: '#/settings',
    }
  }

  return null
}
