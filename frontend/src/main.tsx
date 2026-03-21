import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { ToastProvider } from './components/Toast';
import App from './App';
import './index.css';

// The publishable key is optional — Clerk runs in keyless mode when omitted,
// generating temporary keys automatically so you can start without an account.
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey ?? ''}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
