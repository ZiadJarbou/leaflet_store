import { useState, useEffect } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createCheckoutSession,
  createPortalSession,
  getLocalizedPricing,
  getSubscription,
  type LocalizedPricing,
  type SubscriptionInfo,
} from '../services/api';
import { useCmsContent, cms, cmsVisible, cmsJson } from '../hooks/useCmsContent';
import { getMaximumAnnualSavings } from '../utils/pricing';
import './PricingPage.css';

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  business: string | boolean;
}

const DEFAULT_FEATURES: PlanFeature[] = [
  { label: 'Leaflets',             free: '1',        pro: '10',        business: 'Unlimited' },
  { label: 'Products per leaflet', free: '150',      pro: '150',       business: 'Unlimited' },
  { label: 'PDF export',           free: true,       pro: true,        business: true        },
  { label: 'Flipbook export',      free: false,      pro: true,        business: true        },
  { label: 'Custom card layout',   free: true,       pro: true,        business: true        },
  { label: 'Cover & back page',    free: false,      pro: true,        business: true        },
  { label: 'Gradient backgrounds', free: false,      pro: true,        business: true        },
  { label: 'Remove watermark',     free: false,      pro: true,        business: true        },
  { label: 'Team members',         free: '1',        pro: '3',         business: 'Unlimited' },
  { label: 'Priority support',     free: false,      pro: false,       business: true        },
  { label: 'Custom branding',      free: false,      pro: false,       business: true        },
  { label: 'API access',           free: false,      pro: false,       business: true        },
];

const DEFAULT_PLANS = [
  {
    id:           'free' as const,
    name:         'Free',
    badge:        null as string | null,
    monthlyPrice: 0,
    yearlyPrice:  0,
    desc:         'Perfect to get started and explore the platform.',
    cta:          'Get started free',
    ctaVariant:   'ghost' as const,
    highlight:    false,
  },
  {
    id:           'pro' as const,
    name:         'Pro',
    badge:        'Most popular' as string | null,
    monthlyPrice: 19,
    yearlyPrice:  14,
    desc:         'Everything you need for professional leaflet campaigns.',
    cta:          'Start Pro',
    ctaVariant:   'primary' as const,
    highlight:    true,
  },
  {
    id:           'business' as const,
    name:         'Business',
    badge:        null as string | null,
    monthlyPrice: 49,
    yearlyPrice:  39,
    desc:         'Advanced tools and collaboration for growing teams.',
    cta:          'Upgrade plan',
    ctaVariant:   'brand2' as const,
    highlight:    false,
  },
];

const DEFAULT_FAQ = [
  { q: 'Can I change plans at any time?',                      a: "Yes. You can upgrade or downgrade at any time. Changes take effect immediately and we'll prorate any charges." },
  { q: 'Is there a free trial for paid plans?',                a: "Pro comes with a 14-day free trial â€” no credit card required. Business plans get a personalised demo." },
  { q: 'What happens when I hit my leaflet limit?',            a: "You'll be prompted to upgrade. Existing leaflets remain fully accessible; you just can't create new ones until you upgrade or delete old ones." },
  { q: 'Do you offer discounts for non-profits or education?', a: "Yes â€” contact us at sales@leafletai.com with proof of status and we'll apply a 40% discount." },
  { q: 'What payment methods do you accept?',                  a: "We accept all major credit and debit cards via Stripe. Annual invoicing is available on Business plans." },
  { q: 'Can I cancel anytime?',                                a: "Absolutely. Cancel from your account settings with one click. You keep access until the end of your billing period." },
];

function FeatureValue({ val }: { val: string | boolean }) {
  if (val === true)  return <span className="pp-check" aria-label="Included">check</span>;
  if (val === false) return <span className="pp-dash"  aria-label="Not included">remove</span>;
  return <span className="pp-text-val">{val}</span>;
}

export default function PricingPage() {
  const [annual, setAnnual]           = useState(false);
  const [loading, setLoading]         = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [localizedPricing, setLocalizedPricing] = useState<LocalizedPricing | null>(null);
  const [searchParams]                = useSearchParams();
  const { user, openAuthModal }       = useAuth();
  const c = useCmsContent('pricing');

  const cancelled = searchParams.get('cancelled') === '1';

  /* CMS values */
  const heroTitle   = cms(c,'hero','title',    "Simple, transparent pricing");
  const heroSub     = cms(c,'hero','subtitle', "Start free. Upgrade when you're ready. No hidden fees, cancel anytime.");
  const showHero    = cmsVisible(c,'hero');
  const PLANS       = cmsJson<any>(c,'plans','items', DEFAULT_PLANS);
  const annualSavings = getMaximumAnnualSavings(PLANS);
  const FEATURES    = cmsJson<PlanFeature>(c,'features','items', DEFAULT_FEATURES);
  const faqItems    = cmsJson<{q:string;a:string}>(c,'faq','items', DEFAULT_FAQ);
  const bannerTitle = cms(c,'banner','title',    "Ready to create stunning leaflets?");
  const bannerSub   = cms(c,'banner','subtitle', "Join thousands of businesses already using LeafletAI.");
  const bannerCta   = cms(c,'banner','cta_label',"Get started free");
  const showBanner  = cmsVisible(c,'banner');

  useEffect(() => {
    if (!user) return;
    getSubscription().then(setSubscription).catch(() => null);
  }, [user]);

  useEffect(() => {
    getLocalizedPricing().then(setLocalizedPricing).catch(() => setLocalizedPricing(null));
  }, []);

  async function handleCta(planId: 'free' | 'pro' | 'business') {
    setErrorMsg('');

    if (planId === 'free') {
      if (!user) { openAuthModal('register'); return; }
      return;
    }

    if (!user) { openAuthModal('register'); return; }

    if (planId === 'business') {
      const period = annual ? 'annual' : 'monthly';
      setLoading(`business_${period}`);
      try {
        const url = await createCheckoutSession('business', period);
        window.location.href = url;
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setLoading(null);
      }
      return;
    }

    const period = annual ? 'annual' : 'monthly';
    const key = `${planId}_${period}`;
    setLoading(key);
    try {
      const url = await createCheckoutSession(planId, period);
      window.location.href = url;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    setLoading('portal');
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not open billing portal.');
      setLoading(null);
    }
  }

  function ctaLabel(plan: typeof PLANS[number]): string {
    if (!user) return plan.cta;
    if (!subscription) return plan.cta;
    if (subscription.subscription_plan === plan.id) return 'Current plan âœ“';
    if (plan.id === 'business' && subscription.subscription_plan === 'pro') return 'Upgrade now';
    if (plan.id === 'free' && subscription.subscription_plan !== 'free') return 'Downgrade to Free';
    return plan.cta;
  }

  function isCurrentPlan(planId: string) {
    return user && subscription?.subscription_plan === planId;
  }

  function formatMoney(amount: number, currency: string) {
    const rounded = Math.round((Number(amount) || 0) * 100) / 100;
    const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
    if (currency.toUpperCase() === 'USD') {
      const value = new Intl.NumberFormat(navigator.languages?.[0] || navigator.language || 'en', {
        minimumFractionDigits: hasFraction ? 2 : 0,
        maximumFractionDigits: hasFraction ? 2 : 2,
      }).format(rounded);
      return `$${value}`;
    }
    return new Intl.NumberFormat(navigator.languages?.[0] || navigator.language || 'en', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 2,
    }).format(rounded);
  }

  function displayPrice(planId: string, baseMonthlyAmount: number, billedAnnually: boolean) {
    const planQuote = (planId === 'pro' || planId === 'business') ? localizedPricing?.plans?.[planId] : undefined;
    const quote = billedAnnually ? planQuote?.annual : planQuote?.monthly;
    const annualQuote = billedAnnually ? planQuote?.annual : undefined;
    const currency = quote?.currency || '';
    const monthlyAmount = quote?.amount ?? baseMonthlyAmount;
    const annualTotal = billedAnnually ? (annualQuote?.totalAmount ?? baseMonthlyAmount * 12) : null;
    return {
      monthlyLabel: currency ? formatMoney(monthlyAmount, currency) : `$${monthlyAmount}`,
      annualLabel: annualTotal !== null ? (currency ? formatMoney(annualTotal, currency) : `$${annualTotal}`) : '',
    };
  }

  return (
    <>
    <SEOHelmet pageKey="pricing" />
    <div className="pp-page">
      {/* â”€â”€ Hero â”€â”€ */}
      {showHero && (
      <section className="pp-hero">
        <p className="pp-eyebrow">Pricing</p>
        <h1 className="pp-title">{heroTitle}</h1>
        <p className="pp-sub">{heroSub}</p>

        {/* â”€â”€ Billing toggle â”€â”€ */}
        <div className="pp-toggle-wrap">
          <span className={!annual ? 'pp-toggle-label active' : 'pp-toggle-label'}>Monthly</span>
          <button
            className={`pp-toggle${annual ? ' on' : ''}`}
            onClick={() => setAnnual(a => !a)}
            aria-label="Toggle billing period"
          >
            <span className="pp-toggle-thumb" />
          </button>
          <span className={annual ? 'pp-toggle-label active' : 'pp-toggle-label'}>
            Annual
            {annualSavings > 0 && <span className="pp-save-badge">Save {annualSavings}%</span>}
          </span>
        </div>
      </section>
      )}

      {/* â”€â”€ Banners â”€â”€ */}
      {cancelled && (
        <div className="pp-notice pp-notice--warn container">
          <span className="pp-notice-content">
            <span className="pp-notice-icon material-symbol" aria-hidden="true">warning</span>
            <span>Payment was cancelled - no charge was made. You can try again whenever you're ready.</span>
          </span>
        </div>
      )}
      {errorMsg && (
        <div className="pp-notice pp-notice--error container">
          {errorMsg}
          <button className="pp-notice-close material-symbol" onClick={() => setErrorMsg('')} aria-label="Close notice">close</button>
        </div>
      )}

      {/* â”€â”€ Current plan banner (logged-in) â”€â”€ */}
      {user && subscription && subscription.subscription_plan !== 'free' && (
        <div className="pp-current-banner container">
          <span>
            You're on the <strong>{subscription.subscription_plan.charAt(0).toUpperCase() + subscription.subscription_plan.slice(1)}</strong> plan
            ({subscription.subscription_period})
            {subscription.subscription_status === 'cancelled' && ' - cancels at period end'}
          </span>
          <button
            className="btn ghost pp-portal-btn"
            onClick={handleManageBilling}
            disabled={loading === 'portal'}
          >
            {loading === 'portal' ? 'Opening...' : (<>
              <span>Manage billing</span>
              <span className="material-symbol" aria-hidden="true">arrow_forward</span>
            </>)}
          </button>
        </div>
      )}

      {/* â”€â”€ Plan cards â”€â”€ */}
      <section className="pp-cards-wrap">
        <div className="container pp-cards">
          {PLANS.map(plan => {
            const price   = annual ? plan.yearlyPrice : plan.monthlyPrice;
            const period  = annual ? 'annual' : 'monthly';
            const loadKey = `${plan.id}_${period}`;
            const current = isCurrentPlan(plan.id);
            const localizedPrice = displayPrice(plan.id, price, annual);

            return (
              <div
                key={plan.id}
                className={`pp-card${plan.highlight ? ' pp-card--highlight' : ''}${current ? ' pp-card--current' : ''}`}
              >
                {plan.badge && <div className="pp-card-badge">{plan.badge}</div>}
                {current    && <div className="pp-card-current-badge">Your plan</div>}

                <div className="pp-card-top">
                  <h2 className="pp-plan-name">{plan.name}</h2>
                  <p className="pp-plan-desc">{plan.desc}</p>
                  <div className="pp-price-row">
                    {price === 0 ? (
                      <span className="pp-price-amount">Free</span>
                    ) : (
                      <>
                        <span className="pp-price-amount pp-price-amount--localized">{localizedPrice.monthlyLabel}</span>
                        <span className="pp-price-period">/mo</span>
                      </>
                    )}
                  </div>
                  {annual && price > 0 && (
                    <p className="pp-billed-note">Billed {localizedPrice.annualLabel}/year</p>
                  )}
                </div>

                <button
                  className={`btn pp-cta-btn pp-cta-${plan.ctaVariant}`}
                  onClick={() => handleCta(plan.id)}
                  disabled={!!loading || current === true}
                >
                  {loading === loadKey ? (
                    <span className="pp-spinner" />
                  ) : ctaLabel(plan)}
                </button>

                <ul className="pp-feature-list">
                  {FEATURES.map(f => {
                    const val = f[plan.id];
                    if (val === false) return null;
                    return (
                      <li key={f.label} className="pp-feature-item">
                        <span className="pp-feature-check">check</span>
                        <span className="pp-feature-label">
                          {typeof val === 'string' && val !== 'true'
                            ? <><strong>{val}</strong> {f.label.toLowerCase()}</>
                            : f.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* â”€â”€ Feature comparison table â”€â”€ */}
      <section className="pp-table-section container">
        <h2 className="pp-table-title">Full feature comparison</h2>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th className="pp-th-feature">Feature</th>
                {PLANS.map(p => (
                  <th key={p.id} className={`pp-th-plan${p.highlight ? ' pp-th--highlight' : ''}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? 'pp-tr-even' : ''}>
                  <td className="pp-td-feature">{f.label}</td>
                  <td className="pp-td-val"><FeatureValue val={f.free} /></td>
                  <td className="pp-td-val pp-td--highlight"><FeatureValue val={f.pro} /></td>
                  <td className="pp-td-val"><FeatureValue val={f.business} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* â”€â”€ FAQ â”€â”€ */}
      <section className="pp-faq container">
        <h2 className="pp-faq-title">Frequently asked questions</h2>
        <div className="pp-faq-grid">
          {faqItems.map(item => (
            <div key={item.q} className="pp-faq-item">
              <h3 className="pp-faq-q">{item.q}</h3>
              <p className="pp-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ CTA Banner â”€â”€ */}
      {showBanner && (
      <section className="pp-banner container">
        <div className="pp-banner-inner">
          <h2 className="pp-banner-title">{bannerTitle}</h2>
          <p className="pp-banner-sub">{bannerSub}</p>
          <div className="pp-banner-actions">
            <button className="btn primary" onClick={() => user ? handleCta('pro') : openAuthModal('register')}>
              {bannerCta}
            </button>
            <Link className="btn ghost" to="/create-leaflet">See demo</Link>
          </div>
        </div>
      </section>
      )}
    </div>
    <Footer />
    </>
  );
}

