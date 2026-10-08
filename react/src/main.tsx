import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../static/css/atlas.css'
import '../../static/vendor/leaflet/leaflet.css'
import '../../static/vendor/leaflet/MarkerCluster.css'
import '../../static/vendor/leaflet/MarkerCluster.Default.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
