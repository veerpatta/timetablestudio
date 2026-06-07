import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// RB0 placeholder shell. The real single-screen editor returns in RB2; until then
// this keeps `vite build` honest while src/ is rebuilt on the event model (RB0–RB8).
const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Timetable Studio</h1>
      <p style={{ color: "#555" }}>
        Rebuilding on the event model. The real 2026-27 timetable and the editor arrive in the
        next build steps.
      </p>
    </main>
  </React.StrictMode>,
);
