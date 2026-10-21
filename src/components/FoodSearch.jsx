import { lazy, Suspense, useCallback, useState } from 'react'
import { lookupBarcode, normalizeBarcode, portionOf, searchFoods } from '../food/openFoodFacts.js'

const BarcodeScanner = lazy(() => import('./BarcodeScanner.jsx'))

// Search Open Food Facts by name or barcode (typed or scanned), pick an
// amount, and add it to the log.
export default function FoodSearch({ onAdd, onSaveCustom }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [picked, setPicked] = useState(null)
  const [grams, setGrams] = useState('')
  const [saveFav, setSaveFav] = useState(false)
  const [added, setAdded] = useState(null)

  function pick(food) {
    setPicked(food)
    setGrams(String(food.servingG ?? 100))
    setSaveFav(false)
    setError(null)
  }

  async function run(task) {
    setBusy(true)
    setError(null)
    setAdded(null)
    try {
      await task()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const findBarcode = useCallback((code) => {
    setScanning(false)
    setQuery(code)
    setResults(null)
    setPicked(null)
    run(async () => {
      const food = await lookupBarcode(code)
      if (!food) throw new Error(`Barcode ${code} is not in the food database yet. Search by name or use “Enter your own”.`)
      pick(food)
    })
  }, [])

  function search(e) {
    e.preventDefault()
    setPicked(null)
    const code = normalizeBarcode(query)
    if (code && /^\s*\d[\d\s]*$/.test(query)) {
      findBarcode(code)
      return
    }
    run(async () => setResults(await searchFoods(query)))
  }

  let portion = null
  let portionError = null
  if (picked) {
    try {
      portion = portionOf(picked, grams)
    } catch (err) {
      portionError = err.message
    }
  }

  function add() {
    if (!portion) return
    setError(null)
    try {
      onAdd({ ...portion, servings: 1 })
      if (saveFav) onSaveCustom(portion)
      setAdded(`Added ${portion.name}: ${portion.kcal} kcal.`)
      setPicked(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="stack">
      <form className="row" style={{ gap: 8 }} onSubmit={search}>
        <input
          className="input"
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Food name, brand or barcode"
          aria-label="Search foods"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {!scanning && (
        <button type="button" className="btn block" onClick={() => setScanning(true)}>
          Scan a barcode
        </button>
      )}
      {scanning && (
        <Suspense fallback={<p className="hint">Opening the camera…</p>}>
          <BarcodeScanner onDetected={findBarcode} onClose={() => setScanning(false)} />
        </Suspense>
      )}

      {busy && (
        <p className="hint" role="status">
          Looking that up… this can take a few seconds.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {added && (
        <p className="banner good small" role="status">
          {added}
        </p>
      )}

      {picked && (
        <div className="food-picked stack" style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{picked.name}</strong>
            <span className="hint">
              {picked.brand ? `${picked.brand} · ` : ''}per 100 g: {picked.kcal100} kcal · {picked.protein100} g protein
            </span>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {picked.servingG && (
              <button type="button" className={`btn small ${Number(grams) === picked.servingG ? 'primary' : ''}`} onClick={() => setGrams(String(picked.servingG))}>
                1 serving ({picked.servingLabel})
              </button>
            )}
            {[50, 100, 150, 200].map((g) => (
              <button type="button" key={g} className={`btn small ${Number(grams) === g ? 'primary' : ''}`} onClick={() => setGrams(String(g))}>
                {g} g
              </button>
            ))}
          </div>
          <label className="field">
            Amount you ate (g or ml)
            <input className="input" type="number" inputMode="decimal" min="1" max="3000" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </label>
          {portion ? (
            <p className="food-portion">
              <strong>{portion.kcal} kcal</strong> · {portion.protein} g protein
            </p>
          ) : (
            <p className="error">{portionError}</p>
          )}
          <label className="row small">
            <input type="checkbox" checked={saveFav} onChange={(e) => setSaveFav(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
            Also save this amount to my quick list
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn primary" onClick={add} disabled={!portion}>
              Add to log
            </button>
            <button type="button" className="btn ghost" onClick={() => setPicked(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {results && !picked && (
        <ul className="clean food-list">
          {results.map((f) => (
            <li key={`${f.code}-${f.name}`}>
              <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                <span>{f.name}</span>
                <span className="hint">
                  {f.brand ? `${f.brand} · ` : ''}
                  {f.kcal100} kcal · {f.protein100} g protein per 100 g
                </span>
              </span>
              <button className="btn small" onClick={() => pick(f)} aria-label={`Choose ${f.name}`}>
                Choose
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="hint">No foods found. Try fewer or different words, or use “Enter your own”.</li>}
        </ul>
      )}

      <p className="hint">
        Food data from{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer noopener">
          Open Food Facts
        </a>{' '}
        (open data, added by volunteers). Only your search words or the barcode are sent. Check the packet if a number looks off.
      </p>
    </div>
  )
}
