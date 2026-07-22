import { cssClass, cx } from '../utils/styleClass';
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Footer from '../components/Footer';
type Status = 'verifying' | 'success' | 'error';
export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<Status>('verifying');
    const [message, setMessage] = useState('');
    useEffect(() => {
        const email = searchParams.get('email') || '';
        const token = searchParams.get('token') || '';
        if (!email || !token) {
            setStatus('error');
            setMessage('Invalid verification link.');
            return;
        }
        fetch(`/api/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
            .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setStatus('success');
                setMessage(data.message || 'Email verified successfully!');
            }
            else {
                setStatus('error');
                setMessage(data.message || 'Verification failed. Try again.');
            }
        })
            .catch(() => {
            setStatus('error');
            setMessage('Verification failed. Try again.');
        });
    }, [searchParams]);
    return (<>
      <div className="auth-wrapper">
        <div className="container">
          <div className="auth-box">
            <div className="auth-header">
              <h1>Email verification</h1>
            </div>

            {status === 'verifying' && (<div className={cx("notice-banner", cssClass({ color: 'var(--muted)' }))}>Verifying your email…</div>)}

            {status === 'success' && (<>
                <div className="notice-banner">{message}</div>
                <div className={cssClass({ textAlign: 'center', marginTop: 16 })}>
                  <Link to="/dashboard" className="btn primary">Go to Dashboard</Link>
                </div>
              </>)}

            {status === 'error' && (<>
                <div className={cx("notice-banner", cssClass({ color: '#ff8b8b', borderColor: 'rgba(255,107,107,.3)', background: 'rgba(255,107,107,.08)' }))}>
                  {message}
                </div>
                <div className={cssClass({ textAlign: 'center', marginTop: 16 })}>
                  <Link to="/" className="btn ghost">Back to home</Link>
                </div>
              </>)}
          </div>
        </div>
      </div>
      <Footer />
    </>);
}
