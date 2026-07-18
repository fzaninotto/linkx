import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Chemins relatifs : le build doit fonctionner sous n'importe quel
  // sous-chemin de publication (GitHub Pages sert le site sous /linkx/).
  base: './',
  plugins: [react()],
})
