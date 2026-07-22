import { cssClass, cx } from '../../utils/styleClass';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminFetch } from './adminApi';
import { getStoredToken } from '../../services/authService';
interface HelpArticle {
    id: number;
    group_id: number;
    title: string;
    desc: string;
    content: string;
    image_url: string | null;
    sort_order: number;
}
interface HelpGroup {
    id: number;
    icon: string;
    label: string;
    sort_order: number;
    articles: HelpArticle[];
}
const EMPTY_GROUP = { icon: 'description', label: '', sort_order: 0 };
const EMPTY_ARTICLE = { group_id: 0, title: '', desc: '', content: '', image_url: '' as string, sort_order: 0 };
export default function AdminHelpCenter() {
    const [groups, setGroups] = useState<HelpGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    // group modal
    const [groupModal, setGroupModal] = useState<null | 'new' | HelpGroup>(null);
    const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
    // article modal
    const [artModal, setArtModal] = useState<null | 'new' | HelpArticle>(null);
    const [artForm, setArtForm] = useState<typeof EMPTY_ARTICLE>(EMPTY_ARTICLE);
    // image upload state
    const [imgUploading, setImgUploading] = useState(false);
    const [imgErr, setImgErr] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    // confirm delete
    const [delGroup, setDelGroup] = useState<number | null>(null);
    const [delArt, setDelArt] = useState<number | null>(null);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
    const [saveMsg, setSaveMsg] = useState('');
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const d = await adminFetch('/help-groups');
            setGroups(d.groups || []);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    /* ── Image upload ── */
    async function handleImageFile(file: File) {
        setImgErr('');
        setImgUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const token = getStoredToken();
            const r = await fetch('/api/upload', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });
            if (!r.ok)
                throw new Error(`Upload failed (${r.status})`);
            const { url } = await r.json();
            setArtForm(f => ({ ...f, image_url: url }));
        }
        catch (e: any) {
            setImgErr(e.message);
        }
        finally {
            setImgUploading(false);
        }
    }
    function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file)
            handleImageFile(file);
        e.target.value = '';
    }
    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/'))
            handleImageFile(file);
    }
    /* ── Group CRUD ── */
    function openNewGroup() { setGroupForm(EMPTY_GROUP); setGroupModal('new'); }
    function openEditGroup(g: HelpGroup) {
        setGroupForm({ icon: g.icon, label: g.label, sort_order: g.sort_order });
        setGroupModal(g);
    }
    async function saveGroup() {
        if (!groupForm.label.trim())
            return;
        try {
            if (groupModal === 'new') {
                await adminFetch('/help-groups', { method: 'POST', body: JSON.stringify(groupForm) });
            }
            else {
                await adminFetch(`/help-groups/${(groupModal as HelpGroup).id}`, { method: 'PUT', body: JSON.stringify(groupForm) });
            }
            setGroupModal(null);
            setSaveMsg('Saved!');
            setTimeout(() => setSaveMsg(''), 2000);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function deleteGroup(id: number) {
        try {
            await adminFetch(`/help-groups/${id}`, { method: 'DELETE' });
            setDelGroup(null);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    /* ── Article CRUD ── */
    function openNewArticle(groupId: number) {
        setArtForm({ ...EMPTY_ARTICLE, group_id: groupId });
        setImgErr('');
        setArtModal('new');
    }
    function openEditArticle(a: HelpArticle) {
        setArtForm({ group_id: a.group_id, title: a.title, desc: a.desc, content: a.content, image_url: a.image_url || '', sort_order: a.sort_order });
        setImgErr('');
        setArtModal(a);
    }
    async function saveArticle() {
        if (!artForm.title.trim())
            return;
        try {
            const payload = { ...artForm, image_url: artForm.image_url || null };
            if (artModal === 'new') {
                await adminFetch('/help-articles', { method: 'POST', body: JSON.stringify(payload) });
            }
            else {
                await adminFetch(`/help-articles/${(artModal as HelpArticle).id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            setArtModal(null);
            setSaveMsg('Saved!');
            setTimeout(() => setSaveMsg(''), 2000);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function deleteArticle(id: number) {
        try {
            await adminFetch(`/help-articles/${id}`, { method: 'DELETE' });
            setDelArt(null);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    /* ── Render ── */
    return (<div className="cms-section">
      <div className="cms-section-header">
        <div>
          <h2 className="cms-section-title">Help Center</h2>
          <p className={cssClass({ color: '#64748b', fontSize: 13, margin: '4px 0 0' })}>
            Manage article groups and articles shown in the Help Center page.
          </p>
        </div>
        <div className={cssClass({ display: 'flex', gap: 10, alignItems: 'center' })}>
          {saveMsg && <span className="cms-save-ok">{saveMsg}</span>}
          <button className="cms-btn cms-btn-primary" onClick={openNewGroup}>+ New Group</button>
        </div>
      </div>

      {err && <div className="cms-error">{err}</div>}
      {loading && <div className="cms-loading">Loading…</div>}

      {!loading && groups.length === 0 && (<div className="cms-empty-state">
          <div className={cssClass({ fontSize: '2rem', marginBottom: 8 })}>auto_stories</div>
          <div>No article groups yet.</div>
          <button className={cx("cms-btn cms-btn-primary", cssClass({ marginTop: 12 }))} onClick={openNewGroup}>Create First Group</button>
        </div>)}

      <div className="hc-cms-groups">
        {groups.map(g => (<div key={g.id} className="hc-cms-group">
            <div className="hc-cms-group-hdr">
              <button className="hc-cms-expand-btn" onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}>
                <span className="hc-cms-group-icon">{g.icon}</span>
                <span className="hc-cms-group-label">{g.label}</span>
                <span className="hc-cms-art-count">{g.articles.length} article{g.articles.length !== 1 ? 's' : ''}</span>
                <span className="hc-cms-chevron material-symbol" aria-hidden="true">{expandedGroup === g.id ? 'expand_less' : 'expand_more'}</span>
              </button>
              <div className="hc-cms-group-actions">
                <button className="cms-btn cms-btn-sm" onClick={() => openEditGroup(g)}>Edit Group</button>
                <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={() => { openNewArticle(g.id); setExpandedGroup(g.id); }}>+ Article</button>
                <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDelGroup(g.id)}>Delete</button>
              </div>
            </div>

            {expandedGroup === g.id && (<div className="hc-cms-articles">
                {g.articles.length === 0 && (<div className="hc-cms-no-arts">No articles yet. Click "+ Article" to add one.</div>)}
                {g.articles.map(a => (<div key={a.id} className="hc-cms-art-row">
                    {a.image_url && (<img src={a.image_url} alt="" className="hc-cms-art-thumb"/>)}
                    <div className="hc-cms-art-info">
                      <div className="hc-cms-art-title">{a.title}</div>
                      {a.desc && <div className="hc-cms-art-desc">{a.desc}</div>}
                    </div>
                    <div className="hc-cms-art-actions">
                      <button className="cms-btn cms-btn-sm" onClick={() => openEditArticle(a)}>Edit</button>
                      <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setDelArt(a.id)}>Delete</button>
                    </div>
                  </div>))}
              </div>)}
          </div>))}
      </div>

      {/* ── Group Modal ── */}
      {groupModal !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setGroupModal(null)}>
          <div className="cms-modal">
            <div className="cms-modal-title">{groupModal === 'new' ? 'New Article Group' : 'Edit Group'}</div>
            <div className="cms-form-row">
              <label>Icon (emoji)</label>
              <input className={cx("cms-input", cssClass({ maxWidth: 80 }))} value={groupForm.icon} onChange={e => setGroupForm(f => ({ ...f, icon: e.target.value }))}/>
            </div>
            <div className="cms-form-row">
              <label>Group Label</label>
              <input className="cms-input" value={groupForm.label} onChange={e => setGroupForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Getting Started" autoFocus/>
            </div>
            <div className="cms-form-row">
              <label>Sort Order</label>
              <input className={cx("cms-input", cssClass({ maxWidth: 80 }))} type="number" value={groupForm.sort_order} onChange={e => setGroupForm(f => ({ ...f, sort_order: Number(e.target.value) }))}/>
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setGroupModal(null)}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={saveGroup} disabled={!groupForm.label.trim()}>Save</button>
            </div>
          </div>
        </div>)}

      {/* ── Article Modal ── */}
      {artModal !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setArtModal(null)}>
          <div className={cx("cms-modal", cssClass({ maxWidth: 740, width: '96vw', maxHeight: '92vh', overflowY: 'auto' }))}>
            <div className="cms-modal-title">{artModal === 'new' ? 'New Article' : 'Edit Article'}</div>

            <div className="cms-form-row">
              <label>Group</label>
              <select className="cms-input" value={artForm.group_id} onChange={e => setArtForm(f => ({ ...f, group_id: Number(e.target.value) }))}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.label}</option>)}
              </select>
            </div>

            <div className="cms-form-row">
              <label>Title</label>
              <input className="cms-input" value={artForm.title} onChange={e => setArtForm(f => ({ ...f, title: e.target.value }))} placeholder="Article title" autoFocus/>
            </div>

            <div className="cms-form-row">
              <label>Short Description</label>
              <input className="cms-input" value={artForm.desc} onChange={e => setArtForm(f => ({ ...f, desc: e.target.value }))} placeholder="One-line description shown in the list"/>
            </div>

            {/* ── Cover Image ── */}
            <div className="cms-form-row">
              <label>Cover Image</label>

              {/* Drop zone */}
              <div className={`hc-cms-img-dropzone${imgUploading ? ' hc-cms-img-uploading' : ''}`} onDragOver={e => e.preventDefault()} onDrop={onDrop} onClick={() => !imgUploading && fileInputRef.current?.click()}>
                {artForm.image_url ? (<div className="hc-cms-img-preview-wrap">
                    <img src={artForm.image_url} alt="Cover" className="hc-cms-img-preview"/>
                    <div className="hc-cms-img-preview-overlay">
                      <span>Click or drop to replace</span>
                    </div>
                  </div>) : (<div className="hc-cms-img-placeholder">
                    {imgUploading ? (<><span className="hc-cms-spinner"/>  Uploading…</>) : (<>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Drop image here or click to upload</span>
                        <small>JPG, PNG, WebP, SVG — max 20 MB</small>
                      </>)}
                  </div>)}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className={cssClass({ display: 'none' })}/>

              {/* URL input */}
              <div className="hc-cms-img-url-row">
                <input className="cms-input" value={artForm.image_url} onChange={e => setArtForm(f => ({ ...f, image_url: e.target.value }))} placeholder="Or paste an image URL (https://…)"/>
                {artForm.image_url && (<button className="cms-btn cms-btn-sm cms-btn-danger material-symbol" title="Remove image" aria-label="Remove image" onClick={() => setArtForm(f => ({ ...f, image_url: '' }))}>close</button>)}
              </div>

              {imgErr && <div className="hc-cms-img-err">{imgErr}</div>}
              <div className={cx("hc-cms-content-hint", cssClass({ marginTop: 4 }))}>
                This image appears at the top of the article. You can also embed images inside the content using <code>![alt](url)</code>.
              </div>
            </div>

            <div className="cms-form-row">
              <label>Content</label>
              <div className="hc-cms-content-hint">
                Supports: <code>!!tip:</code> <code>!!warning:</code> <code>!!note:</code> <code>!!success:</code> <code>::step N::</code> <code>{'>>> icon ||| text'}</code> <code>![alt](url)</code> <code>---</code> tables, headings, lists
              </div>
              <textarea className="cms-input hc-cms-content-area" rows={16} value={artForm.content} onChange={e => setArtForm(f => ({ ...f, content: e.target.value }))} placeholder={`## Article Title\n\n!!tip: A helpful tip\n\n::step 1:: First step\n::step 2:: Second step\n\n>>> 🎯 ||| Feature — brief description\n\n---\n\nMore content…`} spellCheck/>
            </div>

            <div className="cms-form-row">
              <label>Sort Order</label>
              <input className={cx("cms-input", cssClass({ maxWidth: 80 }))} type="number" value={artForm.sort_order} onChange={e => setArtForm(f => ({ ...f, sort_order: Number(e.target.value) }))}/>
            </div>

            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setArtModal(null)}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={saveArticle} disabled={!artForm.title.trim() || imgUploading}>
                {imgUploading ? 'Uploading…' : 'Save Article'}
              </button>
            </div>
          </div>
        </div>)}

      {/* ── Delete Group confirm ── */}
      {delGroup !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setDelGroup(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete Group?</div>
            <p className="cms-modal-body">This will delete the group and all its articles. This cannot be undone.</p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setDelGroup(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => deleteGroup(delGroup)}>Delete</button>
            </div>
          </div>
        </div>)}

      {/* ── Delete Article confirm ── */}
      {delArt !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setDelArt(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete Article?</div>
            <p className="cms-modal-body">This article will be permanently deleted.</p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setDelArt(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => deleteArticle(delArt)}>Delete</button>
            </div>
          </div>
        </div>)}
    </div>);
}
