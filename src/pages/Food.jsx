import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/StoreContext.jsx'
import { ACTIVITY_LEVELS, COMMON_FOODS, GOALS, PROTEIN_G_PER_KG, dailyTargets, dayTotals, weeklyCheckIn } from '../logic/nutrition.js'
import {
  addBodyweight,
  addFoodEntry,
  applyCalorieAdjust,
  dateKey,
  deleteCustomFood,
  deleteFoodEntry,
  saveCustomFood,
  updateBodyProfile,
  updateNutritionSettings,
} from '../logic/state.js'
import { formatDate } from '../lib/format.js'
import { addDays } from '../reminders/schedule.js'

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
        <strong>{value.toLocaleString()}</strong>
        <span className="muted"> / {target.toLocaleString()} {unit}</span>
      </div>
      <div className="progress" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={value} aria-label={label}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="hint">{left > 0 ? `${left.toLocaleString()} ${unit} to go` : `Target reached${left < 0 ? ` (+${Math.abs(left).toLocaleString()} ${unit})` : ''}`}</span>
    </div>
  )
}

function ProfileSetup({ state, apply, targets, onDone }) {
  const [sex, setSex] = useState(state.profile.sex ?? '')
  const age = state.profile.birthYear ? new Date().getFullYear() - state.profile.birthYear : ''
  const [ageInput, setAgeInput] = useState(age)
  const [height, setHeight] = useState(state.profile.heightCm ?? '')
  const [weight, setWeight] = useState('')
  const [error, setError] = useState(null)
  const needsWeight = targets.missing.includes('bodyweight')

  function save(e) {
    e.preventDefault()
    setError(null)
    try {
      apply((s) => {
        let next = updateBodyProfile(s, { sex, age: ageInput, heightCm: height })
        if (needsWeight) next = addBodyweight(next, dateKey(), weight)
        return next
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
      {error && <p className="error">{error}</p>}
      <button className="btn primary block" type="submit">
        Calculate my targets
      </button>
    </form>
  )
}

function AddFood({ onAdd, customFoods, onSaveCustom, onDeleteCustom }) {
  const [query, setQuery] = useState('')
  const [servings, setServings] = useState('1')
  const [custom, setCustom] = useState({ name: '', kcal: '', protein: '' })
  const [saveFav, setSaveFav] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('quick')

  const foods = useMemo(() => {
    const all = [...customFoods.map((f) => ({ ...f, portion: 'saved', custom: true })), ...COMMON_FOODS]
    const q = query.trim().toLowerCase()
    return q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all
  }, [customFoods, query])

  function quickAdd(food) {
    setError(null)
    try {
      onAdd({ name: food.name, kcal: food.kcal, protein: food.protein, servings: Number(servings) })
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
      setCustom({ name: '', kcal: '', protein: '' })
      setSaveFav(false)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card">
      <h2>Add food</h2>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'quick'} className={mode === 'quick' ? 'on' : ''} onClick={() => setMode('quick')}>
          Quick list
        </button>
        <button role="tab" aria-selected={mode === 'custom'} className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
          Enter your own
        </button>
      </div>

      {mode === 'quick' ? (
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
                  </span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {f.custom && (
                    <button className="btn small ghost" aria-label={`Delete saved food ${f.name}`} onClick={() => window.confirm(`Delete saved food "${f.name}"?`) && onDeleteCustom(f.id)}>
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
  const { state, apply } = useStore()
  const today = dateKey()
  const [date, setDate] = useState(today)
  const targets = dailyTargets(state.profile, state.nutrition, state.bodyweight)
  const entries = state.nutrition.log[date] ?? []
  const totals = dayTotals(entries)
  const checkIn = weeklyCheckIn(state.bodyweight, state.nutrition.goal)
  const adjustedThisWeek = state.nutrition.lastAdjustDate && addDays(state.nutrition.lastAdjustDate, 7) > today
  const [settingsError, setSettingsError] = useState(null)
  const [editingProfile, setEditingProfile] = useState(false)

  const safeApply = (fn) => {
    try {
      apply(fn)
    } catch (err) {
      window.alert(err.message)
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
            <Meter label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" />
            <Meter label="Protein" value={totals.protein} target={targets.protein} unit="g" range={targets.proteinRange} />
          </div>
        ) : targets.protein ? (
          <Meter label="Protein" value={totals.protein} target={targets.protein} unit="g" range={targets.proteinRange} />
        ) : (
          <p className="hint">Totals: {totals.kcal} kcal · {totals.protein} g protein</p>
        )}
        {entries.length > 0 ? (
          <ul className="clean seg-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span>{e.name}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="text-2">
                    {e.kcal} kcal · {e.protein} g
                  </span>
                  <button className="link-btn" onClick={() => safeApply((s) => deleteFoodEntry(s, date, e.id))} aria-label={`Remove ${e.name}`}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Nothing logged for this day yet.</p>
        )}
      </section>

      <AddFood
        customFoods={state.nutrition.customFoods}
        onAdd={(food) => apply((s) => addFoodEntry(s, date, food))}
        onSaveCustom={(food) => safeApply((s) => saveCustomFood(s, food))}
        onDeleteCustom={(id) => safeApply((s) => deleteCustomFood(s, id))}
      />

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
            Protein {PROTEIN_G_PER_KG} g per kg of bodyweight.
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
