import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      // A: /lab.html es el banco de pruebas de la medición. En `vite dev` anda
      // solo; esto es para que también entre en el build y en los previews.
      input: {
        principal: 'index.html',
        lab: 'lab.html',
      },
    },
  },
})
