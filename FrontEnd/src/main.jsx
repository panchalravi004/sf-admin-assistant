import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
