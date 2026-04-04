import './index.css';
import { initDevProxy } from './hooks/useDevProxy';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Initialize dev proxy BEFORE React renders so window.claudeCodex
// is available when components mount and register IPC listeners
initDevProxy();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
