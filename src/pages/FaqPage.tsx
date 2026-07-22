import { useState } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './FaqPage.css';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_GROUPS: { group: string; icon: string; items: FaqItem[] }[] = [
  {
    group: 'Getting started',
    icon: 'rocket_launch',
    items: [
      { q: 'Do I need design skills to use LeafletAI?', a: 'Not at all. LeafletAI is built for non-designers. Pick a template, add your products, adjust colours and fonts, and your leaflet is ready. Most users publish their first leaflet within 5 minutes.' },
      { q: 'How do I create my first leaflet?', a: 'Sign up for a free account, click "Create leaflet", choose a template or start from scratch, then import your products or add them manually. When you\'re happy, hit Export.' },
      { q: 'Can I import an existing PDF?', a: 'Yes â€” upload any PDF and LeafletAI will preserve your existing layout. You can then layer in product cards, update text, and re-export as a new PDF or flipbook.' },
      { q: 'Is there a free trial?', a: 'The Free plan is free forever â€” no credit card required. Pro comes with a 14-day free trial. Business plans include a personalised onboarding demo.' },
    ],
  },
  {
    group: 'Products & data',
    icon: 'inventory_2',
    items: [
      { q: 'How do I add products to a leaflet?', a: 'You can add products manually (name, price, image, link) or import them in bulk from a CSV file. Each product becomes a styled card on your leaflet.' },
      { q: 'Can I link products to my online store?', a: 'Yes. Every product card can have a URL. In the flipbook export, readers can click through directly to your product page or checkout.' },
      { q: 'How many products can I add per leaflet?', a: 'Free plans support up to 30 products per leaflet. Pro supports 500, and Business is unlimited.' },
      { q: 'Can I reuse products across multiple leaflets?', a: 'Absolutely â€” your product catalogue is saved to your account. Add the same product to as many leaflets as you like without re-entering details.' },
    ],
  },
  {
    group: 'Design & customisation',
    icon: 'palette',
    items: [
      { q: 'Can I change fonts and colours?', a: 'Yes â€” full typography control (font size, weight, style, alignment, case transform) and colour controls per element, including gradient backgrounds.' },
      { q: 'What is the Customize Card Layout feature?', a: 'It\'s the visual editor where you can drag and resize elements on your product card, set borders, shadows, radius, and background for each element independently.' },
      { q: 'Can I add a cover page and back page?', a: 'Yes â€” upload a custom image as a cover page and/or back page. These are included in both PDF and flipbook exports for a professional, branded look.' },
      { q: 'Are there pre-made templates?', a: 'Yes â€” a growing library of pre-built, conversion-tested layouts. New templates are added monthly. You can also save your own layouts as reusable templates.' },
    ],
  },
  {
    group: 'Export & sharing',
    icon: 'upload_file',
    items: [
      { q: 'What export formats are available?', a: 'You can export as a standard PDF (print-ready, high-resolution) or as a PDF flipbook with interactive page-turn animations. Both include your cover and back pages.' },
      { q: 'What is the flipbook export?', a: 'The flipbook export generates an interactive PDF with realistic page-turn animations â€” the same experience as platforms like FlippingBook. Perfect for digital sharing via email, WhatsApp, or your website.' },
      { q: 'Is the exported PDF print-ready?', a: 'Yes â€” exports are high-resolution with correct margins. For commercial printing, we recommend using the PDF export and checking bleed settings with your print provider.' },
      { q: 'Can I share my leaflet without downloading it?', a: 'Sharing via a public link is on our roadmap. Currently, export your PDF or flipbook and share the file directly.' },
    ],
  },
  {
    group: 'Plans & billing',
    icon: 'credit_card',
    items: [
      { q: 'Can I upgrade or downgrade at any time?', a: 'Yes â€” changes take effect immediately and we prorate any charges. Downgrading to Free is always available with no penalty.' },
      { q: 'What happens to my leaflets if I downgrade?', a: 'Your existing leaflets remain fully accessible and viewable. You just won\'t be able to create new ones above the Free plan limit until you upgrade again or delete old ones.' },
      { q: 'Do you offer discounts for non-profits or schools?', a: 'Yes â€” contact us at sales@leafletai.com with proof of non-profit or educational status and we\'ll apply a 40% discount to any paid plan.' },
      { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards via Stripe (Visa, Mastercard, Amex). Annual invoicing is available on Business plans.' },
      { q: 'Can I cancel anytime?', a: 'Absolutely â€” cancel from your account settings with one click. You keep full access until the end of your current billing period. No hidden fees, no lock-in.' },
    ],
  },
  {
    group: 'Technical',
    icon: 'build',
    items: [
      { q: 'Do I need to install anything?', a: 'No â€” LeafletAI is entirely browser-based. Works on Chrome, Firefox, Edge, and Safari. No plugins, no downloads.' },
      { q: 'Is my data secure?', a: 'Yes â€” all data is encrypted in transit (HTTPS) and at rest. Uploaded images are stored securely and never shared with third parties.' },
      { q: 'Do you have an API?', a: 'API access is available on the Business plan. It lets you automate leaflet creation, sync product data, and trigger exports programmatically.' },
      { q: 'What image formats can I upload?', a: 'We support JPEG, PNG, WebP, and SVG for product images and cover pages. Maximum file size is 20 MB per image.' },
    ],
  },
];

export default function FaqPage() {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const { openAuthModal } = useAuth();

  function toggle(key: string) {
    setOpenItem(prev => prev === key ? null : key);
  }

  return (
    <>
    <SEOHelmet pageKey="faq" />
    <div className="fq-page">

      {/* â”€â”€ Hero â”€â”€ */}
      <section className="fq-hero">
        <p className="fq-eyebrow">FAQ</p>
        <h1 className="fq-title">Frequently asked questions</h1>
        <p className="fq-sub">
          Everything you need to know before you get started.
          Can't find your answer? <a href="mailto:hello@leafletai.com" className="fq-link">Email us</a>.
        </p>
      </section>

      {/* â”€â”€ FAQ groups â”€â”€ */}
      <div className="fq-content container">
        {FAQ_GROUPS.map(group => (
          <section key={group.group} className="fq-group">
            <div className="fq-group-head">
              <span className="fq-group-icon">{group.icon}</span>
              <h2 className="fq-group-title">{group.group}</h2>
            </div>
            <div className="fq-items">
              {group.items.map(item => {
                const key   = `${group.group}-${item.q}`;
                const open  = openItem === key;
                return (
                  <div key={key} className={`fq-item${open ? ' fq-item--open' : ''}`}>
                    <button
                      className="fq-question"
                      onClick={() => toggle(key)}
                      aria-expanded={open}
                    >
                      <span>{item.q}</span>
                      <span className={`fq-chevron material-symbol${open ? ' fq-chevron--open' : ''}`}>expand_more</span>
                    </button>
                    {open && <p className="fq-answer">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* â”€â”€ Still have questions â”€â”€ */}
      <section className="fq-contact container">
        <div className="fq-contact-inner">
          <div className="fq-contact-icon">chat</div>
          <h2>Still have questions?</h2>
          <p>Our team typically responds within a few hours on business days.</p>
          <div className="fq-contact-actions">
            <a className="btn primary" href="mailto:hello@leafletai.com">Email support</a>
            <Link className="btn ghost" to="/pricing">View pricing</Link>
          </div>
        </div>
      </section>

      {/* â”€â”€ CTA â”€â”€ */}
      <section className="fq-banner container">
        <div className="fq-banner-inner">
          <h2>Ready to create your first leaflet?</h2>
          <p>Free forever. No credit card required.</p>
          <button className="btn primary big" onClick={() => openAuthModal('register')}>
            Get started free
          </button>
        </div>
      </section>

    </div>
    <Footer />
    </>
  );
}

