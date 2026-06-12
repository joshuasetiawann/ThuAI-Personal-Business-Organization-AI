import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs on :3000 (strictPort:false → falls back to 3001+ if busy; the
// backend's dev CORS regex accepts any localhost port). All /api requests are
// proxied to the backend, so in dev the browser only ever talks same-origin and
// CORS cannot break login. Override the backend address with VITE_BACKEND_URL.
const backend = process.env.VITE_BACKEND_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: { "/api": { target: backend, changeOrigin: true } },
  },
  preview: {
    port: 3000,
    proxy: { "/api": { target: backend, changeOrigin: true } },
  },
});
