import { useEffect, useState } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { Link, useSearchParams } from 'react-router-dom';
import { getSubscription, type SubscriptionInfo } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './PaymentSuccess.css';

export default function PaymentSuccess() {
  const [searchParams]    = useSearchParams();
  const { user }          = useAuth();
  const sessionId         = searchParams.get('session_id');
  const [sub, setSub]     = useState<SubscriptionInfo | null>(null);
  const [dots, setDots]   = useState('');

  useEffect(() => {
    if (!user) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      setDots('.'.repeat((attempts % 3) + 1));
      try {
        const info = await getSubscription();
        if (info.subscription_plan !== 'free') {
          setSub(info);
          clearInterval(interval);
        }
      } catch {
        /* retry */
      }
      if (attempts >= 10) clearInterval(interval);
    }, 1500);
    return () => clearInterval(interval);
  }, [user]);

  const planName = sub
    ? sub.subscription_plan.charAt(0).toUpperCase() + sub.subscription_plan.slice(1)
    : null;

  return (
    <>
    <SEOHelmet pageKey="payment-success" />
    <div className="ps-page">
      <div className="ps-card">
        {sub ? (
          <>
            <div className="ps-icon ps-icon--success">check</div>
            <h1 className="ps-title">You're all set!</h1>
            <p className="ps-sub">
              Welcome to the <strong>{planName}</strong> plan.
              Your subscription is now active.
            </p>
            {sessionId && (
              <p className="ps-session">Reference: <code>{sessionId.slice(0, 24)}…</code></p>
            )}
            <div className="ps-actions">
              <Link className="btn primary" to="/create-leaflet">Create a leaflet</Link>
              <Link className="btn ghost"   to="/my-leaflets">My leaflets</Link>
            </div>
          </>
        ) : (
          <>
            <div className="ps-spinner" />
            <h1 className="ps-title">Confirming your payment{dots}</h1>
            <p className="ps-sub">This usually takes just a few seconds.</p>
          </>
        )}
      </div>
    </div>
    <Footer />
    </>
  );
}
