import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@pseudo-lab/experibase-sdk/react', replacement: path.resolve(__dirname, '../packages/sdk/src/react.tsx') },
      { find: '@pseudo-lab/experibase-sdk', replacement: path.resolve(__dirname, '../packages/sdk/src/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  server: {
    allowedHosts: [
      "sub.pseudolab-devfactory.com",
      "sub.pseudolab-experiment-platform-pseudolab.com"
    ],
    proxy: {
      '/api': {
        target: 'http://experiment-platform-pseudolab-backend:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  }
})
