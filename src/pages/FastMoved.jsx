import { Link } from 'react-router-dom'
import { FORGE_FAST_URL } from '../components/TodayCards.jsx'

// Old links to the Fast tab land here: fasting now has its own app.
export default function FastMoved() {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Fasting</span>
        <h1>Fasting has its own app</h1>
      </div>
      <section className="card">
        <p className="text-2">
          The fasting timer, stages, streaks and history now live in <strong>Forge Fast</strong>, a separate app you can add to your home screen next to Forge.
        </p>
        <ol className="cues">
          <li>
            Here in Forge, open <Link to="/settings">Settings</Link> and tap <strong>Back up now</strong>.
          </li>
          <li>Open Forge Fast and add it to your home screen.</li>
          <li>
            In Forge Fast, go to Settings and choose <strong>Import a Forge backup</strong>. Your fasts and weigh-ins come across.
          </li>
        </ol>
        <a className="btn primary block" href={FORGE_FAST_URL} target="_blank" rel="noreferrer noopener">
          Open Forge Fast
        </a>
      </section>
    </>
  )
}
