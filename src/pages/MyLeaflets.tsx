import React, { useEffect, useState } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { Link, useNavigate } from 'react-router-dom';
import { getLeaflets, deleteLeaflet } from '../services/api';
import './MyLeaflets.css';

interface Leaflet {
  id: number;
  title: string;
  description: string;
  language_mode: string;
  created_at: string;
  thumbnail?: string;
}

export default function MyLeaflets() {
  const [leaflets, setLeaflets] = useState<Leaflet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(9);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getLeaflets()
      .then(r => setLeaflets(r.leaflets))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = leaflets.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  function handlePerPage(val: number) {
    setPerPage(val);
    setPage(1);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await deleteLeaflet(id);
      setLeaflets(prev => prev.filter(l => l.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <>
    <SEOHelmet pageKey="my-leaflets" />
    <div className="ml-page">
      {/* Header */}
      <div className="ml-topbar">
        <div className="ml-topbar-left">
          <h1 className="ml-title">My Leaflets</h1>
          <span className="ml-count">{leaflets.length} leaflet{leaflets.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ml-topbar-right">
          <div className="ml-search-wrap">
            <svg className="ml-search-icon" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            <input
              className="ml-search"
              type="text"
              placeholder="Search leaflets…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <Link to="/create-leaflet" className="ml-btn-new">+ New Leaflet</Link>
        </div>
      </div>

      {/* Body */}
      <div className="ml-body">
        {loading && (
          <div className="ml-state">
            <div className="ml-spinner" />
            <p>Loading your leaflets…</p>
          </div>
        )}
        {!loading && error && (
          <div className="ml-state ml-error">
            <p>{error}</p>
            <button className="ml-btn-retry" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="ml-state">
            {search ? (
              <>
                <span className="ml-state-icon">search</span>
                <p>No leaflets match <strong>"{search}"</strong></p>
                <button className="ml-btn-ghost" onClick={() => handleSearch('')}>Clear search</button>
              </>
            ) : (
              <>
                <span className="ml-state-icon">content_paste</span>
                <p>You haven't created any leaflets yet.</p>
                <Link to="/create-leaflet" className="ml-btn-new">Create your first leaflet</Link>
              </>
            )}
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="ml-grid">
            {paginated.map(l => (
              <div key={l.id} className="ml-card" onClick={() => navigate(`/app/leaflet/${l.id}`)}>
                {/* Thumbnail */}
                <div className="ml-card-thumb">
                  {l.thumbnail
                    ? <img src={l.thumbnail} alt={l.title} className="ml-thumb-img" />
                    : <div className="ml-thumb-placeholder">
                        <span className="ml-thumb-icon">content_paste</span>
                        <span className="ml-thumb-label">No preview</span>
                      </div>
                  }
                </div>
                <div className="ml-card-header">
                  <span className={`ml-lang-badge ml-lang-${l.language_mode}`}>
                    {l.language_mode === 'bilingual' ? 'public Bilingual' : 'text_fields Single lang'}
                  </span>
                  <span className="ml-date">{formatDate(l.created_at)}</span>
                </div>
                <div className="ml-card-body">
                  <h2 className="ml-card-title">{l.title}</h2>
                  {l.description && <p className="ml-card-desc">{l.description}</p>}
                </div>
                <div className="ml-card-footer">
                  <button
                    className="ml-btn-open"
                    onClick={e => { e.stopPropagation(); navigate(`/app/leaflet/${l.id}`); }}
                  >Open</button>
                  <button
                    className="ml-btn-delete"
                    disabled={deleting === l.id}
                    onClick={e => { e.stopPropagation(); setConfirmId(l.id); }}
                  >
                    {deleting === l.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination bar ── */}
        {!loading && !error && totalPages > 1 && (
          <div className="ml-pagination">
            <div className="ml-pagination-left">
              <span className="ml-pagination-info">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
              </span>
              <select
                className="ml-per-page"
                value={perPage}
                onChange={e => handlePerPage(Number(e.target.value))}
                aria-label="Items per page"
              >
                {[6, 9, 12, 18, 24].map(n => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>

            <div className="ml-pagination-pages">
              <button
                className="ml-pg-btn"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                aria-label="Previous page"
              >‹</button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => {
                const show =
                  n === 1 || n === totalPages ||
                  (n >= page - 1 && n <= page + 1);
                const showDotsBefore = n === page - 2 && page > 3;
                const showDotsAfter  = n === page + 2 && page < totalPages - 2;
                if (showDotsBefore || showDotsAfter) {
                  return <span key={`dots-${n}`} className="ml-pg-dots">…</span>;
                }
                if (!show) return null;
                return (
                  <button
                    key={n}
                    className={`ml-pg-btn${page === n ? ' ml-pg-active' : ''}`}
                    onClick={() => setPage(n)}
                    aria-label={`Page ${n}`}
                    aria-current={page === n ? 'page' : undefined}
                  >{n}</button>
                );
              })}

              <button
                className="ml-pg-btn"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                aria-label="Next page"
              >›</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {confirmId !== null && (
        <div className="ml-overlay" onClick={() => setConfirmId(null)}>
          <div className="ml-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete leaflet?</h3>
            <p>This will permanently delete the leaflet and all its products. This action cannot be undone.</p>
            <div className="ml-dialog-actions">
              <button className="ml-btn-ghost" onClick={() => setConfirmId(null)}>Cancel</button>
              <button
                className="ml-btn-confirm-delete"
                disabled={deleting === confirmId}
                onClick={() => handleDelete(confirmId!)}
              >
                {deleting === confirmId ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <Footer />
    </>
  );
}
