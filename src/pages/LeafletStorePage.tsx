import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { getLeafletStore, getRegionCountry, type LeafletStoreCountry, type LeafletStoreFlipbook } from '../services/api';
import { COUNTRY_OPTIONS, countryNameForCode, detectUserCountryCode } from '../data/countries';
import './LeafletStorePage.css';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LeafletStorePage() {
  const [selectedCountry, setSelectedCountry] = useState('');
  const [flipbooks, setFlipbooks] = useState<LeafletStoreFlipbook[]>([]);
  const [countries, setCountries] = useState<LeafletStoreCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareFlipbook, setShareFlipbook] = useState<LeafletStoreFlipbook | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getRegionCountry()
      .then(data => {
        const code = data.country_code;
        if (!alive) return;
        if (code && countryNameForCode(code)) {
          setSelectedCountry(code);
          return;
        }
        const fallback = detectUserCountryCode();
        if (fallback) {
          setSelectedCountry(fallback);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    getLeafletStore(selectedCountry)
      .then(data => {
        setFlipbooks(data.flipbooks || []);
        setCountries(data.countries || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load Leaflet Store.'))
      .finally(() => setLoading(false));
  }, [selectedCountry]);

  const countryCountByCode = useMemo(() => {
    return new Map(countries.map(country => [country.country_code, country.count]));
  }, [countries]);

  const interactiveUrlFor = (flipbook: LeafletStoreFlipbook) => {
    const token = flipbook.share_token || flipbook.share_url.split('/').pop() || '';
    return token ? `/leaflet-store/flipbook/${encodeURIComponent(token)}` : flipbook.url;
  };

  const absoluteInteractiveUrl = (flipbook: LeafletStoreFlipbook) => {
    return new URL(interactiveUrlFor(flipbook), window.location.origin).href;
  };

  const openShareDialog = (flipbook: LeafletStoreFlipbook) => {
    setShareCopied(false);
    setShareFlipbook(flipbook);
  };

  const copyShareLink = async () => {
    if (!shareFlipbook) return;
    await navigator.clipboard.writeText(absoluteInteractiveUrl(shareFlipbook));
    setShareCopied(true);
  };

  const nativeShare = async () => {
    if (!shareFlipbook || !navigator.share) return;
    await navigator.share({
      title: shareFlipbook.title,
      text: `Open this interactive flipbook from LeafletAI.`,
      url: absoluteInteractiveUrl(shareFlipbook),
    });
  };

  return (
    <>
      <SEOHelmet pageKey="leaflet_store" titleOverride="Leaflet Store - LeafletAI" descriptionOverride="Browse exported flipbooks by country." />
      <main className="ls-page container">
        <header className="ls-header">
          <div>
            <p className="ls-eyebrow">Leaflet Store</p>
            <h1>Leaflet flipbooks by country</h1>
            <p>Browse exported flipbooks from different stores in the same market, grouped by country.</p>
          </div>
          <Link className="btn primary" to="/my-leaflets">Create more flipbooks</Link>
        </header>

        <section className="ls-filter" aria-label="Leaflet Store country filter">
          <button type="button" className={!selectedCountry ? 'active' : ''} onClick={() => setSelectedCountry('')}>
            All countries
            <span>{countries.reduce((sum, country) => sum + Number(country.count || 0), 0)}</span>
          </button>
          <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} aria-label="Filter flipbooks by country">
            <option value="">Filter by country</option>
            {COUNTRY_OPTIONS.map(country => (
              <option key={country.code} value={country.code}>
                {country.name}{countryCountByCode.has(country.code) ? ` (${countryCountByCode.get(country.code)})` : ''}
              </option>
            ))}
          </select>
        </section>

        {loading ? (
          <div className="ls-state">Loading flipbooks...</div>
        ) : error ? (
          <div className="ls-state ls-state--error">{error}</div>
        ) : !flipbooks.length ? (
          <div className="ls-empty">
            <span className="material-symbol" aria-hidden="true">auto_stories</span>
            <h2>No flipbooks for this country yet</h2>
            <p>Open a leaflet, click Flipbook, confirm the country, then export it to Leaflet Store.</p>
            <Link className="btn primary" to="/my-leaflets">Go to My Leaflets</Link>
          </div>
        ) : (
          <div className="ls-grid">
            {flipbooks.map(flipbook => (
              <article className="ls-card" key={flipbook.id}>
                <div className="ls-thumb">
                  {flipbook.thumbnail_url ? <img src={flipbook.thumbnail_url} alt={flipbook.title} /> : <span className="material-symbol" aria-hidden="true">auto_stories</span>}
                </div>
                <div className="ls-card-body">
                  <div className="ls-card-meta">
                    <span>{flipbook.country_name}</span>
                    <span>{formatDate(flipbook.created_at)}</span>
                  </div>
                  <h2>{flipbook.title}</h2>
                  {flipbook.description && <p>{flipbook.description}</p>}
                  <div className="ls-card-actions">
                    <Link className="btn primary" to={interactiveUrlFor(flipbook)}>Open flipbook</Link>
                    <button type="button" className="btn ghost" onClick={() => openShareDialog(flipbook)}>Share link</button>
                  </div>
                  <div className="ls-card-foot">
                    <span>{flipbook.country_code}</span>
                    {formatSize(flipbook.size) && <span>{formatSize(flipbook.size)}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      {shareFlipbook && (
        <div className="ls-share-backdrop" role="presentation" onMouseDown={e => {
          if (e.target === e.currentTarget) setShareFlipbook(null);
        }}>
          <div className="ls-share-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-share-title">
            <div className="ls-share-head">
              <div>
                <p className="ls-eyebrow">Share flipbook</p>
                <h2 id="ls-share-title">{shareFlipbook.title}</h2>
              </div>
              <button type="button" className="ls-share-close material-symbol" onClick={() => setShareFlipbook(null)} aria-label="Close share dialog">close</button>
            </div>
            <label className="ls-share-link">
              <span>Interactive flipbook link</span>
              <input value={absoluteInteractiveUrl(shareFlipbook)} readOnly onFocus={e => e.currentTarget.select()} />
            </label>
            <div className="ls-share-actions">
              <button type="button" className="btn primary" onClick={copyShareLink}>
                {shareCopied ? 'Copied' : 'Copy link'}
              </button>
              {'share' in navigator && <button type="button" className="btn ghost" onClick={nativeShare}>Share</button>}
              <Link className="btn ghost" to={interactiveUrlFor(shareFlipbook)}>Open</Link>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
