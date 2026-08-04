import { cssClass, cx } from '../utils/styleClass';
import { Link } from 'react-router-dom';
interface FooterProps {
    onOpenDemo?: () => void;
}
export default function Footer({ onOpenDemo }: FooterProps) {
    const year = new Date().getFullYear();
    return (<footer>
      <div className="container">
        <div className="foot">
          <div>
            <div className={cx("brand", cssClass({ fontSize: 18 }))}>
              <img src="/leafletai_logo.webp" alt="LeafletAI" className="brand-logo-img"/>
            </div>
            <p>Empowering creators to design, publish, and sell with confidence.</p>
          </div>

          <div>
            <h4>Quick Links</h4>
            <a href="/#features">Solutions</a>
            <a href="/#pricing">Plans</a>
            <Link to="/create-leaflet">Create leaflet</Link>
          </div>

          <div>
            <h4>Support</h4>
            <Link to="/help">Help Center</Link>
            <Link to="/contact">Contact Support</Link>
            <Link to="/guides">Guides</Link>
          </div>

          <div>
            <h4>Legal</h4>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">User Agreement</Link>
            <Link to="/acceptable-use">Acceptable Use Policy</Link>
          </div>
        </div>

        <div className="foot-bottom">
          <div>© {year} Responsyve Company. All rights reserved. Created in Dubai, UAE.</div>
          <div className="legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/acceptable-use">Acceptable Use</Link>
          </div>
        </div>
      </div>
    </footer>);
}
