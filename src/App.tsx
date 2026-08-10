import './App.css'

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">SSP</p>
        <h1>Sureal</h1>
        <p className="app__lede">
          A surreal single-page concept with dreamlike atmosphere, bold gradients,
          and concise product storytelling.
        </p>
      </header>

      <section className="hero-card" aria-label="Sureal overview">
        <p>
          Sureal turns abstract ideas into a calm, immersive landing experience
          focused on clarity, mood, and motion-ready composition.
        </p>
        <div className="hero-card__actions">
          <a href="#vision" className="hero-card__button hero-card__button--primary">
            Explore the vision
          </a>
          <a href="#pillars" className="hero-card__button hero-card__button--secondary">
            View pillars
          </a>
        </div>
      </section>

      <section className="pillars" id="pillars" aria-label="Sureal pillars">
        <article className="pillar">
          <h2>Atmosphere</h2>
          <p>Layered gradients and soft contrast establish a surreal first impression.</p>
        </article>
        <article className="pillar">
          <h2>Story</h2>
          <p>Short, intentional copy keeps the page clear while still feeling evocative.</p>
        </article>
        <article className="pillar">
          <h2>Focus</h2>
          <p>The layout is compact and responsive so the concept lands immediately.</p>
        </article>
      </section>

      <section className="vision" id="vision" aria-label="Creative direction">
        <h2>Designed to feel lucid</h2>
        <p>
          SSP frames Sureal as a minimal presentation page instead of a generic
          scaffold, giving the repository a purpose-built front end that matches
          the issue request.
        </p>
      </section>

      <footer className="app__footer">
        Sureal single-page presentation
      </footer>
    </main>
  )
}

export default App
