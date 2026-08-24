import { cssClass, cx } from '../../utils/styleClass';
import React, { useState, useEffect, useCallback } from 'react';
import { adminGetPageContent, adminSavePageContent } from './adminApi';
/* â”€â”€ types â”€â”€ */
type FieldDef = {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'url' | 'toggle' | 'json-list';
};
type SectionDef = {
    key: string;
    label: string;
    fields: FieldDef[];
};
type PageDef = {
    key: string;
    label: string;
    icon: string;
    sections: SectionDef[];
};
function stripeSyncMessage(stripeSync: any) {
    if (!stripeSync) return 'Saved successfully!';
    if (stripeSync.warning) return `Saved. ${stripeSync.warning}`;
    if (!Array.isArray(stripeSync)) return 'Saved successfully!';
    const changed = stripeSync.filter(item => item?.changed);
    if (!changed.length) return 'Saved successfully! Stripe prices already matched.';
    const labels = changed.map(item => `${item.plan}/${item.period}`).join(', ');
    return `Saved successfully! Stripe prices synced: ${labels}.`;
}
/* â”€â”€ page/section/field schema â”€â”€ */
const PAGES: PageDef[] = [
    {
        key: 'home', label: 'Home', icon: 'home',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Headline', type: 'textarea' },
                    { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
                    { key: 'cta_label', label: 'CTA Button Label', type: 'text' },
                    { key: 'cta_link', label: 'CTA Button Link', type: 'url' },
                    { key: 'demo_label', label: 'Demo Button Label', type: 'text' },
                    { key: 'proof_text', label: 'Social Proof Text', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'features', label: 'Features Section', fields: [
                    { key: 'section_title', label: 'Section Title', type: 'text' },
                    { key: 'section_subtitle', label: 'Section Subtitle', type: 'textarea' },
                    { key: 'cta_label', label: 'CTA Label', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                    { key: 'items', label: 'Feature Items', type: 'json-list' },
                ] },
            { key: 'pricing', label: 'Pricing Section', fields: [
                    { key: 'section_title', label: 'Section Title', type: 'text' },
                    { key: 'section_subtitle', label: 'Section Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'faq', label: 'FAQ Section', fields: [
                    { key: 'section_title', label: 'Section Title', type: 'text' },
                    { key: 'section_subtitle', label: 'Section Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                    { key: 'items', label: 'FAQ Items', type: 'json-list' },
                ] },
        ],
    },
    {
        key: 'features', label: 'Features', icon: 'bolt',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Headline', type: 'textarea' },
                    { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
                    { key: 'cta_label', label: 'CTA Button Label', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
    {
        key: 'privacy', label: 'Privacy', icon: 'lock',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Page Title', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
    {
        key: 'terms', label: 'Terms', icon: 'contract',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Page Title', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
    {
        key: 'pricing', label: 'Pricing', icon: 'payments',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Page Title', type: 'text' },
                    { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'plans', label: 'Pricing Plans', fields: [
                    { key: 'items', label: 'Plans (JSON)', type: 'json-list' },
                ] },
            { key: 'features', label: 'Feature Comparison', fields: [
                    { key: 'items', label: 'Feature Rows (JSON)', type: 'json-list' },
                ] },
            { key: 'annual', label: 'Annual Billing', fields: [
                    { key: 'title', label: 'Section Title', type: 'text' },
                    { key: 'subtitle', label: 'Section Subtitle', type: 'textarea' },
                    { key: 'items', label: 'Annual Price Items', type: 'json-list' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'faq', label: 'FAQ', fields: [
                    { key: 'items', label: 'FAQ Items', type: 'json-list' },
                ] },
            { key: 'banner', label: 'Bottom Banner', fields: [
                    { key: 'title', label: 'Banner Title', type: 'text' },
                    { key: 'subtitle', label: 'Banner Subtitle', type: 'textarea' },
                    { key: 'cta_label', label: 'CTA Label', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
    {
        key: 'why', label: 'Why', icon: 'lightbulb',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Headline', type: 'textarea' },
                    { key: 'subtitle', label: 'Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'reasons', label: 'Reasons', fields: [
                    { key: 'section_title', label: 'Section Title', type: 'text' },
                    { key: 'section_subtitle', label: 'Section Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                    { key: 'items', label: 'Reason Items', type: 'json-list' },
                ] },
            { key: 'cta', label: 'CTA Section', fields: [
                    { key: 'title', label: 'CTA Title', type: 'text' },
                    { key: 'subtitle', label: 'CTA Subtitle', type: 'textarea' },
                    { key: 'cta_label', label: 'Button Label', type: 'text' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
    {
        key: 'faq', label: 'FAQ', icon: 'help',
        sections: [
            { key: 'hero', label: 'Hero', fields: [
                    { key: 'title', label: 'Page Title', type: 'text' },
                    { key: 'subtitle', label: 'Page Subtitle', type: 'textarea' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'faq', label: 'FAQ Items', fields: [
                    { key: 'section_title', label: 'Section Title', type: 'text' },
                    { key: 'items', label: 'FAQ Items', type: 'json-list' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
            { key: 'categories', label: 'Categories', fields: [
                    { key: 'items', label: 'Category Items', type: 'json-list' },
                    { key: 'visible', label: 'Section Visible', type: 'toggle' },
                ] },
        ],
    },
];
/* â”€â”€ JSON list editor for feature/faq/plans/comparison items â”€â”€ */
function JsonListEditor({ value, onChange, sectionKey, fieldKey }: {
    value: string;
    onChange: (v: string) => void;
    sectionKey: string;
    fieldKey: string;
}) {
    const isFaq = sectionKey === 'faq';
    const isPlan = sectionKey === 'plans';
    const isComparison = sectionKey === 'features' && fieldKey === 'items';
    const isStringList = sectionKey === 'annual' && fieldKey === 'items';
    let parsed: any[] = [];
    try {
        parsed = JSON.parse(value || '[]');
    }
    catch {
        parsed = [];
    }
    function update(idx: number, field: string, val: any) {
        const next = [...parsed];
        next[idx] = { ...next[idx], [field]: val };
        onChange(JSON.stringify(next));
    }
    function updateFeatures(idx: number, value: string) {
        update(idx, 'features', value.split('\n').map(line => line.trim()).filter(Boolean));
    }
    function addRow() {
        let row: any;
        if (isStringList)
            row = '';
        else if (isFaq)
            row = { q: '', a: '' };
        else if (isPlan)
            row = { id: '', name: '', badge: '', monthlyPrice: 0, yearlyPrice: 0, annualPrice: 0, annualPriceLabel: '', pricePrefix: '', desc: '', cta: '', ctaVariant: 'ghost', checkoutPlanId: '', highlight: false, features: [] };
        else if (isComparison)
            row = { label: '', free: false, starter: false, pro: false, business: false, agency: false };
        else
            row = { ic: '', title: '', desc: '' };
        onChange(JSON.stringify([...parsed, row]));
    }
    function removeRow(idx: number) {
        const next = parsed.filter((_: any, i: number) => i !== idx);
        onChange(JSON.stringify(next));
    }
    function toggle3(idx: number, field: string, current: any) {
        // cycle: false â†’ true â†’ string value
        const next = current === false ? true : current === true ? '' : false;
        update(idx, field, next);
    }
    function val3Label(v: any) {
        if (v === true)
            return <span className="material-symbol" aria-label="Included">check</span>;
        if (v === false)
            return <span className="material-symbol" aria-label="Not included">remove</span>;
        return v || '?';
    }
    return (<div className="cms-json-list">
      {parsed.map((row: any, idx: number) => (<div key={idx} className="cms-json-row">
          <button className="cms-json-del material-symbol" onClick={() => removeRow(idx)} title="Remove" aria-label="Remove">close</button>

          {isStringList ? (<div className="cms-field-group">
              <label>Line Text</label>
              <input className="cms-input" type="text" value={typeof row === 'string' ? row : ''} onChange={e => {
                const next = [...parsed];
                next[idx] = e.target.value;
                onChange(JSON.stringify(next));
              }}/>
            </div>) : isFaq ? (<>
              <div className="cms-field-group">
                <label>Question</label>
                <input className="cms-input" type="text" value={row.q || ''} onChange={e => update(idx, 'q', e.target.value)}/>
              </div>
              <div className="cms-field-group">
                <label>Answer</label>
                <textarea className="cms-input" rows={2} value={row.a || ''} onChange={e => update(idx, 'a', e.target.value)}/>
              </div>
            </>) : isPlan ? (<div className="cms-json-plan-grid">
              <div className="cms-field-group"><label>ID</label><input className="cms-input" type="text" placeholder="free/starter/pro/business/agency" value={row.id || ''} onChange={e => update(idx, 'id', e.target.value)}/></div>
              <div className="cms-field-group"><label>Name</label><input className="cms-input" type="text" value={row.name || ''} onChange={e => update(idx, 'name', e.target.value)}/></div>
              <div className="cms-field-group"><label>Badge (optional)</label><input className="cms-input" type="text" value={row.badge || ''} onChange={e => update(idx, 'badge', e.target.value)}/></div>
              <div className="cms-field-group"><label>Monthly Price ($)</label><input className="cms-input" type="number" value={row.monthlyPrice ?? 0} onChange={e => update(idx, 'monthlyPrice', Number(e.target.value))}/></div>
              <div className="cms-field-group"><label>Annual Monthly Rate ($)</label><input className="cms-input" type="number" step="0.01" value={row.yearlyPrice ?? 0} onChange={e => update(idx, 'yearlyPrice', Number(e.target.value))}/></div>
              <div className="cms-field-group"><label>Annual Total ($)</label><input className="cms-input" type="number" step="0.01" value={row.annualPrice ?? 0} onChange={e => update(idx, 'annualPrice', Number(e.target.value))}/></div>
              <div className="cms-field-group"><label>Price Prefix</label><input className="cms-input" type="text" placeholder="Starting from" value={row.pricePrefix || ''} onChange={e => update(idx, 'pricePrefix', e.target.value)}/></div>
              <div className="cms-field-group"><label>Annual Label</label><input className="cms-input" type="text" placeholder="Custom annual pricing" value={row.annualPriceLabel || ''} onChange={e => update(idx, 'annualPriceLabel', e.target.value)}/></div>
              <div className="cms-field-group cms-span2"><label>Description</label><textarea className="cms-input" rows={2} value={row.desc || ''} onChange={e => update(idx, 'desc', e.target.value)}/></div>
              <div className="cms-field-group cms-span2"><label>Features (one per line)</label><textarea className="cms-input" rows={5} value={Array.isArray(row.features) ? row.features.join('\n') : ''} onChange={e => updateFeatures(idx, e.target.value)}/></div>
              <div className="cms-field-group"><label>CTA Label</label><input className="cms-input" type="text" value={row.cta || ''} onChange={e => update(idx, 'cta', e.target.value)}/></div>
              <div className="cms-field-group"><label>CTA Variant</label>
                <select className="cms-input" value={row.ctaVariant || 'ghost'} onChange={e => update(idx, 'ctaVariant', e.target.value)}>
                  <option value="ghost">Ghost</option><option value="primary">Primary</option><option value="brand2">Brand2</option>
                </select>
              </div>
              <div className="cms-field-group"><label>Checkout Plan</label>
                <select className="cms-input" value={row.checkoutPlanId || ''} onChange={e => update(idx, 'checkoutPlanId', e.target.value)}>
                  <option value="">Same as ID</option><option value="free">Free</option><option value="starter">Starter</option><option value="pro">Professional</option><option value="business">Business</option><option value="contact">Contact Sales</option>
                </select>
              </div>
              <div className="cms-field-group"><label>Highlight?</label>
                <label className="cms-toggle">
                  <input type="checkbox" checked={!!row.highlight} onChange={e => update(idx, 'highlight', e.target.checked)}/>
                  <span className="cms-toggle-track"><span className="cms-toggle-thumb"/></span>
                  <span className="cms-toggle-txt">{row.highlight ? 'Yes' : 'No'}</span>
                </label>
              </div>
            </div>) : isComparison ? (<div className="cms-json-plan-grid">
              <div className="cms-field-group cms-span3"><label>Feature Label</label><input className="cms-input" type="text" value={row.label || ''} onChange={e => update(idx, 'label', e.target.value)}/></div>
              {(['free', 'starter', 'pro', 'business', 'agency'] as const).map(tier => (<div key={tier} className="cms-field-group">
                  <label>{tier.charAt(0).toUpperCase() + tier.slice(1)}</label>
                  <div className={cssClass({ display: 'flex', gap: 6, alignItems: 'center' })}>
                    <button className={cx("cms-btn cms-btn-sm", cssClass({ minWidth: 42 }))} onClick={() => toggle3(idx, tier, row[tier])}>{val3Label(row[tier])}</button>
                    <input className={cx("cms-input", cssClass({ flex: 1 }))} type="text" placeholder='or type "5"' value={typeof row[tier] === 'string' && row[tier] !== '' ? row[tier] : ''} onChange={e => update(idx, tier, e.target.value || false)}/>
                  </div>
                </div>))}
            </div>) : (<>
              <div className="cms-field-group">
                <label>Icon</label>
                <input className={cx("cms-input", cssClass({ maxWidth: 80 }))} type="text" value={row.ic || ''} onChange={e => update(idx, 'ic', e.target.value)}/>
              </div>
              <div className="cms-field-group">
                <label>Title</label>
                <input className="cms-input" type="text" value={row.title || ''} onChange={e => update(idx, 'title', e.target.value)}/>
              </div>
              <div className="cms-field-group">
                <label>Description</label>
                <textarea className="cms-input" rows={2} value={row.desc || ''} onChange={e => update(idx, 'desc', e.target.value)}/>
              </div>
            </>)}
        </div>))}
      <button className="cms-btn cms-btn-sm" onClick={addRow}><span className="material-symbol" aria-hidden="true">add</span> Add Item</button>
    </div>);
}
/* â”€â”€ Section editor panel â”€â”€ */
function SectionEditor({ pageDef, sectionDef, content, onChange }: {
    pageDef: PageDef;
    sectionDef: SectionDef;
    content: Record<string, string>;
    onChange: (field: string, val: string) => void;
}) {
    return (<div className="cms-section-editor">
      {sectionDef.fields.map(f => {
            const val = content[f.key] ?? '';
            return (<div key={f.key} className="cms-field-group">
            <label className="cms-field-label">{f.label}</label>
            {f.type === 'toggle' ? (<label className="cms-toggle">
                <input type="checkbox" checked={val === '1' || val === 'true'} onChange={e => onChange(f.key, e.target.checked ? '1' : '0')}/>
                <span className="cms-toggle-track"><span className="cms-toggle-thumb"/></span>
                <span className="cms-toggle-txt">{val === '1' || val === 'true' ? 'Visible' : 'Hidden'}</span>
              </label>) : f.type === 'textarea' ? (<>
                <textarea rows={3} className="cms-input" value={val} onChange={e => onChange(f.key, e.target.value)}/>
                <span className="cms-char">{val.length} chars</span>
              </>) : f.type === 'json-list' ? (<JsonListEditor value={val} sectionKey={sectionDef.key} fieldKey={f.key} onChange={v => onChange(f.key, v)}/>) : (<>
                <input type={f.type} className="cms-input" value={val} onChange={e => onChange(f.key, e.target.value)}/>
                <span className="cms-char">{val.length} chars</span>
              </>)}
          </div>);
        })}
    </div>);
}
/* â”€â”€ Main AdminPages component â”€â”€ */
export default function AdminPages() {
    const [activePage, setActivePage] = useState('home');
    const [activeSection, setActiveSection] = useState('hero');
    const [pageContent, setPageContent] = useState<Record<string, Record<string, string>>>({});
    const [dirty, setDirty] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [err, setErr] = useState('');
    const pageDef = PAGES.find(p => p.key === activePage)!;
    const sectionDef = pageDef.sections.find(s => s.key === activeSection) ?? pageDef.sections[0];
    const load = useCallback(async () => {
        setErr('');
        try {
            const data = await adminGetPageContent(activePage);
            setPageContent(data);
            setDirty(new Set());
        }
        catch (e: any) {
            setErr(e.message);
        }
    }, [activePage]);
    useEffect(() => { load(); }, [load]);
    function handleChange(field: string, val: string) {
        setPageContent(prev => ({
            ...prev,
            [activeSection]: { ...(prev[activeSection] ?? {}), [field]: val },
        }));
        setDirty(prev => new Set([...prev, activeSection]));
        setSaveMsg('');
    }
    async function handleSave() {
        setSaving(true);
        setSaveMsg('');
        setErr('');
        try {
            const result = await adminSavePageContent(activePage, pageContent);
            setDirty(new Set());
            setSaveMsg(stripeSyncMessage(result?.stripeSync));
            // invalidate frontend cache
            setTimeout(() => setSaveMsg(''), 3000);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setSaving(false);
        }
    }
    function handlePageChange(pageKey: string) {
        setActivePage(pageKey);
        const p = PAGES.find(p => p.key === pageKey)!;
        setActiveSection(p.sections[0].key);
        setSaveMsg('');
    }
    const sectionContent = pageContent[activeSection] ?? {};
    const isDirty = dirty.size > 0;
    return (<div className="cms-section">
      <div className="cms-section-header">
        <h2 className="cms-section-title">Pages CMS</h2>
        <p className={cssClass({ color: 'var(--cms-muted,#94a3b8)', fontSize: 13, margin: '4px 0 0' })}>
          Edit page content - changes go live immediately after saving.
        </p>
      </div>

      {err && <div className="cms-error">{err}</div>}

      {/* page tab bar */}
      <div className="cms-pages-tabs">
        {PAGES.map(p => (<button key={p.key} className={`cms-pages-tab${activePage === p.key ? ' active' : ''}`} onClick={() => handlePageChange(p.key)}>
            <span>{p.icon}</span> {p.label}
          </button>))}
      </div>

      <div className="cms-pages-body">
        {/* section list (left) */}
        <aside className="cms-pages-sections">
          {pageDef.sections.map(s => (<button key={s.key} className={`cms-pages-sec-btn${activeSection === s.key ? ' active' : ''}${dirty.has(s.key) ? ' dirty' : ''}`} onClick={() => setActiveSection(s.key)}>
              {s.label}
              {dirty.has(s.key) && <span className="cms-unsaved-dot" title="Unsaved changes"/>}
            </button>))}
        </aside>

        {/* content panel (right) */}
        <div className="cms-pages-panel">
          <div className="cms-pages-panel-head">
            <h3>{sectionDef.label}</h3>
            <div className="cms-pages-panel-actions">
              {saveMsg && <span className="cms-save-ok">{saveMsg}</span>}
              <button className="cms-btn cms-btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <SectionEditor pageDef={pageDef} sectionDef={sectionDef} content={sectionContent} onChange={handleChange}/>
        </div>
      </div>
    </div>);
}

