import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './AuthContext';
import { CardGallery } from './CardGallery';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get('gallery') === 'cards' ? <CardGallery /> : <AuthProvider><App /></AuthProvider>}
  </React.StrictMode>
);
