import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// basicSsl gives the dev server a self-signed HTTPS certificate.
// Phones only allow GPS and camera features on HTTPS pages, so this
// lets you test on your phone over Wi-Fi.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { host: true },
})
