import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReactGA from 'react-ga4'
import './index.css'
import App from './App.tsx'

// Googleアナリティクス 4 の初期化
ReactGA.initialize('G-FN1BE8RD7X')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)