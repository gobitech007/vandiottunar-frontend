import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Fixed port: the APIs only allow http://localhost:5173 (CORS), so fail loudly instead of moving to 5174
  server: { port: 5173, strictPort: true },
})
