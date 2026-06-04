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

// Register the service worker for offline/PWA support (production only).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort */
    });
  });
}
