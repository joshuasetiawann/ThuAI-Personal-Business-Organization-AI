import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs on :3000 to match the backend's default ALLOWED_ORIGINS
// (http://localhost:3000) — no backend CORS change required.
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000 },
});
