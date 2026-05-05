import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler to help debug white screen issues
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: white; background: #900; font-family: monospace;">
      <h1>Runtime Error</h1>
      <p>${message}</p>
      <pre>${error?.stack || ''}</pre>
    </div>`;
  }
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
