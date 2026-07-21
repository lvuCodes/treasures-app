import { useEffect, useState, type CSSProperties } from "react";
import "./about.css";

// Rich-text styles stay inline; only the structural sidebar/scoot rules (which
// need fixed positioning + the body class) live in about.css.
const ABOUT_LINK: CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--code-bg)",
  color: "var(--text-h)",
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const ABOUT_HEAD: CSSProperties = { fontSize: "1.3rem", margin: 0, color: "var(--text-h)" };
const ABOUT_SECTION: CSSProperties = { margin: "8px 0 12px" };
const ABOUT_H2: CSSProperties = { fontSize: "1.1rem", margin: "0 0 6px", color: "var(--text-h)" };
const ABOUT_P: CSSProperties = { margin: 0, color: "var(--text)", lineHeight: 1.6 };
const ABOUT_LIST: CSSProperties = {
  margin: 0,
  paddingLeft: "1.2rem",
  color: "var(--text)",
  lineHeight: 1.7,
};

function AboutSidebar({ onClose }: { onClose: () => void }) {
  return (
    <aside className="about-sidebar" aria-label="About Treasures Dig Optimizer">
      <div className="about-head">
        <h2 style={ABOUT_HEAD}>About</h2>
        <button className="about-link" style={ABOUT_LINK} onClick={onClose} aria-label="Close about">
          ✕
        </button>
      </div>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Purpose</h2>
        <p style={ABOUT_P}>
          Treasures Dig Optimizer is a helper for the Monopoly GO treasure-map
          mini games. It optimizes hammer (shovel) usage so each dig reveals as
          much as possible, helping players uncover every item with fewer
          hammers and progress further through the mini-game levels.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Overview</h2>
        <p style={ABOUT_P}>
          You recreate the level's grid and declare which items are hidden on
          it. The app then ranks every cell by how likely an undiscovered item
          covers it, normalized by the hammer cost of digging it, and highlights
          the best cells to dig first. As you record what each dig reveals, the
          recommendations update live until every item is located.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Mechanism</h2>
        <p style={ABOUT_P}>
          For each remaining item — expanded by count and considering both
          orientations — the solver enumerates every valid placement on the
          grid. Each placement contributes a normalized weight to the cells it
          covers, and the aggregate is divided by the cell's hammer cost (rock
          costs two hammers, soil one). Cells with the highest cost-normalized
          score are the best first digs. Recording a result eliminates the
          placements it rules out and recomputes the scores against what remains.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Coming Soon</h2>
        <ul style={ABOUT_LIST}>
          <li>
            <b>Mini game</b> — a playable treasure-dig game built into the app.
          </li>
          <li>
            <b>Calculations</b> — a detailed breakdown of the per-cell
            probability and hammer-cost figures behind each recommendation.
          </li>
          <li>
            <b>Tutorial</b> — a guided walkthrough of how to use the optimizer.
          </li>
        </ul>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Privacy</h2>
        <p style={ABOUT_P}>
          All state — theme, saved maps, and the active session — is stored
          locally in your browser. There are no cookies, no analytics, and no
          network requests; nothing leaves your device.
        </p>
      </section>
      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Sources</h2>
        <p className="credits-note">
          The dig-optimization approach was informed by these battleship probability solvers:
        </p>
        <ul className="credits-list">
          <li>
            <a href="https://cliambrown.com/battleship/" target="_blank" rel="noreferrer noopener">
              C. Liam Brown — Battleship Probability Calculator
            </a>{" "}
            (<a href="https://cliambrown.com/battleship/methodology.php" target="_blank" rel="noreferrer noopener">methodology</a>)
          </li>
          <li>
            <a href="https://www.noq.solutions/battleship" target="_blank" rel="noreferrer noopener">
              Noq — Battleship solver
            </a>
          </li>
          <li>
            <a href="https://nulliq.dev/posts/battleship/" target="_blank" rel="noreferrer noopener">
              nulliq — Battleship
            </a>
          </li>
        </ul>
      </section>
    </aside>
  );
}

// About panel: a footer toggle that opens a right-hand sidebar which scoots the
// app over on wide screens and covers it on narrow ones. Self-contained (owns
// its open state + the body-class effect), so the shell wires it with a single
// unconditional render.
export function About() {
  const [open, setOpen] = useState(false);

  // Scoot the page over (CSS `body.about-open`) while the sidebar is open.
  useEffect(() => {
    document.body.classList.toggle("about-open", open);
    return () => document.body.classList.remove("about-open");
  }, [open]);

  return (
    <>
      {!open && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <button className="about-link" style={ABOUT_LINK} onClick={() => setOpen(true)}>
            About
          </button>
        </div>
      )}
      {open && <AboutSidebar onClose={() => setOpen(false)} />}
    </>
  );
}
