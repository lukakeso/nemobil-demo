import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// async function initApp() {
//   const res = await fetch('/config');
//   const config = await res.json();
//   console.log(config)
//   window._env_ = config;
//   //const { createRoot } = await import('react-dom/client');
//   //const App = (await import('./App')).default;

//   //createRoot(document.getElementById('root')).render(<App />);
// }

// initApp();


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
