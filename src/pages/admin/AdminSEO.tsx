import { cssClass, cx } from '../../utils/styleClass';
import React, { useState, useEffect } from 'react';
import { adminFetch } from './adminApi';
import './AdminPage.css';
/* ── types ──────────────────────────────────────────────────────── */
interface SEOPage {
    id: number;
    page_key: string;
    title: string;
    description: string;
    og_title: string;
    og_description: string;
    og_image: string;
    canonical_url: string;
    keywords: string;
    robots: string;
}
type FormState = Omit<SEOPage, 'id' | 'page_key'>;
/* ── AdminSEO ────────────────────────────────────────────────────── */
export default function AdminSEO() {
    const [pages, setPages] = useState<SEOPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<SEOPage | null>(null);
    const [form, setForm] = useState<FormState>({
        title: '', description: '', og_title: '', og_description: '',
        og_image: '', canonical_url: '', keywords: '', robots: 'index, follow',
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveErr, setSaveErr] = useState('');
    useEffect(() => {
        setLoading(true);
        setError('');
        adminFetch('/seo')
            .then((data: SEOPage[]) => { setPages(data); setLoading(false); })
            .catch((e: Error) => { setError(e.message); setLoading(false); });
    }, []);
    function openEdit(p: SEOPage) {
        setEditing(p);
        setForm({
            title: p.title ?? '',
            description: p.description ?? '',
            og_title: p.og_title ?? '',
            og_description: p.og_description ?? '',
            og_image: p.og_image ?? '',
            canonical_url: p.canonical_url ?? '',
            keywords: p.keywords ?? '',
            robots: p.robots || 'index, follow',
        });
        setSaved(false);
        setSaveErr('');
    }
    function closeEdit() { setEditing(null); }
    async function save() {
        if (!editing)
            return;
        setSaving(true);
        setSaveErr('');
        try {
            const updated: SEOPage = await adminFetch(`/seo/${editing.id}`, {
                method: 'PUT',
                body: JSON.stringify(form),
            });
            setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
            setSaved(true);
            setTimeout(() => { setSaved(false); closeEdit(); }, 900);
        }
        catch (e: any) {
            setSaveErr(e.message);
        }
        finally {
            setSaving(false);
        }
    }
    function field(key: keyof FormState, value: string) {
        setForm(f => ({ ...f, [key]: value }));
    }
    const previewUrl = form.canonical_url || `https://yourdomain.com/${editing?.page_key ?? ''}`;
    const previewTitle = form.title || editing?.page_key || '';
    const previewDesc = form.description || 'No description set.';
    /* ── render ── */
    if (loading)
        return <div className="cms-loading">Loading SEO pages…</div>;
    return (<div className="cms-section">
      <div className="cms-section-header">
        <h2 className="cms-section-title">SEO Management</h2>
      </div>

      {error && <div className="cms-error">{error}</div>}

      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead>
            <tr>
              <th>Page Key</th>
              <th>Title</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 && (<tr>
                <td colSpan={4} className="cms-loading-row">No SEO pages found.</td>
              </tr>)}
            {pages.map(p => (<tr key={p.id}>
                <td>
                  <code className="cms-code">{p.page_key}</code>
                </td>
                <td className="cms-truncate">
                  {p.title || <span className="cms-muted">—</span>}
                </td>
                <td className="cms-truncate">
                  {p.description || <span className="cms-muted">—</span>}
                </td>
                <td>
                  <button className="cms-btn cms-btn-sm" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>

      {/* ── Edit modal ── */}
      {editing && (<div className="cms-modal-backdrop" onClick={closeEdit}>
          <div className="cms-modal" onClick={e => e.stopPropagation()}>
            <div className="cms-modal-header">
              <h3>Edit SEO</h3>
              <button className="cms-modal-close material-symbol" onClick={closeEdit} aria-label="Close">close</button>
            </div>

            <div className={cx("cms-modal-body", cssClass({ overflowY: 'auto' }))}>
              {saveErr && <div className="cms-error">{saveErr}</div>}

              {/* Page Key — read-only */}
              <div className="cms-form-group">
                <label className="cms-label">Page Key</label>
                <div className={cssClass({ padding: '9px 13px', background: 'rgba(255,255,255,.04)', borderRadius: 8, fontSize: '.88rem', color: '#7dd3fc', fontFamily: 'monospace' })}>
                  {editing.page_key}
                </div>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">Title</label>
                <input className="cms-input" value={form.title} onChange={e => field('title', e.target.value)} placeholder="e.g. Home | MySite"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">Description</label>
                <textarea className="cms-textarea" rows={3} value={form.description} onChange={e => field('description', e.target.value)} placeholder="Short description shown in search results…"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">OG Title</label>
                <input className="cms-input" value={form.og_title} onChange={e => field('og_title', e.target.value)} placeholder="Defaults to Title if empty"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">OG Description</label>
                <textarea className="cms-textarea" rows={2} value={form.og_description} onChange={e => field('og_description', e.target.value)} placeholder="Defaults to Description if empty"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">OG Image URL</label>
                <input className="cms-input" value={form.og_image} onChange={e => field('og_image', e.target.value)} placeholder="https://…/image.jpg"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">Canonical URL</label>
                <input className="cms-input" value={form.canonical_url} onChange={e => field('canonical_url', e.target.value)} placeholder="https://yourdomain.com/page"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">Keywords</label>
                <input className="cms-input" value={form.keywords} onChange={e => field('keywords', e.target.value)} placeholder="keyword1, keyword2, …"/>
              </div>

              <div className="cms-form-group">
                <label className="cms-label">Robots</label>
                <input className="cms-input" value={form.robots} onChange={e => field('robots', e.target.value)} placeholder="index, follow"/>
              </div>

              {/* ── Live Google snippet preview ── */}
              <div className="cms-seo-preview">
                <p className="cms-seo-preview-label">Search Preview</p>
                <div className="cms-seo-preview-box">
                  <div className="cms-seo-preview-url">{previewUrl}</div>
                  <div className="cms-seo-preview-title">{previewTitle}</div>
                  <div className="cms-seo-preview-desc">{previewDesc}</div>
                </div>
              </div>
            </div>

            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={closeEdit}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : saved ? <><span className="material-symbol" aria-hidden="true">check</span> Saved!</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
