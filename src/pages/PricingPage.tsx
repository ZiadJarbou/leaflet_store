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

type CheckoutPlanId = 'starter' | 'pro' | 'business';

interface PlanFeature {
  label: string;
  [planId: string]: string | boolean;
}

interface PricingPlan {
  id: 'free' | 'starter' | 'pro' | 'business' | 'agency';
  name: string;
  badge?: string | null;
  monthlyPrice: number;
  yearlyPrice?: number;
  annualPrice?: number;
  annualPriceLabel?: string;
  pricePrefix?: string;
  desc: string;
  cta: string;
  ctaVariant: 'ghost' | 'primary' | 'brand2';
  highlight?: boolean;
  features?: string[];
  checkoutPlanId?: CheckoutPlanId | 'contact' | 'free';
}

const DEFAULT_FEATURES: PlanFeature[] = [
  { label: 'Leaflets per month',       free: '1', starter: '5',  pro: '25', business: '100', agency: 'High-volume' },
  { label: 'Products per leaflet',     free: '20', starter: '100', pro: 'Large imports', business: true, agency: true },
  { label: 'CSV and XLSX import',      free: true, starter: true, pro: true, business: true, agency: true },
  { label: '2-language layouts',       free: true, starter: true, pro: true, business: true, agency: true },
  { label: 'PDF and PNG export',       free: false, starter: true, pro: true, business: true, agency: true },
  { label: 'Watermark removed',        free: false, starter: true, pro: true, business: true, agency: true },
  { label: 'Brand kits and templates', free: false, starter: false, pro: true, business: true, agency: true },
  { label: 'Team members',             free: '1', starter: '1', pro: '1', business: '5', agency: '10+' },
];

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id:           'free',
    name:         'Free',
    badge:        null,
    monthlyPrice: 0,
    yearlyPrice:  0,
    annualPrice:  0,
    desc:         'Explore LeafletAI and create your first promotional leaflet.',
    cta:          'Start for Free',
    ctaVariant:   'ghost' as const,
    highlight:    false,
    checkoutPlanId: 'free',
    features: [
      '1 leaflet per month',
      'Up to 20 products per leaflet',
      'Basic leaflet templates',
      'CSV and XLSX product import',
      '2-language support',
      'Standard-quality export',
      'LeafletAI watermark',
      '1 user',
    ],
  },
  {
    id:           'starter',
    name:         'Starter',
    badge:        null,
    monthlyPrice: 13.34,
    yearlyPrice:  133.42 / 12,
    annualPrice:  133.42,
    desc:         'Perfect for small shops and businesses that create promotional leaflets occasionally.',
    cta:          'Choose Starter',
    ctaVariant:   'ghost' as const,
    highlight:    false,
    checkoutPlanId: 'starter',
    features: [
      'Up to 5 leaflets per month',
      'Up to 100 products per leaflet',
      'CSV and XLSX product import',
      '2-language layouts',
      'Basic template library',
      'PDF and PNG export',
      'No LeafletAI watermark',
      'Save and edit your leaflets',
      '1 user',
    ],
  },
  {
    id:           'pro',
    name:         'Professional',
    badge:        'Most Popular',
    monthlyPrice: 26.96,
    yearlyPrice:  269.57 / 12,
    annualPrice:  269.57,
    desc:         'The best choice for supermarkets and active retailers that regularly create promotional campaigns.',
    cta:          'Choose Professional',
    ctaVariant:   'primary' as const,
    highlight:    true,
    checkoutPlanId: 'pro',
    features: [
      'Up to 25 leaflets per month',
      'Large product imports',
      'Access to all premium templates',
      'High-quality print-ready PDF export',
      '2-language layouts',
      'Custom fonts',
      'Brand kit with logos, colors, and fonts',
      'Background removal tools',
      'Custom reusable templates',
      'Priority support',
      '1 user',
    ],
  },
  {
    id:           'business',
    name:         'Business',
    badge:        null,
    monthlyPrice: 67.80,
    yearlyPrice:  677.99 / 12,
    annualPrice:  677.99,
    desc:         'Designed for marketing teams, multi-branch retailers, and businesses managing frequent promotional campaigns.',
    cta:          'Choose Business',
    ctaVariant:   'brand2' as const,
    highlight:    false,
    checkoutPlanId: 'business',
    features: [
      'Up to 100 leaflets per month',
      'Up to 5 team members',
      'Multiple brands and branches',
      'Shared product library',
      'Shared brand assets and templates',
      'Team collaboration',
      'User roles and permissions',
      'High-quality PDF and PNG export',
      'Advanced AI tools',
      'Higher AI usage limits',
      'Priority customer support',
      'Branch-specific logos and contact details',
    ],
  },
  {
    id:           'agency',
    name:         'Agency',
    badge:        null,
    monthlyPrice: 163.10,
    yearlyPrice:  0,
    annualPriceLabel: 'Custom annual pricing',
    pricePrefix:  'Starting from',
    desc:         'Built for agencies and large organizations managing multiple brands, stores, or clients.',
    cta:          'Contact Sales',
    ctaVariant:   'ghost' as const,
    highlight:    false,
    checkoutPlanId: 'contact',
    features: [
      'High-volume or unlimited leaflet creation',
      'Multiple client workspaces',
      '10 or more team members',
      'Separate brand kits for each client',
      'White-label leaflet exports',
      'Advanced team permissions',
      'Bulk product and design management',
      'Custom templates for each client',
      'Batch export tools',
      'Premium customer support',
      'Custom onboarding and training',
    ],
  },
];

const DEFAULT_ANNUAL_BILLING = {
  title: 'Annual Billing',
  subtitle: 'Save up to 17% with annual billing. Get two months free when you pay annually.',
  items: [
    'Starter: $133.42 per year',
    'Professional: $269.57 per year',
    'Business: $677.99 per year',
    'Agency: Custom annual pricing',
  ],
};

const DEFAULT_FAQ = [
  { q: 'Can I change plans at any time?',                      a: "Yes. You can upgrade or downgrade at any time. Changes take effect immediately and we'll prorate any charges." },
  { q: 'Is there a free trial for paid plans?',                a: "Pro comes with a 14-day free trial â€” no credit card required. Business plans get a personalised demo." },
  { q: 'What happens when I hit my leaflet limit?',            a: "You'll be prompted to upgrade. Existing leaflets remain fully accessible; you just can't create new ones until you upgrade or delete old ones." },
  { q: 'Do you offer discounts for non-profits or education?', a: "Yes â€” contact us at sales@leafletai.com with proof of status and we'll apply a 40% discount." },
  { q: 'What payment methods do you accept?',                  a: "We accept all major credit and debit cards via Stripe. Annual invoicing is available on Business plans." },
  { q: 'Can I cancel anytime?',                                a: "Absolutely. Cancel from your account settings with one click. You keep access until the end of your billing period." },
];

function FeatureValue({ val }: { val: string | boolean | undefined }) {
  if (val === undefined || val === null || val === '') return <span className="pp-dash" aria-label="Not included">remove</span>;
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
  const PLANS       = cmsJson<PricingPlan>(c,'plans','items', DEFAULT_PLANS);
  const annualSavings = getMaximumAnnualSavings(PLANS);
  const FEATURES    = cmsJson<PlanFeature>(c,'features','items', DEFAULT_FEATURES);
  const annualItems = cmsJson<string>(c,'annual','items', DEFAULT_ANNUAL_BILLING.items);
  const annualTitle = cms(c,'annual','title', DEFAULT_ANNUAL_BILLING.title);
  const annualSub   = cms(c,'annual','subtitle', DEFAULT_ANNUAL_BILLING.subtitle);
  const showAnnual  = cmsVisible(c,'annual');
  const faqItems    = cmsJson<{q:string;a:string}>(c,'faq','items', DEFAULT_FAQ);
  const bannerTitle = cms(c,'banner','title',    "Ready to create stunning leaflets?");
  const bannerSub   = cms(c,'banner','subtitle', "Join thousands of businesses already using LeafletAI.");
  const bannerCta   = cms(c,'banner','cta_label',"Get started free");
  const showBanner  = cmsVisible(c,'banner');
  const [planStart, setPlanStart] = useState(0);
  const [planDirection, setPlanDirection] = useState<'next' | 'prev'>('next');
  const visiblePlanCount = 3;
  const maxPlanStart = Math.max(0, PLANS.length - visiblePlanCount);
  const visiblePlans = PLANS.slice(planStart, planStart + visiblePlanCount);

  useEffect(() => {
    setPlanStart(start => Math.min(start, Math.max(0, PLANS.length - visiblePlanCount)));
  }, [PLANS.length]);

  function movePlans(direction: 'next' | 'prev') {
    setPlanDirection(direction);
    setPlanStart(start => direction === 'next'
      ? Math.min(maxPlanStart, start + 1)
      : Math.max(0, start - 1));
  }

  useEffect(() => {
    if (!user) return;
    getSubscription().then(setSubscription).catch(() => null);
  }, [user]);

  useEffect(() => {
    getLocalizedPricing().then(setLocalizedPricing).catch(() => setLocalizedPricing(null));
  }, []);

  function planCheckoutId(plan: PricingPlan): PricingPlan['checkoutPlanId'] {
    return plan.checkoutPlanId || (plan.id === 'agency' ? 'contact' : plan.id);
  }

  async function handleCta(plan: PricingPlan) {
    setErrorMsg('');
    const checkoutPlan = planCheckoutId(plan);

    if (checkoutPlan === 'free') {
      if (!user) { openAuthModal('register'); return; }
      return;
    }

    if (checkoutPlan === 'contact') {
      window.location.href = 'mailto:sales@leafletai.ai?subject=LeafletAI Agency Plan';
      return;
    }

    if (!user) { openAuthModal('register'); return; }

    const period = annual ? 'annual' : 'monthly';
    const key = `${plan.id}_${period}`;
    setLoading(key);
    try {
      const url = await createCheckoutSession(checkoutPlan, period);
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
    const checkoutPlan = planCheckoutId(plan);
    if (subscription.subscription_plan === checkoutPlan) return 'Current plan';
    if (plan.id === 'business' && subscription.subscription_plan === 'pro') return 'Upgrade now';
    if (plan.id === 'free' && subscription.subscription_plan !== 'free') return 'Downgrade to Free';
    return plan.cta;
  }

  function isCurrentPlan(plan: PricingPlan) {
    return user && subscription?.subscription_plan === planCheckoutId(plan);
  }

  function planDisplayName(planId: string) {
    return planId === 'pro' ? 'Professional' : planId.charAt(0).toUpperCase() + planId.slice(1);
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
    const planQuote = (planId === 'starter' || planId === 'pro' || planId === 'business' || planId === 'agency') ? localizedPricing?.plans?.[planId] : undefined;
    const quote = billedAnnually ? planQuote?.annual : planQuote?.monthly;
    const annualQuote = billedAnnually ? planQuote?.annual : undefined;
    const currency = quote?.currency || '';
    const monthlyAmount = quote?.amount ?? baseMonthlyAmount;
    const annualTotal = billedAnnually ? (annualQuote?.totalAmount ?? baseMonthlyAmount * 12) : null;
    return {
      monthlyLabel: formatMoney(monthlyAmount, currency || 'USD'),
      annualLabel: annualTotal !== null ? formatMoney(annualTotal, currency || 'USD') : '',
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
            You're on the <strong>{planDisplayName(subscription.subscription_plan)}</strong> plan
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
        <div className="container pp-carousel">
          {PLANS.length > visiblePlanCount && (
            <div className="pp-carousel-controls" aria-label="Pricing plan navigation">
              <button
                className="pp-carousel-btn material-symbol"
                type="button"
                onClick={() => movePlans('prev')}
                disabled={planStart === 0}
                aria-label="Previous pricing plans"
              >
                arrow_back
              </button>
              <span className="pp-carousel-status">{planStart + 1}-{Math.min(planStart + visiblePlanCount, PLANS.length)} of {PLANS.length}</span>
              <button
                className="pp-carousel-btn material-symbol"
                type="button"
                onClick={() => movePlans('next')}
                disabled={planStart >= maxPlanStart}
                aria-label="Next pricing plans"
              >
                arrow_forward
              </button>
            </div>
          )}
          <div key={planStart} className={`pp-cards pp-cards--slide-${planDirection}`}>
          {visiblePlans.map(plan => {
            const price   = annual ? Number(plan.yearlyPrice ?? plan.monthlyPrice) : Number(plan.monthlyPrice);
            const period  = annual ? 'annual' : 'monthly';
            const loadKey = `${plan.id}_${period}`;
            const current = isCurrentPlan(plan);
            const localizedPrice = displayPrice(plan.id, price, annual);
            const planFeatures = Array.isArray(plan.features) ? plan.features : [];
            const annualTotal = Number(plan.annualPrice || (Number(plan.yearlyPrice) || 0) * 12);

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
                        {plan.pricePrefix && <span className="pp-price-prefix">{plan.pricePrefix}</span>}
                        <span className="pp-price-amount pp-price-amount--localized">{localizedPrice.monthlyLabel}</span>
                        <span className="pp-price-period">/mo</span>
                      </>
                    )}
                  </div>
                  {annual && annualTotal > 0 && (
                    <p className="pp-billed-note">Billed {localizedPrice.annualLabel}/year</p>
                  )}
                  {annual && plan.annualPriceLabel && (
                    <p className="pp-billed-note">{plan.annualPriceLabel}</p>
                  )}
                </div>

                <button
                  className={`btn pp-cta-btn pp-cta-${plan.ctaVariant}`}
                  onClick={() => handleCta(plan)}
                  disabled={!!loading || current === true}
                >
                  {loading === loadKey ? (
                    <span className="pp-spinner" />
                  ) : ctaLabel(plan)}
                </button>

                <ul className="pp-feature-list">
                  {(planFeatures.length ? planFeatures : FEATURES.map(f => f[plan.id] ? `${f[plan.id]} ${f.label}` : '').filter(Boolean)).map(feature => (
                    <li key={String(feature)} className="pp-feature-item">
                      <span className="pp-feature-check">check</span>
                      <span className="pp-feature-label">{String(feature)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          </div>
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
                  {PLANS.map(p => (
                    <td key={p.id} className={`pp-td-val${p.highlight ? ' pp-td--highlight' : ''}`}>
                      <FeatureValue val={f[p.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAnnual && (
        <section className="pp-annual container">
          <div className="pp-annual-inner">
            <div>
              <h2 className="pp-annual-title">{annualTitle}</h2>
              <p className="pp-annual-sub">{annualSub}</p>
            </div>
            <ul className="pp-annual-list">
              {annualItems.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>
      )}

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
            <button className="btn primary" onClick={() => user ? handleCta(PLANS.find(p => p.id === 'pro') || DEFAULT_PLANS.find(p => p.id === 'pro')!) : openAuthModal('register')}>
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

