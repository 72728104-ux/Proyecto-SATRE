import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      skipFull: false,
      include: [
        'src/api/client.js',
        'src/api/auth.js',
        'src/api/query.js',
        'src/context/AuthContext.jsx',
        'src/routes/ProtectedRoute.jsx',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ['**/cypress/downloads/**', '**/cypress/screenshots/**', '**/cypress/videos/**'],
    },
  },
})
