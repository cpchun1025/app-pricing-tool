import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API only accepts browser requests from http://localhost:5200 (FrontendOrigin in backend/appsettings.json),
// so the dev server must use exactly this port. strictPort makes Vite fail instead of quietly picking another one.
export default defineConfig({
  plugins: [react()],
  server: { port: 5200, strictPort: true },
  preview: { port: 5200, strictPort: true },
})
