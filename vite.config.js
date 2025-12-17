import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks
          'chart': ['chart.js', 'react-chartjs-2'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        }
      }
    }
  }
})
