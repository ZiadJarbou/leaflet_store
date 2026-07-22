import { cssClass, cx } from '../utils/styleClass';
import { Link } from 'react-router-dom';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import './WhyPage.css';
const PAINS = [
    {
        emoji: 'sentiment_dissatisfied',
        pain: 'Hours wasted in Photoshop or InDesign just to update a price',
        fix: 'Edit any text, price, or image in seconds — no design tool needed.',
    },
    {
        emoji: 'upload_file',
        pain: 'Sharing static PDFs that nobody can interact with',
        fix: 'Publish interactive flipbooks with clickable product links.',
    },
    {
        emoji: 'sync',
        pain: 'Starting from scratch every time you run a campaign',
        fix: 'Save your brand layout as a template and reuse it instantly.',
    },
    {
        emoji: 'print',
        pain: 'Print files that look wrong when sent to a printer',
        fix: 'Export print-ready, high-res PDFs with correct bleed and margins.',
    },
    {
        emoji: 'monitoring',
        pain: 'No idea whether your leaflets are actually being read',
        fix: 'Built-in analytics show views, clicks, and engagement per leaflet.',
    },
    {
        emoji: 'payments',
        pain: 'Paying a designer $200+ every time prices change',
        fix: 'Update your entire catalogue yourself in under 5 minutes.',
    },
];
const STATS = [
    { value: '5,000+', label: 'Businesses using LeafletAI' },
    { value: '2.4M+', label: 'Leaflets published' },
    { value: '< 5 min', label: 'Average time to first leaflet' },
    { value: '98%', label: 'Customer satisfaction score' },
];
const TESTIMONIALS = [
    {
        name: 'Sarah M.',
        role: 'Marketing Manager, RetailCo',
        avatar: 'S',
        quote: 'We cut our leaflet production time from 3 days to 20 minutes. Our team can now update prices and publish the same day — it\'s a game changer.',
        color: '#7c5cff',
    },
    {
        name: 'Ahmed K.',
        role: 'Owner, Fresh Mart',
        avatar: 'A',
        quote: 'I used to pay a freelancer every week to update our weekly offers. Now I do it myself before my morning coffee. The savings paid for a year of Pro in the first month.',
        color: '#49f2b6',
    },
    {
        name: 'Lena T.',
        role: 'Creative Director, Studio Flow',
        avatar: 'L',
        quote: 'The flipbook export is incredible. Clients love receiving an interactive PDF instead of a flat file. It looks so much more professional.',
        color: '#f59e0b',
    },
];
const WHO = [
    { emoji: 'shopping_cart', title: 'Retail stores', desc: 'Weekly offers, seasonal promotions, product catalogues — update and distribute in minutes.' },
    { emoji: 'restaurant', title: 'Restaurants & cafés', desc: 'Beautiful menus and specials that stay current without printing costs.' },
    { emoji: 'home', title: 'Real estate agencies', desc: 'Property listings with photos, prices, and direct inquiry links.' },
    { emoji: 'spa', title: 'Beauty & wellness', desc: 'Service menus, seasonal campaigns, and loyalty offers that convert.' },
    { emoji: 'inventory_2', title: 'E-commerce brands', desc: 'Product drops and lookbooks that link straight to your store.' },
    { emoji: 'school', title: 'Educational orgs', desc: 'Course catalogues, event flyers, and programme guides — always up to date.' },
];
export default function WhyPage() {
    const { openAuthModal } = useAuth();
    return (<>
    <SEOHelmet pageKey="why"/>
    <div className="wp-page">

      {/* ── Hero ── */}
      <section className="wp-hero">
        <p className="wp-eyebrow">Why LeafletAI</p>
        <h1 className="wp-title">
          Stop wasting time on leaflets.<br />
          <span className="wp-title-accent">Start getting results.</span>
        </h1>
        <p className="wp-sub">
          Traditional leaflet design is slow, expensive, and static.
          LeafletAI gives your team the power to create, update, and publish
          professional leaflets — in a fraction of the time, at a fraction of the cost.
        </p>
        <div className="wp-hero-cta">
          <button className="btn primary big" onClick={() => openAuthModal('register')}>
            Try it free — no credit card
          </button>
          <Link className="btn ghost big" to="/features">Explore features →</Link>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="wp-stats-bar">
        <div className="container wp-stats">
          {STATS.map(s => (<div key={s.label} className="wp-stat">
              <span className="wp-stat-value">{s.value}</span>
              <span className="wp-stat-label">{s.label}</span>
            </div>))}
        </div>
      </section>

      {/* ── Pain → Fix grid ── */}
      <section className="wp-section container">
        <div className="wp-sec-head">
          <h2>The old way vs. the LeafletAI way</h2>
          <p>Every pain point your team faces today has a faster, smarter solution.</p>
        </div>
        <div className="wp-pain-grid">
          {PAINS.map(item => (<div key={item.pain} className="wp-pain-card">
              <div className="wp-pain-emoji">{item.emoji}</div>
              <div className="wp-pain-before">
                <span className="wp-pain-tag">Before</span>
                <p>{item.pain}</p>
              </div>
              <div className="wp-pain-arrow">→</div>
              <div className="wp-pain-after">
                <span className="wp-fix-tag">With LeafletAI</span>
                <p>{item.fix}</p>
              </div>
            </div>))}
        </div>
      </section>

      {/* ── Who is it for ── */}
      <section className="wp-section wp-section--alt">
        <div className="container">
          <div className="wp-sec-head">
            <h2>Built for businesses of every kind</h2>
            <p>If you need to communicate with customers using visual content, LeafletAI is for you.</p>
          </div>
          <div className="wp-who-grid">
            {WHO.map(w => (<div key={w.title} className="wp-who-card">
                <div className="wp-who-emoji">{w.emoji}</div>
                <h3 className="wp-who-title">{w.title}</h3>
                <p className="wp-who-desc">{w.desc}</p>
              </div>))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="wp-section container">
        <div className="wp-sec-head">
          <h2>What our customers say</h2>
          <p>Real results from real businesses — not marketing copy.</p>
        </div>
        <div className="wp-testi-grid">
          {TESTIMONIALS.map(t => (<div key={t.name} className="wp-testi-card">
              <p className="wp-testi-quote">"{t.quote}"</p>
              <div className="wp-testi-author">
                <div className={cx("wp-testi-avatar", cssClass({ background: t.color }))}>{t.avatar}</div>
                <div>
                  <div className="wp-testi-name">{t.name}</div>
                  <div className="wp-testi-role">{t.role}</div>
                </div>
              </div>
            </div>))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="wp-banner container">
        <div className="wp-banner-inner">
          <h2>Ready to transform how you create leaflets?</h2>
          <p>Join 5,000+ businesses that already publish faster with LeafletAI.</p>
          <div className="wp-banner-actions">
            <button className="btn primary big" onClick={() => openAuthModal('register')}>
              Get started free
            </button>
            <Link className="btn ghost big" to="/pricing">See pricing</Link>
          </div>
        </div>
      </section>

    </div>
    <Footer />
    </>);
}
