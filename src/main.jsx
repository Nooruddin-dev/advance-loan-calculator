import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.jsx'

// ✅ Import Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

// ✅ Import Bootstrap JS (includes Popper for tooltips, dropdowns, modals, etc.)
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
