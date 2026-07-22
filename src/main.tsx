import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'

const EXTENSION_MESSAGE_CHANNEL_ERROR =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';

window.addEventListener('unhandledrejection', event => {
  const message = event.reason instanceof Error
    ? event.reason.message
    : typeof event.reason === 'string'
      ? event.reason
      : '';

  if (message.includes(EXTENSION_MESSAGE_CHANNEL_ERROR)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
)
