import { cssClass, cx } from '../utils/styleClass';
import { useState, useEffect } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    createCheckoutSession,
    getLocalizedPricing,
    getPublicSettings,
    getSubscription,
    type LocalizedPricing,
    type SubscriptionInfo,
} from '../services/api';
import Footer from '../components/Footer';
import { useCmsContent, cms, cmsVisible, cmsJson } from '../hooks/useCmsContent';
import { getMaximumAnnualSavings } from '../utils/pricing';
import { getYouTubeEmbedUrl } from '../utils/youtube';
import './PricingPage.css';
function DemoModal({ open, onClose, videoUrl }: {
    open: boolean;
    onClose: () => void;
    videoUrl: string;
}) {
    if (!open)
        return null;
    return (<div className="modal open" aria-hidden="false" onClick={(e) => { if (e.target === e.currentTarget)
        onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Demo video">
        <div className="modal-top">
          <b>LeafletAI Demo</b>
          <button className="close material-symbol" onClick={onClose} aria-label="Close">close</button>
        </div>
        <div className="modal-body">
          {getYouTubeEmbedUrl(videoUrl) ? (
            <iframe
              className="home-demo-video"
              src={getYouTubeEmbedUrl(videoUrl)}
              title="LeafletAI demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="hint">The demo video has not been added yet.</div>
          )}
        </div>
      </div>
    </div>);
}
const DEFAULT_FEATURES = [
    { ic: 'bolt', title: 'Easy Import', desc: 'Import PDFs in seconds â€” keep quality, skip complexity.' },
    { ic: 'psychology', title: 'Effortless Builder', desc: 'No design skills? No problem. It just works.' },
    { ic: 'extension', title: 'Templates Library', desc: 'Pre-built layouts crafted for high conversion.' },
    { ic: 'auto_awesome', title: 'Interactive Leaflets', desc: 'Turn static files into engaging digital experiences.' },
    { ic: 'construction', title: 'Full Customization', desc: 'Edit colors, fonts & layouts â€” make it uniquely yours.' },
    { ic: 'shopping_cart', title: 'Product Linking', desc: 'Connect leaflets directly to your product pages.' },
];
const DEFAULT_PRICING = [
    { name: 'Starter', desc: 'Perfect for personal projects & quick sharing.', price: '$16', period: '/mo', save: '$192 billed annually â€” save $228', features: ['Concurrent logins: 2 devices', '5 flipbooks', 'Basic templates', 'Share links & QR codes', 'Export to PDF'] },
    { name: 'Professional', desc: 'Everything you need to create like a pro.', price: '$16', period: '/mo', save: '$192 billed annually â€” save $228', features: ['Concurrent logins: 3 devices', '5 flipbooks', 'Full templates library', 'Customization controls', 'Export to PDF'] },
    { name: 'Business', desc: "Built for selling & growth.", price: '$16', period: '/mo', save: '$192 billed annually â€” save $228', features: ['Concurrent logins: 5 devices', '5 flipbooks', 'Unlimited product links', 'Priority support', 'Export to PDF'], best: true, badge: 'Best Value â€” Save 20% + Priority support' },
    { name: 'Enterprise', desc: 'Scale, control & dedicated support.', price: 'Custom', period: '', save: "Let's tailor a plan for your team", features: ['Multi-user access', 'Advanced store limits', 'Dedicated support', 'Security & compliance options', 'Custom onboarding'] },
];
const DEFAULT_PLANS = [
    { id: 'free', name: 'Free', badge: null, monthlyPrice: 0, yearlyPrice: 0, annualPrice: 0, desc: 'Explore LeafletAI and create your first promotional leaflet.', cta: 'Start for Free', ctaVariant: 'ghost', highlight: false, checkoutPlanId: 'free', features: ['1 leaflet per month', 'Up to 20 products per leaflet', 'Basic leaflet templates', 'CSV and XLSX product import', '2-language support', 'Standard-quality export', 'LeafletAI watermark', 'Concurrent logins: 1 device'] },
    { id: 'starter', name: 'Starter', badge: null, monthlyPrice: 13.34, yearlyPrice: 133.42 / 12, annualPrice: 133.42, desc: 'Perfect for small shops and businesses that create promotional leaflets occasionally.', cta: 'Choose Starter', ctaVariant: 'ghost', highlight: false, checkoutPlanId: 'starter', features: ['Up to 5 leaflets per month', 'Up to 100 products per leaflet', 'CSV and XLSX product import', '2-language layouts', 'Basic template library', 'PDF and PNG export', 'No LeafletAI watermark', 'Save and edit your leaflets', 'Concurrent logins: 2 devices'] },
    { id: 'pro', name: 'Professional', badge: 'Most Popular', monthlyPrice: 26.96, yearlyPrice: 269.57 / 12, annualPrice: 269.57, desc: 'The best choice for supermarkets and active retailers that regularly create promotional campaigns.', cta: 'Choose Professional', ctaVariant: 'primary', highlight: true, checkoutPlanId: 'pro', features: ['Up to 25 leaflets per month', 'Large product imports', 'Access to all premium templates', 'High-quality print-ready PDF export', '2-language layouts', 'Custom fonts', 'Brand kit with logos, colors, and fonts', 'Background removal tools', 'Custom reusable templates', 'Priority support', 'Concurrent logins: 3 devices'] },
    { id: 'business', name: 'Business', badge: null, monthlyPrice: 67.80, yearlyPrice: 677.99 / 12, annualPrice: 677.99, desc: 'Designed for marketing teams, multi-branch retailers, and businesses managing frequent promotional campaigns.', cta: 'Choose Business', ctaVariant: 'brand2', highlight: false, checkoutPlanId: 'business', features: ['Up to 100 leaflets per month', 'Concurrent logins: 5 devices', 'Multiple brands and branches', 'Shared product library', 'Shared brand assets and templates', 'Team collaboration', 'User roles and permissions', 'High-quality PDF and PNG export', 'Advanced AI tools', 'Higher AI usage limits', 'Priority customer support', 'Branch-specific logos and contact details'] },
    { id: 'agency', name: 'Agency', badge: null, monthlyPrice: 163.10, yearlyPrice: 0, annualPriceLabel: 'Custom annual pricing', pricePrefix: 'Starting from', desc: 'Built for agencies and large organizations managing multiple brands, stores, or clients.', cta: 'Contact Sales', ctaVariant: 'ghost', highlight: false, checkoutPlanId: 'contact', features: ['High-volume or unlimited leaflet creation', 'Multiple client workspaces', 'Concurrent logins: 10+ devices', 'Separate brand kits for each client', 'White-label leaflet exports', 'Advanced team permissions', 'Bulk product and design management', 'Custom templates for each client', 'Batch export tools', 'Premium customer support', 'Custom onboarding and training'] },
];
const DEFAULT_FEATURES_COMPARE = [
    { label: 'Leaflets per month', free: '1', starter: '5', pro: '25', business: '100', agency: 'High-volume' },
    { label: 'Products per leaflet', free: '20', starter: '100', pro: 'Large imports', business: true, agency: true },
    { label: 'CSV and XLSX import', free: true, starter: true, pro: true, business: true, agency: true },
    { label: '2-language layouts', free: true, starter: true, pro: true, business: true, agency: true },
    { label: 'PDF and PNG export', free: false, starter: true, pro: true, business: true, agency: true },
    { label: 'Watermark removed', free: false, starter: true, pro: true, business: true, agency: true },
    { label: 'Brand kits and templates', free: false, starter: false, pro: true, business: true, agency: true },
    { label: 'Concurrent logins', free: '1 device', starter: '2 devices', pro: '3 devices', business: '5 devices', agency: '10+ devices' },
];
const DEFAULT_FAQ = [
    { q: 'Do I need design skills?', a: 'No â€” use templates or start from your PDF and edit visually in minutes.' },
    { q: 'Can I link products inside the leaflet?', a: 'Yes â€” add clickable links to product pages and track better conversions.' },
    { q: 'Can I export for print?', a: 'Absolutely â€” export print-ready PDFs anytime, optimized for sharing and printing.' },
    { q: 'Is it good for creators and stores?', a: "Yes â€” it's designed for creators who want conversion-focused leaflets and a store-like experience." },
];
export default function HomePage() {
    const { user, openAuthModal, closeAuthModal } = useAuth();
    const [demoOpen, setDemoOpen] = useState(false);
    const [annual, setAnnual] = useState(false);
    const [ctaLoading, setCtaLoading] = useState<string | null>(null);
    const [pricingError, setPricingError] = useState('');
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [localizedPricing, setLocalizedPricing] = useState<LocalizedPricing | null>(null);
    const [demoVideoUrl, setDemoVideoUrl] = useState('');
    const [planStart, setPlanStart] = useState(0);
    const [planDirection, setPlanDirection] = useState<'next' | 'prev'>('next');
    const c = useCmsContent('home');
    const cp = useCmsContent('pricing'); // pricing page data â€” single source of truth
    useEffect(() => { closeAuthModal(); }, [closeAuthModal]);
    useEffect(() => {
        if (!user) {
            setSubscription(null);
            return;
        }
        getSubscription().then(setSubscription).catch(() => null);
    }, [user]);
    useEffect(() => {
        getLocalizedPricing().then(setLocalizedPricing).catch(() => setLocalizedPricing(null));
    }, []);
    useEffect(() => {
        getPublicSettings().then(settings => setDemoVideoUrl(settings.home_demo_video_url || '')).catch(() => null);
    }, []);
    function checkoutPlanId(plan: any): 'free' | 'starter' | 'pro' | 'business' | 'contact' {
        return plan.checkoutPlanId || (plan.id === 'agency' ? 'contact' : plan.id);
    }
    async function handleCta(plan: any) {
        setPricingError('');
        const planId = checkoutPlanId(plan);
        if (planId === 'free') {
            if (!user) {
                openAuthModal('register');
                return;
            }
            return;
        }
        if (planId === 'contact') {
            window.location.href = 'mailto:sales@leafletai.ai?subject=LeafletAI Agency Plan';
            return;
        }
        if (!user) {
            openAuthModal('register');
            return;
        }
        const period = annual ? 'annual' : 'monthly';
        const key = `${planId}_${period}`;
        setCtaLoading(key);
        try {
            const url = await createCheckoutSession(planId, period);
            window.location.href = url;
        }
        catch (err: unknown) {
            setPricingError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setCtaLoading(null);
        }
    }
    function isCurrentPlan(plan: any) {
        return !!user && subscription?.subscription_plan === checkoutPlanId(plan);
    }
    function planCtaLabel(plan: any) {
        if (!user || !subscription)
            return plan.cta || 'Get started';
        if (subscription.subscription_plan === checkoutPlanId(plan))
            return 'Current plan';
        if (plan.id === 'business' && subscription.subscription_plan === 'pro')
            return 'Upgrade now';
        if (plan.id === 'free' && subscription.subscription_plan !== 'free')
            return 'Downgrade to Free';
        return plan.cta || 'Get started';
    }
    function formatMoney(amount: number, currency: string) {
        const rounded = Math.round((Number(amount) || 0) * 100) / 100;
        const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
        const options: Intl.NumberFormatOptions = {
            minimumFractionDigits: hasFraction ? 2 : 0,
            maximumFractionDigits: hasFraction ? 2 : 2,
        };
        if (currency.toUpperCase() === 'USD')
            return `$${new Intl.NumberFormat(navigator.languages?.[0] || navigator.language || 'en', options).format(rounded)}`;
        return new Intl.NumberFormat(navigator.languages?.[0] || navigator.language || 'en', {
            ...options,
            style: 'currency',
            currency,
        }).format(rounded);
    }
    function displayPrice(planId: string, baseMonthlyAmount: number, billedAnnually: boolean) {
        const planQuote = planId === 'starter' || planId === 'pro' || planId === 'business' || planId === 'agency'
            ? localizedPricing?.plans?.[planId]
            : undefined;
        const quote = billedAnnually ? planQuote?.annual : planQuote?.monthly;
        const currency = quote?.currency || '';
        const monthlyAmount = quote?.amount ?? baseMonthlyAmount;
        const annualTotal = billedAnnually
            ? (planQuote?.annual?.totalAmount ?? baseMonthlyAmount * 12)
            : null;
        return {
            monthlyLabel: formatMoney(monthlyAmount, currency || 'USD'),
            annualLabel: annualTotal === null
                ? ''
                : formatMoney(annualTotal, currency || 'USD'),
        };
    }
    const heroTitle = cms(c, 'hero', 'title', "Design leaflets that captivate.\nBuild stores that convert. Export PDFs instantly.");
    const heroSub = cms(c, 'hero', 'subtitle', "Create, publish, and sell professional leaflets â€” no skills required, no time wasted. Import PDFs, customize freely, link products, and export ready-to-share PDFs in minutes.");
    const ctaLabel = cms(c, 'hero', 'cta_label', "Create Leaflets That Sell");
    const ctaLink = cms(c, 'hero', 'cta_link', "/create-leaflet");
    const demoLabel = cms(c, 'hero', 'demo_label', "Watch Demo (60 sec)");
    const showHero = cmsVisible(c, 'hero');
    const featTitle = cms(c, 'features', 'section_title', "Feature highlights");
    const featSub = cms(c, 'features', 'section_subtitle', "Everything you need to create premium leaflets and publish store-ready experiences â€” without the complexity.");
    const featCta = cms(c, 'features', 'cta_label', "Start Building for Free");
    const showFeats = cmsVisible(c, 'features');
    const featItems = cmsJson<{
        ic: string;
        title: string;
        desc: string;
    }>(c, 'features', 'items', DEFAULT_FEATURES);
    /* pricing â€” pulled from pricing page CMS */
    const pricTitle = cms(c, 'pricing', 'section_title', "Pricing that scales with your ambition");
    const pricSub = cms(c, 'pricing', 'section_subtitle', "Start small, grow fast â€” switch to yearly and save more.");
    const showPricing = cmsVisible(c, 'pricing');
    const plans = cmsJson<any>(cp, 'plans', 'items', DEFAULT_PLANS);
    const annualSavings = getMaximumAnnualSavings(plans);
    const features = cmsJson<any>(cp, 'features', 'items', DEFAULT_FEATURES_COMPARE);
    const visiblePlanCount = 3;
    const maxPlanStart = Math.max(0, plans.length - visiblePlanCount);
    const visiblePlans = plans.slice(planStart, planStart + visiblePlanCount);
    useEffect(() => {
        setPlanStart(start => Math.min(start, Math.max(0, plans.length - visiblePlanCount)));
    }, [plans.length]);
    function movePlans(direction: 'next' | 'prev') {
        setPlanDirection(direction);
        setPlanStart(start => direction === 'next'
            ? Math.min(maxPlanStart, start + 1)
            : Math.max(0, start - 1));
    }
    const faqTitle = cms(c, 'faq', 'section_title', "Frequently asked questions");
    const faqSub = cms(c, 'faq', 'section_subtitle', "Quick answers to reduce friction and help you launch faster.");
    const showFaq = cmsVisible(c, 'faq');
    const faqItems = cmsJson<{
        q: string;
        a: string;
    }>(c, 'faq', 'items', DEFAULT_FAQ);
    return (<>
      <SEOHelmet pageKey="home"/>

      {showHero && (<header className="hero" id="why">
          <div className="container">
            <div className="hero-grid">
              <div className="video-card" aria-label="Demo video">
                <div className="video-overlay">
                  <button className="play" onClick={() => setDemoOpen(true)} aria-label="Watch demo">
                    <span className="material-symbol" aria-hidden="true">play_arrow</span>
                  </button>
                </div>
                <div className="video-caption">
                  <span className={cx("material-symbol", cssClass({ opacity: .9 }))} aria-hidden="true">play_arrow</span>
                  <span>Watch a quick demo (60 sec)</span>
                </div>
              </div>

              <div>
                <div className="pill"><span className="dot"></span> Built for creators &amp; stores</div>
                <h1>
                  {heroTitle.split('\n').map((line, i) => (<span key={i}>{i === 0 ? <span className="grad">{line}</span> : line}{i < heroTitle.split('\n').length - 1 ? <br /> : null}</span>))}
                </h1>
                <p className="sub">{heroSub}</p>
                <div className="cta-row">
                  <Link className="btn primary big" to={ctaLink}>{ctaLabel}</Link>
                  <button className="btn ghost big" onClick={() => setDemoOpen(true)}>{demoLabel}</button>
                </div>
                <div className="strip" aria-label="Key benefits">
                  <div className="strip-item"><div className="strip-ic">description</div><div><b>Import fast</b><br /><span>PDFs in seconds</span></div></div>
                  <div className="strip-item"><div className="strip-ic">palette</div><div><b>Customize</b><br /><span>colors &amp; fonts</span></div></div>
                  <div className="strip-item"><div className="strip-ic">link</div><div><b>Link products</b><br /><span>real conversion</span></div></div>
                  <div className="strip-item"><div className="strip-ic">download</div><div><b>Export</b><br /><span>print-ready PDF</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </header>)}

      {showFeats && (<section className="section" id="features">
          <div className="container">
            <div className="sec-head">
              <h2>{featTitle}</h2>
              <p>{featSub}</p>
            </div>
            <div className="features">
              {featItems.map(f => (<div className="card" key={f.title}>
                  <div className="ic material-symbol" aria-hidden="true">{f.ic}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>))}
            </div>
            <div className="center-cta">
              <Link className="btn primary big" to="/create-leaflet">{featCta}</Link>
            </div>
          </div>
        </section>)}

      {showPricing && (<section className="section" id="pricing">
          <div className="container">
            <div className="sec-head">
              <h2>{pricTitle}</h2>
              <p>{pricSub}</p>
            </div>

            {/* billing toggle â€” identical to PricingPage */}
            <div className={cssClass({ textAlign: 'center', marginBottom: 40 })}>
              <div className="pp-toggle-wrap">
                <span className={!annual ? 'pp-toggle-label active' : 'pp-toggle-label'}>Monthly</span>
                <button className={`pp-toggle${annual ? ' on' : ''}`} onClick={() => setAnnual(a => !a)} aria-label="Toggle billing">
                  <span className="pp-toggle-thumb"/>
                </button>
                <span className={annual ? 'pp-toggle-label active' : 'pp-toggle-label'}>
                  Annual {annualSavings > 0 && <span className="pp-save-badge">Save up to 17%</span>}
                </span>
              </div>
            </div>

            {/* plan cards â€” exact same markup & classes as PricingPage */}
            <div className="pp-carousel">
              {plans.length > visiblePlanCount && (
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
                  <span className="pp-carousel-status">{planStart + 1}-{Math.min(planStart + visiblePlanCount, plans.length)} of {plans.length}</span>
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
              {visiblePlans.map((plan: any) => {
                const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
                const current = isCurrentPlan(plan);
                const localizedPrice = displayPrice(plan.id, price, annual);
                return (<div key={plan.id} className={`pp-card${plan.highlight ? ' pp-card--highlight' : ''}${current ? ' pp-card--current' : ''}`}>
                    {plan.badge && <div className="pp-card-badge">{plan.badge}</div>}
                    {current && <div className="pp-card-current-badge">Your plan</div>}

                    <div className="pp-card-top">
                      <h3 className="pp-plan-name">{plan.name}</h3>
                      <p className="pp-plan-desc">{plan.desc}</p>
                      <div className="pp-price-row">
                        {price === 0 ? (<span className="pp-price-amount">Free</span>) : (<>
                            {plan.pricePrefix && <span className="pp-price-prefix">{plan.pricePrefix}</span>}
                            <span className="pp-price-amount pp-price-amount--localized">{localizedPrice.monthlyLabel}</span>
                            <span className="pp-price-period">/mo</span>
                          </>)}
                      </div>
                      {annual && price > 0 && (<p className="pp-billed-note">Billed {localizedPrice.annualLabel}/year</p>)}
                      {annual && plan.annualPriceLabel && (<p className="pp-billed-note">{plan.annualPriceLabel}</p>)}
                    </div>

                    <button className={`btn pp-cta-btn pp-cta-${plan.ctaVariant ?? 'ghost'}`} disabled={!!ctaLoading || current} onClick={() => handleCta(plan)}>
                      {ctaLoading === `${plan.id}_${annual ? 'annual' : 'monthly'}`
                        ? <span className="pp-spinner" />
                        : planCtaLabel(plan)}
                    </button>

                    <ul className="pp-feature-list">
                      {(Array.isArray(plan.features) && plan.features.length ? plan.features : features.map((f: any) => {
                        const val = f[plan.id as 'free' | 'starter' | 'pro' | 'business'];
                        if (val === false)
                            return '';
                        return typeof val === 'string' && val !== 'true'
                            ? `${val} ${f.label.toLowerCase()}`
                            : f.label;
                    }).filter(Boolean)).map((feature: any) => (<li key={String(feature)} className="pp-feature-item">
                            <span className="pp-feature-check">check</span>
                            <span className="pp-feature-label">{String(feature)}</span>
                          </li>))}
                    </ul>
                  </div>);
            })}
              </div>
            </div>

            {pricingError && (
              <div className="pp-notice pp-notice--error">
                {pricingError}
                <button className="pp-notice-close material-symbol" onClick={() => setPricingError('')} aria-label="Close notice">close</button>
              </div>
            )}

            <div className={cx("center-cta", cssClass({ marginTop: 32 }))}>
              <Link className="btn ghost" to="/pricing">View full pricing &amp; feature comparison <span className="material-symbol" aria-hidden="true">arrow_forward</span></Link>
            </div>
          </div>
        </section>)}

      {showFaq && (<section className="section" id="faq">
          <div className="container">
            <div className="sec-head">
              <h2>{faqTitle}</h2>
              <p>{faqSub}</p>
            </div>
            <div className="faq">
              {faqItems.map(item => (<details key={item.q}>
                  <summary>{item.q}<span className="chev material-symbol" aria-hidden="true">expand_more</span></summary>
                  <p>{item.a}</p>
                </details>))}
            </div>
          </div>
        </section>)}

      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} videoUrl={demoVideoUrl}/>
    </>);
}

