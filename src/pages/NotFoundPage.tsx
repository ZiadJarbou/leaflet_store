import { Link } from 'react-router-dom';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import './NotFoundPage.css';

export default function NotFoundPage() {
    return (<>
      <SEOHelmet title="Page not found | LeafletAI" description="The page you are looking for could not be found." path="/404"/>
      <main className="nf-page">
        <section className="nf-panel" aria-labelledby="nf-title">
          <span className="nf-code">404</span>
          <h1 id="nf-title">Page not found</h1>
          <p>We could not find the page you were looking for.</p>
          <Link className="nf-home-btn" to="/">
            Go back to home page
          </Link>
        </section>
      </main>
      <Footer />
    </>);
}
