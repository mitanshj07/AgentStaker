import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ai': 'http://localhost:8787',
      '/orders': 'http://localhost:8787',
      '/orderbook': 'http://localhost:8787',
      '/portfolio': 'http://localhost:8787',
      '/route': 'http://localhost:8787',
      '/markets': {
        target: 'http://localhost:8787',
        ws: true,
      },
    },
  },
})
