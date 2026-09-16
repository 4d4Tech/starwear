import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    proxy: {
      '/api-3daistudio': {
        target: 'https://api.3daistudio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-3daistudio/, '')
      },
      '/api-tripo': {
        target: 'https://openapi.tripo3d.ai',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-tripo/, '')
      }
    }
  }
})
