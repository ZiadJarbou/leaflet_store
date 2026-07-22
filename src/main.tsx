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

function showStartupError(error: unknown) {
  const root = document.getElementById('root') ?? document.body;
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  root.innerHTML = `
    <div style="font-family: Inter, system-ui, sans-serif; max-width: 680px; margin: 64px auto; padding: 24px; line-height: 1.5;">
      <h1 style="font-size: 24px; margin: 0 0 12px;">LeafletAI could not start</h1>
      <p style="margin: 0 0 16px; color: #4b5563;">Please refresh the page. If this keeps happening, contact support.</p>
      <pre style="white-space: pre-wrap; background: #f3f4f6; border-radius: 8px; padding: 12px; color: #111827;">${message}</pre>
    </div>
  `;
}

function mountApp() {
  const root = document.getElementById('root');
  if (!root) {
    document.addEventListener('DOMContentLoaded', mountApp, { once: true });
    return;
  }

  try {
    root.dataset.appMounted = 'true';
    createRoot(root).render(
      <HelmetProvider>
        <App />
      </HelmetProvider>
    );
  } catch (error) {
    console.error('LeafletAI startup failed', error);
    showStartupError(error);
  }
}

mountApp();
