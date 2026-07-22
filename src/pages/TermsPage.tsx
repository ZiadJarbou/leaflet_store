import { cssClass, cx } from '../utils/styleClass';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { useCmsContent, cms } from '../hooks/useCmsContent';
import './PrivacyPage.css';
import './TermsPage.css';
export default function TermsPage() {
    const c = useCmsContent('terms');
    const heroTitle = cms(c, 'hero', 'title', 'Terms of Use');
    return (<>
      <SEOHelmet pageKey="terms"/>
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
              LeafletAI (<strong>"we"</strong> or <strong>"us"</strong>) provides AI-powered product
              intelligence and automation tools. Our Service is currently open to the public. By
              accessing or using our website, platform, tools, and the Services we provide —
              including but not limited to the LeafletAI web platform and related integrations
              (collectively, the <strong>"Services"</strong>), you (<strong>"you"</strong> or{' '}
              <strong>"user"</strong>) agree to be bound by these Terms of Use (
              <strong>"Terms"</strong>) and our{' '}
              <a href="/privacy" className="tp-link">Privacy Policy</a>.
              Please read these Terms carefully before using our Services.
            </p>
            <p>
              We reserve the right, at our sole discretion, to change or modify portions of these
              Terms at any time. Your continued use of the Services constitutes your acceptance of
              such changes. If you do not agree, you must not access or use the Services.
            </p>
          </div>

          {/* ── TOC ── */}
          <nav className="pp-toc">
            <p className="pp-toc-heading">Table of Contents</p>
            <ol className="pp-toc-list">
              {[
            'Access to Our Services',
            'Age and Eligibility',
            'Use Restrictions',
            'Availability and Modification',
            'Payment',
            'Rights to Information',
            'Reliability of Output',
            'Intellectual Property',
            'Third-Party Services',
            'Liability',
            'Governing Law & Disputes',
            'Termination',
            'Export and Trade Controls',
            'Contact Us',
            'Miscellaneous',
            'Jurisdiction-Specific Terms',
        ].map((item, i) => (<li key={i}><a href={`#ts-${i + 1}`}>{item}</a></li>))}
            </ol>
          </nav>

          {/* ── 1 ── */}
          <section id="ts-1" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">1</span>Access to Our Services</h2>
            <div className="pp-sub">
              <h3>Account Registration</h3>
              <p>LeafletAI collects identifiers such as your username and email address when you create an account. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
            </div>
            <div className="pp-sub">
              <h3>Your Responsibility</h3>
              <p>It is your responsibility to ensure you have the necessary means and access to use our Services.</p>
            </div>
          </section>

          {/* ── 2 ── */}
          <section id="ts-2" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">2</span>Age and Eligibility</h2>
            <p>You must be at least 18 years old or the age of majority in your jurisdiction. By using the Services, you confirm that:</p>
            <ul className="pp-check-list">
              <li>You meet the legal age requirement</li>
              <li>You have not been previously suspended or banned</li>
              <li>Your use complies with all applicable laws and regulations</li>
            </ul>
          </section>

          {/* ── 3 ── */}
          <section id="ts-3" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">3</span>Use Restrictions</h2>
            <p>Except where prohibited by law, you agree <strong>not</strong> to:</p>
            <ul className="pp-check-list tp-cross-list">
              <li>Use the Services to build competing products or models</li>
              <li>Reverse engineer, extract, or copy any part of the Services</li>
              <li>Remove proprietary notices</li>
              <li>Crawl, scrape, or harvest data unlawfully</li>
              <li>Generate or distribute harmful, abusive, or illegal content</li>
              <li>Interfere with or disrupt the Services or infrastructure</li>
              <li>Infringe intellectual property or legal rights</li>
              <li>Violate applicable laws or internal policies</li>
            </ul>
            <div className="pp-callout tp-sharia-callout">
              <strong>Islamic Law Compliance</strong>
              <p>You agree not to use the Services for activities or content that are incompatible with Islamic law (Sharia principles), including but not limited to prohibited (haram) products or services.</p>
            </div>
          </section>

          {/* ── 4 ── */}
          <section id="ts-4" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">4</span>Availability and Modification of the Services</h2>
            <div className="pp-grid-2">
              <div className="pp-chip-card">
                <div className="pp-chip-icon">power</div>
                <div>
                  <strong>Availability</strong>
                  <p>We do not guarantee uninterrupted or continuous availability of the Services.</p>
                </div>
              </div>
              <div className="pp-chip-card">
                <div className="pp-chip-icon">build</div>
                <div>
                  <strong>Changes</strong>
                  <p>We may modify, suspend, or discontinue any part of the Services at any time without notice.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 5 ── */}
          <section id="ts-5" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">5</span>Payment</h2>
            <div className="pp-item-list">
              <div className="pp-item">
                <div className="pp-item-title">credit_card Paid Services</div>
                <p>Certain features may require payment. Fees will be disclosed prior to purchase and may be updated with notice.</p>
              </div>
              <div className="pp-item">
                <div className="pp-item-title">🔁 Subscriptions</div>
                <p>Subscriptions renew automatically unless canceled. You must cancel before the renewal date to avoid charges.</p>
              </div>
              <div className="pp-item">
                <div className="pp-item-title">🏦 Payment Processing</div>
                <p>Payments may be processed through third-party providers. By using payment features, you agree to their terms.</p>
              </div>
              <div className="pp-item">
                <div className="pp-item-title">undo Refunds</div>
                <p>All payments are non-refundable unless required by law.</p>
              </div>
            </div>
          </section>

          {/* ── 6 ── */}
          <section id="ts-6" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">6</span>Rights to Information</h2>
            <div className="pp-sub">
              <h3>Input and Output</h3>
              <p>You may submit content (<strong>"Input"</strong>), including product data such as prices, images, URLs, and descriptions. The Services generate responses (<strong>"Output"</strong>).</p>
            </div>
            <div className="pp-sub">
              <h3>Rights to Input</h3>
              <p>You confirm you have the rights to submit your Input and are responsible for ensuring it does not violate laws or third-party rights.</p>
              <p>You grant LeafletAI a limited license to use your Input to operate, improve, and provide the Services, including <strong>price observatory and analytics features</strong>.</p>
            </div>
          </section>

          {/* ── 7 ── */}
          <section id="ts-7" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">7</span>Reliability of Output</h2>
            <div className="pp-callout">
              <strong>Important Notice</strong>
              <p>AI-generated Output may not always be accurate, complete, or reliable.</p>
            </div>
            <ul className={cx("pp-check-list tp-cross-list", cssClass({ marginTop: '16px' }))}>
              <li>You should independently verify Output</li>
              <li>Output may contain inaccuracies or outdated information</li>
              <li>We are not responsible for decisions made based on Output</li>
            </ul>
          </section>

          {/* ── 8 ── */}
          <section id="ts-8" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">8</span>Intellectual Property</h2>
            <div className="pp-sub">
              <h3>Service Content</h3>
              <p>LeafletAI retains all rights to its technology, models, and platform. You may not use our trademarks, branding, or intellectual property without permission.</p>
            </div>
            <div className="pp-sub">
              <h3>Complaints</h3>
              <p>If you believe your rights are infringed, contact: <a href="mailto:info@leafletai.ai" className="tp-link">info@leafletai.ai</a></p>
            </div>
          </section>

          {/* ── 9 ── */}
          <section id="ts-9" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">9</span>Third-Party Services</h2>
            <p>The Services may include third-party integrations. We are not responsible for third-party services, content, or policies.</p>
          </section>

          {/* ── 10 ── */}
          <section id="ts-10" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">10</span>Liability</h2>
            <p>The Services are provided <strong>"as is"</strong> without warranties of any kind.</p>
            <p>To the maximum extent permitted by law:</p>
            <ul className="pp-check-list tp-cross-list">
              <li>We are not liable for indirect or consequential damages</li>
              <li>Total liability is limited to the amount you paid (if any)</li>
            </ul>
            <div className={cx("pp-callout", cssClass({ marginTop: '18px' }))}>
              <strong>Indemnification</strong>
              <p>You agree to indemnify LeafletAI against claims arising from your use or violation of these Terms.</p>
            </div>
          </section>

          {/* ── 11 ── */}
          <section id="ts-11" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">11</span>Governing Law and Dispute Resolution</h2>
            <div className="pp-grid-2">
              <div className="pp-chip-card">
                <div className="pp-chip-icon">balance</div>
                <div>
                  <strong>Governing Law</strong>
                  <p>These Terms are governed by the laws of the <strong>United Arab Emirates</strong>.</p>
                </div>
              </div>
              <div className="pp-chip-card">
                <div className="pp-chip-icon">account_balance</div>
                <div>
                  <strong>Disputes</strong>
                  <p>Any disputes shall be resolved in the competent courts of the UAE on an individual basis.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 12 ── */}
          <section id="ts-12" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">12</span>Termination</h2>
            <p>We may terminate or suspend your access at any time, including if:</p>
            <ul className="pp-check-list tp-cross-list">
              <li>You violate these Terms</li>
              <li>Your activities are unlawful or harmful</li>
              <li>Your account or usage is incompatible with applicable laws, public morals, or Islamic law (Sharia principles)</li>
            </ul>
            <p className={cx("pp-note", cssClass({ marginTop: '12px' }))}>Upon termination, your right to use the Services ceases immediately.</p>
          </section>

          {/* ── 13 ── */}
          <section id="ts-13" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">13</span>Export and Trade Controls</h2>
            <p>You must comply with applicable trade laws and regulations. You may not use the Services in restricted jurisdictions or for prohibited purposes.</p>
          </section>

          {/* ── 14 ── */}
          <section id="ts-14" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">14</span>Contact Us</h2>
            <div className="pp-contact-card">
              <span className="pp-contact-icon">mail</span>
              <div>
                <strong>Email</strong>
                <p><a href="mailto:info@leafletai.ai" className="tp-link">info@leafletai.ai</a></p>
              </div>
            </div>
          </section>

          {/* ── 15 ── */}
          <section id="ts-15" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">15</span>Miscellaneous</h2>
            <ul className="pp-check-list">
              <li>Failure to enforce any provision does not waive our rights.</li>
              <li>If any provision is invalid, the remaining provisions remain in effect.</li>
            </ul>
          </section>

          {/* ── 16 ── */}
          <section id="ts-16" className="pp-section">
            <h2 className="pp-section-title"><span className="pp-num">16</span>Jurisdiction-Specific Terms</h2>
            <p>We do not guarantee availability in all jurisdictions.</p>
            <p>Nothing in these Terms limits your rights under applicable laws, including GDPR or UAE data protection laws. Personal data is handled in accordance with our <a href="/privacy" className="tp-link">Privacy Policy</a>.</p>
          </section>

        </div>
      </div>
      <Footer />
    </>);
}
