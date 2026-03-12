import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Yeni service worker devreye girince sayfayı yenile (stale cache sorunu çözümü)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(<App />)
