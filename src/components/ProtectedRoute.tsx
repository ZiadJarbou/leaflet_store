import { cssClass } from '../utils/styleClass';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
interface Props {
    children: ReactNode;
}
/**
 * Wraps routes that require authentication.
 * - While auth state is loading, renders nothing.
 * - If not authenticated, renders an inline prompt on the page itself.
 *   The global auth modal is NOT opened automatically, so other pages
 *   (like the home page) are never affected.
 * - Once authenticated, renders children normally.
 */
export default function ProtectedRoute({ children }: Props) {
    const { user, loading, openAuthModal } = useAuth();
    if (loading)
        return (<div className={cssClass({ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
      <div className="lv-spinner" aria-label="Loading"/>
    </div>);
    if (!user) {
        return (<div className={cssClass({
            minHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            color: 'var(--muted, #888)',
            textAlign: 'center',
            padding: '2rem',
        })}>
        <div className={cssClass({ fontSize: 48 })}>lock</div>
        <h2 className={cssClass({ margin: 0, fontSize: 22, color: 'var(--text, #fff)' })}>Login required</h2>
        <p className={cssClass({ margin: 0, maxWidth: 360 })}>
          You need to be logged in to access this page.
        </p>
        <div className={cssClass({ display: 'flex', gap: 12, marginTop: 8 })}>
          <button className="btn primary" onClick={() => openAuthModal('login')}>
            Log In
          </button>
          <button className="btn ghost" onClick={() => openAuthModal('signup')}>
            Sign Up
          </button>
        </div>
      </div>);
    }
    return <>{children}</>;
}
