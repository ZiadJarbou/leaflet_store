import { cssClass, cx } from '../utils/styleClass';
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { apiForgotPassword } from '../services/authService';
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    function validateEmail(e: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    }
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setEmailError('');
        setNotice('');
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setEmailError('Email is required.');
            return;
        }
        if (!validateEmail(trimmed)) {
            setEmailError('Enter a valid email address.');
            return;
        }
        setLoading(true);
        try {
            const data = await apiForgotPassword(trimmed);
            setNotice(data.notice || 'If that email exists, we sent a reset link.');
        }
        catch {
            setNotice('If that email exists, we sent a reset link.');
        }
        finally {
            setLoading(false);
        }
    }
    return (<>
      <div className="auth-wrapper">
        <div className="container">
          <div className="auth-box">
            <div className="auth-header">
              <h1>Reset password</h1>
              <p>Enter your email and we'll send you a reset link.</p>
            </div>

            {notice && <div className="notice-banner">{notice}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="fp_email">Email Address</label>
                <input type="email" id="fp_email" className={`input${emailError ? ' error-border' : ''}`} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} maxLength={190}/>
                {emailError && <div className="field-error">{emailError}</div>}
              </div>

              <button type="submit" className={cx("btn primary", cssClass({ width: '100%', marginTop: 8 }))} disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>

              <div className="form-footer">
                <Link to="/" className={cx("link-text", cssClass({ fontSize: 13 }))}>← Back to home</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>);
}
