import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contoursPlugin } from './plugins/contours'

// https://vitejs.dev/config/
export default defineConfig({
  // contoursPlugin: elevation GeoTIFFs dropped into elevation/ become src/telemetry-v2/contours/*.geojson
  plugins: [react(), contoursPlugin()],
})
