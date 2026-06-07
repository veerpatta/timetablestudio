import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/app/App";
import { enablePersistence } from "./store/projectStore";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// Load any saved project and write-through on every change (C1: edits survive reload).
// Best-effort: the app renders from the bundled seed first, then swaps in saved data.
void enablePersistence();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: register the service worker for offline use. PROD-only (so it never interferes
// with the Vite dev server or tests) and base-path-aware (the site deploys under a
// GitHub Pages subpath; BASE_URL keeps the scope correct).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort; ignore registration failures */
    });
  });
}
