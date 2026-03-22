import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

function validateRequiredEnv() {
  const required = {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_CONTRACT_TOKEN: import.meta.env.VITE_CONTRACT_TOKEN,
    VITE_CONTRACT_WAGE: import.meta.env.VITE_CONTRACT_WAGE,
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(
      ', '
    )}. Please set them in the client \`.env\` file before running the app.`
    console.warn(msg)
    throw new Error(msg)
  }
}

validateRequiredEnv()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
