import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { useCmsContent, cms } from '../hooks/useCmsContent';
import './PrivacyPage.css';

export default function PrivacyPage() {
  const c = useCmsContent('privacy');
  const heroTitle = cms(c,'hero','title','Privacy Policy');
  return (
    <>
      <SEOHelmet pageKey="privacy" />
      <div className="pp-page">
        <div className="pp-container">

          {/* ── Hero ── */}
          <div className="pp-hero">
            <div className="pp-badge">Legal</div>
            <h1 className="pp-hero-title">{heroTitle}</h1>
            <p className="pp-hero-sub">
              Date of Last Revision: <strong>March 2026</strong>
            </p>
          </div>

          {/* ── Intro ── */}
          <div className="pp-card pp-intro">
            <p>
              This Privacy Policy describes how we collect, use, share, and protect your personal
              data when you use our websites, applications, and other services that link to this
              Privacy Policy — including but not limited to the LeafletAI platform and related
              AI-powered tools (collectively, the <strong>"Services"</strong>).
            </p>
            <p>
              LeafletAI (<strong>"LeafletAI"</strong>, <strong>"we"</strong>,{' '}
              <strong>"our"</strong>, or <strong>"us"</strong>) is the data controller responsible
              for processing your personal data in accordance with applicable data protection laws,
              including the{' '}
              <strong>UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021)</strong>{' '}
              and, where applicable, the{' '}
              <strong>General Data Protection Regulation (GDPR)</strong>.
            </p>
          </div>

          {/* ── TOC ── */}
          <nav className="pp-toc">
            <p className="pp-toc-heading">Table of Contents</p>
            <ol className="pp-toc-list">
              {[
                'What Information Do We Collect?',
                'How Do We Use Your Information?',
                'How Do We Store Your Information?',
                'How Do We Share Your Data?',
                'Data Security',
                'Your Rights',
                'Cookies and Tracking Technologies',
                'Cookie Banner Notice',
                'Image Copyright & User Responsibility',
                'Privacy Policy Updates',
                'Contact Us',
                'Jurisdiction-Specific Terms',
              ].map((item, i) => (
                <li key={i}>
                  <a href={`#section-${i + 1}`}>{item}</a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ── Section 1 ── */}
          <section id="section-1" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">1</span>
              What Information Do We Collect From You?
            </h2>

            <div className="pp-sub">
              <h3>A. Personal Data You Provide to Us</h3>
              <p>We collect personal data when you create an account, use our Services, or communicate with us:</p>

              <div className="pp-item-list">
                <div className="pp-item">
                  <div className="pp-item-title">1. Account Information</div>
                  <p>Name, username, email address, and login credentials.</p>
                  <ul>
                    <li>Google sign-in: user ID, name, email</li>
                    <li>Other providers: similar profile information</li>
                    <li>Email sign-up: email and password</li>
                  </ul>
                </div>
                <div className="pp-item">
                  <div className="pp-item-title">2. Input and Output</div>
                  <p>Content you submit (prompts, data, product information, URLs, images, or text) and AI-generated responses. This may be stored as part of your account history.</p>
                </div>
                <div className="pp-item">
                  <div className="pp-item-title">3. Uploaded Content</div>
                  <p>Documents, files, product images, datasets, or media uploaded to the platform.</p>
                </div>
                <div className="pp-item">
                  <div className="pp-item-title">4. Purchase Information</div>
                  <p>Billing and payment data processed via secure third-party providers.</p>
                </div>
                <div className="pp-item">
                  <div className="pp-item-title">5. Communication Data</div>
                  <p>Messages, feedback, or support inquiries you send to us.</p>
                </div>
                <div className="pp-item">
                  <div className="pp-item-title">6. Other Information</div>
                  <p>Survey responses, event participation, or additional voluntary data.</p>
                </div>
              </div>
            </div>

            <div className="pp-sub">
              <h3>B. Personal Data Collected Automatically</h3>
              <div className="pp-grid-2">
                <div className="pp-chip-card">
                  <div className="pp-chip-icon">desktop_windows</div>
                  <div>
                    <strong>Device &amp; Network</strong>
                    <p>IP address, device type, operating system, browser type.</p>
                  </div>
                </div>
                <div className="pp-chip-card">
                  <div className="pp-chip-icon">content_paste</div>
                  <div>
                    <strong>Log Data</strong>
                    <p>System activity, error logs, performance metrics.</p>
                  </div>
                </div>
                <div className="pp-chip-card">
                  <div className="pp-chip-icon">monitoring</div>
                  <div>
                    <strong>Usage Data</strong>
                    <p>Interactions, features used, session duration.</p>
                  </div>
                </div>
                <div className="pp-chip-card">
                  <div className="pp-chip-icon">cookie</div>
                  <div>
                    <strong>Cookies &amp; Tracking</strong>
                    <p>Used to operate, analyze, and improve the Services.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pp-sub pp-highlight">
              <h3>C. Product and Market Data (Price Observatory)</h3>
              <p>As part of certain features, LeafletAI may collect and process <strong>product-related data</strong>, including but not limited to:</p>
              <ul className="pp-check-list">
                <li>Product names and descriptions</li>
                <li>Product prices</li>
                <li>Product images</li>
                <li>Product URLs or links</li>
                <li>Retailer or marketplace identifiers</li>
                <li>Availability and pricing trends over time</li>
              </ul>
              <p>We use this information to create and operate <strong>price observatory and market intelligence features</strong>, including:</p>
              <ul className="pp-check-list">
                <li>Price tracking and monitoring</li>
                <li>Market trend analysis</li>
                <li>Competitive benchmarking</li>
                <li>Insights, analytics, and reporting</li>
              </ul>
              <p className="pp-note">Where required by law, such processing will be conducted on an aggregated, anonymized, or non-personal basis.</p>
            </div>

            <div className="pp-sub">
              <h3>D. Sensitive Data</h3>
              <p>We do <strong>not intentionally collect sensitive personal data</strong> (e.g., health, biometric, or religious data) unless required and with explicit consent, in compliance with UAE PDPL and GDPR requirements.</p>
            </div>

            <div className="pp-sub">
              <h3>E. Children's Data</h3>
              <p>LeafletAI does not knowingly collect data from individuals under the age of 13 (or applicable minimum age). If identified, such data will be deleted.</p>
            </div>
          </section>

          {/* ── Section 2 ── */}
          <section id="section-2" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">2</span>
              How Do We Use Your Information?
            </h2>
            <p>We process your personal data to:</p>
            <ul className="pp-check-list">
              <li>Provide and operate the Services</li>
              <li>Manage accounts and subscriptions</li>
              <li>Improve and develop AI and analytics features</li>
              <li>Power <strong>price observatory and product intelligence tools</strong></li>
              <li>Communicate updates, support, and notifications</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>

            <div className="pp-sub">
              <h3>Legal Bases for Processing (GDPR)</h3>
              <div className="pp-grid-2">
                {[
                  { label: 'Contractual Necessity', icon: 'description' },
                  { label: 'Legitimate Interests', icon: 'balance' },
                  { label: 'Consent', icon: 'check_circle' },
                  { label: 'Legal Obligations', icon: 'account_balance' },
                ].map(b => (
                  <div className="pp-basis-card" key={b.label}>
                    <span className="pp-basis-icon">{b.icon}</span>
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pp-sub pp-callout">
              <strong>AI Training Transparency</strong>
              <p>Your Input and Output are <strong>not used for AI model training without your explicit consent</strong>. We may use anonymized or aggregated data to improve system performance.</p>
            </div>
          </section>

          {/* ── Section 3 ── */}
          <section id="section-3" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">3</span>
              How Do We Store Your Information?
            </h2>
            <div className="pp-grid-3">
              <div className="pp-store-card">
                <div className="pp-store-icon">database</div>
                <h4>Data Storage</h4>
                <p>Your data may be stored on secure servers located in the UAE, EU, or other jurisdictions.</p>
              </div>
              <div className="pp-store-card">
                <div className="pp-store-icon">public</div>
                <h4>International Transfers</h4>
                <p>We implement Standard Contractual Clauses (SCCs) and UAE-compliant transfer mechanisms.</p>
              </div>
              <div className="pp-store-card">
                <div className="pp-store-icon">calendar_month</div>
                <h4>Data Retention</h4>
                <p>We retain data only as long as necessary. Product and pricing data may be retained in aggregated or anonymized form.</p>
              </div>
            </div>
          </section>

          {/* ── Section 4 ── */}
          <section id="section-4" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">4</span>
              How Do We Share Your Data?
            </h2>
            <p>We may share personal data with:</p>
            <div className="pp-share-grid">
              {[
                { n: '01', t: 'Service Providers' },
                { n: '02', t: 'Affiliates' },
                { n: '03', t: 'Legal Authorities' },
                { n: '04', t: 'Business Transfers' },
                { n: '05', t: 'Third-Party Integrations' },
                { n: '06', t: 'User-Directed Sharing' },
                { n: '07', t: 'With Your Consent' },
              ].map(s => (
                <div className="pp-share-item" key={s.n}>
                  <span className="pp-share-num">{s.n}</span>
                  <span>{s.t}</span>
                </div>
              ))}
            </div>
            <p className="pp-note mt">We may also share <strong>aggregated or anonymized product and pricing insights</strong> that do not identify individuals.</p>
            <div className="pp-callout pp-no-sell">
              <span className="pp-basis-icon">block</span> &nbsp;We do <strong>not sell personal data</strong>.
            </div>
          </section>

          {/* ── Section 5 ── */}
          <section id="section-5" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">5</span>
              Data Security
            </h2>
            <p>We implement strong security measures including encryption and access control. However, no system is completely secure.</p>
          </section>

          {/* ── Section 6 ── */}
          <section id="section-6" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">6</span>
              Your Rights
            </h2>
            <p>Under UAE PDPL and GDPR, you may:</p>
            <div className="pp-rights-grid">
              {[
                { icon: 'visibility', right: 'Access your data' },
                { icon: 'edit', right: 'Correct inaccuracies' },
                { icon: 'delete', right: 'Request deletion' },
                { icon: 'block', right: 'Restrict or object to processing' },
                { icon: 'undo', right: 'Withdraw consent' },
                { icon: 'inventory_2', right: 'Request portability' },
              ].map(r => (
                <div className="pp-right-card" key={r.right}>
                  <span className="pp-right-icon">{r.icon}</span>
                  <span>{r.right}</span>
                </div>
              ))}
            </div>
            <p className="pp-contact-line">Contact: <a href="mailto:info@leafletai.ai">info@leafletai.ai</a></p>
          </section>

          {/* ── Section 7 ── */}
          <section id="section-7" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">7</span>
              Cookies and Tracking Technologies
            </h2>
            <p>We use cookies to:</p>
            <ul className="pp-check-list">
              <li>Enable functionality</li>
              <li>Analyze traffic</li>
              <li>Personalize experience</li>
              <li>Support analytics including price observatory features</li>
            </ul>
          </section>

          {/* ── Section 8 ── */}
          <section id="section-8" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">8</span>
              Cookie Banner Notice
            </h2>
            <div className="pp-cookie-banner">
              <p>
                "We use cookies and similar technologies to improve your experience, analyze traffic,
                and support features such as product insights and price tracking. By clicking{' '}
                <strong>'Accept All'</strong>, you consent to the use of all cookies. You can manage
                your preferences at any time."
              </p>
              <div className="pp-cookie-btns">
                <button className="pp-cookie-btn pp-cookie-accept">Accept All</button>
                <button className="pp-cookie-btn pp-cookie-reject">Reject Non-Essential</button>
                <button className="pp-cookie-btn pp-cookie-custom">Customize Preferences</button>
              </div>
              <p className="pp-cookie-link">Learn more in our <a href="/privacy">Privacy Policy</a>.</p>
            </div>
          </section>

          {/* ── Section 9 ── */}
          <section id="section-9" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">9</span>
              Image Copyright &amp; User Responsibility
            </h2>
            <p>
              Users are solely responsible for any images, media, or visual assets uploaded,
              imported, or used within the platform, including images retrieved from external
              sources or search engines. The company is not responsible for any unauthorized use
              of copyrighted materials, trademark violations, or intellectual property
              infringements caused by user-uploaded or user-selected content. Users must ensure
              they have the legal rights, permissions, or licenses required to use such images or
              assets.
            </p>
          </section>

          {/* -- Section 10 -- */}
          <section id="section-10" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">10</span>
              Privacy Policy Updates
            </h2>
            <p>We may update this policy periodically. Continued use of the Services constitutes acceptance of any revised policy.</p>
          </section>

          {/* ── Section 10 ── */}
          <section id="section-11" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">11</span>
              Contact Us
            </h2>
            <div className="pp-contact-card">
              <span className="pp-contact-icon">mail</span>
              <div>
                <strong>Email</strong>
                <p><a href="mailto:info@leafletai.ai">info@leafletai.ai</a></p>
              </div>
            </div>
          </section>

          {/* ── Section 11 ── */}
          <section id="section-12" className="pp-section">
            <h2 className="pp-section-title">
              <span className="pp-num">12</span>
              Jurisdiction-Specific Terms
            </h2>

            <div className="pp-sub">
              <h3>A. EEA / UK / Switzerland</h3>
              <ul className="pp-check-list">
                <li>Legal bases: contract, consent, legitimate interest</li>
                <li>Transfers: SCCs / adequacy decisions</li>
                <li>Right to lodge complaints with supervisory authorities</li>
              </ul>
            </div>

            <div className="pp-sub">
              <h3>B. United Arab Emirates (UAE)</h3>
              <p>Under Federal Decree-Law No. 45 of 2021:</p>
              <ul className="pp-check-list">
                <li>Lawful, fair, transparent processing</li>
                <li>Purpose limitation</li>
                <li>Data minimization</li>
                <li>Secure cross-border transfers</li>
              </ul>
            </div>
          </section>

        </div>
      </div>
      <Footer />
    </>
  );
}
