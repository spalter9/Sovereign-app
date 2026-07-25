import { useState } from 'react'
import './App.css'

interface Note {
  id: number
  text: string
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')

  const addNote = () => {
    const text = draft.trim()
    if (!text) return
    setNotes((prev) => [{ id: Date.now(), text }, ...prev])
    setDraft('')
  }

  const removeNote = (id: number) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Sovereign</h1>
        <p>Your own private notes, owned by you.</p>
      </header>

      <section className="composer">
        <input
          className="composer__input"
          value={draft}
          placeholder="Write a note…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addNote()
          }}
          aria-label="Note text"
        />
        <button className="composer__button" onClick={addNote}>
          Add note
        </button>
      </section>

      <section className="notes" aria-label="Notes list">
        {notes.length === 0 ? (
          <p className="notes__empty">No notes yet. Add your first one above.</p>
        ) : (
          <ul className="notes__list">
            {notes.map((note) => (
              <li key={note.id} className="notes__item">
                <span>{note.text}</span>
                <button
                  className="notes__delete"
                  onClick={() => removeNote(note.id)}
                  aria-label={`Delete note: ${note.text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="app__footer">
        {notes.length} {notes.length === 1 ? 'note' : 'notes'}
      </footer>
    </main>
  )
}

export default App
