import { cssClass, cx } from '../utils/styleClass';
import { Link } from 'react-router-dom';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCmsContent, cms, cmsVisible } from '../hooks/useCmsContent';
import './FeaturesPage.css';
const DEFAULT_FEATURE_GROUPS = [
    { group: 'Create', icon: 'edit', color: '#7c5cff', features: [
            { icon: 'monitoring', title: 'Excel / CSV Import', desc: 'Drop any Excel or CSV file and LeafletAI maps your product data instantly â€” prices, images, and descriptions ready to go.' },
            { icon: 'extension', title: 'Template Library', desc: 'Dozens of pre-built, conversion-tested layouts ready to customise. New templates added every month.' },
            { icon: 'palette', title: 'Visual Card Builder', desc: 'Drag elements, resize boxes, pick colours â€” design your product cards without touching a line of code.' },
            { icon: 'image', title: 'Cover & Back Pages', desc: "Add a branded cover and closing page to every leaflet for a polished, end-to-end brand experience." },
        ] },
    { group: 'Customise', icon: 'palette', color: '#49f2b6', features: [
            { icon: 'gradient', title: 'Gradient Backgrounds', desc: 'Apply smooth gradient fills to cards or sections â€” solid or multi-stop, with full angle control.' },
            { icon: 'text_fields', title: 'Typography Controls', desc: 'Font size, weight, style, alignment, case transform, and letter spacing â€” all per element.' },
            { icon: 'architecture', title: 'Border & Radius', desc: 'Per-element border width, colour, and style. Rounded corners with per-corner or global mode.' },
            { icon: 'lightbulb', title: 'Drop Shadows', desc: 'Add depth to any element with a single toggle â€” consistent, tasteful shadows automatically applied.' },
            { icon: 'straighten', title: 'Spacing & Padding', desc: 'Control internal padding and card spacing across your grid for pixel-perfect layouts.' },
            { icon: 'source', title: 'Page Layout Controls', desc: 'Cards per row, page margins, card height ratio â€” all adjustable from the sidebar.' },
            { icon: 'bookmark', title: 'Product Card Icons', desc: 'Insert custom icons into product cards â€” link icons, badges, origin flags â€” to guide shoppers at a glance.' },
        ] },
    { group: 'Publish', icon: 'rocket_launch', color: '#f59e0b', features: [
            { icon: 'download', title: 'PDF Export', desc: 'High-resolution, print-ready PDF with correct bleed. Includes cover and back pages when set.' },
            { icon: 'menu_book', title: 'Flipbook Export', desc: 'Generate an interactive PDF flipbook with page-turn animations â€” just like FlippingBook, built-in.' },
            { icon: 'link', title: 'Product Links', desc: 'Each product card can carry a direct URL â€” tap in a flipbook or PDF to land on the product page.' },
            { icon: 'image', title: 'Leaflet Thumbnails', desc: "Auto-generated thumbnails from your leaflet's first page appear in your My Leaflets dashboard." },
        ] },
    { group: 'Manage', icon: 'monitoring', color: '#ec4899', features: [
            { icon: 'folder', title: 'My Leaflets Dashboard', desc: 'All your leaflets in one place â€” thumbnail previews, quick edit, duplicate, or delete.' },
            { icon: 'search', title: 'Search & Filter', desc: 'Find any leaflet instantly by name or sort by date â€” no more scrolling through long lists.' },
            { icon: 'save', title: 'Auto-save', desc: 'Every change is saved automatically. Come back later and pick up exactly where you left off.' },
            { icon: 'inventory_2', title: 'Bulk Product Import', desc: 'Import hundreds of products at once from a CSV or connect your product catalogue via API.' },
        ] },
];
const DEFAULT_COMPARISON = [
    { feature: 'No design skills required', leafletai: true, photoshop: false, canva: true, indesign: false },
    { feature: 'Excel / CSV import & edit', leafletai: true, photoshop: false, canva: false, indesign: false },
    { feature: 'Interactive flipbook export', leafletai: true, photoshop: false, canva: false, indesign: false },
    { feature: 'Product link integration', leafletai: true, photoshop: false, canva: false, indesign: false },
    { feature: 'Bulk product import', leafletai: true, photoshop: false, canva: false, indesign: false },
    { feature: 'Print-ready PDF export', leafletai: true, photoshop: true, canva: true, indesign: true },
    { feature: 'Reusable brand templates', leafletai: true, photoshop: false, canva: true, indesign: true },
    { feature: 'Cloud-based, no install', leafletai: true, photoshop: false, canva: true, indesign: false },
    { feature: 'Affordable monthly pricing', leafletai: true, photoshop: false, canva: true, indesign: false },
];
function Check({ yes }: {
    yes: boolean;
}) {
    return yes ? <span className="fp-yes">check</span> : <span className="fp-no">remove</span>;
}
export default function FeaturesPage() {
    const { openAuthModal } = useAuth();
    const c = useCmsContent('features');
    const heroTitle = cms(c, 'hero', 'title', "Everything you need to create,\ncustomise, and publish leaflets");
    const heroSub = cms(c, 'hero', 'subtitle', "From a blank canvas to a polished, interactive flipbook â€” LeafletAI gives you every tool in one focused platform.");
    const ctaLabel = cms(c, 'hero', 'cta_label', "Start for free");
    const showHero = cmsVisible(c, 'hero');
    return (<>
    <SEOHelmet pageKey="features"/>
    <div className="fp-page">

      {showHero && (<section className="fp-hero">
          <p className="fp-eyebrow">Features</p>
          <h1 className="fp-title">
            {heroTitle.split('\n').map((line, i, arr) => (<span key={i}>{line}{i < arr.length - 1 ? <br /> : null}</span>))}
          </h1>
          <p className="fp-sub">{heroSub}</p>
          <div className="fp-hero-cta">
            <button className="btn primary big" onClick={() => openAuthModal('register')}>{ctaLabel}</button>
            <Link className="btn ghost big" to="/pricing">View pricing</Link>
          </div>
        </section>)}

      {DEFAULT_FEATURE_GROUPS.map(group => (<section key={group.group} className="fp-group container">
          <div className="fp-group-head">
            <div className={cx("fp-group-icon", cssClass({ background: `${group.color}22`, color: group.color }))}>{group.icon}</div>
            <h2 className={cx("fp-group-title", cssClass({ '--group-color': group.color } as React.CSSProperties))}>{group.group}</h2>
          </div>
          <div className="fp-cards">
            {group.features.map(f => (<div key={f.title} className="fp-card">
                <div className="fp-card-icon">{f.icon}</div>
                <h3 className="fp-card-title">{f.title}</h3>
                <p className="fp-card-desc">{f.desc}</p>
              </div>))}
          </div>
        </section>))}

      <section className="fp-compare container">
        <div className="fp-sec-head">
          <h2>How LeafletAI compares</h2>
          <p>Purpose-built for leaflets â€” not adapted from a generic design tool.</p>
        </div>
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead>
              <tr>
                <th className="fp-th-feature">Feature</th>
                <th className="fp-th-brand">LeafletAI</th>
                <th>Photoshop</th><th>Canva</th><th>InDesign</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_COMPARISON.map((row, i) => (<tr key={row.feature} className={i % 2 === 0 ? 'fp-tr-even' : ''}>
                  <td className="fp-td-feature">{row.feature}</td>
                  <td className="fp-td-brand"><Check yes={row.leafletai}/></td>
                  <td className="fp-td-val"><Check yes={row.photoshop}/></td>
                  <td className="fp-td-val"><Check yes={row.canva}/></td>
                  <td className="fp-td-val"><Check yes={row.indesign}/></td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fp-workflow container">
        <div className="fp-sec-head">
          <h2>From idea to published in 4 steps</h2>
          <p>The fastest path from product catalogue to customer-ready leaflet.</p>
        </div>
        <div className="fp-steps">
          {[
            { n: '1', icon: 'monitoring', title: 'Import or start fresh', desc: 'Upload your Excel / CSV file or pick a blank template.' },
            { n: '2', icon: 'palette', title: 'Customise your design', desc: 'Add products, adjust layout, set colours and typography.' },
            { n: '3', icon: 'link', title: 'Add product links', desc: 'Connect each card to a URL so customers can click through.' },
            { n: '4', icon: 'upload_file', title: 'Export & share', desc: 'Download a PDF or flipbook and share it anywhere.' },
        ].map((step, i) => (<div key={step.n} className="fp-step">
              <div className="fp-step-num">{step.n}</div>
              {i < 3 && <div className="fp-step-line"/>}
              <div className="fp-step-icon">{step.icon}</div>
              <h3 className="fp-step-title">{step.title}</h3>
              <p className="fp-step-desc">{step.desc}</p>
            </div>))}
        </div>
      </section>

      <section className="fp-banner container">
        <div className="fp-banner-inner">
          <h2>See every feature in action</h2>
          <p>Start your free account and explore the full platform â€” no credit card required.</p>
          <div className="fp-banner-actions">
            <button className="btn primary big" onClick={() => openAuthModal('register')}>Create your first leaflet</button>
            <Link className="btn ghost big" to="/why">Why LeafletAI?</Link>
          </div>
        </div>
      </section>

    </div>
    <Footer />
    </>);
}

