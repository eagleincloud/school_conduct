import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/media': {
        target: 'https://school-management-system-l12n.onrender.com',
        changeOrigin: true,
      }
    }
  }
})
