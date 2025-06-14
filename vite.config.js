import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: false
  },
  css: {
    devSourcemap: false
  }
})