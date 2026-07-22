import { cssClass, cx } from '../utils/styleClass';
import { useEffect, useState } from 'react';
import { getLayoutTemplates, deleteLayoutTemplate, saveLeafletLayout } from '../services/api';
import type { CardLayout, LayoutTemplate } from '../services/api';
import { DEFAULT_POSITIONS, DEFAULT_ELEM_STYLES } from './LayoutCustomizer';
import './CardTemplateModal.css';
/* ── Mini thumbnail renderer ───────────────────────────────────── */
export function LayoutThumbnail({ layout }: {
    layout: CardLayout;
}) {
    const pos = layout.positions ?? DEFAULT_POSITIONS;
    const bg = layout.card_background ?? '#1e1e2e';
    const rad = Math.min((layout.card_border_radius ?? 16) * 0.35, 8);
    // Helper: convert a percent-based position to thumbnail px (thumbnail is 100×133 virtual units)
    const W = 100, H = 133;
    function box(p: {
        x: number;
        y: number;
        w: number;
        h: number;
    }) {
        return {
            left: `${p.x}%`,
            top: `${(p.y / (layout.card_height_ratio ?? 150)) * 100}%`,
            width: `${p.w}%`,
            height: `${(p.h / (layout.card_height_ratio ?? 150)) * 100}%`,
        };
    }
    const imgPos = pos.image ?? DEFAULT_POSITIONS.image;
    const n1Pos = pos.name_lan1 ?? DEFAULT_POSITIONS.name_lan1;
    const n2Pos = pos.name_lan2 ?? DEFAULT_POSITIONS.name_lan2;
    const o1Pos = pos.origin_lan1 ?? DEFAULT_POSITIONS.origin_lan1;
    const o2Pos = pos.origin_lan2 ?? DEFAULT_POSITIONS.origin_lan2;
    const opPos = pos.old_price ?? DEFAULT_POSITIONS.old_price;
    const cpPos = pos.current_price ?? DEFAULT_POSITIONS.current_price;
    const urlPos = pos.product_url ?? DEFAULT_POSITIONS.product_url;
    const badgePos = pos.discount_badge ?? DEFAULT_POSITIONS.discount_badge;
    const es = layout.element_styles ?? DEFAULT_ELEM_STYLES;
    const n1Bg = es.name_lan1?.bg || null;
    const cpBg = es.current_price?.bg || null;
    const badgeBg = es.discount_badge?.bg || null;
    return (<div className={cx("ctm-thumb", cssClass({ background: bg, borderRadius: rad }))}>
      {/* image area */}
      {layout.show_image !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-img", cssClass(box(imgPos)))}/>)}
      {/* name lan1 */}
      {layout.show_name_lan1 !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-bar", cssClass({ ...box(n1Pos), background: n1Bg || layout.name_lan1_color || '#e2e8f0', opacity: .9 }))}/>)}
      {/* name lan2 */}
      {layout.show_name_lan2 !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-bar thin", cssClass({ ...box(n2Pos), background: layout.name_lan2_color || '#94a3b8', opacity: .65 }))}/>)}
      {/* origin lan1 */}
      {(layout.show_origin_lan1 ?? true) && (<div className={cx("ctm-thumb-elem ctm-thumb-bar thin", cssClass({ ...box(o1Pos), background: layout.origin_lan1_color || '#888', opacity: .5 }))}/>)}
      {/* origin lan2 */}
      {(layout.show_origin_lan2 ?? true) && (<div className={cx("ctm-thumb-elem ctm-thumb-bar thin", cssClass({ ...box(o2Pos), background: layout.origin_lan2_color || '#888', opacity: .5 }))}/>)}
      {/* old price */}
      {layout.show_old_price !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-bar", cssClass({ ...box(opPos), background: layout.old_price_color || '#94a3b8', opacity: .45 }))}/>)}
      {/* current price */}
      {layout.show_current_price !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-bar", cssClass({ ...box(cpPos), background: cpBg || layout.price_color || '#49f2b6', opacity: .95 }))}/>)}
      {/* product url */}
      {layout.show_product_url !== false && (<div className={cx("ctm-thumb-elem ctm-thumb-bar thin", cssClass({ ...box(urlPos), background: layout.url_color || '#49f2b6', opacity: .6 }))}/>)}
      {/* discount badge */}
      {(layout.show_discount_badge ?? true) && (<div className={cx("ctm-thumb-elem ctm-thumb-badge", cssClass({
            ...box(badgePos),
            background: badgeBg || layout.badge_color || '#ff5c5c',
            borderRadius: Math.min((layout.badge_radius ?? 20) * 0.4, 6),
        }))}/>)}
    </div>);
    // suppress unused variable warnings for W/H constants used only for documentation
    void W;
    void H;
}
/* ── Preset templates ──────────────────────────────────────────── */
const DEF_ES = { bold: false, italic: false, transform: 'none' as const, script: 'none' as const, align: 'left' as const, valign: 'top' as const, padding: 2, radius: 3, bg: '', bg_opacity: 0.15 };
const PRESET_TEMPLATES: Array<{
    id: string;
    name: string;
    preview: string;
    layout: CardLayout;
}> = [
    {
        id: 'premium-white',
        name: 'Premium White',
        preview: '#ffffff',
        layout: {
            card_background: '#ffffff', card_border_radius: 14, accent_color: '#E53935',
            image_aspect_ratio: 68, card_shadow: true, card_height_ratio: 130,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: false,
            show_origin_lan1_flag: true, show_origin_lan2_flag: false,
            show_old_price: true, show_current_price: true, show_product_url: false,
            show_discount_badge: true,
            badge_color: '#E53935', badge_text_color: '#E53935', badge_font_size: 13, badge_radius: 0, badge_show_bg: true,
            url_icon: 'arrow', url_icon_size: 14, url_icon_url: '', url_text: '', url_show_text: false, url_icon_color: '#E53935', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 13, origin_size: 11, origin_lan1_size: 12, origin_lan2_size: 11, price_size: 18, url_size: 12,
            name_lan1_color: '#1a1a2e', name_lan2_color: '#1a1a2e', origin_color: '#888888', origin_lan1_color: '#444444', origin_lan2_color: '#888888',
            price_color: '#ffffff', old_price_color: '#1565C0', url_color: '#E53935',
            name_lan1_bold: true, name_lan2_italic: false,
            positions: {
                ...DEFAULT_POSITIONS,
                origin_lan1: { x: 2, y: 2, w: 32, h: 9 },
                current_price: { x: 56, y: 1, w: 42, h: 24 },
                discount_badge: { x: 56, y: 26, w: 42, h: 13 },
                old_price: { x: 56, y: 40, w: 42, h: 10 },
                image: { x: 2, y: 13, w: 52, h: 84 },
                name_lan1: { x: 56, y: 56, w: 42, h: 15 },
                name_lan2: { x: 56, y: 73, w: 42, h: 12 },
                origin_lan2: { x: 2, y: 100, w: 52, h: 7 },
                product_url: { x: 2, y: 120, w: 52, h: 7 },
            },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                current_price: { ...DEF_ES, bold: true, align: 'center' as const, valign: 'middle' as const, padding: 6, radius: 12, bg: '#E53935', bg_opacity: 1 },
                discount_badge: { ...DEF_ES, bold: true, align: 'center' as const, valign: 'middle' as const, padding: 4, radius: 0, bg: '#ffffff', bg_opacity: 1 },
                old_price: { ...DEF_ES, bold: false, align: 'center' as const, valign: 'middle' as const, padding: 2, radius: 0, bg: '#ffffff', bg_opacity: 1 },
                name_lan1: { ...DEF_ES, bold: true, align: 'left' as const, valign: 'top' as const, padding: 2, radius: 0, bg: '', bg_opacity: 0 },
                name_lan2: { ...DEF_ES, bold: true, align: 'left' as const, valign: 'top' as const, padding: 2, radius: 0, bg: '', bg_opacity: 0 },
                origin_lan1: { ...DEF_ES, bold: false, align: 'left' as const, valign: 'middle' as const, padding: 3, radius: 4, bg: '#f0f0f0', bg_opacity: 1 },
            },
        },
    },
    {
        id: 'white-clean',
        name: 'White Clean',
        preview: '#ffffff',
        layout: {
            card_background: '#ffffff', card_border_radius: 12, accent_color: '#2563eb',
            image_aspect_ratio: 75, card_shadow: true, card_height_ratio: 155,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
            show_origin_lan1_flag: false, show_origin_lan2_flag: false,
            show_old_price: true, show_current_price: true, show_product_url: true,
            show_discount_badge: true,
            badge_color: '#dc2626', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 20, badge_show_bg: true,
            url_icon: 'external', url_icon_size: 14, url_icon_url: '', url_text: 'Shop now', url_show_text: true, url_icon_color: '#2563eb', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 18, url_size: 12,
            name_lan1_color: '#1e293b', name_lan2_color: '#64748b', origin_color: '#94a3b8', origin_lan1_color: '#94a3b8', origin_lan2_color: '#94a3b8',
            price_color: '#2563eb', old_price_color: '#94a3b8', url_color: '#2563eb',
            name_lan1_bold: true, name_lan2_italic: false,
            positions: { ...DEFAULT_POSITIONS },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                name_lan1: { ...DEF_ES, bold: true },
                current_price: { ...DEF_ES, bold: true },
            },
        },
    },
    {
        id: 'midnight-blue',
        name: 'Midnight Blue',
        preview: '#0f172a',
        layout: {
            card_background: '#0f172a', card_border_radius: 20, accent_color: '#818cf8',
            image_aspect_ratio: 70, card_shadow: true, card_height_ratio: 160,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
            show_origin_lan1_flag: true, show_origin_lan2_flag: true,
            show_old_price: true, show_current_price: true, show_product_url: true,
            show_discount_badge: true,
            badge_color: '#7c3aed', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 6, badge_show_bg: true,
            url_icon: 'cart', url_icon_size: 15, url_icon_url: '', url_text: 'Add to cart', url_show_text: true, url_icon_color: '#818cf8', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 18, url_size: 12,
            name_lan1_color: '#f1f5f9', name_lan2_color: '#94a3b8', origin_color: '#64748b', origin_lan1_color: '#64748b', origin_lan2_color: '#64748b',
            price_color: '#818cf8', old_price_color: '#475569', url_color: '#818cf8',
            name_lan1_bold: true, name_lan2_italic: true,
            positions: { ...DEFAULT_POSITIONS },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                name_lan1: { ...DEF_ES, bold: true },
                current_price: { ...DEF_ES, bold: true },
                discount_badge: { ...DEF_ES, bold: true, align: 'center' as const, valign: 'middle' as const, padding: 4, radius: 6 },
            },
        },
    },
    {
        id: 'warm-market',
        name: 'Warm Market',
        preview: '#1c1410',
        layout: {
            card_background: '#1c1410', card_border_radius: 14, accent_color: '#f59e0b',
            image_aspect_ratio: 72, card_shadow: true, card_height_ratio: 150,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
            show_origin_lan1_flag: true, show_origin_lan2_flag: false,
            show_old_price: true, show_current_price: true, show_product_url: true,
            show_discount_badge: true,
            badge_color: '#f59e0b', badge_text_color: '#1c1410', badge_font_size: 11, badge_radius: 4, badge_show_bg: true,
            url_icon: 'chevron', url_icon_size: 14, url_icon_url: '', url_text: 'View deal', url_show_text: true, url_icon_color: '#f59e0b', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 18, url_size: 12,
            name_lan1_color: '#fef3c7', name_lan2_color: '#a78bfa', origin_color: '#92400e', origin_lan1_color: '#92400e', origin_lan2_color: '#92400e',
            price_color: '#f59e0b', old_price_color: '#78716c', url_color: '#f59e0b',
            name_lan1_bold: true, name_lan2_italic: true,
            positions: { ...DEFAULT_POSITIONS },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                current_price: { ...DEF_ES, bold: true },
                discount_badge: { ...DEF_ES, bold: true, align: 'center' as const, valign: 'middle' as const, padding: 4, radius: 4, bg: '#f59e0b', bg_opacity: 0.15 },
            },
        },
    },
    {
        id: 'emerald-fresh',
        name: 'Emerald Fresh',
        preview: '#052e16',
        layout: {
            card_background: '#052e16', card_border_radius: 18, accent_color: '#34d399',
            image_aspect_ratio: 70, card_shadow: true, card_height_ratio: 155,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
            show_origin_lan1_flag: true, show_origin_lan2_flag: true,
            show_old_price: true, show_current_price: true, show_product_url: true,
            show_discount_badge: true,
            badge_color: '#16a34a', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 20, badge_show_bg: true,
            url_icon: 'eye', url_icon_size: 15, url_icon_url: '', url_text: 'See product', url_show_text: true, url_icon_color: '#34d399', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 17, url_size: 12,
            name_lan1_color: '#ecfdf5', name_lan2_color: '#6ee7b7', origin_color: '#065f46', origin_lan1_color: '#065f46', origin_lan2_color: '#065f46',
            price_color: '#34d399', old_price_color: '#4b5563', url_color: '#34d399',
            name_lan1_bold: true, name_lan2_italic: false,
            positions: { ...DEFAULT_POSITIONS },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                name_lan1: { ...DEF_ES, bold: true },
                current_price: { ...DEF_ES, bold: true },
            },
        },
    },
    {
        id: 'rose-elegant',
        name: 'Rose Elegant',
        preview: '#1a0a0f',
        layout: {
            card_background: '#1a0a0f', card_border_radius: 22, accent_color: '#f43f5e',
            image_aspect_ratio: 75, card_shadow: true, card_height_ratio: 158,
            show_image: true, show_name_lan1: true, show_name_lan2: true,
            show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
            show_origin_lan1_flag: false, show_origin_lan2_flag: false,
            show_old_price: true, show_current_price: true, show_product_url: true,
            show_discount_badge: true,
            badge_color: '#f43f5e', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 20, badge_show_bg: true,
            url_icon: 'link', url_icon_size: 14, url_icon_url: '', url_text: 'View item', url_show_text: true, url_icon_color: '#f43f5e', url_custom_icon: '',
            name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 18, url_size: 12,
            name_lan1_color: '#ffe4e6', name_lan2_color: '#fda4af', origin_color: '#9f1239', origin_lan1_color: '#9f1239', origin_lan2_color: '#9f1239',
            price_color: '#f43f5e', old_price_color: '#6b7280', url_color: '#f43f5e',
            name_lan1_bold: true, name_lan2_italic: true,
            positions: { ...DEFAULT_POSITIONS },
            element_styles: {
                ...DEFAULT_ELEM_STYLES,
                current_price: { ...DEF_ES, bold: true },
                discount_badge: { ...DEF_ES, bold: true, align: 'center' as const, valign: 'middle' as const, padding: 4 },
            },
        },
    },
];
void PRESET_TEMPLATES;
/* ── Component ─────────────────────────────────────────────────── */
interface Props {
    leafletId: string;
    onApply: (layout: CardLayout, templateName?: string) => void;
    onClose: () => void;
}
export default function CardTemplateModal({ leafletId, onApply, onClose }: Props) {
    const [tab, setTab] = useState<'templates' | 'saved'>('templates');
    const [saved, setSaved] = useState<LayoutTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [savedErr, setSavedErr] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);
    const [applyErr, setApplyErr] = useState<string | null>(null);
    const [confirmDelId, setConfirmDelId] = useState<number | null>(null);
    const visibleTemplates = saved.filter(t => (t.is_default === true || t.is_platform === true) && t.name !== 'Template 1');
    const savedTemplates = saved.filter(t => t.is_default !== true && t.is_platform !== true && t.can_delete !== false);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    useEffect(() => {
        setLoading(true);
        setSavedErr(null);
        getLayoutTemplates()
            .then(r => setSaved(r.templates))
            .catch(e => setSavedErr(e instanceof Error ? e.message : 'Failed to load templates.'))
            .finally(() => setLoading(false));
    }, []);
    async function applyLayout(layout: CardLayout, key: string, templateName?: string) {
        setApplying(key);
        setApplyErr(null);
        try {
            await saveLeafletLayout(leafletId, layout);
            onApply(layout, templateName);
            onClose();
        }
        catch (e) {
            setApplyErr(e instanceof Error ? e.message : 'Failed to apply template.');
            setApplying(null);
        }
    }
    async function handleDeleteSaved(id: number) {
        if (id < 0)
            return;
        setConfirmDelId(id);
    }
    async function confirmDelete() {
        if (confirmDelId === null)
            return;
        try {
            await deleteLayoutTemplate(confirmDelId);
            setSaved(prev => prev.filter(t => t.id !== confirmDelId));
        }
        catch (e) {
            setSavedErr(e instanceof Error ? e.message : 'Delete failed.');
        }
        finally {
            setConfirmDelId(null);
        }
    }
    return (<div className="ctm-backdrop" onClick={e => { if (e.currentTarget === e.target)
        onClose(); }}>
      <div className="ctm-modal" role="dialog" aria-modal="true">

        <div className="ctm-header">
          <h2 className="ctm-title">source Templates</h2>
          <button className="ctm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ctm-tabs">
          <button className={`ctm-tab${tab === 'templates' ? ' active' : ''}`} onClick={() => setTab('templates')}>
            Templates
          </button>
          <button className={`ctm-tab${tab === 'saved' ? ' active' : ''}`} onClick={() => setTab('saved')}>
            Saved Templates
          </button>
        </div>

        {applyErr && <p className="ctm-apply-err">warning {applyErr}</p>}

        <div className="ctm-body">

          {tab === 'templates' && (<div className="ctm-saved-tab">
              {loading && <p className="ctm-state-msg">Loading…</p>}
              {!loading && savedErr && <p className="ctm-state-msg err">{savedErr}</p>}
              {!loading && !savedErr && visibleTemplates.length === 0 && (<div className="ctm-saved-empty">
                  <span className="ctm-empty-icon">inbox</span>
                  <p>No templates yet.</p>
                  <p className="ctm-empty-hint">Design your card in <strong>palette Customize Layout</strong>, then click <strong>content_paste Templates → + Save current</strong>.</p>
                </div>)}
              {visibleTemplates.length > 0 && (<div className="ctm-grid">
                  {visibleTemplates.map((t, index) => {
                    const l = t.layout as CardLayout;
                    const key = `tpl-${t.id}`;
                    const displayName = t.is_default ? `Template ${index + 1}` : t.name;
                    return (<div key={t.id} className="ctm-card">
                        <div className="ctm-card-preview-wrap">
                          <LayoutThumbnail layout={l}/>
                        </div>
                        <div className="ctm-card-info ctm-card-info--saved">
                          <div className="ctm-saved-meta">
                            <span className="ctm-card-name" title={displayName}>{displayName}</span>
                            <span className="ctm-saved-date">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="ctm-saved-actions">
                            <button className="ctm-apply-btn" disabled={!!applying} onClick={() => applyLayout(l, key, displayName)}>
                              {applying === key ? 'Applying…' : 'Apply'}
                            </button>
                            {t.can_delete !== false && (<button className="ctm-del-btn" onClick={() => handleDeleteSaved(t.id)} aria-label="Delete">delete</button>)}
                          </div>
                        </div>
                      </div>);
                })}
                </div>)}
            </div>)}

          {tab === 'saved' && (<div className="ctm-saved-tab">
              {loading && <p className="ctm-state-msg">Loading…</p>}
              {!loading && savedErr && <p className="ctm-state-msg err">{savedErr}</p>}
              {!loading && !savedErr && savedTemplates.length === 0 && (<div className="ctm-saved-empty">
                  <span className="ctm-empty-icon">inbox</span>
                  <p>No saved templates yet.</p>
                  <p className="ctm-empty-hint">Open <strong>palette Customize Layout</strong>, design your card, then click <strong>content_paste Templates → + Save current</strong>.</p>
                </div>)}
              {savedTemplates.length > 0 && (<div className="ctm-grid">
                  {savedTemplates.map(t => {
                    const l = t.layout as CardLayout;
                    const key = `saved-${t.id}`;
                    return (<div key={t.id} className="ctm-card">
                        <div className="ctm-card-preview-wrap">
                          <LayoutThumbnail layout={l}/>
                        </div>
                        <div className="ctm-card-info ctm-card-info--saved">
                          <div className="ctm-saved-meta">
                            <span className="ctm-card-name" title={t.name}>{t.name}</span>
                            <span className="ctm-saved-date">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="ctm-saved-actions">
                            <button className="ctm-apply-btn" disabled={!!applying} onClick={() => applyLayout(l, key, t.name)}>
                              {applying === key ? 'Applying…' : 'Apply'}
                            </button>
                            {t.can_delete !== false && (<button className="ctm-del-btn" onClick={() => handleDeleteSaved(t.id)} aria-label="Delete">delete</button>)}
                          </div>
                        </div>
                      </div>);
                })}
                </div>)}
            </div>)}

        </div>
      </div>

      {/* ── Delete confirmation ── */}
      {confirmDelId !== null && (<div className="ctm-confirm-backdrop" onClick={() => setConfirmDelId(null)}>
          <div className="ctm-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="ctm-confirm-icon">delete</div>
            <h3 className="ctm-confirm-title">Delete Template?</h3>
            <p className="ctm-confirm-body">
              This template will be permanently deleted and cannot be recovered.
            </p>
            <div className="ctm-confirm-actions">
              <button className="ctm-confirm-cancel" onClick={() => setConfirmDelId(null)}>Cancel</button>
              <button className="ctm-confirm-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>)}
    </div>);
}
