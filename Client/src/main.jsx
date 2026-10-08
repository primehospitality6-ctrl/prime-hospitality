import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/montserrat/wght.css';
import '@fontsource/noto-kufi-arabic/arabic-300.css';
import '@fontsource/noto-kufi-arabic/arabic-400.css';
import '@fontsource/noto-kufi-arabic/arabic-600.css';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
