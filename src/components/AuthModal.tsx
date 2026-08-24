import { cssClass, cx } from '../utils/styleClass';
import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { revokeLoginDevices } from '../services/authService';
import type { DeviceLimitInfo, FieldErrors } from '../services/authService';
const EyeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>);
const GoogleIcon = () => (<svg viewBox="0 0 48 48">
    <path d="M44.5 20H24v8.5h11.8C34.6 34.3 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.5 0 6.6 1.4 9 3.6l6-6C35.3 5.2 29.9 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
    <path d="M6.3 14.7l7 5.1C15.1 15.2 19.2 11 24 11c3.5 0 6.6 1.4 9 3.6l6-6C35.3 5.2 29.9 3 24 3 16 3 9.1 7.5 6.3 14.7z" fill="#FF3D00"/>
    <path d="M24 45c5.7 0 11-2.2 14.9-5.9l-6.9-5.7c-2 1.4-4.6 2.6-8 2.6-5.9 0-10.9-3.9-12.7-9.2l-7.2 5.5C6.8 39.9 14.8 45 24 45z" fill="#4CAF50"/>
    <path d="M44.5 20H24v8.5h11.8c-1 3-3.1 5.2-5.8 6.6l.1.1 6.9 5.7C40.6 37.6 44 32.7 44 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
  </svg>);
function OAuthButtons({ mode }: { mode: 'login' | 'signup' }) {
    const action = mode === 'signup' ? 'Sign up' : 'Continue';
    const suffix = mode === 'signup' ? '/signup' : '';
    return (<div className="oauth-wrap">
      <button type="button" className="btn ghost oauth-btn" onClick={() => window.location.href = `/api/oauth/google${suffix}`}>
        <span className="oauth-ic"><GoogleIcon /></span>
        <span>{action} with Google</span>
      </button>
      <div className="oauth-divider"><span>or</span></div>
    </div>);
}
export default function AuthModal() {
    const { authModalOpen, authView, setAuthView, closeAuthModal, submitLogin, submitSignup } = useAuth();
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginErrors, setLoginErrors] = useState<FieldErrors>({});
    const [deviceLimit, setDeviceLimit] = useState<DeviceLimitInfo | null>(null);
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
    const [deviceActionLoading, setDeviceActionLoading] = useState(false);
    const [deviceActionError, setDeviceActionError] = useState('');
    const [showLoginPw, setShowLoginPw] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupErrors, setSignupErrors] = useState<FieldErrors>({});
    const [showSignupPw, setShowSignupPw] = useState(false);
    const [signupLoading, setSignupLoading] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [termsError, setTermsError] = useState(false);
    useEffect(() => {
        document.body.style.overflow = authModalOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [authModalOpen]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                closeAuthModal();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [closeAuthModal]);
    function switchView(v: 'login' | 'signup') {
        setLoginErrors({});
        setSignupErrors({});
        setDeviceLimit(null);
        setSelectedSessions(new Set());
        setDeviceActionError('');
        setTermsError(false);
        setAuthView(v);
    }
    function clientValidateLogin(): FieldErrors {
        const errs: FieldErrors = {};
        if (!loginEmail.trim())
            errs.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail))
            errs.email = 'Enter a valid email address.';
        if (!loginPassword)
            errs.password = 'Password is required.';
        return errs;
    }
    function clientValidateSignup(): FieldErrors {
        const errs: FieldErrors = {};
        if (!signupName.trim())
            errs.name = 'Full name is required.';
        else if (signupName.trim().length < 2)
            errs.name = 'Name must be at least 2 characters.';
        if (!signupEmail.trim())
            errs.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail))
            errs.email = 'Enter a valid email address.';
        if (!signupPassword)
            errs.password = 'Password is required.';
        else if (signupPassword.length < 8)
            errs.password = 'Password must be at least 8 characters.';
        else if (!/[a-z]/.test(signupPassword) || !/[A-Z]/.test(signupPassword) || !/[0-9]/.test(signupPassword)) {
            errs.password = 'Password must include uppercase, lowercase, and a number.';
        }
        return errs;
    }
    async function handleLogin(e: FormEvent) {
        e.preventDefault();
        const clientErrs = clientValidateLogin();
        if (Object.keys(clientErrs).length) {
            setLoginErrors(clientErrs);
            return;
        }
        setLoginLoading(true);
        setLoginErrors({});
        setDeviceLimit(null);
        setSelectedSessions(new Set());
        setDeviceActionError('');
        try {
            const res = await submitLogin(loginEmail.trim().toLowerCase(), loginPassword);
            if (res.errors) {
                setLoginErrors(res.errors);
                if (res.deviceLimit) {
                    setDeviceLimit(res.deviceLimit);
                    setSelectedSessions(new Set());
                }
                if (res.switchTo === 'signup') {
                    setSignupEmail(res.old?.email || loginEmail);
                    setSignupErrors(res.errors);
                    switchView('signup');
                }
            }
            else {
                closeAuthModal();
            }
        }
        catch (err) {
            setLoginErrors({ general: err instanceof Error ? err.message : 'Network error. Please try again.' });
        }
        finally {
            setLoginLoading(false);
        }
    }
    async function revokeDevices(options: { all?: boolean }) {
        if (!loginEmail.trim() || !loginPassword) {
            setDeviceActionError('Enter your email and password first.');
            return;
        }
        const sessionIds = Array.from(selectedSessions);
        if (!options.all && sessionIds.length === 0) {
            setDeviceActionError('Choose at least one device to log out.');
            return;
        }
        setDeviceActionLoading(true);
        setDeviceActionError('');
        try {
            const res = await revokeLoginDevices(loginEmail.trim().toLowerCase(), loginPassword, {
                all: options.all,
                sessionIds,
            });
            if (res.errors) {
                setDeviceActionError(res.errors.general || 'Could not log out selected devices.');
                return;
            }
            setDeviceLimit(prev => prev ? { ...prev, sessions: res.sessions ?? [] } : prev);
            setSelectedSessions(new Set());
            const loginRes = await submitLogin(loginEmail.trim().toLowerCase(), loginPassword);
            if (loginRes.errors) {
                setLoginErrors(loginRes.errors);
                setDeviceLimit(loginRes.deviceLimit ?? null);
                return;
            }
            closeAuthModal();
        }
        catch (err) {
            setDeviceActionError(err instanceof Error ? err.message : 'Could not log out selected devices.');
        }
        finally {
            setDeviceActionLoading(false);
        }
    }
    function toggleSession(id: string) {
        setSelectedSessions(prev => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function formatSessionTime(value: string) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }
    async function handleSignup(e: FormEvent) {
        e.preventDefault();
        const clientErrs = clientValidateSignup();
        const missingFields = [
            !signupName.trim() && 'Full Name',
            !signupEmail.trim() && 'Email Address',
            !signupPassword && 'Password',
            !agreeTerms && 'Terms and Privacy Policy agreement',
        ].filter(Boolean);
        if (Object.keys(clientErrs).length || !agreeTerms) {
            setSignupErrors({
                ...clientErrs,
                general: missingFields.length
                    ? `Please complete the required fields: ${missingFields.join(', ')}.`
                    : 'Please correct the highlighted fields before creating your account.',
            });
            setTermsError(!agreeTerms);
            requestAnimationFrame(() => {
                const firstInvalidId = clientErrs.name ? 'signup_name'
                    : clientErrs.email ? 'signup_email'
                    : clientErrs.password ? 'signup_password'
                    : 'signup_terms';
                document.getElementById(firstInvalidId)?.focus();
            });
            return;
        }
        setSignupLoading(true);
        setSignupErrors({});
        setTermsError(false);
        try {
            const res = await submitSignup(signupName.trim(), signupEmail.trim().toLowerCase(), signupPassword);
            if (res.errors) {
                setSignupErrors(res.errors);
            }
            else {
                closeAuthModal();
            }
        }
        catch (err) {
            setSignupErrors({ general: err instanceof Error ? err.message : 'Network error. Please try again.' });
        }
        finally {
            setSignupLoading(false);
        }
    }
    if (!authModalOpen)
        return null;
    const tabStyle = (active: boolean): React.CSSProperties => ({
        height: 34, padding: '0 12px',
        borderColor: active ? 'rgba(73,242,182,.45)' : 'rgba(255,255,255,.18)',
    });
    return (<div className="modal open" aria-hidden="false" onClick={e => {
            if (e.target === e.currentTarget)
                closeAuthModal();
        }}>
      <div className="modal-box small" role="dialog" aria-modal="true" aria-label="Authentication">
        <div className={cx("modal-top", cssClass({ gap: 10 }))}>
          <div className={cssClass({ display: 'flex', gap: 8, alignItems: 'center' })}>
            <button type="button" className={cx("btn ghost", cssClass(tabStyle(authView === 'login')))} onClick={() => switchView('login')}>Login</button>
            <button type="button" className={cx("btn ghost", cssClass(tabStyle(authView === 'signup')))} onClick={() => switchView('signup')}>Sign up</button>
          </div>
          <button className="close" onClick={closeAuthModal} aria-label="Close">×</button>
        </div>

        <div className="modal-body form-content">

          {/* ── LOGIN VIEW ── */}
          {authView === 'login' && (<div>
              {loginErrors.general && <div className={cx("field-error", cssClass({ marginBottom: 10 }))}>{loginErrors.general}</div>}
              {deviceLimit && (<div className={cssClass({
                display: 'grid',
                gap: 10,
                padding: 12,
                marginBottom: 12,
                border: '1px solid rgba(73,242,182,.28)',
                borderRadius: 10,
                background: 'rgba(73,242,182,.08)',
              })}>
                <div className={cssClass({ color: '#e2e8f0', fontSize: 13, fontWeight: 800 })}>
                  Active devices for your {deviceLimit.plan} plan
                </div>
                {deviceLimit.canChooseDevices && deviceLimit.sessions.length > 0 && (<div className={cssClass({ display: 'grid', gap: 8 })}>
                  {deviceLimit.sessions.map(session => (<label key={session.id} className={cssClass({
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 8,
                    alignItems: 'start',
                    padding: 8,
                    border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 8,
                    background: 'rgba(15,23,42,.38)',
                    cursor: 'pointer',
                  })}>
                    <input type="checkbox" checked={selectedSessions.has(session.id)} onChange={() => toggleSession(session.id)} />
                    <span className={cssClass({ display: 'grid', gap: 2 })}>
                      <strong className={cssClass({ color: '#f8fafc', fontSize: 12 })}>{session.device}</strong>
                      <span className={cssClass({ color: '#94a3b8', fontSize: 11 })}>Last active {formatSessionTime(session.last_seen_at)}</span>
                      {session.ip_address && <span className={cssClass({ color: '#64748b', fontSize: 11 })}>{session.ip_address}</span>}
                    </span>
                  </label>))}
                  <button type="button" className="btn ghost" disabled={deviceActionLoading || selectedSessions.size === 0} onClick={() => revokeDevices({})}>
                    {deviceActionLoading ? 'Logging out…' : 'Log out selected devices'}
                  </button>
                </div>)}
                <button type="button" className="btn ghost" disabled={deviceActionLoading} onClick={() => revokeDevices({ all: true })}>
                  {deviceActionLoading ? 'Logging out…' : 'Log out from all other devices'}
                </button>
                {deviceActionError && <div className="field-error">{deviceActionError}</div>}
              </div>)}
              <OAuthButtons mode="login" />
              <form onSubmit={handleLogin} noValidate>
                <div className="form-group">
                  <label htmlFor="login_email">Email Address</label>
                  <input type="email" id="login_email" className={`input${loginErrors.email ? ' error-border' : ''}`} placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} maxLength={190} autoComplete="email"/>
                  {loginErrors.email && <div className="field-error">{loginErrors.email}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="login_password">Password</label>
                  <div className="password-wrapper">
                    <input type={showLoginPw ? 'text' : 'password'} id="login_password" className={`input has-icon${loginErrors.password ? ' error-border' : ''}`} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} maxLength={128} autoComplete="current-password"/>
                    <button type="button" className="password-toggle" onClick={() => setShowLoginPw(v => !v)} aria-label="Toggle password visibility">
                      <EyeIcon />
                    </button>
                  </div>
                  {loginErrors.password && <div className="field-error">{loginErrors.password}</div>}
                </div>

                <button type="submit" className={cx("btn primary", cssClass({ width: '100%', marginTop: 10 }))} disabled={loginLoading}>
                  {loginLoading ? 'Logging in…' : 'Log In'}
                </button>

                <div className="form-footer">
                  <Link to="/forgot-password" className={cx("link-text", cssClass({ fontSize: 12, color: 'var(--muted)' }))} onClick={closeAuthModal}>
                    Forgot password?
                  </Link>
                  <br /><br />
                  Don't have an account?{' '}
                  <span className="link-text" onClick={() => switchView('signup')}>Sign up</span>
                </div>
              </form>
            </div>)}

          {/* ── SIGNUP VIEW ── */}
          {authView === 'signup' && (<div>
              {signupErrors.general && <div className={cx("field-error", cssClass({ marginBottom: 10 }))} role="alert" aria-live="assertive">{signupErrors.general}</div>}
              <OAuthButtons mode="signup" />
              <form onSubmit={handleSignup} noValidate>
                <div className="form-group">
                  <label htmlFor="signup_name">Full Name</label>
                  <input type="text" id="signup_name" className={`input${signupErrors.name ? ' error-border' : ''}`} placeholder="Your name" value={signupName} onChange={e => setSignupName(e.target.value)} maxLength={120} autoComplete="name" aria-invalid={Boolean(signupErrors.name)} aria-required="true"/>
                  {signupErrors.name && <div className="field-error">{signupErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="signup_email">Email Address</label>
                  <input type="email" id="signup_email" className={`input${signupErrors.email ? ' error-border' : ''}`} placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} maxLength={190} autoComplete="email" aria-invalid={Boolean(signupErrors.email)} aria-required="true"/>
                  {signupErrors.email && <div className="field-error">{signupErrors.email}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="signup_password">Password</label>
                  <div className="password-wrapper">
                    <input type={showSignupPw ? 'text' : 'password'} id="signup_password" className={`input has-icon${signupErrors.password ? ' error-border' : ''}`} placeholder="At least 8 chars, upper/lower/number" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} maxLength={128} autoComplete="new-password" aria-invalid={Boolean(signupErrors.password)} aria-required="true"/>
                    <button type="button" className="password-toggle" onClick={() => setShowSignupPw(v => !v)} aria-label="Toggle password visibility">
                      <EyeIcon />
                    </button>
                  </div>
                  {signupErrors.password && <div className="field-error">{signupErrors.password}</div>}
                </div>

                <label className="terms-check">
                  <input type="checkbox" id="signup_terms" checked={agreeTerms} onChange={e => { setAgreeTerms(e.target.checked); if (e.target.checked) setTermsError(false); }} aria-invalid={termsError} aria-required="true"/>
                  <span>I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</span>
                </label>
                {termsError && <div className="field-error">You must accept the Terms and Privacy Policy.</div>}

                <button type="submit" className={cx("btn primary", cssClass({ width: '100%' }))} disabled={signupLoading}>
                  {signupLoading ? 'Creating account…' : 'Create account'}
                </button>

                <div className="form-footer">
                  Already have an account?{' '}
                  <span className="link-text" onClick={() => switchView('login')}>Login</span>
                </div>
              </form>
            </div>)}

        </div>
      </div>
    </div>);
}
