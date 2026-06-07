import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/app/App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

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
