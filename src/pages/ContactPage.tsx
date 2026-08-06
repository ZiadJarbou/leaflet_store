import type { FormEvent } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import './ContactPage.css';

const supportEmail = 'info@leafletai.ai';
const salesEmail = 'sales@leafletai.ai';

export default function ContactPage() {
  function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const topic = String(form.get('topic') || 'Support').trim();
    const message = String(form.get('message') || '').trim();
    const subject = encodeURIComponent(`LeafletAI ${topic} request`);
    const body = encodeURIComponent([
      name ? `Name: ${name}` : '',
      email ? `Email: ${email}` : '',
      `Topic: ${topic}`,
      '',
      message,
    ].filter(line => line !== '').join('\n'));

    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <SEOHelmet
        title="Contact LeafletAI | Support and Sales"
        description="Contact LeafletAI for product support, billing questions, sales inquiries, or feedback."
        path="/contact"
      />
      <main className="ct-page">
        <section className="ct-hero container">
          <p className="ct-eyebrow">Contact</p>
          <h1>How can we help?</h1>
          <p>
            Reach the LeafletAI team for technical support, billing questions, sales inquiries,
            or feedback about your leaflet workflow.
          </p>
        </section>

        <section className="ct-content container">
          <div className="ct-card ct-card--primary">
            <span className="ct-card-icon material-symbol" aria-hidden="true">support_agent</span>
            <h2>Support</h2>
            <p>For account, product, export, or technical issues.</p>
            <a className="btn primary" href={`mailto:${supportEmail}`}>
              Email support
              <span className="material-symbol" aria-hidden="true">arrow_forward</span>
            </a>
            <span className="ct-email">{supportEmail}</span>
          </div>

          <div className="ct-card">
            <span className="ct-card-icon material-symbol" aria-hidden="true">handshake</span>
            <h2>Sales</h2>
            <p>For Business, Agency, custom onboarding, and team plans.</p>
            <a className="btn ghost" href={`mailto:${salesEmail}?subject=LeafletAI%20Sales%20Inquiry`}>
              Contact sales
              <span className="material-symbol" aria-hidden="true">arrow_forward</span>
            </a>
            <span className="ct-email">{salesEmail}</span>
          </div>
        </section>

        <section className="ct-form-section container">
          <div className="ct-form-panel">
            <div>
              <p className="ct-section-label">Send a message</p>
              <h2>Tell us what you need</h2>
              <p>
                Include your account email, leaflet link, and any screenshots or details that help us
                understand the issue faster.
              </p>
            </div>
            <form className="ct-form" onSubmit={handleContactSubmit}>
              <label>
                Name
                <input name="name" type="text" placeholder="Your name" />
              </label>
              <label>
                Email
                <input name="email" type="email" placeholder="you@example.com" />
              </label>
              <label>
                Topic
                <select className="ct-topic-select" name="topic" defaultValue="Support">
                  <option>Support</option>
                  <option>Billing</option>
                  <option>Sales</option>
                  <option>Feature request</option>
                </select>
              </label>
              <label>
                Message
                <textarea name="message" rows={6} placeholder="Write your message..." />
              </label>
              <button className="btn primary big" type="submit">
                Send message
                <span className="material-symbol" aria-hidden="true">send</span>
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
