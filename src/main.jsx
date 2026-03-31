import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

// Register service worker with auto-update and periodic check
const updateSW = registerSW({
  onNeedRefresh() {
    // New content available — auto-apply on next reload
  },
  onOfflineReady() {
    // App cached and ready to work offline
  },
  onRegisterError(error) {
    // SW registration failed — log for debugging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('SW registration failed:', error);
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
