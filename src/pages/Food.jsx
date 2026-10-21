import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import {
  ACTIVITY_LEVELS,
  COMMON_FOODS,
  GOALS,
  LOSS_RATES,
  MEALS,
  PROTEIN_G_PER_KG,
  dailyTargets,
  dayTotals,
  goalProjection,
  loggingStreak,
  mealForTime,
  weeklyCheckIn,
} from '../logic/nutrition.js'
import {
  addBodyweight,
  addFoodEntry,
  applyCalorieAdjust,
  dateKey,
  deleteCustomFood,
  deleteFoodEntry,
  restoreFoodEntry,
  saveCustomFood,
  updateBodyProfile,
  updateNutritionSettings,
  updateWeightGoal,
} from '../logic/state.js'
import { formatDate } from '../lib/format.js'
import { addDays } from '../reminders/schedule.js'
import FoodSearch from '../components/FoodSearch.jsx'
import CountUp from '../components/CountUp.jsx'
import ProgressRing from '../components/ProgressRing.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { FoodIcon } from '../components/icons.jsx'
import { useToast } from '../components/Toasts.jsx'
import { useDialogs } from '../components/Dialogs.jsx'

// Calories as a ring: what is left today in the middle, amber once over target.
function CalorieRing({ value, target }) {
  const left = target - value
  const over = left < 0
  return (
    <div className="calorie-ring">
      <ProgressRing value={value} max={target} size={112} stroke={10} tone={over ? 'warn' : 'accent'} label="Calories eaten">
        <span className="ring-big">
          <CountUp value={Math.abs(left)} />
        </span>
        <span className="ring-small">{over ? 'kcal over' : 'kcal left'}</span>
      </ProgressRing>
      <div className="stack" style={{ gap: 4 }}>
        <span className="coach-label">Calories</span>
        <div className="meter-value">
          <strong>
            <CountUp value={value} />
          </strong>
          <span className="muted"> / {target.toLocaleString()} kcal</span>
        </div>
        <span className="hint">{over ? 'Over the target for this day.' : 'Eaten so far'}</span>
      </div>
    </div>
  )
}

function Meter({ label, value, target, unit, range }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0
  const left = Math.round((target - value) * 10) / 10
  return (
    <div className="meter">
      <div className="row between">
        <span className="coach-label">{label}</span>
        <span className="small text-2">
          {range ? `aim ${range[0]}–${range[1]} ${unit}` : `target ${target.toLocaleString()} ${unit}`}
        </span>
      </div>
      <div className="meter-value">
        <strong>
          <CountUp value={value} decimals={1} />
        </strong>
        <span className="muted"> / {target.toLocaleString()} {unit}</span>
      </div>
      <div className="progress" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={value} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="hint">{left > 0 ? `${left.toLocaleString()} ${unit} to go` : `Target reached${left < 0 ? ` (+${Math.abs(left).toLocaleString()} ${unit})` : ''}`}</span>
    </div>
  )
}

// Carbs and fat: small bars under the protein meter.
function MacroBars({ totals, targets }) {
  return (
    <div className="macro-bars">
      {[
        ['Carbs', totals.carbs, targets.carbs],
        ['Fat', totals.fat, targets.fat],
      ].map(([label, value, target]) => (
        <div className="macro" key={label}>
          <div className="row between">
            <span className="coach-label">{label}</span>
            <span className="small text-2">
              <CountUp value={value} decimals={0} /> / {target} g
            </span>
          </div>
          <div className="progress" aria-hidden>
            <span style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
          </div>
        </div>
      ))}
      {!totals.macrosComplete && <p className="hint">Some entries have no carb or fat values, so these are partial.</p>}
    </div>
  )
}

// Goal weight: where you are, how far to go, and when you will get there.
function GoalCard({ state, apply }) {
  const n = state.nutrition
  const current = state.bodyweight.at(-1)?.kg ?? null
  const start = state.bodyweight[0]?.kg ?? null
  const projection = goalProjection(n, current)
  const [editing, setEditing] = useState(!n.goalWeight)
  const [goalWeight, setGoalWeight] = useState(n.goalWeight ?? '')
  const [rate, setRate] = useState(n.weeklyRate ?? '')
  const [error, setError] = useState(null)

  function save(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => updateWeightGoal(s, { goalWeight, weeklyRate: rate }))
      setEditing(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const done = start && n.goalWeight && current ? Math.min(1, Math.max(0, (start - current) / (start - n.goalWeight || 1))) : 0
  const losing = n.goal === 'lose'

  return (
    <section className="card">
      <div className="row between">
        <h2>Your goal</h2>
        {!editing && (
          <button className="link-btn" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </div>
      {!editing && n.goalWeight && projection ? (
        <>
          <div className="goal-row">
            <ProgressRing value={projection.reached ? 1 : losing ? done : 0} max={1} size={72} stroke={8} tone={projection.reached ? 'good' : 'accent'}>
              <span className="ring-num" style={{ fontSize: '0.8rem' }}>
                {projection.reached ? '✓' : losing ? `${Math.round(done * 100)}%` : ''}
              </span>
            </ProgressRing>
            <div className="stack" style={{ gap: 2 }}>
              <strong className="goal-big">
                {current} kg → {n.goalWeight} kg
              </strong>
              <span className="small text-2">
                {projection.reached
                  ? 'Goal reached! Consider switching your goal to Recomposition to hold your new weight.'
                  : `${projection.kgToGo} kg to go`}
                {projection.date && ` · about ${projection.weeks} weeks, around ${projection.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </span>
            </div>
          </div>
          {losing && <p className="hint">Pace: {n.weeklyRate ? `${n.weeklyRate} kg a week` : 'standard (about 0.35 kg a week)'}. Projections assume you stick to your calorie target.</p>}
        </>
      ) : !editing ? (
        <p className="small text-2">Log your weight in Progress or on the Fast tab to see how far you have to go.</p>
      ) : (
        <form className="stack" style={{ gap: 10 }} onSubmit={save}>
          <div className="grid-2">
            <label className="field">
              Goal weight (kg)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} placeholder={current ? String(Math.round(current - 5)) : ''} />
            </label>
            {losing && (
              <label className="field">
                Pace
                <select className="input" value={rate} onChange={(e) => setRate(e.target.value)}>
                  <option value="">Standard (about 0.35 kg a week)</option>
                  {LOSS_RATES.map((r) => (
                    <option key={r.kg} value={r.kg}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {losing && <p className="hint">Losing 0.5–1% of your bodyweight a week keeps most of your muscle while you train. Faster paces are harder to stick to.</p>}
          {!losing && <p className="hint">Set your goal to “Lose fat, keep muscle” below to choose a weight-loss pace.</p>}
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" type="submit">
              Save goal
            </button>
            {n.goalWeight && (
              <button className="btn ghost" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  )
}

// Calories for the last 7 days against the target, plus the logging streak.
function FoodWeek({ log, target, today }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const kcal = days.map((d) => dayTotals(log[d]).kcal)
  const top = Math.max(target ?? 0, ...kcal, 1) * 1.1
  const H = 110
  const streak = loggingStreak(log, today)
  const logged = kcal.filter((k) => k > 0)
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : null
  return (
    <section className="card">
      <div className="row between">
        <h2>This week</h2>
        <span className="pill accent">{streak} day streak</span>
      </div>
      <figure className="week-chart" aria-label="Calories, last 7 days">
        <svg viewBox={`0 0 280 ${H + 22}`} role="img">
          {target && <line x1="0" x2="280" y1={H - (target / top) * H} y2={H - (target / top) * H} className="week-goal" />}
          {days.map((d, i) => {
            const h = (kcal[i] / top) * H
            const x = 8 + i * 39
            const over = target && kcal[i] > target
            return (
              <g key={d}>
                <rect x={x} y={H - Math.max(h, 3)} width="26" height={Math.max(h, 3)} rx="6" className={kcal[i] === 0 ? 'week-bar empty' : over ? 'week-bar over' : 'week-bar good'} />
                <text x={x + 13} y={H + 16} textAnchor="middle" className="week-day">
                  {new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </text>
                <title>{`${d}: ${kcal[i].toLocaleString()} kcal`}</title>
              </g>
            )
          })}
        </svg>
      </figure>
      <p className="hint">
        {avg ? `Average ${avg.toLocaleString()} kcal on days you logged` : 'Log food to see your week'}
        {target ? ` · target ${target.toLocaleString()} kcal (green line)` : ''}. Amber bars went over the target.
      </p>
    </section>
  )
}

function ProfileSetup({ state, apply, targets, onDone }) {
  const [sex, setSex] = useState(state.profile.sex ?? '')
  const age = state.profile.birthYear ? new Date().getFullYear() - state.profile.birthYear : ''
  const [ageInput, setAgeInput] = useState(age)
  const [height, setHeight] = useState(state.profile.heightCm ?? '')
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState(state.nutrition.goal)
  const [rate, setRate] = useState(state.nutrition.weeklyRate ?? 0.5)
  const [goalWeight, setGoalWeight] = useState(state.nutrition.goalWeight ?? '')
  const [error, setError] = useState(null)
  const needsWeight = targets.missing?.includes('bodyweight')

  function save(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => {
        let next = updateBodyProfile(s, { sex, age: ageInput, heightCm: height })
        if (needsWeight) next = addBodyweight(next, dateKey(), weight)
        next = updateNutritionSettings(next, { activity: next.nutrition.activity, goal })
        return updateWeightGoal(next, { goalWeight, weeklyRate: goal === 'lose' ? rate : next.nutrition.weeklyRate })
      })
      onDone?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="card accent" onSubmit={save}>
      <div className="stack" style={{ gap: 4 }}>
        <h2>Set your targets</h2>
        <p className="small text-2">A few details to calculate your calories and protein. They stay on this phone.</p>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Sex (for the calorie formula)">
        {[
          ['male', 'Male'],
          ['female', 'Female'],
        ].map(([id, label]) => (
          <button type="button" key={id} role="radio" aria-checked={sex === id} className={sex === id ? 'on' : ''} onClick={() => setSex(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <label className="field">
          Age
          <input className="input" type="number" inputMode="numeric" value={ageInput} onChange={(e) => setAgeInput(e.target.value)} required />
        </label>
        <label className="field">
          Height (cm)
          <input className="input" type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} required />
        </label>
        {needsWeight && (
          <label className="field">
            Bodyweight today (kg)
            <input className="input" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required />
          </label>
        )}
      </div>
      <label className="field">
        Your goal
        <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
          {GOALS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid-2">
        <label className="field">
          Goal weight (kg, optional)
          <input className="input" type="number" inputMode="decimal" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
        </label>
        {goal === 'lose' && (
          <label className="field">
            Pace
            <select className="input" value={rate} onChange={(e) => setRate(e.target.value)}>
              {LOSS_RATES.map((r) => (
                <option key={r.kg} value={r.kg}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" type="submit">
        Calculate my targets
      </button>
    </form>
  )
}

function AddFood({ onAdd: addToLog, customFoods, onSaveCustom, onDeleteCustom }) {
  const { confirm } = useDialogs()
  const [meal, setMeal] = useState(() => mealForTime())
  const onAdd = (food) => addToLog({ ...food, meal })
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState('1')
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [saveFav, setSaveFav] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('search')

  const foods = useMemo(() => {
    const all = [...customFoods.map((f) => ({ ...f, portion: 'saved', custom: true })), ...COMMON_FOODS]
    const q = query.trim().toLowerCase()
    return q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all
  }, [customFoods, query])

  function quickAdd(food) {
    setError(null)
    try {
      onAdd({ name: food.name, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, servings: Number(servings) })
    } catch (err) {
      setError(err.message)
    }
  }

  function addCustom(e) {
    e.preventDefault()
    setError(null)
    try {
      onAdd({ ...custom, servings: 1 })
      if (saveFav) onSaveCustom(custom)
      setCustom({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
      setSaveFav(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card">
      <h2>Add food</h2>
      <div className="meal-pick" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={meal === m.id} className={`meal-chip ${meal === m.id ? 'on' : ''}`} onClick={() => setMeal(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'search'} className={mode === 'search' ? 'on' : ''} onClick={() => setMode('search')}>
          Search & scan
        </button>
        <button role="tab" aria-selected={mode === 'quick'} className={mode === 'quick' ? 'on' : ''} onClick={() => setMode('quick')}>
          Quick list
        </button>
        <button role="tab" aria-selected={mode === 'custom'} className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
          Enter your own
        </button>
      </div>

      {mode === 'search' ? (
        <FoodSearch onAdd={onAdd} onSaveCustom={onSaveCustom} />
      ) : mode === 'quick' ? (
        <>
          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
            <label className="field">
              Search
              <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. chicken" />
            </label>
            <label className="field">
              Servings
              <select className="input" value={servings} onChange={(e) => setServings(e.target.value)}>
                {['0.5', '1', '1.5', '2', '3'].map((v) => (
                  <option key={v} value={v}>
                    × {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="clean food-list">
            {foods.map((f) => (
              <li key={f.id}>
                <span className="stack" style={{ gap: 1 }}>
                  <span>{f.name}</span>
                  <span className="hint">
                    {f.custom ? 'Saved food' : f.portion} · {f.kcal} kcal · {f.protein} g protein
                    {f.carbs != null && f.fat != null ? ` · ${f.carbs} g carbs · ${f.fat} g fat` : ''}
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {f.custom && (
                    <button className="btn small ghost" aria-label={`Delete saved food ${f.name}`} onClick={async () => (await confirm({ title: `Delete “${f.name}”?`, message: 'It is removed from your quick list. Entries already logged stay.', confirmLabel: 'Delete', tone: 'danger' })) && onDeleteCustom(f.id)}>
                      ✕
                    </button>
                  )}
                  <button className="btn small" onClick={() => quickAdd(f)} aria-label={`Add ${f.name}`}>
                    Add
                  </button>
                </span>
              </li>
            ))}
            {foods.length === 0 && <li className="hint">No match. Use “Enter your own”.</li>}
          </ul>
          <p className="hint">Values are typical averages (USDA). Check packaging for exact numbers.</p>
        </>
      ) : (
        <form className="stack" onSubmit={addCustom}>
          <label className="field">
            Food
            <input className="input" value={custom.name} maxLength={60} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} placeholder="e.g. Jollof rice, 1 plate" required />
          </label>
          <div className="grid-2">
            <label className="field">
              Calories (kcal)
              <input className="input" type="number" inputMode="numeric" value={custom.kcal} onChange={(e) => setCustom((c) => ({ ...c, kcal: e.target.value }))} required />
            </label>
            <label className="field">
              Protein (g)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={custom.protein} onChange={(e) => setCustom((c) => ({ ...c, protein: e.target.value }))} required />
            </label>
            <label className="field">
              Carbs (g, optional)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={custom.carbs} onChange={(e) => setCustom((c) => ({ ...c, carbs: e.target.value }))} />
            </label>
            <label className="field">
              Fat (g, optional)
              <input className="input" type="number" inputMode="decimal" step="0.1" value={custom.fat} onChange={(e) => setCustom((c) => ({ ...c, fat: e.target.value }))} />
            </label>
          </div>
          <label className="row small">
            <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
            Save to my quick list
          </label>
          <button className="btn primary" type="submit">
            Add
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

export default function Food() {
  const { notify } = useDialogs()
  const { state, apply } = useStore()
  const today = dateKey()
  const [date, setDate] = useState(today)
  const targets = dailyTargets(state.profile, state.nutrition, state.bodyweight)
  const entries = state.nutrition.log[date] ?? []
  const totals = dayTotals(entries)
  const checkIn = weeklyCheckIn(state.bodyweight, state.nutrition.goal, new Date(), state.nutrition.weeklyRate)
  const adjustedThisWeek = state.nutrition.lastAdjustDate && addDays(state.nutrition.lastAdjustDate, 7) > today
  const [settingsError, setSettingsError] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)

  const toast = useToast()

  function removeEntry(entry, index) {
    const day = date
    safeApply((s) => deleteFoodEntry(s, day, entry.id))
    toast({ message: `Removed ${entry.name}`, actionLabel: 'Undo', onAction: () => safeApply((s) => restoreFoodEntry(s, day, entry, index)) })
  }

  const safeApply = (fn) => {
    try {
      apply(fn)
    } catch (err) {
      notify({ title: 'That didn’t work', message: err.message })
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Nutrition</span>
        <h1>Food</h1>
      </div>

      {(!targets.ready || editingProfile) && <ProfileSetup state={state} apply={apply} targets={targets} onDone={() => setEditingProfile(false)} />}

      <section className="card">
        <div className="row between">
          <button className="btn small ghost" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Previous day">
            ‹
          </button>
          <h2>{date === today ? 'Today' : formatDate(date)}</h2>
          <button className="btn small ghost" onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= today} aria-label="Next day">
            ›
          </button>
        </div>
        {targets.ready ? (
          <div className="stack" style={{ gap: 14 }}>
            <CalorieRing value={totals.kcal} target={targets.kcal} />
            <Meter label="Protein" value={totals.protein} target={targets.protein} unit="g" range={targets.proteinRange} />
            <MacroBars totals={totals} targets={targets} />
          </div>
        ) : targets.protein ? (
          <Meter label="Protein" value={totals.protein} target={targets.protein} unit="g" range={targets.proteinRange} />
        ) : (
          <p className="hint">Totals: {totals.kcal} kcal · {totals.protein} g protein</p>
        )}
        {entries.length > 0 ? (
          <div className="stack" style={{ gap: 12 }}>
            {[...MEALS, { id: null, label: 'Other' }].map((m) => {
              const items = entries.map((e, i) => ({ e, i })).filter(({ e }) => (e.meal ?? null) === m.id)
              if (!items.length) return null
              const sub = dayTotals(items.map(({ e }) => e))
              return (
                <div key={m.label} className="meal-group">
                  <div className="row between meal-head">
                    <h3>{m.label}</h3>
                    <span className="small text-2">{sub.kcal.toLocaleString()} kcal</span>
                  </div>
                  <ul className="clean seg-list">
                    {items.map(({ e, i }) => (
                      <SwipeRow key={e.id} className="seg-row" onDelete={() => removeEntry(e, i)}>
                        <span>{e.name}</span>
                        <span className="row" style={{ gap: 8 }}>
                          <span className="text-2">
                            {e.kcal} kcal · {e.protein} g
                          </span>
                          <button className="link-btn" onClick={() => removeEntry(e, i)} aria-label={`Remove ${e.name}`}>
                            Remove
                          </button>
                        </span>
                      </SwipeRow>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState icon={<FoodIcon />} title={date === today ? 'Nothing logged today' : 'Nothing logged this day'}>
            Search, scan a barcode or pick from your quick list below. Swipe an entry left to remove it.
          </EmptyState>
        )}
      </section>

      <AddFood
        key={date}
        customFoods={state.nutrition.customFoods}
        onAdd={(food) => apply((s) => addFoodEntry(s, date, food))}
        onSaveCustom={(food) => safeApply((s) => saveCustomFood(s, food))}
        onDeleteCustom={(id) => safeApply((s) => deleteCustomFood(s, id))}
      />

      {targets.ready && <GoalCard state={state} apply={apply} />}
      <FoodWeek log={state.nutrition.log} target={targets.ready ? targets.kcal : null} today={today} />

      {targets.ready && (
        <section className="card">
          <h2>Weekly check-in</h2>
          {checkIn ? (
            <>
              <p className="small text-2">
                Average weight: {checkIn.priorAvg} kg → {checkIn.recentAvg} kg ({checkIn.weeklyChange >= 0 ? '+' : ''}
                {checkIn.weeklyChange} kg this week). Healthy range for your goal: {checkIn.range[0]} to {checkIn.range[1]} kg a week.
              </p>
              {checkIn.adjust === 0 ? (
                <p className="banner good small">Right on track. Keep your calories where they are.</p>
              ) : adjustedThisWeek ? (
                <p className="banner warn small">You adjusted calories within the last 7 days. Give it a week before changing again.</p>
              ) : (
                <div className="banner warn small" style={{ flexDirection: 'column' }}>
                  <span>
                    {checkIn.adjust > 0 ? 'Your weight is moving slower than your goal needs.' : 'Your weight is moving faster than your goal needs.'} Coach suggests{' '}
                    <strong>
                      {checkIn.adjust > 0 ? '+' : '−'}
                      {Math.abs(checkIn.adjust)} kcal a day
                    </strong>
                    .
                  </span>
                  <button className="btn small primary" onClick={() => safeApply((s) => applyCalorieAdjust(s, checkIn.adjust))}>
                    Apply to my target
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="small text-2">
              Weigh in at least twice a week (morning, after the bathroom) in <Link to="/progress">Progress</Link>. After two weeks the coach checks your trend and
              suggests calorie changes.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2>Goal and activity</h2>
        <label className="field">
          Goal
          <select
            className="input"
            value={state.nutrition.goal}
            onChange={(e) => {
              setSettingsError(null)
              try {
                apply((s) => updateNutritionSettings(s, { activity: s.nutrition.activity, goal: e.target.value }))
              } catch (err) {
                setSettingsError(err.message)
              }
            }}
          >
            {GOALS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Activity (outside of the planned training)
          <select
            className="input"
            value={state.nutrition.activity}
            onChange={(e) => {
              setSettingsError(null)
              try {
                apply((s) => updateNutritionSettings(s, { activity: e.target.value, goal: s.nutrition.goal }))
              } catch (err) {
                setSettingsError(err.message)
              }
            }}
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        {settingsError && <p className="error">{settingsError}</p>}
        {targets.ready && (
          <p className="hint">
            Resting burn {targets.bmr.toLocaleString()} kcal · maintenance about {targets.maintenance.toLocaleString()} kcal
            {state.nutrition.calorieAdjust ? ` · coach adjustment ${state.nutrition.calorieAdjust > 0 ? '+' : ''}${state.nutrition.calorieAdjust} kcal` : ''}.
            Protein {PROTEIN_G_PER_KG} g per kg of bodyweight, fat about 28% of calories, carbs the rest.
            {targets.floored && ' Your target is held at the 1,400 kcal minimum; eating less than that makes it hard to get enough nutrients.'}
          </p>
        )}
        {targets.ready && (
          <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setEditingProfile(true)}>
            Edit age, height or sex
          </button>
        )}
      </section>
    </>
  )
}
