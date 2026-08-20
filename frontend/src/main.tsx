import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { WeatherProvider } from './contexts/WeatherContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <WeatherProvider>
        <App />
      </WeatherProvider>
    </SettingsProvider>
  </StrictMode>,
)
