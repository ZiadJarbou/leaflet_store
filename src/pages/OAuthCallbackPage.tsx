import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeSession } from '../services/authService';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Signing you in...');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error = query.get('error') || hash.get('error');

    if (error) {
      setMessage(error);
      window.history.replaceState(null, '', '/oauth/callback');
      return;
    }

    const token = hash.get('token');
    const rawUser = hash.get('user');
    if (!token || !rawUser) {
      setMessage('Google login could not be completed. Please try again.');
      window.history.replaceState(null, '', '/oauth/callback');
      return;
    }

    try {
      const user = JSON.parse(rawUser);
      storeSession(user, token);
      window.history.replaceState(null, '', '/oauth/callback');
      navigate('/my-leaflets', { replace: true });
      window.location.reload();
    } catch {
      setMessage('Google login returned an invalid session. Please try again.');
      window.history.replaceState(null, '', '/oauth/callback');
    }
  }, [navigate]);

  return (
    <main className="auth-wrapper">
      <section className="auth-box">
        <div className="auth-header">
          <h1>Google Login</h1>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
