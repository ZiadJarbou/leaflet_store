import { cssClass, cx } from '../utils/styleClass';
import { useEffect, useRef, useState } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, deleteAccount, createPortalSession, getSubscription, type SubscriptionInfo } from '../services/api';
import './SettingsPage.css';
type Tab = 'profile' | 'security' | 'subscription';
function Toast({ msg, type, onClose }: {
    msg: string;
    type: 'success' | 'error';
    onClose: () => void;
}) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
    return <div className={`st-toast st-toast--${type}`}>{msg}<button onClick={onClose}>Ã—</button></div>;
}
export default function SettingsPage() {
    const { user, login, logout } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('profile');
    /* profile */
    const [name, setName] = useState(user?.name ?? '');
    const [nameLoading, setNL] = useState(false);
    /* password */
    const [curPw, setCurPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confPw, setConfPw] = useState('');
    const [pwLoading, setPwL] = useState(false);
    const [showPw, setShowPw] = useState(false);
    /* delete */
    const [delPw, setDelPw] = useState('');
    const [delLoading, setDelL] = useState(false);
    const [delConfirm, setDelC] = useState(false);
    /* subscription */
    const [sub, setSub] = useState<SubscriptionInfo | null>(null);
    const [portalL, setPortalL] = useState(false);
    /* toast */
    const [toast, setToast] = useState<{
        msg: string;
        type: 'success' | 'error';
    } | null>(null);
    const isMounted = useRef(true);
    useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
    useEffect(() => { if (!user)
        navigate('/'); }, [user]);
    useEffect(() => {
        if (tab === 'subscription' && !sub) {
            getSubscription().then(s => { if (isMounted.current)
                setSub(s); }).catch(() => null);
        }
    }, [tab]);
    useEffect(() => { if (user)
        setName(user.name); }, [user]);
    function ok(msg: string) { setToast({ msg, type: 'success' }); }
    function err(msg: string) { setToast({ msg, type: 'error' }); }
    /* â”€â”€ Profile save â”€â”€ */
    async function saveProfile(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            err('Name cannot be empty.');
            return;
        }
        setNL(true);
        try {
            const res = await updateProfile(name.trim());
            localStorage.setItem('token', res.token);
            await login(res.token);
            ok('Profile updated successfully.');
        }
        catch (e: unknown) {
            err(e instanceof Error ? e.message : 'Failed to update profile.');
        }
        finally {
            setNL(false);
        }
    }
    /* â”€â”€ Password change â”€â”€ */
    async function savePassword(e: React.FormEvent) {
        e.preventDefault();
        if (!curPw || !newPw || !confPw) {
            err('Enter your current password, new password, and password confirmation.');
            return;
        }
        if (newPw !== confPw) {
            err('New passwords do not match.');
            return;
        }
        if (newPw.length < 8) {
            err('Password must be at least 8 characters.');
            return;
        }
        setPwL(true);
        try {
            await changePassword(curPw, newPw);
            setCurPw('');
            setNewPw('');
            setConfPw('');
            ok('Password updated successfully.');
        }
        catch (e: unknown) {
            err(e instanceof Error ? e.message : 'Failed to change password.');
        }
        finally {
            setPwL(false);
        }
    }
    /* â”€â”€ Delete account â”€â”€ */
    async function confirmDelete(e: React.FormEvent) {
        e.preventDefault();
        setDelL(true);
        try {
            await deleteAccount(delPw);
            await logout();
            navigate('/');
        }
        catch (e: unknown) {
            err(e instanceof Error ? e.message : 'Failed to delete account.');
        }
        finally {
            setDelL(false);
        }
    }
    /* â”€â”€ Billing portal â”€â”€ */
    async function openPortal() {
        setPortalL(true);
        try {
            window.location.href = await createPortalSession();
        }
        catch {
            err('Could not open billing portal.');
            setPortalL(false);
        }
    }
    if (!user)
        return null;
    const initial = user.name.charAt(0).toUpperCase();
    const PLAN_COLOR: Record<string, string> = { free: '#64748b', pro: '#49f2b6', business: '#7c5cff' };
    const planColor = PLAN_COLOR[sub?.subscription_plan ?? 'free'];
    return (<>
      <SEOHelmet pageKey="settings"/>
      <div className="st-page container">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}

      <div className="st-header">
        <h1 className="st-title">Settings</h1>
        <p className="st-sub">Manage your profile, security, and subscription.</p>
      </div>

      <div className="st-layout">

        {/* â”€â”€ Sidebar tabs â”€â”€ */}
        <nav className="st-tabs">
          {([
            { key: 'profile', icon: 'person', label: 'Profile' },
            { key: 'security', icon: 'lock', label: 'Security' },
            { key: 'subscription', icon: 'credit_card', label: 'Subscription' },
        ] as {
            key: Tab;
            icon: string;
            label: string;
        }[]).map(t => (<button key={t.key} className={`st-tab${tab === t.key ? ' st-tab--active' : ''}`} onClick={() => setTab(t.key)}>
              <span>{t.icon}</span> {t.label}
            </button>))}
        </nav>

        {/* â”€â”€ Content â”€â”€ */}
        <div className="st-content">

          {/* â”€â”€ Profile tab â”€â”€ */}
          {tab === 'profile' && (<div className="st-panel">
              <div className="st-panel-head">
                <div className="st-avatar">{initial}</div>
                <div>
                  <div className="st-avatar-name">{user.name}</div>
                  <div className="st-avatar-email">{user.email}</div>
                </div>
              </div>

              <form className="st-form" onSubmit={saveProfile}>
                <h2 className="st-section-title">Personal info</h2>

                <div className="st-field">
                  <label className="st-label">Display name</label>
                  <input className="st-input" value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Your name"/>
                </div>

                <div className="st-field">
                  <label className="st-label">Email address</label>
                  <input className="st-input st-input--readonly" value={user.email} readOnly/>
                  <p className="st-hint">Email changes are not supported yet. Contact support if needed.</p>
                </div>

                <button className="btn primary st-save-btn" type="submit" disabled={nameLoading || name.trim() === user.name}>
                  {nameLoading ? 'Savingâ€¦' : 'Save changes'}
                </button>
              </form>
            </div>)}

          {/* â”€â”€ Security tab â”€â”€ */}
          {tab === 'security' && (<div className="st-panel">
              <form className="st-form" onSubmit={savePassword}>
                <h2 className="st-section-title">Change password</h2>

                <div className="st-field">
                  <label className="st-label">Current password</label>
                  <div className="st-pw-wrap">
                    <input className="st-input" type={showPw ? 'text' : 'password'} value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="••••••••" autoComplete="current-password"/>
                    <button type="button" className="st-pw-eye material-symbol" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>{showPw ? 'visibility_off' : 'visibility'}</button>
                  </div>
                </div>
                <div className="st-field">
                  <label className="st-label">New password</label>
                  <input className="st-input" type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
                  <p className="st-hint">Minimum 8 characters with uppercase, lowercase, and a number.</p>
                </div>
                <div className="st-field">
                  <label className="st-label">Confirm new password</label>
                  <input className="st-input" type={showPw ? 'text' : 'password'} value={confPw} onChange={e => setConfPw(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
                </div>

                <button className="btn primary st-save-btn" type="submit" disabled={pwLoading}>
                  {pwLoading ? 'Updating…' : 'Update password'}
                </button>
              </form>

              {/* Danger zone */}
              <div className="st-danger-zone">
                <h2 className="st-section-title st-section-title--danger">Danger zone</h2>
                <p className="st-danger-desc">Permanently delete your account and all your leaflets. This cannot be undone.</p>

                {!delConfirm ? (<button className="btn st-delete-btn" onClick={() => setDelC(true)}>
                    Delete my account
                  </button>) : (<form className="st-del-form" onSubmit={confirmDelete}>
                    <p className="st-del-warning"><span className="material-symbol" aria-hidden="true">warning</span> Enter your password to confirm permanent deletion:</p>
                    <input className="st-input st-input--danger" type="password" value={delPw} onChange={e => setDelPw(e.target.value)} placeholder="Your password" autoComplete="current-password"/>
                    <div className="st-del-actions">
                      <button className="btn st-delete-btn" type="submit" disabled={delLoading || !delPw}>
                        {delLoading ? 'Deletingâ€¦' : 'Yes, delete my account'}
                      </button>
                      <button className="btn ghost" type="button" onClick={() => { setDelC(false); setDelPw(''); }}>
                        Cancel
                      </button>
                    </div>
                  </form>)}
              </div>
            </div>)}

          {/* â”€â”€ Subscription tab â”€â”€ */}
          {tab === 'subscription' && (<div className="st-panel">
              <h2 className="st-section-title">Your subscription</h2>

              {!sub ? (<div className="st-loading">Loadingâ€¦</div>) : (<div className="st-sub-info">
                  <div className="st-sub-plan-row">
                    <div className={cx("st-sub-plan-icon", cssClass({ background: `${planColor}18`, color: planColor }))}>star</div>
                    <div>
                      <div className={cx("st-sub-plan-name", cssClass({ color: planColor }))}>
                        {sub.subscription_plan.charAt(0).toUpperCase() + sub.subscription_plan.slice(1)} Plan
                      </div>
                      {sub.subscription_plan !== 'free' && (<div className="st-sub-plan-detail">
                          {sub.subscription_period === 'annual' ? 'Billed annually' : 'Billed monthly'}
                          <span className="material-symbol st-sub-detail-separator" aria-hidden="true">fiber_manual_record</span>
                          <span className={`st-sub-status st-sub-status--${sub.subscription_status}`}>{sub.subscription_status}</span>
                        </div>)}
                    </div>
                  </div>

                  <div className="st-sub-features">
                    {[
                    { label: 'Leaflets', free: '3', pro: '50', biz: 'Unlimited' },
                    { label: 'Products/leaflet', free: '30', pro: '500', biz: 'Unlimited' },
                    { label: 'Flipbook export', free: 'close', pro: 'check', biz: 'check' },
                    { label: 'Cover & back page', free: 'close', pro: 'check', biz: 'check' },
                    { label: 'Remove watermark', free: 'close', pro: 'check', biz: 'check' },
                ].map(row => (<div key={row.label} className="st-sub-feat-row">
                        <span className="st-sub-feat-label">{row.label}</span>
                        <span className="st-sub-feat-val">
                          {(() => {
                            const val = sub.subscription_plan === 'pro' ? row.pro
                              : sub.subscription_plan === 'business' ? row.biz
                                : row.free;
                            return val === 'check' || val === 'close' ? <span className="material-symbol">{val}</span> : val;
                          })()}
                        </span>
                      </div>))}
                  </div>

                  <div className="st-sub-actions">
                    {sub.subscription_plan === 'free' ? (<a className="btn primary" href="/pricing">Upgrade to Pro â†’</a>) : (<button className="btn ghost" onClick={openPortal} disabled={portalL}>
                        {portalL ? 'Opening…' : <>Manage billing &amp; invoices <span className="material-symbol" aria-hidden="true">arrow_forward</span></>}
                      </button>)}
                    <a className="st-sub-link" href="/pricing">Compare all plans</a>
                  </div>
                </div>)}
            </div>)}

        </div>
      </div>
    </div>
    <Footer />
    </>);
}

