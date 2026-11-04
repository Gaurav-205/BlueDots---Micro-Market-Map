import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GOOGLE_MAPS_ is exposed too: the Maps JS key must reach the browser anyway (restrict it by referrer).
  envPrefix: ['VITE_', 'GOOGLE_MAPS_'],
})
