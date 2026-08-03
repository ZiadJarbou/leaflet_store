import { cssClass, cx } from '../utils/styleClass';
import { useCallback, useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { uploadImage, getLayoutTemplates, saveLayoutTemplate, deleteLayoutTemplate } from '../services/api';
import ColorSwatch from './ColorSwatch';
import NumericInput from './NumericInput';
import { countryToFlag } from '../utils/countryToFlag';
import type { CardLayout, CardElementPos, CardPositions, TextElementStyle, TextTransform, TextScript, TextAlign, TextVAlign, TextElemKey, ElementStyles, LayoutTemplate, CardShape, CardShapeType, } from '../services/api';
import './LayoutCustomizer.css';
/* ── Constants ──────────────────────────────── */
type ElemKey = 'image' | 'name_lan1' | 'name_lan2' | 'origin_lan1' | 'origin_lan2' | 'origin_lan1_flag' | 'origin_lan2_flag' | 'old_price' | 'current_price' | 'product_url' | 'discount_badge';
type AlignMode = 'left' | 'center_h' | 'right' | 'top' | 'center_v' | 'bottom' | 'equal_w' | 'equal_h';
const ALL_KEYS: ElemKey[] = ['image', 'name_lan1', 'name_lan2', 'origin_lan1', 'origin_lan2', 'origin_lan1_flag', 'old_price', 'current_price', 'product_url', 'discount_badge'];
const TEXT_ELEM_KEYS: TextElemKey[] = ['name_lan1', 'name_lan2', 'origin_lan1', 'origin_lan2', 'old_price', 'current_price', 'product_url', 'discount_badge'];
const ELEM_LABELS: Record<ElemKey, string> = {
    image: 'image Image', name_lan1: 'Name (lang 1)', name_lan2: 'Name (lang 2)',
    origin_lan1: 'Origin (lang 1)', origin_lan2: 'Origin (lang 2)',
    origin_lan1_flag: '🌍 Origin Flag', origin_lan2_flag: 'Origin Flag (lang 2)',
    old_price: 'Old Price', current_price: 'Current Price',
    product_url: 'Product Link', discount_badge: 'sell Discount Badge',
};
export const DEFAULT_POSITIONS: Required<CardPositions> = {
    image: { x: 0, y: 0, w: 100, h: 46 }, name_lan1: { x: 3, y: 48, w: 94, h: 9 },
    name_lan2: { x: 3, y: 58, w: 94, h: 7 },
    origin_lan1_flag: { x: 3, y: 66, w: 6, h: 6 }, origin_lan1: { x: 10, y: 66, w: 37, h: 6 },
    origin_lan2_flag: { x: 51, y: 66, w: 6, h: 6 }, origin_lan2: { x: 58, y: 66, w: 39, h: 6 },
    old_price: { x: 3, y: 74, w: 32, h: 7 }, current_price: { x: 37, y: 73, w: 45, h: 9 },
    product_url: { x: 3, y: 84, w: 60, h: 6 }, discount_badge: { x: 65, y: 2, w: 32, h: 8 },
};
const DEF_ES: TextElementStyle = { bold: false, italic: false, transform: 'none', script: 'none', align: 'left', valign: 'top', padding: 2, radius: 3, bg: '', bg_opacity: 0.15 };
export const DEFAULT_ELEM_STYLES: Record<TextElemKey, TextElementStyle> = {
    name_lan1: { ...DEF_ES, bold: true }, name_lan2: { ...DEF_ES, italic: true },
    origin_lan1: { ...DEF_ES }, origin_lan2: { ...DEF_ES },
    old_price: { ...DEF_ES },
    current_price: { ...DEF_ES, bold: true }, product_url: { ...DEF_ES },
    discount_badge: { ...DEF_ES, bold: true, align: 'center', valign: 'middle', padding: 4 },
};
const DEFAULT_FLAG_ES: TextElementStyle = { ...DEF_ES, align: 'center', valign: 'middle', padding: 2 };
export const LINK_ICONS: Array<{
    key: string;
    label: string;
    path?: string;
}> = [
    { key: 'arrow', label: 'Arrow', path: 'M13 7l5 5m0 0l-5 5m5-5H6' },
    { key: 'external', label: 'Open', path: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' },
    { key: 'cart', label: 'Cart', path: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'eye', label: 'View', path: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    { key: 'chevron', label: 'Chevron', path: 'M9 5l7 7-7 7' },
    { key: 'link', label: 'Link', path: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
    { key: 'plus', label: 'Plus', path: 'M12 4v16m8-8H4' },
    { key: 'none', label: 'None' },
    { key: 'custom', label: 'Custom' },
];
const DEFAULT: CardLayout = {
    card_background: '#1e1e2e', card_border_radius: 16, accent_color: '#49f2b6',
    image_aspect_ratio: 72,
    show_image: true, show_name_lan1: true, show_name_lan2: true,
    show_origin: true, show_origin_lan1: true, show_origin_lan2: true,
    show_origin_lan1_flag: true, show_origin_lan2_flag: true,
    show_old_price: true, show_current_price: true, show_product_url: true,
    show_discount_badge: true, badge_color: '#ff5c5c', badge_text_color: '#ffffff', badge_font_size: 11, badge_radius: 20, badge_show_bg: true, badge_display_mode: 'percent' as const,
    currency_symbol: '', currency_symbol_position: 'after' as const,
    url_icon: 'arrow', url_icon_size: 16, url_icon_url: '', url_text: 'View product', url_show_text: true, url_icon_color: '', url_custom_icon: '',
    name_lan1_size: 14, name_lan2_size: 12, origin_size: 11, origin_lan1_size: 11, origin_lan2_size: 11, price_size: 17, old_price_size: 12, url_size: 12,
    name_lan1_color: '#e2e8f0', name_lan2_color: '#94a3b8', origin_color: '#888888', origin_lan1_color: '#888888', origin_lan2_color: '#888888',
    price_color: '#49f2b6', old_price_color: '#94a3b8', url_color: '#49f2b6',
    card_shadow: false, name_lan1_bold: true, name_lan2_italic: true,
    positions: DEFAULT_POSITIONS, card_height_ratio: 150,
    card_border_width: 0, card_border_top: 0, card_border_right: 0, card_border_bottom: 0, card_border_left: 0, card_border_color: '#49f2b6', card_border_style: 'solid',
    card_radius_mode: 'all', card_radius_tl: 16, card_radius_tr: 16, card_radius_br: 16, card_radius_bl: 16,
    element_styles: { ...DEFAULT_ELEM_STYLES },
    locked_elems: [] as string[],
    elem_groups: [] as string[][],
    shapes: [],
};
const SHAPE_TOOLS: Array<{
    type: CardShapeType;
    label: string;
}> = [
    { type: 'rectangle', label: 'Rectangle' },
    { type: 'triangle', label: 'Triangle' },
    { type: 'ellipse', label: 'Ellipse' },
    { type: 'polygon', label: 'Polygon' },
    { type: 'star', label: 'Star' },
    { type: 'line', label: 'Draw line' },
];
const SHOW_MAP: Partial<Record<ElemKey, keyof CardLayout>> = {
    image: 'show_image', name_lan1: 'show_name_lan1', name_lan2: 'show_name_lan2',
    origin_lan1: 'show_origin_lan1', origin_lan2: 'show_origin_lan2',
    origin_lan1_flag: 'show_origin_lan1_flag', origin_lan2_flag: 'show_origin_lan2_flag',
    old_price: 'show_old_price', current_price: 'show_current_price',
    product_url: 'show_product_url', discount_badge: 'show_discount_badge',
};
const ALIGN_TITLES: Record<AlignMode, string> = {
    left: 'Align left edges', center_h: 'Center horizontally', right: 'Align right edges',
    top: 'Align top edges', center_v: 'Center vertically', bottom: 'Align bottom edges',
    equal_w: 'Match width', equal_h: 'Match height',
};
/* ── Font catalogue ──────────────────────────── */
interface FontEntry {
    name: string;
    category: string;
    google?: boolean;
}
export const BUILTIN_FONTS: FontEntry[] = [
    { name: 'System Default', category: 'System', google: false },
    { name: 'Arial', category: 'System', google: false },
    { name: 'Georgia', category: 'System', google: false },
    { name: 'Verdana', category: 'System', google: false },
    { name: 'Trebuchet MS', category: 'System', google: false },
    { name: 'Courier New', category: 'System', google: false },
    { name: 'Roboto', category: 'Sans-Serif', google: true },
    { name: 'Open Sans', category: 'Sans-Serif', google: true },
    { name: 'Lato', category: 'Sans-Serif', google: true },
    { name: 'Montserrat', category: 'Sans-Serif', google: true },
    { name: 'Nunito', category: 'Sans-Serif', google: true },
    { name: 'Poppins', category: 'Sans-Serif', google: true },
    { name: 'Raleway', category: 'Sans-Serif', google: true },
    { name: 'Inter', category: 'Sans-Serif', google: true },
    { name: 'Oswald', category: 'Sans-Serif', google: true },
    { name: 'Source Sans 3', category: 'Sans-Serif', google: true },
    { name: 'PT Sans', category: 'Sans-Serif', google: true },
    { name: 'Ubuntu', category: 'Sans-Serif', google: true },
    { name: 'Noto Sans', category: 'Sans-Serif', google: true },
    { name: 'Noto Sans Arabic', category: 'Arabic', google: true },
    { name: 'Amiri', category: 'Arabic', google: true },
    { name: 'Cairo', category: 'Arabic', google: true },
    { name: 'Tajawal', category: 'Arabic', google: true },
    { name: 'Changa', category: 'Arabic', google: true },
    { name: 'Playfair Display', category: 'Serif', google: true },
    { name: 'Merriweather', category: 'Serif', google: true },
    { name: 'Lora', category: 'Serif', google: true },
    { name: 'PT Serif', category: 'Serif', google: true },
    { name: 'Libre Baskerville', category: 'Serif', google: true },
    { name: 'Pacifico', category: 'Display', google: true },
    { name: 'Lobster', category: 'Display', google: true },
    { name: 'Dancing Script', category: 'Handwriting', google: true },
    { name: 'Caveat', category: 'Handwriting', google: true },
    { name: 'Source Code Pro', category: 'Monospace', google: true },
];
const loadedFonts = new Set<string>();
export function loadGoogleFont(fontName: string): void {
    if (!fontName || fontName === 'System Default' || loadedFonts.has(fontName))
        return;
    const entry = BUILTIN_FONTS.find(f => f.name === fontName);
    if (entry?.google === false)
        return;
    loadedFonts.add(fontName);
    const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id))
        return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
}
/* ── Helpers ─────────────────────────────────── */
function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
export function hexToRgba(hex: string, opacity: number): string {
    if (!hex || hex.length < 7)
        return `rgba(0,0,0,${opacity})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${opacity})`;
}
function mergeElemStyles(defs: Record<TextElemKey, TextElementStyle>, overrides?: ElementStyles): Record<TextElemKey, TextElementStyle> {
    const result = { ...defs };
    if (!overrides)
        return result;
    for (const k of TEXT_ELEM_KEYS) {
        if (overrides[k])
            result[k] = { ...defs[k], ...overrides[k] };
    }
    return result;
}
/* ── Main component ──────────────────────────── */
function cardBorderRadius(layout: CardLayout): string | number {
    if (layout.card_radius_mode === 'each') {
        const tl = layout.card_radius_tl ?? layout.card_border_radius ?? 16;
        const tr = layout.card_radius_tr ?? layout.card_border_radius ?? 16;
        const br = layout.card_radius_br ?? layout.card_border_radius ?? 16;
        const bl = layout.card_radius_bl ?? layout.card_border_radius ?? 16;
        return `${tl}px ${tr}px ${br}px ${bl}px`;
    }
    return layout.card_border_radius ?? 16;
}
interface Props {
    initial: CardLayout;
    onSave: (layout: CardLayout) => Promise<void>;
    onReset: () => Promise<void>;
    onClose: () => void;
    cardAspectRatio?: number;
}
export default function LayoutCustomizer({ initial, onSave, onReset, onClose, cardAspectRatio }: Props) {
    const [layout, setLayout] = useState<CardLayout>({
        ...DEFAULT, ...initial,
        positions: { ...DEFAULT_POSITIONS, ...initial.positions },
        element_styles: mergeElemStyles(DEFAULT_ELEM_STYLES, initial.element_styles),
        shapes: initial.shapes ?? [],
    });
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<ElemKey>>(new Set());
    const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());
    const [canvasZoom, setCanvasZoom] = useState(45);
    const [cardOpen, setCardOpen] = useState(true);
    const [elementPickerOpen, setElementPickerOpen] = useState(true);
    const [shapesOpen, setShapesOpen] = useState(true);
    const [shapeStyleOpen, setShapeStyleOpen] = useState(true);
    const undoStackRef = useRef<CardLayout[]>([]);
    const redoStackRef = useRef<CardLayout[]>([]);
    const lastLayoutRef = useRef<CardLayout>(layout);
    const skipHistoryRef = useRef(false);
    const historyReadyRef = useRef(false);
    const [, setHistoryTick] = useState(0);
    const cloneLayout = useCallback((value: CardLayout): CardLayout => JSON.parse(JSON.stringify(value)), []);
    useEffect(() => {
        if (!historyReadyRef.current) {
            historyReadyRef.current = true;
            lastLayoutRef.current = cloneLayout(layout);
            return;
        }
        if (skipHistoryRef.current) {
            skipHistoryRef.current = false;
            lastLayoutRef.current = cloneLayout(layout);
            return;
        }
        undoStackRef.current = [...undoStackRef.current.slice(-49), cloneLayout(lastLayoutRef.current)];
        redoStackRef.current = [];
        lastLayoutRef.current = cloneLayout(layout);
        setHistoryTick(tick => tick + 1);
    }, [cloneLayout, layout]);
    const undoLayout = useCallback(() => {
        const prev = undoStackRef.current.pop();
        if (!prev)
            return;
        redoStackRef.current.push(cloneLayout(layout));
        skipHistoryRef.current = true;
        setLayout(prev);
        setHistoryTick(tick => tick + 1);
    }, [cloneLayout, layout]);
    const redoLayout = useCallback(() => {
        const next = redoStackRef.current.pop();
        if (!next)
            return;
        undoStackRef.current.push(cloneLayout(layout));
        skipHistoryRef.current = true;
        setLayout(next);
        setHistoryTick(tick => tick + 1);
    }, [cloneLayout, layout]);
    /* Load saved font on mount */
    useEffect(() => {
        if (initial.font_family)
            loadGoogleFont(initial.font_family);
        (initial.custom_fonts ?? []).forEach(loadGoogleFont);
    }, []);
    const selArr = Array.from(selected);
    const inspectKey = selArr.length === 1 ? selArr[0] : null;
    const selectedShapeId = selectedShapeIds.size === 1 ? (Array.from(selectedShapeIds)[0] ?? null) : null;
    const selectedShape = (layout.shapes ?? []).find(shape => shape.id === selectedShapeId) ?? null;
    const hasSelectedShape = selectedShapeIds.size > 0;
    useEffect(() => {
        if (hasSelectedShape) {
            setCardOpen(false);
            setShapeStyleOpen(true);
        }
    }, [hasSelectedShape]);
    /* Escape → deselect current element */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && (selected.size > 0 || selectedShapeIds.size > 0)) {
                e.stopPropagation();
                setSelected(new Set());
                setSelectedShapeIds(new Set());
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selected, selectedShapeIds]);
    const [tplOpen, setTplOpen] = useState(false);
    const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
    const [tplLoading, setTplLoading] = useState(false);
    const [tplSaving, setTplSaving] = useState(false);
    const [tplName, setTplName] = useState('');
    const [tplErr, setTplErr] = useState<string | null>(null);
    const [tplSuccess, setTplSuccess] = useState<string | null>(null);
    async function openTemplates() {
        setTplOpen(true);
        setTplLoading(true);
        setTplErr(null);
        try {
            const r = await getLayoutTemplates();
            setTemplates(r.templates);
        }
        catch (e) {
            setTplErr(e instanceof Error ? e.message : 'Failed to load templates.');
        }
        finally {
            setTplLoading(false);
        }
    }
    async function handleSaveTemplate() {
        const name = tplName.trim();
        if (!name) {
            setTplErr('Enter a template name.');
            return;
        }
        setTplSaving(true);
        setTplErr(null);
        setTplSuccess(null);
        try {
            const r = await saveLayoutTemplate(name, layout);
            setTemplates(prev => [{ ...r.template, layout } as LayoutTemplate, ...prev]);
            setTplName('');
            setTplSuccess(`"${name}" saved!`);
            setTimeout(() => setTplSuccess(null), 2000);
        }
        catch (e) {
            setTplErr(e instanceof Error ? e.message : 'Save failed.');
        }
        finally {
            setTplSaving(false);
        }
    }
    async function handleApplyTemplate(tpl: LayoutTemplate) {
        setLayout({
            ...DEFAULT, ...tpl.layout,
            positions: { ...DEFAULT_POSITIONS, ...tpl.layout.positions },
            element_styles: mergeElemStyles(DEFAULT_ELEM_STYLES, tpl.layout.element_styles),
            shapes: tpl.layout.shapes ?? [],
        });
        setSelected(new Set());
        setTplOpen(false);
    }
    async function handleDeleteTemplate(id: number) {
        if (!confirm('Delete this template?'))
            return;
        try {
            await deleteLayoutTemplate(id);
            setTemplates(prev => prev.filter(t => t.id !== id));
        }
        catch (e) {
            setTplErr(e instanceof Error ? e.message : 'Delete failed.');
        }
    }
    const backdropRef = useRef<HTMLDivElement>(null);
    const layoutRef = useRef(layout);
    const selectedRef = useRef(selected);
    useEffect(() => { layoutRef.current = layout; }, [layout]);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    function set<K extends keyof CardLayout>(key: K, val: CardLayout[K]) {
        setLayout(prev => ({ ...prev, [key]: val }));
    }
    function patchLayout(patch: Partial<CardLayout>) {
        setLayout(prev => ({ ...prev, ...patch }));
    }
    function getES(key: TextElemKey): TextElementStyle {
        return layout.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key];
    }
    function setES(key: TextElemKey, patch: Partial<TextElementStyle>) {
        setLayout(prev => ({
            ...prev,
            element_styles: {
                ...(prev.element_styles ?? DEFAULT_ELEM_STYLES),
                [key]: { ...(prev.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key]), ...patch },
            },
        }));
    }
    const handlePosChange = useCallback((key: ElemKey, pos: CardElementPos) => {
        setLayout(prev => ({ ...prev, positions: { ...(prev.positions ?? DEFAULT_POSITIONS), [key]: pos } }));
    }, []);
    const handleMultiPosChange = useCallback((updates: Partial<Record<ElemKey, CardElementPos>>) => {
        setLayout(prev => ({ ...prev, positions: { ...(prev.positions ?? DEFAULT_POSITIONS), ...updates } }));
    }, []);
    function addShape(type: CardShapeType) {
        const id = `shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const shape: CardShape = {
            id,
            type,
            x: 18,
            y: 18,
            w: type === 'line' ? 46 : 24,
            h: type === 'line' ? 4 : 18,
            rotation: 0,
            fillType: 'solid',
            fill: type === 'line' ? 'transparent' : '#49f2b6',
            fillColor2: '#ffffff',
            fillGradientAngle: 135,
            stroke: '#49f2b6',
            strokeWidth: type === 'line' ? 3 : 1.5,
            strokeStyle: 'solid',
            opacity: type === 'line' ? 1 : 0.35,
            radiusMode: 'all',
            radius: type === 'rectangle' ? 4 : 0,
            radiusTl: type === 'rectangle' ? 4 : 0,
            radiusTr: type === 'rectangle' ? 4 : 0,
            radiusBr: type === 'rectangle' ? 4 : 0,
            radiusBl: type === 'rectangle' ? 4 : 0,
            sides: type === 'polygon' ? 6 : undefined,
            points: type === 'star' ? 5 : undefined,
            z: 30 + (layout.shapes?.length ?? 0),
        };
        setLayout(prev => ({ ...prev, shapes: [...(prev.shapes ?? []), shape] }));
        setSelected(new Set());
        setSelectedShapeIds(new Set([id]));
        setCardOpen(false);
        setShapeStyleOpen(true);
    }
    const handleShapeChange = useCallback((id: string, patch: Partial<CardShape>) => {
        setLayout(prev => ({
            ...prev,
            shapes: (prev.shapes ?? []).map(shape => shape.id === id ? { ...shape, ...patch } : shape),
        }));
    }, []);
    const deleteSelectedShapes = useCallback(() => {
        setLayout(prev => ({
            ...prev,
            shapes: (prev.shapes ?? []).filter(shape => !selectedShapeIds.has(shape.id)),
            elem_groups: (prev.elem_groups ?? [])
                .map(group => group.filter(item => !selectedShapeIds.has(item)))
                .filter(group => group.length >= 2),
        }));
        setSelectedShapeIds(new Set());
    }, [selectedShapeIds]);
    /* ── Lock helpers ── */
    const lockedSet = new Set<string>(layout.locked_elems ?? []);
    function isLocked(k: ElemKey) { return lockedSet.has(k); }
    function toggleLock(k: ElemKey) {
        const locked = new Set(lockedSet);
        locked.has(k) ? locked.delete(k) : locked.add(k);
        set('locked_elems', Array.from(locked));
    }
    function lockSelected() {
        const locked = new Set(lockedSet);
        Array.from(selected).forEach(k => locked.add(k));
        set('locked_elems', Array.from(locked));
    }
    function unlockSelected() {
        const locked = new Set(lockedSet);
        Array.from(selected).forEach(k => locked.delete(k));
        set('locked_elems', Array.from(locked));
    }
    /* ── Group helpers ── */
    const groups: string[][] = layout.elem_groups ?? [];
    function getGroup(k: string): string[] | null {
        return groups.find(g => g.includes(k)) ?? null;
    }
    function groupSelected() {
        const keys = [...Array.from(selected), ...Array.from(selectedShapeIds)];
        if (keys.length < 2)
            return;
        const newGroups = groups.filter(g => !keys.some(k => g.includes(k)));
        newGroups.push(keys);
        set('elem_groups', newGroups);
    }
    function ungroupSelected() {
        const keys = [...Array.from(selected), ...Array.from(selectedShapeIds)];
        const newGroups = groups.filter(g => !keys.some(k => g.includes(k)));
        set('elem_groups', newGroups);
    }
    const selInGroup = [...Array.from(selected), ...Array.from(selectedShapeIds)].some(k => getGroup(k) !== null);
    const canGroup = selected.size + selectedShapeIds.size >= 2;
    /* ── Expand selection to include grouped partners ── */
    function expandGroupSelection(keys: Set<ElemKey>): Set<ElemKey> {
        const expanded = new Set(keys);
        for (const k of keys) {
            const g = getGroup(k);
            if (g)
                g.forEach(gk => expanded.add(gk as ElemKey));
        }
        return expanded;
    }
    type SnapMode = 'snap_left' | 'snap_center_h' | 'snap_right' | 'snap_top' | 'snap_center_v' | 'snap_bottom';
    function snapToCard(mode: SnapMode) {
        if (selected.size !== 1)
            return;
        const key = Array.from(selected)[0];
        const pos = layout.positions ?? DEFAULT_POSITIONS;
        const p = { ...(pos[key] ?? DEFAULT_POSITIONS[key]!) };
        switch (mode) {
            case 'snap_left':
                p.x = 0;
                break;
            case 'snap_center_h':
                p.x = (100 - p.w) / 2;
                break;
            case 'snap_right':
                p.x = Math.max(0, 100 - p.w);
                break;
            case 'snap_top':
                p.y = 0;
                break;
            case 'snap_center_v':
                p.y = (100 - p.h) / 2;
                break;
            case 'snap_bottom':
                p.y = Math.max(0, 100 - p.h);
                break;
        }
        handlePosChange(key, p);
    }
    function applyAlign(mode: AlignMode) {
        const pos = layout.positions ?? DEFAULT_POSITIONS;
        const keys = Array.from(selected).filter(k => layout[SHOW_MAP[k]]);
        const shapes = layout.shapes ?? [];
        const selectedShapes = shapes.filter(shape => selectedShapeIds.has(shape.id));
        const items = [
            ...keys.map(key => ({ kind: 'element' as const, key, ...(pos[key] ?? DEFAULT_POSITIONS[key]!) })),
            ...selectedShapes.map(shape => ({ kind: 'shape' as const, id: shape.id, x: shape.x, y: shape.y, w: shape.w, h: shape.h })),
        ];
        if (items.length === 0)
            return;
        const itemId = (item: typeof items[number]) => item.kind === 'shape' ? item.id : item.key;
        const selectedIds = items.map(itemId);
        const writeUpdates = (elemUpdates: Partial<Record<ElemKey, CardElementPos>>, shapeUpdates: Record<string, Partial<CardShape>>) => {
            setLayout(prev => ({
                ...prev,
                positions: { ...(prev.positions ?? DEFAULT_POSITIONS), ...elemUpdates },
                shapes: (prev.shapes ?? []).map(shape => shapeUpdates[shape.id] ? { ...shape, ...shapeUpdates[shape.id] } : shape),
            }));
        };
        const updateMixedItem = (item: typeof items[number], patch: Partial<CardElementPos>, elemUpdates: Partial<Record<ElemKey, CardElementPos>>, shapeUpdates: Record<string, Partial<CardShape>>) => {
            if (item.kind === 'shape') {
                shapeUpdates[item.id] = { ...(shapeUpdates[item.id] ?? {}), ...patch };
            }
            else {
                elemUpdates[item.key] = { ...(pos[item.key] ?? DEFAULT_POSITIONS[item.key]!), ...patch };
            }
        };
        const selectedIdSet = new Set(selectedIds);
        const usedIds = new Set<string>();
        const units: {
            items: typeof items;
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [];
        groups.forEach(group => {
            if (group.length < 2 || !group.every(id => selectedIdSet.has(id)))
                return;
            const groupItems = items.filter(item => group.includes(itemId(item)));
            if (groupItems.length < 2)
                return;
            const left = Math.min(...groupItems.map(item => item.x));
            const top = Math.min(...groupItems.map(item => item.y));
            const right = Math.max(...groupItems.map(item => item.x + item.w));
            const bottom = Math.max(...groupItems.map(item => item.y + item.h));
            groupItems.forEach(item => usedIds.add(itemId(item)));
            units.push({ items: groupItems, x: left, y: top, w: right - left, h: bottom - top });
        });
        items.forEach(item => {
            if (usedIds.has(itemId(item)))
                return;
            units.push({ items: [item], x: item.x, y: item.y, w: item.w, h: item.h });
        });
        // Single element selected → align to card edges
        if (units.length === 1) {
            const unit = units[0];
            const p = { x: unit.x, y: unit.y, w: unit.w, h: unit.h };
            switch (mode) {
                case 'left':
                    p.x = 0;
                    break;
                case 'center_h':
                    p.x = (100 - p.w) / 2;
                    break;
                case 'right':
                    p.x = Math.max(0, 100 - p.w);
                    break;
                case 'top':
                    p.y = 0;
                    break;
                case 'center_v':
                    p.y = (100 - p.h) / 2;
                    break;
                case 'bottom':
                    p.y = Math.max(0, 100 - p.h);
                    break;
                default: return;
            }
            const upd: Partial<Record<ElemKey, CardElementPos>> = {};
            const shapeUpdates: Record<string, Partial<CardShape>> = {};
            const dx = p.x - unit.x;
            const dy = p.y - unit.y;
            unit.items.forEach(item => updateMixedItem(item, {
                x: clamp(item.x + dx, 0, 100 - item.w),
                y: clamp(item.y + dy, 0, 100 - item.h),
            }, upd, shapeUpdates));
            writeUpdates(upd, shapeUpdates);
            return;
        }
        // Multiple elements → align relative to each other
        const upd: Partial<Record<ElemKey, CardElementPos>> = {};
        const shapeUpdates: Record<string, Partial<CardShape>> = {};
        const moveUnit = (unit: typeof units[number], x = unit.x, y = unit.y) => {
            const dx = x - unit.x;
            const dy = y - unit.y;
            unit.items.forEach(item => updateMixedItem(item, {
                x: clamp(item.x + dx, 0, 100 - item.w),
                y: clamp(item.y + dy, 0, 100 - item.h),
            }, upd, shapeUpdates));
        };
        switch (mode) {
            case 'left': {
                const r = Math.min(...units.map(p => p.x));
                units.forEach(p => moveUnit(p, r));
                break;
            }
            case 'center_h': {
                const r = units.reduce((s, p) => s + p.x + p.w / 2, 0) / units.length;
                units.forEach(p => moveUnit(p, clamp(r - p.w / 2, 0, 100 - p.w)));
                break;
            }
            case 'right': {
                const r = Math.max(...units.map(p => p.x + p.w));
                units.forEach(p => moveUnit(p, clamp(r - p.w, 0, 100 - p.w)));
                break;
            }
            case 'top': {
                const r = Math.min(...units.map(p => p.y));
                units.forEach(p => moveUnit(p, p.x, r));
                break;
            }
            case 'center_v': {
                const r = units.reduce((s, p) => s + p.y + p.h / 2, 0) / units.length;
                units.forEach(p => moveUnit(p, p.x, clamp(r - p.h / 2, 0, 100 - p.h)));
                break;
            }
            case 'bottom': {
                const r = Math.max(...units.map(p => p.y + p.h));
                units.forEach(p => moveUnit(p, p.x, clamp(r - p.h, 0, 100 - p.h)));
                break;
            }
            case 'equal_w': {
                if (units.some(p => p.items.length > 1))
                    return;
                const r = units[0].w;
                units.forEach(p => updateMixedItem(p.items[0], { w: Math.min(r, 100 - p.x) }, upd, shapeUpdates));
                break;
            }
            case 'equal_h': {
                if (units.some(p => p.items.length > 1))
                    return;
                const r = units[0].h;
                units.forEach(p => updateMixedItem(p.items[0], { h: Math.min(r, 100 - p.y) }, upd, shapeUpdates));
                break;
            }
        }
        writeUpdates(upd, shapeUpdates);
    }
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape')
                onClose();
            if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setSelected(new Set((ALL_KEYS as ElemKey[]).filter(k => layoutRef.current[SHOW_MAP[k]])));
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIds.size > 0) {
                const tag = (document.activeElement as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA')
                    return;
                e.preventDefault();
                deleteSelectedShapes();
                return;
            }
            /* Arrow key movement */
            const arrows: Record<string, [
                number,
                number
            ]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (arrows[e.key]) {
                const cur = layoutRef.current;
                const sel = selectedRef.current;
                if (sel.size === 0)
                    return;
                /* only move if no input/textarea is focused */
                const tag = (document.activeElement as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA')
                    return;
                e.preventDefault();
                const step = e.shiftKey ? 1 : 0.5; /* % units; 0.5% fine, 1% coarse */
                const [dx, dy] = arrows[e.key];
                const pos = cur.positions ?? DEFAULT_POSITIONS;
                const locked = new Set<string>(cur.locked_elems ?? []);
                const keys = Array.from(sel).filter(k => !locked.has(k));
                if (keys.length === 0)
                    return;
                const upd: Partial<Record<ElemKey, CardElementPos>> = {};
                for (const k of keys) {
                    const p = pos[k] ?? DEFAULT_POSITIONS[k]!;
                    upd[k as ElemKey] = { ...p, x: clamp(p.x + dx * step, 0, 100 - p.w), y: clamp(p.y + dy * step, 0, 100 - p.h) };
                }
                if (keys.length === 1) {
                    const k = keys[0] as ElemKey;
                    setLayout(prev => ({ ...prev, positions: { ...(prev.positions ?? DEFAULT_POSITIONS), [k]: upd[k]! } }));
                }
                else {
                    setLayout(prev => ({ ...prev, positions: { ...(prev.positions ?? DEFAULT_POSITIONS), ...upd } }));
                }
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, selectedShapeIds, deleteSelectedShapes]);
    async function handleSave() {
        setSaving(true);
        setSaveErr(null);
        try {
            await onSave(layout);
            setSaved(true);
            setTimeout(() => { setSaved(false); onClose(); }, 800);
        }
        catch (e) {
            setSaveErr(e instanceof Error ? e.message : 'Failed to save.');
        }
        finally {
            setSaving(false);
        }
    }
    async function handleReset() {
        if (!confirm('Reset to default layout?'))
            return;
        setResetting(true);
        setSaveErr(null);
        try {
            await onReset();
            setLayout({ ...DEFAULT });
            setSelected(new Set());
        }
        catch (e) {
            setSaveErr(e instanceof Error ? e.message : 'Reset failed.');
        }
        finally {
            setResetting(false);
        }
    }
    const multiSel = Array.from(selected).filter(k => layout[SHOW_MAP[k]]);
    function set<K extends keyof CardLayout>(key: K, val: CardLayout[K]) {
        setLayout(prev => ({ ...prev, [key]: val }));
    }
    function getES(key: TextElemKey): TextElementStyle {
        return layout.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key];
    }
    function setES(key: TextElemKey, patch: Partial<TextElementStyle>) {
        setLayout(prev => ({
            ...prev,
            element_styles: {
                ...(prev.element_styles ?? DEFAULT_ELEM_STYLES),
                [key]: { ...(prev.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key]), ...patch },
            },
        }));
    }
    function handleZOrder(dir: 'forward' | 'backward' | 'front' | 'back') {
        if (selectedShapeId) {
            const shapes = layout.shapes ?? [];
            const shape = shapes.find(s => s.id === selectedShapeId);
            if (!shape)
                return;
            const pos = { ...(layout.positions ?? DEFAULT_POSITIONS) } as Record<ElemKey, CardElementPos>;
            const elementZ = ALL_KEYS.map(k => pos[k]?.z ?? ALL_KEYS.indexOf(k) + 1);
            const shapeZ = shapes.map((s, i) => s.z ?? 30 + i);
            const allZ = [...elementZ, ...shapeZ];
            const myZ = shape.z ?? 30 + shapes.findIndex(s => s.id === selectedShapeId);
            let newZ: number;
            if (dir === 'front') {
                newZ = Math.max(...allZ) + 1;
            }
            else if (dir === 'back') {
                newZ = Math.min(...allZ) - 1;
            }
            else if (dir === 'forward') {
                const above = allZ.filter(z => z > myZ);
                newZ = above.length ? Math.min(...above) + 1 : myZ + 1;
            }
            else {
                const below = allZ.filter(z => z < myZ);
                newZ = below.length ? Math.max(...below) - 1 : myZ - 1;
            }
            handleShapeChange(selectedShapeId, { z: newZ });
            return;
        }
        if (selected.size !== 1)
            return;
        const key = Array.from(selected)[0];
        const pos = { ...(layout.positions ?? DEFAULT_POSITIONS) } as Record<ElemKey, CardElementPos>;
        const elementZ = ALL_KEYS.map(k => pos[k]?.z ?? ALL_KEYS.indexOf(k) + 1);
        const shapeZ = (layout.shapes ?? []).map((s, i) => s.z ?? 30 + i);
        const allZ = [...elementZ, ...shapeZ];
        const myZ = pos[key]?.z ?? ALL_KEYS.indexOf(key as ElemKey) + 1;
        let newZ: number;
        if (dir === 'front') {
            newZ = Math.max(...allZ) + 1;
        }
        else if (dir === 'back') {
            newZ = Math.min(...allZ) - 1;
        }
        else if (dir === 'forward') {
            const above = allZ.filter(z => z > myZ);
            newZ = above.length ? Math.min(...above) + 1 : myZ + 1;
        }
        else {
            const below = allZ.filter(z => z < myZ);
            newZ = below.length ? Math.max(...below) - 1 : myZ - 1;
        }
        setLayout(prev => ({
            ...prev,
            positions: { ...(prev.positions ?? DEFAULT_POSITIONS), [key]: { ...(pos[key] ?? DEFAULT_POSITIONS[key as keyof typeof DEFAULT_POSITIONS]!), z: newZ } },
        }));
    }
    return (<div className="lc-backdrop" ref={backdropRef} onClick={e => {
            if (e.target === backdropRef.current)
                onClose();
        }}>
      <div className="lc-modal" role="dialog" aria-modal="true">

        <div className="lc-header">
          <div className="lc-header-left">
            <span className="lc-header-icon">palette</span>
            <h2 className="lc-title">Customize Card Layout</h2>
            <span className="lc-header-hint">Drag · ◢ resize · Shift+click multi-select · Ctrl+A select all</span>
          </div>
          <button className="lc-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="lc-body">
          {/* ── Controls panel ── */}
          <div className="lc-controls">

            {/* ── Element picker ── */}
            <div className={`lc-elem-picker-wrap${!elementPickerOpen ? ' collapsed' : ''}`}>
              <button type="button" className="lc-elem-picker-head" onClick={() => setElementPickerOpen(open => !open)} aria-expanded={elementPickerOpen}>
                <h3>Elements</h3>
                <span className="material-symbol" aria-hidden="true">expand_more</span>
              </button>
              {elementPickerOpen && (<div className="lc-elem-picker-body">
              <ElemPickerList value={inspectKey ?? ''} layout={layout} onChange={val => {
                if (val) {
                    setSelectedShapeIds(new Set());
                    setSelected(new Set([val as ElemKey]));
                    setCardOpen(true);
                }
                else {
                    setSelectedShapeIds(new Set());
                    setSelected(new Set());
                    setCardOpen(true);
                }
            }} onToggleVisible={key => {
                const showKey = SHOW_MAP[key];
                if (!showKey)
                    return;
                setLayout(prev => ({ ...prev, [showKey]: !prev[showKey] }));
            }}/>
              </div>)}
            </div>

            <Section sectionKey="shapes" title="Shapes" openSection={shapesOpen ? 'shapes' : null} onOpen={k => setShapesOpen(k === 'shapes')}>
              <div className="lc-shape-tools" aria-label="Add shape tools">
                {SHAPE_TOOLS.map(tool => (<button key={tool.type} type="button" className="lc-shape-tool" onClick={() => addShape(tool.type)} title={tool.type === 'line' ? tool.label : `Add ${tool.label}`} aria-label={tool.type === 'line' ? tool.label : `Add ${tool.label}`}>
                    <ShapeIcon type={tool.type}/>
                  </button>))}
              </div>
            </Section>

            {selectedShape && (<Section sectionKey="shape-style" title={`${selectedShape.type[0].toUpperCase()}${selectedShape.type.slice(1)} Style`} openSection={shapeStyleOpen ? 'shape-style' : null} onOpen={k => setShapeStyleOpen(k === 'shape-style')}>
                <ShapeInspector shape={selectedShape} onChange={patch => handleShapeChange(selectedShape.id, patch)} onDelete={deleteSelectedShapes}/>
              </Section>)}

            {false && !hasSelectedShape && !inspectKey && (<Section sectionKey="card" title="palette Card" openSection={cardOpen ? 'card' : null} onOpen={k => setCardOpen(k === 'card')}>
              {inspectKey ? (<InspectorContent elemKey={inspectKey} layout={layout} set={set} getES={getES} setES={setES} pos={(layout.positions ?? DEFAULT_POSITIONS)[inspectKey] ?? DEFAULT_POSITIONS[inspectKey]} onPosChange={handlePosChange}/>) : null}
              {!inspectKey && false && <><Row label="Background">
                <div className="lc-btn-group">
                  {(['solid', 'gradient'] as const).map(m => (<button key={m} type="button" className={`lc-btn-opt${(layout.card_bg_type ?? 'solid') === m ? ' active' : ''}`} onClick={() => {
                        const type = m;
                        const color1 = layout.card_bg_type === 'gradient'
                            ? (layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)?.[0] ?? layout.card_background)
                            : layout.card_background;
                        const color2 = layout.card_bg_color2 ?? '#ffffff';
                        const angle = layout.card_bg_gradient_angle ?? 135;
                        const bg = type === 'gradient'
                            ? `linear-gradient(${angle}deg, ${color1}, ${color2})`
                            : color1;
                        setLayout(prev => ({ ...prev, card_bg_type: type, card_background: bg }));
                    }}>{m}</button>))}
                </div>
              </Row>
              {(layout.card_bg_type ?? 'solid') === 'solid' ? (<Row label="Color">
                  <ColorSwatch value={layout.card_background} onChange={v => set('card_background', v)}/>
                  <span className="lc-val">{layout.card_background}</span>
                </Row>) : (<>
                  <Row label="Color 1">
                    <ColorSwatch value={layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)?.[0] ?? '#ffffff'} onChange={v => {
                        const color2 = layout.card_bg_color2 ?? '#ffffff';
                        const angle = layout.card_bg_gradient_angle ?? 135;
                        setLayout(prev => ({ ...prev, card_background: `linear-gradient(${angle}deg, ${v}, ${color2})` }));
                    }}/>
                    <span className="lc-val">{layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)?.[0] ?? ''}</span>
                  </Row>
                  <Row label="Color 2">
                    <ColorSwatch value={layout.card_bg_color2 ?? '#ffffff'} onChange={v => {
                        const color1 = layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)?.[0] ?? '#ffffff';
                        const angle = layout.card_bg_gradient_angle ?? 135;
                        setLayout(prev => ({ ...prev, card_bg_color2: v, card_background: `linear-gradient(${angle}deg, ${color1}, ${v})` }));
                    }}/>
                    <span className="lc-val">{layout.card_bg_color2 ?? '#ffffff'}</span>
                  </Row>
                  <Row label="Angle">
                    <input type="range" min={0} max={360} value={layout.card_bg_gradient_angle ?? 135} onChange={e => {
                        const angle = +e.target.value;
                        const color1 = layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)?.[0] ?? '#ffffff';
                        const color2 = layout.card_bg_color2 ?? '#ffffff';
                        setLayout(prev => ({ ...prev, card_bg_gradient_angle: angle, card_background: `linear-gradient(${angle}deg, ${color1}, ${color2})` }));
                    }}/>
                    <span className="lc-val">{layout.card_bg_gradient_angle ?? 135}°</span>
                  </Row>
                </>)}
              <Row label="Drop shadow"><Toggle checked={layout.card_shadow} onChange={v => set('card_shadow', v)}/></Row>

              {/* ── Border ── */}
              <div className="lc-sub-title">Border</div>
              <Row label="Width">
                <NumericInput min={0} max={20} step={0.1} size="sm" value={layout.card_border_width ?? 0} onChange={v => { set('card_border_width', v); set('card_border_top', v); set('card_border_right', v); set('card_border_bottom', v); set('card_border_left', v); }} className={cssClass({ width: 90 })}/>
                <span className="lc-val">{layout.card_border_width ?? 0}px</span>
              </Row>
              {(layout.card_border_width ?? 0) > 0 && <>
                <Row label="Color">
                  <ColorSwatch value={layout.card_border_color ?? '#49f2b6'} onChange={v => set('card_border_color', v)}/>
                  <span className="lc-val">{layout.card_border_color ?? '#49f2b6'}</span>
                </Row>
                <Row label="Style">
                  <div className="lc-btn-group">
                    {(['solid', 'dashed', 'dotted'] as const).map(s => (<button key={s} type="button" className={`lc-btn-opt${(layout.card_border_style ?? 'solid') === s ? ' active' : ''}`} onClick={() => set('card_border_style', s)}>{s}</button>))}
                  </div>
                </Row>
                <span className="lc-insp-subsection-label">Per Side</span>
                <div className="lc-border-sides">
                  {([
                        ['T', 'card_border_top', layout.card_border_top ?? (layout.card_border_width ?? 0)],
                        ['R', 'card_border_right', layout.card_border_right ?? (layout.card_border_width ?? 0)],
                        ['B', 'card_border_bottom', layout.card_border_bottom ?? (layout.card_border_width ?? 0)],
                        ['L', 'card_border_left', layout.card_border_left ?? (layout.card_border_width ?? 0)],
                    ] as [
                        string,
                        keyof CardLayout,
                        number
                    ][]).map(([lbl, key, val]) => (<div key={key} className="lc-border-side-field">
                      <span className="lc-border-side-label">{lbl}</span>
                      <NumericInput size="xs" min={0} max={20} step={0.1} value={val} onChange={v => set(key, v)}/>
                    </div>))}
                </div>
              </>}

              {/* ── Radius ── */}
              <div className="lc-sub-title">Radius</div>
              <Row label="Mode">
                <div className="lc-btn-group">
                  <button type="button" className={`lc-btn-opt${(layout.card_radius_mode ?? 'all') === 'all' ? ' active' : ''}`} onClick={() => {
                    const v = layout.card_radius_tl ?? layout.card_border_radius ?? 16;
                    patchLayout({
                        card_radius_mode: 'all',
                        card_border_radius: v,
                        card_radius_tl: v,
                        card_radius_tr: v,
                        card_radius_br: v,
                        card_radius_bl: v,
                    });
                }}>All corners</button>
                  <button type="button" className={`lc-btn-opt${(layout.card_radius_mode ?? 'all') === 'each' ? ' active' : ''}`} onClick={() => {
                    const v = layout.card_border_radius ?? layout.card_radius_tl ?? 16;
                    patchLayout({
                        card_radius_mode: 'each',
                        card_radius_tl: v,
                        card_radius_tr: v,
                        card_radius_br: v,
                        card_radius_bl: v,
                    });
                }}>Each corner</button>
                </div>
              </Row>
              {(layout.card_radius_mode ?? 'all') === 'all' ? (<Row label="Radius">
                  <NumericInput min={0} max={64} step={1} size="sm" value={layout.card_border_radius ?? 16} onChange={v => {
                        patchLayout({
                            card_border_radius: v,
                            card_radius_tl: v,
                            card_radius_tr: v,
                            card_radius_br: v,
                            card_radius_bl: v,
                        });
                    }} className={cssClass({ width: 82 })}/>
                  <span className="lc-val">{layout.card_border_radius ?? 16}px</span>
                </Row>) : (<div className="lc-corner-grid lc-corner-grid--row">
                  {([['tl', '↖ TL'], ['tr', '↗ TR'], ['br', '↘ BR'], ['bl', '↙ BL']] as const).map(([corner, label]) => {
                        const key = `card_radius_${corner}` as 'card_radius_tl' | 'card_radius_tr' | 'card_radius_br' | 'card_radius_bl';
                        const val = layout[key] ?? 16;
                        return (<div key={corner} className="lc-corner-item">
                        <span className="lc-corner-label">{corner.toUpperCase()}</span>
                        <NumericInput min={0} max={64} step={1} size="sm" value={val} onChange={v => set(key, v)} className={cssClass({ width: 82 })}/>
                        <span className="lc-val">{val}px</span>
                      </div>);
                    })}
                </div>)}

              

            </>}
            </Section>)}

          </div>

          {/* ── Preview column ── */}
          <div className="lc-preview-col">
            <div className="lc-preview-topbar">
              <p className="lc-preview-label">
                Live Preview
                {(multiSel.length + selectedShapeIds.size) >= 2 && <span className="lc-sel-count"> · {multiSel.length + selectedShapeIds.size} selected</span>}
              </p>
              <div className="lc-zoom-bar">
                <button className="lc-zoom-btn" title="Zoom out" onClick={() => setCanvasZoom(z => Math.max(30, z - 10))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <input type="range" min={30} max={200} step={5} value={canvasZoom} className="lc-zoom-slider" onChange={e => setCanvasZoom(+e.target.value)}/>
                <button className="lc-zoom-btn" title="Zoom in" onClick={() => setCanvasZoom(z => Math.min(200, z + 10))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button className="lc-zoom-reset" title="Reset zoom (100%)" onClick={() => setCanvasZoom(100)}>
                  {canvasZoom}%
                </button>
              </div>
            </div>

            <div className={cx("lc-canvas-zoom-wrap", cssClass({ transform: `scale(${canvasZoom / 100})` }))}>
              <DraggableCard layout={layout} onPosChange={handlePosChange} onMultiPosChange={handleMultiPosChange} onShapeChange={handleShapeChange} selected={selected} setSelected={setSelected} selectedShapeIds={selectedShapeIds} setSelectedShapeIds={setSelectedShapeIds} lockedElems={layout.locked_elems ?? []} elemGroups={layout.elem_groups ?? []} onAlign={applyAlign} onSnap={snapToCard} onZOrder={handleZOrder} onGroup={groupSelected} onUngroup={ungroupSelected} canGroup={canGroup} selInGroup={selInGroup} onUndo={undoLayout} onRedo={redoLayout} canUndo={undoStackRef.current.length > 0} canRedo={redoStackRef.current.length > 0} onToggleLock={toggleLock} onHideElement={key => {
            const showKey = SHOW_MAP[key];
            if (!showKey)
                return;
            set(showKey, false as never);
            setSelected(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }} onLayoutPatch={patch => setLayout(prev => ({ ...prev, ...patch }))} onElemStyleChange={setES} cardAspectRatio={cardAspectRatio} canvasZoom={canvasZoom}/>
            </div>

          </div>

          {/* ── Toolbar column (Align / Order / Group / Lock) ── */}
          <div className="lc-toolbar-col">
            <AlignToolbar onAlign={applyAlign} onSnap={snapToCard} onZOrder={handleZOrder} singleSel={(selected.size + selectedShapeIds.size) === 1} canGroup={canGroup} selInGroup={selInGroup} onUndo={undoLayout} onRedo={redoLayout} canUndo={undoStackRef.current.length > 0} canRedo={redoStackRef.current.length > 0} onGroup={groupSelected} onUngroup={ungroupSelected} onLockSelected={lockSelected} onUnlockSelected={unlockSelected} selectedAllLocked={selected.size > 0 && Array.from(selected).every(k => isLocked(k))}/>
          </div>
        </div>

        {tplOpen && (<div className="lc-tpl-panel">
            <div className="lc-tpl-panel-header">
              <span className="lc-tpl-panel-title">content_paste Layout Templates</span>
              <button className="lc-tpl-close" onClick={() => setTplOpen(false)} aria-label="Close templates">✕</button>
            </div>

            <div className="lc-tpl-save-row">
              <input className="lc-tpl-name-input" type="text" placeholder="Template name…" maxLength={80} value={tplName} onChange={e => { setTplName(e.target.value); setTplErr(null); }} onKeyDown={e => {
                if (e.key === 'Enter')
                    handleSaveTemplate();
            }}/>
              <button className="btn primary lc-tpl-save-btn" onClick={handleSaveTemplate} disabled={tplSaving}>
                {tplSaving ? 'Saving…' : '+ Save current'}
              </button>
            </div>

            {tplErr && <p className="lc-tpl-msg err">{tplErr}</p>}
            {tplSuccess && <p className="lc-tpl-msg ok">{tplSuccess}</p>}

            <div className="lc-tpl-list">
              {tplLoading && <p className="lc-tpl-loading">Loading…</p>}
              {!tplLoading && templates.length === 0 && (<p className="lc-tpl-empty">No saved templates yet.</p>)}
              {templates.map(t => (<div key={t.id} className="lc-tpl-item">
                  <span className="lc-tpl-item-name" title={t.name}>{t.name}</span>
                  <span className="lc-tpl-item-date">{new Date(t.created_at).toLocaleDateString()}</span>
                  <button className="lc-tpl-apply-btn" onClick={() => handleApplyTemplate(t)}>Apply</button>
                  {t.can_delete !== false && (<button className="lc-tpl-del-btn" onClick={() => handleDeleteTemplate(t.id)} aria-label="Delete template">delete</button>)}
                </div>))}
            </div>
          </div>)}

        <div className="lc-footer">
          {saveErr && <span className="lc-save-err">warning {saveErr}</span>}
          <button className="btn ghost lc-reset-btn" onClick={handleReset} disabled={resetting}>{resetting ? 'Resetting…' : '↺ Reset all to default'}</button>
          <button className="btn ghost lc-tpl-toggle-btn" onClick={tplOpen ? () => setTplOpen(false) : openTemplates}>
            content_paste Templates
          </button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}</button>
        </div>
      </div>
    </div>);
}
/* ── TextStyleControls ───────────────────────── */
function TscLabel({ children }: {
    children: React.ReactNode;
}) {
    return <span className="tsc-label">{children}</span>;
}
function TscCell({ children, span2 }: {
    children: React.ReactNode;
    span2?: boolean;
}) {
    return <div className={span2 ? 'tsc-cell tsc-span2' : 'tsc-cell'}>{children}</div>;
}
function TscSlider({ min = 0, max, value, onChange, unit = 'px' }: {
    min?: number;
    max: number;
    value: number;
    onChange: (v: number) => void;
    unit?: string;
}) {
    return (<div className="tsc-slider-wrap">
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}/>
      <span className="tsc-val">{value}{unit}</span>
    </div>);
}
function TextStyleControls({ elemKey, textStyle, onChange }: {
    elemKey: TextElemKey;
    textStyle: TextElementStyle;
    onChange: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
}) {
    function upd(patch: Partial<TextElementStyle>) { onChange(elemKey, patch); }
    const style = textStyle;
    const biVal = style.bold && style.italic ? 'bi' : style.bold ? 'b' : style.italic ? 'i' : 'n';
    return (<div className="tsc-grid">

      {/* Font style + Font case */}
      <TscCell>
        <TscLabel>Font style</TscLabel>
        <div className="tsc-col-gap">
          <BtnGroup value={biVal} onChange={v => upd({ bold: v === 'b' || v === 'bi', italic: v === 'i' || v === 'bi' })} opts={[{ v: 'n', l: 'N', t: 'Normal' }, { v: 'b', l: 'B', t: 'Bold', s: { fontWeight: 700 } }, { v: 'i', l: 'I', t: 'Italic', s: { fontStyle: 'italic' } }, { v: 'bi', l: 'BI', t: 'Bold+Italic', s: { fontWeight: 700, fontStyle: 'italic' } }]}/>
          <BtnGroup value={style.script} onChange={v => upd({ script: v as TextScript })} opts={[{ v: 'none', l: '𝑋', t: 'Normal' }, { v: 'superscript', l: 'X²', t: 'Super' }, { v: 'subscript', l: 'X₂', t: 'Sub' }]}/>
        </div>
      </TscCell>
      <TscCell>
        <TscLabel>Font case</TscLabel>
        <BtnGroup value={style.transform} onChange={v => upd({ transform: v as TextTransform })} opts={[{ v: 'none', l: 'Aa', t: 'None' }, { v: 'uppercase', l: 'AA', t: 'Upper' }, { v: 'lowercase', l: 'aa', t: 'Lower' }, { v: 'title_case', l: 'Tt', t: 'Title' }]}/>
      </TscCell>

      {/* Align + V-Align */}
      <TscCell>
        <TscLabel>Align</TscLabel>
        <BtnGroup value={style.align} onChange={v => upd({ align: v as TextAlign })} opts={[{ v: 'left', l: '⬅', t: 'Left' }, { v: 'center', l: '↔', t: 'Center' }, { v: 'right', l: '➡', t: 'Right' }]}/>
      </TscCell>
      <TscCell>
        <TscLabel>V-Align</TscLabel>
        <BtnGroup value={style.valign ?? 'top'} onChange={v => upd({ valign: v as TextVAlign })} opts={[{ v: 'top', l: 'upload', t: 'Top' }, { v: 'middle', l: '⬛', t: 'Middle' }, { v: 'bottom', l: 'download', t: 'Bottom' }]}/>
      </TscCell>

      {/* Padding */}
      <TscCell span2>
        <TscLabel>Padding</TscLabel>
        <TscSlider max={20} value={style.padding ?? 2} onChange={v => upd({ padding: v })}/>
      </TscCell>

    </div>);
}
/* ── Button group ────────────────────────────── */
interface BtnOpt {
    v: string;
    l: string;
    t?: string;
    s?: React.CSSProperties;
}
function BtnGroup({ value, onChange, opts }: {
    value: string;
    onChange: (v: string) => void;
    opts: BtnOpt[];
}) {
    return (<div className="lc-btn-group">
      {opts.map(o => (<button key={o.v} type="button" className={cx(`lc-btn-opt${value === o.v ? ' active' : ''}`, cssClass(o.s))} title={o.t} onClick={() => onChange(o.v)}>
          {o.l}
        </button>))}
    </div>);
}
/* ── Alignment toolbar ───────────────────────── */
const ALIGN_MODES: AlignMode[] = ['left', 'center_h', 'right', 'top', 'center_v', 'bottom', 'equal_w', 'equal_h'];
const ALIGN_ICONS: Record<AlignMode, React.ReactNode> = {
    left: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="1" height="13"/><rect x="3" y="2" width="7" height="3" rx="1"/><rect x="3" y="9" width="10" height="3" rx="1"/></svg>,
    center_h: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="7" y="1" width="1" height="13"/><rect x="2.5" y="2" width="10" height="3" rx="1"/><rect x="0.5" y="9" width="14" height="3" rx="1"/></svg>,
    right: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="13" y="1" width="1" height="13"/><rect x="5" y="2" width="7" height="3" rx="1"/><rect x="2" y="9" width="10" height="3" rx="1"/></svg>,
    top: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="13" height="1"/><rect x="2" y="3" width="3" height="7" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>,
    center_v: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="7" width="13" height="1"/><rect x="2" y="2" width="3" height="11" rx="1"/><rect x="9" y="4" width="3" height="7" rx="1"/></svg>,
    bottom: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="13" width="13" height="1"/><rect x="2" y="5" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1"/></svg>,
    equal_w: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="4.5" width="13" height="2" rx="1"/><rect x="1" y="8.5" width="13" height="2" rx="1"/><rect x="1" y="2" width="1" height="11"/><rect x="13" y="2" width="1" height="11"/></svg>,
    equal_h: <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="4.5" y="1" width="2" height="13" rx="1"/><rect x="8.5" y="1" width="2" height="13" rx="1"/><rect x="2" y="1" width="11" height="1"/><rect x="2" y="13" width="11" height="1"/></svg>,
};
const EyeOn = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOff = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
function ElemPickerList({ value, layout, onChange, onToggleVisible }: {
    value: string;
    layout: CardLayout;
    onChange: (v: string) => void;
    onToggleVisible: (key: ElemKey) => void;
}) {
    const isVisible = (k: ElemKey) => {
        const key = SHOW_MAP[k];
        return key ? layout[key] !== false : true;
    };
    return (<div className="lc-elem-picker-list">
          <button type="button" className={`lc-elem-picker-item${value === '' ? ' active' : ''}`} onClick={() => onChange('')}>
            <span className="lc-epi-label">Card</span>
          </button>

          {ALL_KEYS.map(k => {
                const vis = isVisible(k);
                return (<button type="button" key={k} className={`lc-elem-picker-item${value === k ? ' active' : ''}${!vis ? ' hidden-elem' : ''}`} onClick={() => onChange(k)}>
                <span className="lc-epi-label">{ELEM_LABELS[k]}</span>
                <span role="button" tabIndex={0} className={`lc-epi-eye${vis ? ' vis' : ' invis'}`} title={vis ? 'Hide element' : 'Show element'} onClick={e => {
                        e.stopPropagation();
                        onToggleVisible(k);
                    }} onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleVisible(k);
                        }
                    }}>
                  {vis ? <EyeOn /> : <EyeOff />}
                </span>
              </button>);
            })}
    </div>);
}
function AlignToolbar({ onAlign, onSnap, onZOrder, singleSel, canGroup, selInGroup, onUndo, onRedo, canUndo, canRedo, onGroup, onUngroup, onLockSelected, onUnlockSelected, selectedAllLocked }: {
    onAlign: (m: AlignMode) => void;
    onSnap: (m: 'snap_left' | 'snap_center_h' | 'snap_right' | 'snap_top' | 'snap_center_v' | 'snap_bottom') => void;
    onZOrder: (dir: 'forward' | 'backward' | 'front' | 'back') => void;
    singleSel: boolean;
    canGroup: boolean;
    selInGroup: boolean;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onGroup: () => void;
    onUngroup: () => void;
    onLockSelected: () => void;
    onUnlockSelected: () => void;
    selectedAllLocked: boolean;
}) {
    return (<div className="lc-align-toolbar">
      <span className="lc-align-label">History</span>
      <div className="lc-align-btns lc-history-btns">
        <button type="button" className="lc-align-btn" title="Undo" onClick={onUndo} disabled={!canUndo}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>
        </button>
        <button type="button" className="lc-align-btn" title="Redo" onClick={onRedo} disabled={!canRedo}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>
        </button>
      </div>
      <span className="lc-align-label">Align</span>
      <div className="lc-align-btns lc-align-main-btns">
        {ALIGN_MODES.map(m => (<button key={m} type="button" className="lc-align-btn" title={ALIGN_TITLES[m]} onClick={() => onAlign(m)}>
            {ALIGN_ICONS[m]}
          </button>))}
      </div>

      {false && (<><span className="lc-align-label">Snap to Card</span>
      <div className="lc-align-btns">
        {([
            ['snap_left', '⬛⬜⬜', 'Snap to left edge'],
            ['snap_center_h', '⬜⬛⬜', 'Snap to horizontal center'],
            ['snap_right', '⬜⬜⬛', 'Snap to right edge'],
            ['snap_top', '▲', 'Snap to top edge'],
            ['snap_center_v', '⬛', 'Snap to vertical center'],
            ['snap_bottom', '▼', 'Snap to bottom edge'],
        ] as [
            string,
            string,
            string
        ][]).map(([m, icon, title]) => (<button key={m} type="button" className="lc-align-btn" title={title} disabled={!singleSel} onClick={() => onSnap(m as Parameters<typeof onSnap>[0])}>
            {m === 'snap_left' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="2" x2="4" y2="22"/><rect x="6" y="8" width="8" height="8" rx="1"/></svg>}
            {m === 'snap_center_h' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><rect x="7" y="8" width="10" height="8" rx="1"/></svg>}
            {m === 'snap_right' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="2" x2="20" y2="22"/><rect x="10" y="8" width="8" height="8" rx="1"/></svg>}
            {m === 'snap_top' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="4" x2="22" y2="4"/><rect x="8" y="6" width="8" height="10" rx="1"/></svg>}
            {m === 'snap_center_v' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><rect x="8" y="7" width="8" height="10" rx="1"/></svg>}
            {m === 'snap_bottom' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="20" x2="22" y2="20"/><rect x="8" y="8" width="8" height="10" rx="1"/></svg>}
          </button>))}
      </div>

      </>)}
      <span className="lc-align-label">Order</span>
      <div className="lc-align-btns">
        <button type="button" className="lc-align-btn" title="Bring to Front" onClick={() => onZOrder('front')} disabled={!singleSel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>
        </button>
        <button type="button" className="lc-align-btn" title="Bring Forward" onClick={() => onZOrder('forward')} disabled={!singleSel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><line x1="15" y1="6" x2="15" y2="12"/><line x1="12" y1="9" x2="18" y2="9"/></svg>
        </button>
        <button type="button" className="lc-align-btn" title="Send Backward" onClick={() => onZOrder('backward')} disabled={!singleSel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="13" height="13" rx="2"/><path d="M20 9h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-1"/><line x1="11" y1="15" x2="11" y2="9"/><line x1="8" y1="12" x2="14" y2="12"/></svg>
        </button>
        <button type="button" className="lc-align-btn" title="Send to Back" onClick={() => onZOrder('back')} disabled={!singleSel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="13" height="13" rx="2"/><path d="M20 9h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-1"/><line x1="15" y1="15" x2="9" y2="15"/><line x1="12" y1="18" x2="12" y2="12"/></svg>
        </button>
      </div>

      <span className="lc-align-label">Group</span>
      <div className="lc-align-btns">
        <button type="button" className="lc-align-btn" title="Group selected elements (2+)" onClick={onGroup} disabled={!canGroup}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><line x1="10" y1="6" x2="14" y2="6"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="18" y1="10" x2="18" y2="14"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
        </button>
        <button type="button" className="lc-align-btn" title="Ungroup selected elements" onClick={onUngroup} disabled={!selInGroup}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>
        </button>
      </div>

      <span className="lc-align-label">Lock</span>
      <div className="lc-align-btns">
        {selectedAllLocked ? (<button type="button" className="lc-align-btn lc-align-btn-active" title="Unlock selected" onClick={onUnlockSelected}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          </button>) : (<button type="button" className="lc-align-btn" title="Lock selected" onClick={onLockSelected}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>)}
      </div>
    </div>);
}
/* ── Draggable canvas ────────────────────────── */
function ShapeIcon({ type }: {
    type: CardShapeType;
}) {
    const stroke = 'currentColor';
    if (type === 'rectangle')
        return <svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
    if (type === 'triangle')
        return <svg viewBox="0 0 24 24"><polygon points="12 4 21 20 3 20" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/></svg>;
    if (type === 'ellipse')
        return <svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
    if (type === 'polygon')
        return <svg viewBox="0 0 24 24"><polygon points="7 4 17 4 21 12 16 20 6 18 3 10" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/></svg>;
    if (type === 'star')
        return <svg viewBox="0 0 24 24"><polygon points="12 3 14.7 8.5 20.8 9.4 16.4 13.7 17.4 19.8 12 16.9 6.6 19.8 7.6 13.7 3.2 9.4 9.3 8.5" fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/></svg>;
    return <svg viewBox="0 0 24 24"><line x1="4" y1="12" x2="20" y2="12" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"/></svg>;
}
function ShapeSvg({ shape }: {
    shape: CardShape;
}) {
    const gradientId = `lc-shape-grad-${shape.id}`;
    const fill = shape.type === 'line'
        ? 'none'
        : (shape.fillType ?? 'solid') === 'gradient'
            ? `url(#${gradientId})`
            : (shape.fill ?? '#49f2b6');
    const stroke = shape.stroke ?? '#49f2b6';
    const strokeWidth = shape.strokeWidth ?? 1.5;
    const opacity = shape.opacity ?? 0.4;
    const dasharray = shape.strokeStyle === 'dotted'
        ? `${strokeWidth} ${Math.max(strokeWidth * 1.6, 2)}`
        : shape.strokeStyle === 'dashed'
            ? `${Math.max(strokeWidth * 4, 4)} ${Math.max(strokeWidth * 2, 3)}`
            : undefined;
    const common = { fill, stroke, strokeWidth, opacity, strokeDasharray: dasharray, strokeLinecap: shape.strokeStyle === 'dotted' ? 'round' as const : 'butt' as const, vectorEffect: 'non-scaling-stroke' as const };
    const angle = ((shape.fillGradientAngle ?? 135) * Math.PI) / 180;
    const x = Math.cos(angle) * 50;
    const y = Math.sin(angle) * 50;
    const rectPath = roundedRectPath(4, 4, 92, 92, shape.radiusMode === 'each' ? (shape.radiusTl ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusTr ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusBr ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusBl ?? 0) : (shape.radius ?? 4));
    const trianglePath = roundedPolygonPath([{ x: 50, y: 4 }, { x: 96, y: 96 }, { x: 4, y: 96 }], shape.radiusMode === 'each'
        ? [shape.radiusTl ?? 0, shape.radiusBr ?? 0, shape.radiusBl ?? 0]
        : [shape.radius ?? 4, shape.radius ?? 4, shape.radius ?? 4]);
    return (<svg viewBox="0 0 100 100" preserveAspectRatio="none" className="lc-shape-svg">
      {(shape.fillType ?? 'solid') === 'gradient' && shape.type !== 'line' && (<defs>
          <linearGradient id={gradientId} x1={50 - x} y1={50 - y} x2={50 + x} y2={50 + y} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={shape.fill ?? '#49f2b6'}/>
            <stop offset="100%" stopColor={shape.fillColor2 ?? '#ffffff'}/>
          </linearGradient>
        </defs>)}
      {shape.type === 'rectangle' && <path d={rectPath} {...common}/>}
      {shape.type === 'triangle' && <path d={trianglePath} {...common}/>}
      {shape.type === 'ellipse' && <ellipse cx="50" cy="50" rx="46" ry="44" {...common}/>}
      {shape.type === 'polygon' && <polygon points={polygonPoints(shape.sides ?? 6)} {...common}/>}
      {shape.type === 'star' && <polygon points={starPoints(shape.points ?? 5)} {...common}/>}
      {shape.type === 'line' && <line x1="4" y1="50" x2="96" y2="50" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} strokeDasharray={dasharray} strokeLinecap={shape.strokeStyle === 'solid' ? 'round' : common.strokeLinecap} vectorEffect="non-scaling-stroke"/>}
    </svg>);
}
function polygonPoints(sides: number) {
    const count = Math.max(3, Math.min(12, Math.round(sides)));
    const pts: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        pts.push(`${50 + Math.cos(angle) * 46} ${50 + Math.sin(angle) * 46}`);
    }
    return pts.join(' ');
}
function starPoints(points: number) {
    const count = Math.max(3, Math.min(12, Math.round(points)));
    const pts: string[] = [];
    for (let i = 0; i < count * 2; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / count;
        const radius = i % 2 === 0 ? 46 : 20;
        pts.push(`${50 + Math.cos(angle) * radius} ${50 + Math.sin(angle) * radius}`);
    }
    return pts.join(' ');
}
function roundedRectPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
    const max = Math.min(w, h) / 2;
    const r = [tl, tr, br, bl].map(v => clamp(v, 0, max));
    return [
        `M ${x + r[0]} ${y}`,
        `H ${x + w - r[1]}`,
        `Q ${x + w} ${y} ${x + w} ${y + r[1]}`,
        `V ${y + h - r[2]}`,
        `Q ${x + w} ${y + h} ${x + w - r[2]} ${y + h}`,
        `H ${x + r[3]}`,
        `Q ${x} ${y + h} ${x} ${y + h - r[3]}`,
        `V ${y + r[0]}`,
        `Q ${x} ${y} ${x + r[0]} ${y}`,
        'Z',
    ].join(' ');
}
function roundedPolygonPath(points: {
    x: number;
    y: number;
}[], radii: number[]) {
    if (points.length < 3)
        return '';
    const corner = points.map((point, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const prevLen = Math.hypot(prev.x - point.x, prev.y - point.y);
        const nextLen = Math.hypot(next.x - point.x, next.y - point.y);
        const radius = clamp(radii[i] ?? 0, 0, Math.min(prevLen, nextLen) / 2);
        return {
            point,
            before: {
                x: point.x + ((prev.x - point.x) / prevLen) * radius,
                y: point.y + ((prev.y - point.y) / prevLen) * radius,
            },
            after: {
                x: point.x + ((next.x - point.x) / nextLen) * radius,
                y: point.y + ((next.y - point.y) / nextLen) * radius,
            },
        };
    });
    return [
        `M ${corner[0].after.x} ${corner[0].after.y}`,
        ...corner.slice(1).flatMap(({ point, before, after }) => [
            `L ${before.x} ${before.y}`,
            `Q ${point.x} ${point.y} ${after.x} ${after.y}`,
        ]),
        `L ${corner[0].before.x} ${corner[0].before.y}`,
        `Q ${corner[0].point.x} ${corner[0].point.y} ${corner[0].after.x} ${corner[0].after.y}`,
        'Z',
    ].join(' ');
}
function ShapeInspector({ shape, onChange, onDelete }: {
    shape: CardShape;
    onChange: (patch: Partial<CardShape>) => void;
    onDelete: () => void;
}) {
    const fillType = shape.fillType ?? 'solid';
    const strokeWidth = shape.strokeWidth ?? 0;
    const radiusMode = shape.radiusMode ?? 'all';
    const supportsBorderRadius = shape.type === 'rectangle' || shape.type === 'triangle';
    const radiusCornerOptions = shape.type === 'triangle'
        ? [
            ['radiusTl', 'Top'],
            ['radiusBr', 'Right'],
            ['radiusBl', 'Left'],
        ] as [
            keyof CardShape,
            string
        ][]
        : [
            ['radiusTl', 'TL'],
            ['radiusTr', 'TR'],
            ['radiusBr', 'BR'],
            ['radiusBl', 'BL'],
        ] as [
            keyof CardShape,
            string
        ][];
    return (<>
      <div className="lc-insp-size-row">
        <div className="lc-insp-size-field">
          <span className="lc-insp-size-label">W</span>
          <NumericInput size="sm" min={1} max={100} step={0.1} value={+shape.w.toFixed(1)} onChange={v => onChange({ w: Math.min(100 - shape.x, Math.max(0.1, v)) })}/>
          <span className="lc-insp-size-unit">%</span>
        </div>
        <div className="lc-insp-size-field">
          <span className="lc-insp-size-label">H</span>
          <NumericInput size="sm" min={1} max={100} step={0.1} value={+shape.h.toFixed(1)} onChange={v => onChange({ h: Math.min(100 - shape.y, Math.max(0.1, v)) })}/>
          <span className="lc-insp-size-unit">%</span>
        </div>
      </div>

      <Row label="Shape">
        <button type="button" className="lc-delete-shape-btn" onClick={onDelete}>Delete shape</button>
      </Row>

      <Row label="Rotate">
        <input type="range" min={-180} max={180} step={1} value={shape.rotation ?? 0} onChange={e => onChange({ rotation: +e.target.value })}/>
        <NumericInput min={-360} max={360} step={1} size="sm" value={shape.rotation ?? 0} onChange={v => onChange({ rotation: clamp(v, -360, 360) })} className={cssClass({ width: 76 })}/>
        <span className="lc-val">{Math.round(shape.rotation ?? 0)}deg</span>
      </Row>

      {shape.type !== 'line' && (<>
          <div className="lc-sub-title">Fill</div>
          <Row label="Type">
            <div className="lc-btn-group">
              {(['solid', 'gradient'] as const).map(type => (<button key={type} type="button" className={`lc-btn-opt${fillType === type ? ' active' : ''}`} onClick={() => onChange({ fillType: type })}>{type}</button>))}
            </div>
          </Row>
          <Row label={fillType === 'gradient' ? 'Color 1' : 'Color'}>
            <ColorSwatch value={shape.fill ?? '#49f2b6'} onChange={v => onChange({ fill: v })}/>
            <span className="lc-val">{shape.fill ?? '#49f2b6'}</span>
          </Row>
          {fillType === 'gradient' && (<>
              <Row label="Color 2">
                <ColorSwatch value={shape.fillColor2 ?? '#ffffff'} onChange={v => onChange({ fillColor2: v })}/>
                <span className="lc-val">{shape.fillColor2 ?? '#ffffff'}</span>
              </Row>
              <Row label="Angle">
                <input type="range" min={0} max={360} value={shape.fillGradientAngle ?? 135} onChange={e => onChange({ fillGradientAngle: +e.target.value })}/>
                <span className="lc-val">{shape.fillGradientAngle ?? 135}°</span>
              </Row>
            </>)}
          <Row label="Opacity">
            <input type="range" min={0} max={1} step={0.01} value={shape.opacity ?? 0.35} onChange={e => onChange({ opacity: +e.target.value })}/>
            <span className="lc-val">{Math.round((shape.opacity ?? 0.35) * 100)}%</span>
          </Row>
        </>)}

      <div className="lc-sub-title">Border</div>
      <Row label="Size">
        <NumericInput min={0} max={20} step={0.1} size="sm" value={strokeWidth} onChange={v => onChange({ strokeWidth: v })} className={cssClass({ width: 90 })}/>
        <span className="lc-val">{strokeWidth}px</span>
      </Row>
      {strokeWidth > 0 && (<>
          <Row label="Color">
            <ColorSwatch value={shape.stroke ?? '#49f2b6'} onChange={v => onChange({ stroke: v })}/>
            <span className="lc-val">{shape.stroke ?? '#49f2b6'}</span>
          </Row>
          <Row label="Style">
            <div className="lc-btn-group">
              {(['solid', 'dashed', 'dotted'] as const).map(style => (<button key={style} type="button" className={`lc-btn-opt${(shape.strokeStyle ?? 'solid') === style ? ' active' : ''}`} onClick={() => onChange({ strokeStyle: style })}>{style}</button>))}
            </div>
          </Row>
        </>)}

      {supportsBorderRadius && (<>
          <div className="lc-sub-title">Border Radius</div>
          <Row label="Mode">
            <div className="lc-btn-group">
              <button type="button" className={`lc-btn-opt${radiusMode === 'all' ? ' active' : ''}`} onClick={() => {
                const radius = shape.radiusTl ?? shape.radius ?? 4;
                onChange({ radiusMode: 'all', radius, radiusTl: radius, radiusTr: radius, radiusBr: radius, radiusBl: radius });
            }}>All corners</button>
              <button type="button" className={`lc-btn-opt${radiusMode === 'each' ? ' active' : ''}`} onClick={() => {
                const radius = shape.radius ?? shape.radiusTl ?? 4;
                onChange({ radiusMode: 'each', radiusTl: radius, radiusTr: radius, radiusBr: radius, radiusBl: radius });
            }}>Each corner</button>
            </div>
          </Row>
          {radiusMode === 'all' ? (<Row label="Radius">
              <NumericInput min={0} max={50} step={1} size="sm" value={shape.radius ?? 4} onChange={v => {
                    const radius = clamp(v, 0, 50);
                    onChange({ radius, radiusTl: radius, radiusTr: radius, radiusBr: radius, radiusBl: radius });
                }} className={cssClass({ width: 72 })}/>
              <span className="lc-val">{shape.radius ?? 4}px</span>
            </Row>) : (<div className="lc-corner-grid lc-corner-grid--row">
              {radiusCornerOptions.map(([key, label]) => {
                    const val = Number(shape[key] ?? 0);
                    return (<div key={key} className="lc-corner-item">
                    <span className="lc-corner-label">{label}</span>
                    <NumericInput min={0} max={50} step={1} size="sm" value={val} onChange={v => onChange({ [key]: clamp(v, 0, 50) } as Partial<CardShape>)} className={cssClass({ width: 64 })}/>
                    <span className="lc-val">{val}px</span>
                  </div>);
                })}
            </div>)}
        </>)}

      {shape.type === 'polygon' && (<>
          <div className="lc-sub-title">Polygon</div>
          <Row label="Sides">
            <input type="range" min={3} max={12} step={1} value={shape.sides ?? 6} onChange={e => onChange({ sides: +e.target.value })}/>
            <span className="lc-val">{shape.sides ?? 6}</span>
          </Row>
        </>)}

      {shape.type === 'star' && (<>
          <div className="lc-sub-title">Star</div>
          <Row label="Points">
            <input type="range" min={3} max={12} step={1} value={shape.points ?? 5} onChange={e => onChange({ points: +e.target.value })}/>
            <span className="lc-val">{shape.points ?? 5}</span>
          </Row>
        </>)}
    </>);
}
function DraggableCard({ layout, onPosChange, onMultiPosChange, onShapeChange, selected, setSelected, selectedShapeIds, setSelectedShapeIds, lockedElems, elemGroups, onAlign, onSnap, onZOrder, onGroup, onUngroup, canGroup, selInGroup, onUndo, onRedo, canUndo, canRedo, onToggleLock, onHideElement, onLayoutPatch, onElemStyleChange, cardAspectRatio, canvasZoom }: {
    layout: CardLayout;
    onPosChange: (key: ElemKey, pos: CardElementPos) => void;
    onMultiPosChange: (updates: Partial<Record<ElemKey, CardElementPos>>) => void;
    onShapeChange: (id: string, patch: Partial<CardShape>) => void;
    selected: Set<ElemKey>;
    setSelected: React.Dispatch<React.SetStateAction<Set<ElemKey>>>;
    selectedShapeIds: Set<string>;
    setSelectedShapeIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    lockedElems: string[];
    elemGroups: string[][];
    onAlign: (m: AlignMode) => void;
    onSnap: (m: 'snap_left' | 'snap_center_h' | 'snap_right' | 'snap_top' | 'snap_center_v' | 'snap_bottom') => void;
    onZOrder: (dir: 'forward' | 'backward' | 'front' | 'back') => void;
    onGroup: () => void;
    onUngroup: () => void;
    canGroup: boolean;
    selInGroup: boolean;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onToggleLock: (key: ElemKey) => void;
    onHideElement: (key: ElemKey) => void;
    onLayoutPatch: (patch: Partial<CardLayout>) => void;
    onElemStyleChange: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
    cardAspectRatio?: number;
    canvasZoom: number;
}) {
    const CARD_TOOLBAR_TARGET = '__card' as const;
    type ToolbarMenuPanel = 'arrange' | 'typography' | 'background' | 'border' | 'radius' | 'link' | 'badge';
    type ToolbarTarget = ElemKey | typeof CARD_TOOLBAR_TARGET;
    type ToolbarPosition = { left: number; top: number; placeBelow: boolean };
    const canvasRef = useRef<HTMLDivElement>(null);
    const [canvasW, setCanvasW] = useState(260);
    const [cardToolbarOpen, setCardToolbarOpen] = useState(false);
    const [cardToolbarPosition, setCardToolbarPosition] = useState<ToolbarPosition | null>(null);
    const [toolbarMenu, setToolbarMenu] = useState<{ target: ToolbarTarget; panel: ToolbarMenuPanel } | null>(null);
    const [toolbarPositions, setToolbarPositions] = useState<Partial<Record<ElemKey, ToolbarPosition>>>({});
    const dragging = useRef<{
        keys: ElemKey[];
        shapeIds: string[];
        mode: 'move' | 'resize' | 'rotate';
        pivotKey: ElemKey;
        startX: number;
        startY: number;
        startAngle?: number;
        elementRect?: DOMRect;
        startPositions: Partial<Record<ElemKey, CardElementPos>>;
        startShapes: Record<string, CardShape>;
    } | null>(null);
    const shapeDrag = useRef<{
        id: string;
        shapeIds: string[];
        elemKeys: ElemKey[];
        mode: 'move' | 'resize';
        startX: number;
        startY: number;
        startShape: CardShape;
        startShapes: Record<string, CardShape>;
        startPositions: Partial<Record<ElemKey, CardElementPos>>;
    } | null>(null);
    const positions = layout.positions ?? DEFAULT_POSITIONS;
    const lockedSet = new Set(lockedElems);
    const selectedItemCount = selected.size + selectedShapeIds.size;
    const hasMultiSelection = selectedItemCount > 1;
    const textSizeFields: Partial<Record<ElemKey, keyof CardLayout>> = {
        name_lan1: 'name_lan1_size',
        name_lan2: 'name_lan2_size',
        origin_lan1: 'origin_lan1_size',
        origin_lan2: 'origin_lan2_size',
        current_price: 'price_size',
        old_price: 'old_price_size',
        product_url: 'url_size',
        discount_badge: 'badge_font_size',
        origin_lan1_flag: 'flag_icon_size',
        origin_lan2_flag: 'flag_icon_size',
    };
    const textColorFields: Partial<Record<ElemKey, keyof CardLayout>> = {
        name_lan1: 'name_lan1_color',
        name_lan2: 'name_lan2_color',
        origin_lan1: 'origin_lan1_color',
        origin_lan2: 'origin_lan2_color',
        current_price: 'price_color',
        old_price: 'old_price_color',
        product_url: 'url_color',
        discount_badge: 'badge_text_color',
        origin_lan1_flag: 'flag_color',
        origin_lan2_flag: 'flag_color',
    };
    function isTextElemKey(key: ElemKey): key is TextElemKey {
        return (TEXT_ELEM_KEYS as readonly string[]).includes(key);
    }
    function getToolbarES(key: ElemKey): TextElementStyle | null {
        if (isTextElemKey(key))
            return layout.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key];
        if (key === 'origin_lan1_flag' || key === 'origin_lan2_flag')
            return layout.flag_element_style ?? DEFAULT_FLAG_ES;
        return null;
    }
    function patchToolbarES(key: ElemKey, patch: Partial<TextElementStyle>) {
        if (isTextElemKey(key)) {
            onElemStyleChange(key, patch);
            return;
        }
        if (key === 'origin_lan1_flag' || key === 'origin_lan2_flag') {
            onLayoutPatch({ flag_element_style: { ...(layout.flag_element_style ?? DEFAULT_FLAG_ES), ...patch } } as Partial<CardLayout>);
        }
    }
    function setLayoutField(field: keyof CardLayout | undefined, value: unknown) {
        if (!field)
            return;
        onLayoutPatch({ [field]: value } as Partial<CardLayout>);
    }
    function focusInspectorSection(section: 'typography' | 'color' | 'background' | 'border' | 'radius') {
        setToolbarMenu(null);
        window.dispatchEvent(new CustomEvent('lc-inspector-focus-section', { detail: { section } }));
    }
    function toggleToolbarMenu(target: ToolbarTarget, panel: ToolbarMenuPanel) {
        setToolbarMenu(prev => prev?.target === target && prev.panel === panel ? null : { target, panel });
    }
    function isToolbarMenuOpen(target: ToolbarTarget, panel: ToolbarMenuPanel) {
        return toolbarMenu?.target === target && toolbarMenu.panel === panel;
    }
    const toolbarButton = (icon: string, title: string, action: () => void, active = false, disabled = false) => (<button type="button" className={active ? 'active' : ''} title={title} aria-label={title} disabled={disabled} onClick={e => {
            e.stopPropagation();
            action();
        }}>
        <span className="material-symbol" aria-hidden="true">{icon}</span>
      </button>);
    const toolbarGroup = (target: ToolbarTarget, panel: ToolbarMenuPanel, label: string, icon: string, children: React.ReactNode, className = '') => {
        const open = isToolbarMenuOpen(target, panel);
        return (<div className={`lc-toolbar-group ${className}${open ? ' open' : ''}`} aria-label={label}>
          <button type="button" className="lc-toolbar-group-trigger" title={label} aria-label={label} aria-expanded={open} onClick={e => {
                e.stopPropagation();
                toggleToolbarMenu(target, panel);
            }}>
            <span className="material-symbol" aria-hidden="true">{icon}</span>
            <span className="lc-toolbar-group-caret material-symbol" aria-hidden="true">expand_more</span>
          </button>
          {open && (<div className={`lc-toolbar-menu${className.includes('lc-toolbar-group--panel') ? ' lc-toolbar-menu--panel' : ''}${className.includes('lc-toolbar-group--wide-menu') ? ' lc-toolbar-menu--wide' : ''}`} role="menu" aria-label={label}>
              <div className="lc-toolbar-menu-title">{label}</div>
              {children}
            </div>)}
        </div>);
    };
    const miniRange = (label: string, value: number, min: number, max: number, step: number, unit: string, onChange: (value: number) => void) => (<label className="lc-toolbar-field lc-toolbar-field--range">
        <span>{label}</span>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/>
        <em>{Number(value.toFixed(1))}{unit}</em>
      </label>);
    const miniColor = (label: string, value: string, onChange: (value: string) => void) => (<div className="lc-toolbar-field lc-toolbar-field--color">
        <span>{label}</span>
        <ColorSwatch value={value} onChange={onChange}/>
      </div>);
    const miniSegment = <T extends string>(label: string, current: T | undefined, options: { value: T; icon: string; title: string }[], onPick: (value: T) => void) => (<div className="lc-toolbar-field">
        <span>{label}</span>
        <div className="lc-toolbar-segment">
          {options.map(option => toolbarButton(option.icon, option.title, () => onPick(option.value), current === option.value))}
        </div>
      </div>);
    function renderTypographyPanel(key: ElemKey) {
        const es = getToolbarES(key);
        const sizeField = textSizeFields[key];
        const colorField = textColorFields[key];
        const size = Number(sizeField ? (layout[sizeField] ?? (key === 'current_price' ? 17 : 12)) : 12);
        const color = String(colorField ? (layout[colorField] ?? '#ffffff') : '#ffffff');
        if (!es && !sizeField && !colorField) {
            return <button type="button" className="lc-toolbar-text-btn" onClick={() => focusInspectorSection('typography')}>Open typography</button>;
        }
        return (<div className="lc-toolbar-panel-stack">
          {sizeField && miniRange('Font size', size, 8, key === 'current_price' || key === 'old_price' ? 48 : 64, 1, 'px', value => setLayoutField(sizeField, value))}
          {es && (<div className="lc-toolbar-segment lc-toolbar-style-segment">
              {toolbarButton('format_bold', 'Bold', () => patchToolbarES(key, { bold: !es.bold }), !!es.bold)}
              {toolbarButton('format_italic', 'Italic', () => patchToolbarES(key, { italic: !es.italic }), !!es.italic)}
            </div>)}
          {es && miniSegment('Align', es.align, [
                { value: 'left', icon: 'format_align_left', title: 'Align left' },
                { value: 'center', icon: 'format_align_center', title: 'Align center' },
                { value: 'right', icon: 'format_align_right', title: 'Align right' },
            ], value => patchToolbarES(key, { align: value as TextAlign }))}
          {es && miniSegment('Vertical', es.valign ?? 'top', [
                { value: 'top', icon: 'vertical_align_top', title: 'Align top' },
                { value: 'middle', icon: 'vertical_align_center', title: 'Align middle' },
                { value: 'bottom', icon: 'vertical_align_bottom', title: 'Align bottom' },
            ], value => patchToolbarES(key, { valign: value as TextVAlign }))}
          {colorField && miniColor('Text color', color, value => setLayoutField(colorField, value))}
        </div>);
    }
    function renderBackgroundPanel(key: ElemKey) {
        const es = getToolbarES(key);
        if (!es)
            return <button type="button" className="lc-toolbar-text-btn" onClick={() => focusInspectorSection('background')}>Open background</button>;
        return (<div className="lc-toolbar-panel-stack">
          {miniColor('Color', es.bg || '#ffffff', value => patchToolbarES(key, { bg: value, bg_opacity: es.bg_opacity ?? 0.25 }))}
          {miniRange('Opacity', es.bg_opacity ?? 0.25, 0, 1, 0.05, '', value => patchToolbarES(key, { bg_opacity: value }))}
          <button type="button" className="lc-toolbar-text-btn" onClick={() => patchToolbarES(key, { bg: '', bg_opacity: 0 })}>Transparent</button>
        </div>);
    }
    function renderBorderPanel(key: ElemKey) {
        if (key === 'image') {
            const width = Number(layout.image_border_width ?? 0);
            return (<div className="lc-toolbar-panel-stack">
              {miniRange('Width', width, 0, 16, 1, 'px', value => setLayoutField('image_border_width', value))}
              {miniSegment('Style', (layout.image_border_style ?? 'solid') as string, [
                    { value: 'solid', icon: 'horizontal_rule', title: 'Solid' },
                    { value: 'dashed', icon: 'more_horiz', title: 'Dashed' },
                    { value: 'dotted', icon: 'blur_linear', title: 'Dotted' },
                ], value => setLayoutField('image_border_style', value))}
              {miniColor('Color', layout.image_border_color ?? '#49f2b6', value => setLayoutField('image_border_color', value))}
            </div>);
        }
        const es = getToolbarES(key);
        if (!es)
            return <button type="button" className="lc-toolbar-text-btn" onClick={() => focusInspectorSection('border')}>Open border</button>;
        const width = es.border_width ?? 0;
        return (<div className="lc-toolbar-panel-stack">
          {miniRange('Width', width, 0, 20, 1, 'px', value => patchToolbarES(key, { border_width: value, border_top: value, border_right: value, border_bottom: value, border_left: value }))}
          {miniSegment('Style', es.border_style ?? 'solid', [
                { value: 'solid', icon: 'horizontal_rule', title: 'Solid' },
                { value: 'dashed', icon: 'more_horiz', title: 'Dashed' },
                { value: 'dotted', icon: 'blur_linear', title: 'Dotted' },
            ], value => patchToolbarES(key, { border_style: value as TextElementStyle['border_style'] }))}
          {miniColor('Color', es.border_color ?? '#49f2b6', value => patchToolbarES(key, { border_color: value }))}
        </div>);
    }
    function renderRadiusPanel(key: ElemKey) {
        if (key === 'image') {
            const mode = layout.image_radius_mode ?? 'all';
            const radius = Number(layout.image_radius ?? layout.image_radius_tl ?? 0);
            const corners = [
                ['TL', 'image_radius_tl', layout.image_radius_tl ?? radius],
                ['TR', 'image_radius_tr', layout.image_radius_tr ?? radius],
                ['BR', 'image_radius_br', layout.image_radius_br ?? radius],
                ['BL', 'image_radius_bl', layout.image_radius_bl ?? radius],
            ] as const;
            return (<div className="lc-toolbar-panel-stack">
              <div className="lc-toolbar-segment">
                <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => {
                    const value = layout.image_radius_tl ?? radius;
                    onLayoutPatch({ image_radius_mode: 'all', image_radius: value, image_radius_tl: value, image_radius_tr: value, image_radius_br: value, image_radius_bl: value });
                }}>All</button>
                <button type="button" className={mode === 'each' ? 'active' : ''} onClick={() => {
                    const value = layout.image_radius ?? radius;
                    onLayoutPatch({ image_radius_mode: 'each', image_radius_tl: layout.image_radius_tl ?? value, image_radius_tr: layout.image_radius_tr ?? value, image_radius_br: layout.image_radius_br ?? value, image_radius_bl: layout.image_radius_bl ?? value });
                }}>Each</button>
              </div>
              {mode === 'all' ? miniRange('Radius', radius, 0, 64, 1, 'px', value => onLayoutPatch({ image_radius_mode: 'all', image_radius: value, image_radius_tl: value, image_radius_tr: value, image_radius_br: value, image_radius_bl: value })) : (<div className="lc-toolbar-corner-grid">
                {corners.map(([label, field, value]) => (<label key={field} className="lc-toolbar-corner-field">
                  <span>{label}</span>
                  <input type="range" min={0} max={64} step={1} value={value} onChange={e => onLayoutPatch({ [field]: Number(e.target.value) } as Partial<CardLayout>)}/>
                  <em>{value}px</em>
                </label>))}
              </div>)}
            </div>);
        }
        const es = getToolbarES(key);
        if (!es)
            return <button type="button" className="lc-toolbar-text-btn" onClick={() => focusInspectorSection('radius')}>Open radius</button>;
        const mode = es.radius_mode ?? 'all';
        const radius = es.radius ?? es.radius_tl ?? 0;
        const corners = [
            ['TL', 'radius_tl', es.radius_tl ?? radius],
            ['TR', 'radius_tr', es.radius_tr ?? radius],
            ['BR', 'radius_br', es.radius_br ?? radius],
            ['BL', 'radius_bl', es.radius_bl ?? radius],
        ] as const;
        return (<div className="lc-toolbar-panel-stack">
          <div className="lc-toolbar-segment">
            <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => {
                const value = es.radius_tl ?? radius;
                patchToolbarES(key, { radius_mode: 'all', radius: value, radius_tl: value, radius_tr: value, radius_br: value, radius_bl: value });
            }}>All</button>
            <button type="button" className={mode === 'each' ? 'active' : ''} onClick={() => {
                const value = es.radius ?? radius;
                patchToolbarES(key, { radius_mode: 'each', radius_tl: es.radius_tl ?? value, radius_tr: es.radius_tr ?? value, radius_br: es.radius_br ?? value, radius_bl: es.radius_bl ?? value });
            }}>Each</button>
          </div>
          {mode === 'all' ? miniRange('Radius', radius, 0, 64, 1, 'px', value => patchToolbarES(key, { radius_mode: 'all', radius: value, radius_tl: value, radius_tr: value, radius_br: value, radius_bl: value })) : (<div className="lc-toolbar-corner-grid">
            {corners.map(([label, field, value]) => (<label key={field} className="lc-toolbar-corner-field">
              <span>{label}</span>
              <input type="range" min={0} max={64} step={1} value={value} onChange={e => patchToolbarES(key, { [field]: Number(e.target.value) } as Partial<TextElementStyle>)}/>
              <em>{value}px</em>
            </label>))}
          </div>)}
        </div>);
    }
    function renderLinkPanel() {
        const iconKey = layout.url_icon ?? 'arrow';
        return (<div className="lc-toolbar-panel-stack">
          <label className="lc-toolbar-field lc-toolbar-field--text">
            <span>Link text</span>
            <input type="text" maxLength={60} value={layout.url_text ?? 'View product'} onChange={e => setLayoutField('url_text', e.target.value)} placeholder="View product"/>
          </label>
          <label className="lc-toolbar-check">
            <span>Show text</span>
            <Toggle checked={layout.url_show_text ?? true} onChange={value => setLayoutField('url_show_text', value)}/>
          </label>
          <div className="lc-toolbar-field">
            <span>Icon</span>
            <div className="lc-icon-grid lc-icon-grid--toolbar">
              {LINK_ICONS.map(ic => (<button key={ic.key} type="button" title={ic.label} className={`lc-icon-btn${iconKey === ic.key ? ' active' : ''}`} onClick={() => setLayoutField('url_icon', ic.key)}>
                {ic.key === 'none' ? '∅' : ic.key === 'custom' ? '+' : ic.path ? (<svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ic.path}/></svg>) : ic.label}
              </button>))}
            </div>
          </div>
          {iconKey === 'custom' && (<>
            <label className="lc-toolbar-field lc-toolbar-field--text">
              <span>Custom icon</span>
              <input type="text" maxLength={10} value={layout.url_custom_icon ?? ''} onChange={e => setLayoutField('url_custom_icon', e.target.value)} placeholder="→ or emoji"/>
            </label>
            <div className="lc-toolbar-field">
              <span>Upload icon</span>
              <UploadIconBtn current={layout.url_icon_url ?? ''} onChange={url => setLayoutField('url_icon_url', url)}/>
            </div>
          </>)}
          {miniRange('Icon size', layout.url_icon_size ?? 16, 8, 48, 1, 'px', value => setLayoutField('url_icon_size', value))}
          <label className="lc-toolbar-check">
            <span>Icon color</span>
            <Toggle checked={!!layout.url_icon_color} onChange={value => setLayoutField('url_icon_color', value ? (layout.url_color ?? '#49f2b6') : '')}/>
          </label>
          {layout.url_icon_color && miniColor('Icon color', layout.url_icon_color, value => setLayoutField('url_icon_color', value))}
        </div>);
    }
    function renderBadgePanel() {
        const showBg = layout.badge_show_bg ?? true;
        return (<div className="lc-toolbar-panel-stack">
          <div className="lc-toolbar-field">
            <span>Show as</span>
            <div className="lc-toolbar-segment">
              <button type="button" className={(layout.badge_display_mode ?? 'percent') === 'percent' ? 'active' : ''} onClick={() => setLayoutField('badge_display_mode', 'percent')}>%</button>
              <button type="button" className={(layout.badge_display_mode ?? 'percent') === 'amount' ? 'active' : ''} onClick={() => setLayoutField('badge_display_mode', 'amount')}>$</button>
            </div>
          </div>
          <label className="lc-toolbar-check">
            <span>Show bg</span>
            <Toggle checked={showBg} onChange={value => setLayoutField('badge_show_bg', value)}/>
          </label>
          {showBg && (<>
            {miniColor('Badge color', layout.badge_color ?? '#ff5c5c', value => setLayoutField('badge_color', value))}
            {miniRange('Radius', layout.badge_radius ?? 20, 0, 50, 1, 'px', value => setLayoutField('badge_radius', value))}
          </>)}
        </div>);
    }
    function cardGradientColors() {
        const matches = layout.card_background.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
        return {
            color1: matches?.[0] ?? (layout.card_bg_type === 'gradient' ? '#ffffff' : layout.card_background),
            color2: layout.card_bg_color2 ?? matches?.[1] ?? '#ffffff',
        };
    }
    function setCardBackgroundMode(type: 'solid' | 'gradient') {
        const { color1, color2 } = cardGradientColors();
        const angle = layout.card_bg_gradient_angle ?? 135;
        onLayoutPatch({
            card_bg_type: type,
            card_background: type === 'gradient' ? `linear-gradient(${angle}deg, ${color1}, ${color2})` : color1,
            card_bg_color2: color2,
        });
    }
    function renderCardBackgroundPanel() {
        const mode = layout.card_bg_type ?? 'solid';
        const { color1, color2 } = cardGradientColors();
        return (<div className="lc-toolbar-panel-stack">
          <div className="lc-toolbar-segment">
            <button type="button" className={mode === 'solid' ? 'active' : ''} onClick={() => setCardBackgroundMode('solid')}>Solid</button>
            <button type="button" className={mode === 'gradient' ? 'active' : ''} onClick={() => setCardBackgroundMode('gradient')}>Gradient</button>
          </div>
          {mode === 'gradient' ? (<>
            {miniColor('Color 1', color1, value => {
                    const angle = layout.card_bg_gradient_angle ?? 135;
                    onLayoutPatch({ card_background: `linear-gradient(${angle}deg, ${value}, ${color2})` });
                })}
            {miniColor('Color 2', color2, value => {
                    const angle = layout.card_bg_gradient_angle ?? 135;
                    onLayoutPatch({ card_bg_color2: value, card_background: `linear-gradient(${angle}deg, ${color1}, ${value})` });
                })}
            {miniRange('Angle', layout.card_bg_gradient_angle ?? 135, 0, 360, 1, 'deg', value => onLayoutPatch({ card_bg_gradient_angle: value, card_background: `linear-gradient(${value}deg, ${color1}, ${color2})` }))}
          </>) : miniColor('Color', color1, value => onLayoutPatch({ card_background: value }))}
          <button type="button" className={`lc-toolbar-text-btn${layout.card_shadow ? ' active' : ''}`} onClick={() => onLayoutPatch({ card_shadow: !layout.card_shadow })}>
            {layout.card_shadow ? 'Shadow on' : 'Shadow off'}
          </button>
        </div>);
    }
    function renderCardBorderPanel() {
        const width = layout.card_border_width ?? 0;
        const sides = [
            ['T', 'card_border_top', layout.card_border_top ?? width],
            ['R', 'card_border_right', layout.card_border_right ?? width],
            ['B', 'card_border_bottom', layout.card_border_bottom ?? width],
            ['L', 'card_border_left', layout.card_border_left ?? width],
        ] as const;
        return (<div className="lc-toolbar-panel-stack">
          {miniRange('Width', width, 0, 20, 1, 'px', value => onLayoutPatch({ card_border_width: value, card_border_top: value, card_border_right: value, card_border_bottom: value, card_border_left: value }))}
          {miniSegment('Style', (layout.card_border_style ?? 'solid') as string, [
                { value: 'solid', icon: 'horizontal_rule', title: 'Solid' },
                { value: 'dashed', icon: 'more_horiz', title: 'Dashed' },
                { value: 'dotted', icon: 'blur_linear', title: 'Dotted' },
            ], value => onLayoutPatch({ card_border_style: value as CardLayout['card_border_style'] }))}
          {miniColor('Color', layout.card_border_color ?? '#49f2b6', value => onLayoutPatch({ card_border_color: value }))}
          <div className="lc-toolbar-side-grid">
            {sides.map(([label, field, value]) => (<label key={field} className="lc-toolbar-side-field">
              <span>{label}</span>
              <input type="range" min={0} max={20} step={1} value={value} onChange={e => onLayoutPatch({ [field]: Number(e.target.value) } as Partial<CardLayout>)}/>
              <em>{value}px</em>
            </label>))}
          </div>
        </div>);
    }
    function renderCardRadiusPanel() {
        const mode = layout.card_radius_mode ?? 'all';
        const radius = layout.card_border_radius ?? layout.card_radius_tl ?? 16;
        const corners = [
            ['TL', 'card_radius_tl', layout.card_radius_tl ?? radius],
            ['TR', 'card_radius_tr', layout.card_radius_tr ?? radius],
            ['BR', 'card_radius_br', layout.card_radius_br ?? radius],
            ['BL', 'card_radius_bl', layout.card_radius_bl ?? radius],
        ] as const;
        return (<div className="lc-toolbar-panel-stack">
          <div className="lc-toolbar-segment">
            <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => {
                const value = layout.card_radius_tl ?? radius;
                onLayoutPatch({ card_radius_mode: 'all', card_border_radius: value, card_radius_tl: value, card_radius_tr: value, card_radius_br: value, card_radius_bl: value });
            }}>All</button>
            <button type="button" className={mode === 'each' ? 'active' : ''} onClick={() => {
                const value = layout.card_border_radius ?? radius;
                onLayoutPatch({ card_radius_mode: 'each', card_radius_tl: layout.card_radius_tl ?? value, card_radius_tr: layout.card_radius_tr ?? value, card_radius_br: layout.card_radius_br ?? value, card_radius_bl: layout.card_radius_bl ?? value });
            }}>Each</button>
          </div>
          {mode === 'all' ? miniRange('Radius', radius, 0, 64, 1, 'px', value => onLayoutPatch({ card_radius_mode: 'all', card_border_radius: value, card_radius_tl: value, card_radius_tr: value, card_radius_br: value, card_radius_bl: value })) : (<div className="lc-toolbar-corner-grid">
            {corners.map(([label, field, value]) => (<label key={field} className="lc-toolbar-corner-field">
              <span>{label}</span>
              <input type="range" min={0} max={64} step={1} value={value} onChange={e => onLayoutPatch({ [field]: Number(e.target.value) } as Partial<CardLayout>)}/>
              <em>{value}px</em>
            </label>))}
          </div>)}
        </div>);
    }
    function updateToolbarPositions() {
        const next: Partial<Record<ElemKey, ToolbarPosition>> = {};
        selected.forEach(key => {
            const el = document.querySelector<HTMLElement>(`[data-lc-elem-key="${key}"]`);
            if (!el)
                return;
            const rect = el.getBoundingClientRect();
            const estimatedToolbarHeight = 112;
            const margin = 12;
            const placeBelow = rect.top < estimatedToolbarHeight + margin;
            next[key] = {
                left: Math.max(margin, Math.min(window.innerWidth - margin, rect.left + rect.width / 2)),
                top: placeBelow ? Math.min(window.innerHeight - margin, rect.bottom + margin) : Math.max(margin, rect.top - margin),
                placeBelow,
            };
        });
        if (cardToolbarOpen && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const estimatedToolbarHeight = 112;
            const margin = 12;
            const placeBelow = rect.top < estimatedToolbarHeight + margin;
            setCardToolbarPosition({
                left: Math.max(margin, Math.min(window.innerWidth - margin, rect.left + rect.width / 2)),
                top: placeBelow ? Math.min(window.innerHeight - margin, rect.bottom + margin) : Math.max(margin, rect.top - margin),
                placeBelow,
            });
        }
        else {
            setCardToolbarPosition(null);
        }
        setToolbarPositions(next);
    }
    function renderCardFloatingToolbar() {
        if (typeof document === 'undefined' || !cardToolbarOpen || !cardToolbarPosition)
            return null;
        return createPortal(<div className={`lc-floating-toolbar lc-floating-toolbar--fixed${cardToolbarPosition.placeBelow ? ' lc-floating-toolbar--below' : ''}`} style={{ left: cardToolbarPosition.left, top: cardToolbarPosition.top } as React.CSSProperties} onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                {toolbarGroup(CARD_TOOLBAR_TARGET, 'background', 'Background', 'format_color_fill', renderCardBackgroundPanel(), 'lc-toolbar-group--panel')}
                {toolbarGroup(CARD_TOOLBAR_TARGET, 'border', 'Border', 'border_outer', renderCardBorderPanel(), 'lc-toolbar-group--panel')}
                {toolbarGroup(CARD_TOOLBAR_TARGET, 'radius', 'Radius', 'rounded_corner', renderCardRadiusPanel(), 'lc-toolbar-group--panel')}
              </div>, document.body);
    }
    function renderFloatingToolbar(key: ElemKey, isLocked: boolean) {
        if (typeof document === 'undefined' || hasMultiSelection)
            return null;
        const toolbarPos = toolbarPositions[key];
        if (!toolbarPos)
            return null;
        return createPortal(<div className={`lc-floating-toolbar lc-floating-toolbar--fixed${toolbarPos.placeBelow ? ' lc-floating-toolbar--below' : ''}`} style={{ left: toolbarPos.left, top: toolbarPos.top } as React.CSSProperties} onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                {toolbarButton('undo', 'Undo', onUndo, false, !canUndo)}
                {toolbarButton('redo', 'Redo', onRedo, false, !canRedo)}
                {toolbarGroup(key, 'arrange', 'Arrange', 'dashboard_customize', <>
                  {toolbarButton('align_horizontal_left', 'Align left', () => onAlign('left'))}
                  {toolbarButton('align_horizontal_center', 'Align center', () => onAlign('center_h'))}
                  {toolbarButton('align_horizontal_right', 'Align right', () => onAlign('right'))}
                  {toolbarButton('align_vertical_top', 'Align top', () => onAlign('top'))}
                  {toolbarButton('align_vertical_center', 'Align middle', () => onAlign('center_v'))}
                  {toolbarButton('align_vertical_bottom', 'Align bottom', () => onAlign('bottom'))}
                  {toolbarButton('keyboard_double_arrow_left', 'Snap left', () => onSnap('snap_left'))}
                  {toolbarButton('keyboard_double_arrow_right', 'Snap right', () => onSnap('snap_right'))}
                  {toolbarButton('flip_to_front', 'Bring forward', () => onZOrder('forward'))}
                  {toolbarButton('flip_to_back', 'Send backward', () => onZOrder('backward'))}
                  {toolbarButton('select_all', 'Group selected', onGroup, false, !canGroup)}
                  {toolbarButton('tab_unselected', 'Ungroup selected', onUngroup, false, !selInGroup)}
                </>, 'lc-toolbar-group--wide-menu')}
                {toolbarGroup(key, 'typography', 'Typography', 'text_fields', renderTypographyPanel(key), 'lc-toolbar-group--panel')}
                {key === 'product_url' && toolbarGroup(key, 'link', 'Link', 'link', renderLinkPanel(), 'lc-toolbar-group--panel')}
                {key === 'discount_badge' && toolbarGroup(key, 'badge', 'Badge', 'sell', renderBadgePanel(), 'lc-toolbar-group--panel')}
                {toolbarGroup(key, 'background', 'Background', 'format_color_fill', renderBackgroundPanel(key), 'lc-toolbar-group--panel')}
                {toolbarGroup(key, 'border', 'Border', 'border_outer', renderBorderPanel(key), 'lc-toolbar-group--panel')}
                {toolbarGroup(key, 'radius', 'Radius', 'rounded_corner', renderRadiusPanel(key), 'lc-toolbar-group--panel')}
                <button type="button" title={isLocked ? 'Unlock element' : 'Lock element'} onClick={() => onToggleLock(key)}>
                  <span className="material-symbol" aria-hidden="true">{isLocked ? 'lock_open' : 'lock'}</span>
                </button>
                <button type="button" className="lc-floating-toolbar-delete" title="Hide element" onClick={() => onHideElement(key)}>
                  <span className="material-symbol" aria-hidden="true">delete</span>
                </button>
              </div>, document.body);
    }
    useEffect(() => {
        setToolbarMenu(prev => {
            if (!prev)
                return null;
            if (hasMultiSelection)
                return null;
            if (prev.target === CARD_TOOLBAR_TARGET)
                return cardToolbarOpen ? prev : null;
            return selected.has(prev.target) ? prev : null;
        });
    }, [selected, cardToolbarOpen, hasMultiSelection]);
    useEffect(() => {
        let frame = window.requestAnimationFrame(updateToolbarPositions);
        const schedule = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(updateToolbarPositions);
        };
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
        };
    }, [selected, positions, canvasZoom, toolbarMenu, cardToolbarOpen, layout.card_background, layout.card_border_width, layout.card_border_radius]);
    useEffect(() => {
        function onDocumentPointerDown(e: PointerEvent) {
            if (!selected.size && !cardToolbarOpen)
                return;
            const target = e.target as HTMLElement | null;
            if (!target)
                return;
            if (target.closest('.lc-floating-toolbar') || target.closest('.lc-align-toolbar') || target.closest('.lc-toolbar-col') || target.closest('.cs-popover') || target.closest('[data-lc-elem-key]'))
                return;
            setToolbarMenu(null);
            setSelected(new Set());
            setCardToolbarOpen(false);
        }
        document.addEventListener('pointerdown', onDocumentPointerDown);
        return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
    }, [selected, setSelected, cardToolbarOpen]);
    useEffect(() => {
        if (!canvasRef.current)
            return;
        const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect.width;
            if (w && w > 0)
                setCanvasW(w);
        });
        ro.observe(canvasRef.current);
        return () => ro.disconnect();
    }, []);
    function isElemKey(value: string): value is ElemKey {
        return (ALL_KEYS as string[]).includes(value);
    }
    function getGroupItems(key: string): {
        elemKeys: ElemKey[];
        shapeIds: string[];
    } {
        const g = elemGroups.find(gr => gr.includes(key));
        if (!g)
            return { elemKeys: [], shapeIds: [] };
        return {
            elemKeys: g.filter(isElemKey),
            shapeIds: g.filter(item => !isElemKey(item)),
        };
    }
    function startInteraction(e: React.MouseEvent | React.PointerEvent, key: ElemKey, mode: 'move' | 'resize' | 'rotate') {
        e.preventDefault();
        e.stopPropagation();
        if (lockedSet.has(key)) {
            setSelected(new Set([key]));
            setSelectedShapeIds(new Set());
            setCardToolbarOpen(false);
            return;
        }
        setCardToolbarOpen(false);
        if (mode === 'rotate') {
            const element = (e.currentTarget as HTMLElement).closest('.lc-elem') as HTMLElement | null;
            const elementRect = element?.getBoundingClientRect();
            const startPositions: Partial<Record<ElemKey, CardElementPos>> = {
                [key]: { ...(positions[key] ?? DEFAULT_POSITIONS[key]!) },
            };
            const centerX = elementRect ? elementRect.left + elementRect.width / 2 : e.clientX;
            const centerY = elementRect ? elementRect.top + elementRect.height / 2 : e.clientY;
            dragging.current = {
                keys: [key],
                shapeIds: [],
                mode,
                pivotKey: key,
                startX: e.clientX,
                startY: e.clientY,
                startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI,
                elementRect,
                startPositions,
                startShapes: {},
            };
            setSelected(new Set([key]));
            setSelectedShapeIds(new Set());
            return;
        }
        if (e.shiftKey) {
            setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
            return;
        }
        /* expand selection to grouped partners */
        let keys: ElemKey[];
        let shapeIds: string[] = [];
        if (selected.has(key) && (selected.size + selectedShapeIds.size) > 1 && mode === 'move') {
            keys = Array.from(selected).filter(k => !lockedSet.has(k));
            shapeIds = Array.from(selectedShapeIds);
            setSelected(new Set([key]));
            setSelectedShapeIds(new Set());
        }
        else {
            const group = getGroupItems(key);
            const groupKeys = group.elemKeys.filter(k => !lockedSet.has(k));
            const groupShapeIds = group.shapeIds;
            keys = groupKeys.length + groupShapeIds.length > 1 ? groupKeys : [key];
            shapeIds = groupKeys.length + groupShapeIds.length > 1 ? groupShapeIds : [];
            if (groupKeys.length + groupShapeIds.length > 1) {
                setSelected(new Set([key]));
                setSelectedShapeIds(new Set());
            }
            else if (!selected.has(key)) {
                setSelected(new Set([key]));
                setSelectedShapeIds(new Set());
            }
        }
        const startPositions: Partial<Record<ElemKey, CardElementPos>> = {};
        for (const k of keys)
            startPositions[k] = { ...(positions[k] ?? DEFAULT_POSITIONS[k]!) };
        const startShapes: Record<string, CardShape> = {};
        for (const id of shapeIds) {
            const shape = (layout.shapes ?? []).find(s => s.id === id);
            if (shape)
                startShapes[id] = { ...shape };
        }
        dragging.current = { keys, shapeIds, mode, pivotKey: key, startX: e.clientX, startY: e.clientY, startPositions, startShapes };
    }
    function startShapeInteraction(e: React.MouseEvent, shape: CardShape, mode: 'move' | 'resize') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
            setSelectedShapeIds(prev => {
                const next = new Set(prev);
                next.has(shape.id) ? next.delete(shape.id) : next.add(shape.id);
                return next;
            });
            return;
        }
        setCardToolbarOpen(false);
        let shapeIds: string[];
        let elemKeys: ElemKey[];
        if (selectedShapeIds.has(shape.id) && (selectedShapeIds.size + selected.size) > 1 && mode === 'move') {
            shapeIds = Array.from(selectedShapeIds);
            elemKeys = Array.from(selected);
        }
        else {
            const group = getGroupItems(shape.id);
            if (group.elemKeys.length + group.shapeIds.length > 1) {
                shapeIds = group.shapeIds;
                elemKeys = group.elemKeys.filter(k => !lockedSet.has(k));
                setSelected(new Set(elemKeys));
                setSelectedShapeIds(new Set(shapeIds));
            }
            else {
                shapeIds = [shape.id];
                elemKeys = [];
                setSelected(new Set());
                setSelectedShapeIds(new Set([shape.id]));
            }
        }
        const startShapes: Record<string, CardShape> = {};
        for (const id of shapeIds) {
            const s = (layout.shapes ?? []).find(item => item.id === id);
            if (s)
                startShapes[id] = { ...s };
        }
        const startPositions: Partial<Record<ElemKey, CardElementPos>> = {};
        for (const k of elemKeys)
            startPositions[k] = { ...(positions[k] ?? DEFAULT_POSITIONS[k]!) };
        shapeDrag.current = { id: shape.id, shapeIds, elemKeys, mode, startX: e.clientX, startY: e.clientY, startShape: { ...shape }, startShapes, startPositions };
    }
    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            if (shapeDrag.current && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                let dx = (e.clientX - shapeDrag.current.startX) / rect.width * 100;
                let dy = (e.clientY - shapeDrag.current.startY) / rect.height * 100;
                if (e.shiftKey && shapeDrag.current.mode === 'move') {
                    if (Math.abs(dx) >= Math.abs(dy))
                        dy = 0;
                    else
                        dx = 0;
                }
                const s = shapeDrag.current.startShape;
                if (shapeDrag.current.mode === 'move') {
                    for (const id of shapeDrag.current.shapeIds) {
                        const ss = shapeDrag.current.startShapes[id];
                        if (ss)
                            onShapeChange(id, {
                                x: clamp(ss.x + dx, 0, 100 - ss.w),
                                y: clamp(ss.y + dy, 0, 100 - ss.h),
                            });
                    }
                    if (shapeDrag.current.elemKeys.length) {
                        const upd: Partial<Record<ElemKey, CardElementPos>> = {};
                        for (const k of shapeDrag.current.elemKeys) {
                            const sp = shapeDrag.current.startPositions[k]!;
                            upd[k] = { ...sp, x: clamp(sp.x + dx, 0, 100 - sp.w), y: clamp(sp.y + dy, 0, 100 - sp.h) };
                        }
                        onMultiPosChange(upd);
                    }
                }
                else {
                    onShapeChange(shapeDrag.current.id, {
                        w: clamp(s.w + dx, 2, 100 - s.x),
                        h: clamp(s.h + dy, s.type === 'line' ? 1 : 2, 100 - s.y),
                    });
                }
                return;
            }
            if (!dragging.current || !canvasRef.current)
                return;
            const rect = canvasRef.current.getBoundingClientRect();
            let dx = (e.clientX - dragging.current.startX) / rect.width * 100;
            let dy = (e.clientY - dragging.current.startY) / rect.height * 100;
            // Shift-key: constrain to the dominant axis (straight-line drag)
            if (e.shiftKey && dragging.current.mode === 'move') {
                if (Math.abs(dx) >= Math.abs(dy))
                    dy = 0;
                else
                    dx = 0;
            }
            const { keys, shapeIds, mode, pivotKey, startPositions, startShapes } = dragging.current;
            if (mode === 'rotate') {
                const sp = startPositions[pivotKey]!;
                const elementRect = dragging.current.elementRect;
                const centerX = elementRect ? elementRect.left + elementRect.width / 2 : dragging.current.startX;
                const centerY = elementRect ? elementRect.top + elementRect.height / 2 : dragging.current.startY;
                const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
                const deltaAngle = currentAngle - (dragging.current.startAngle ?? currentAngle);
                const rotation = Math.round((sp.rotation ?? 0) + deltaAngle);
                onPosChange(pivotKey, { ...sp, rotation });
                return;
            }
            if (mode === 'move') {
                if (keys.length === 1) {
                    const sp = startPositions[keys[0]]!;
                    onPosChange(keys[0], { ...sp, x: clamp(sp.x + dx, 0, 100 - sp.w), y: clamp(sp.y + dy, 0, 100 - sp.h) });
                }
                else {
                    const upd: Partial<Record<ElemKey, CardElementPos>> = {};
                    for (const k of keys) {
                        const sp = startPositions[k]!;
                        upd[k] = { ...sp, x: clamp(sp.x + dx, 0, 100 - sp.w), y: clamp(sp.y + dy, 0, 100 - sp.h) };
                    }
                    onMultiPosChange(upd);
                }
                for (const id of shapeIds) {
                    const ss = startShapes[id];
                    if (ss)
                        onShapeChange(id, {
                            x: clamp(ss.x + dx, 0, 100 - ss.w),
                            y: clamp(ss.y + dy, 0, 100 - ss.h),
                        });
                }
            }
            else {
                const sp = startPositions[pivotKey]!;
                onPosChange(pivotKey, { ...sp, w: clamp(sp.w + dx, 5, 100 - sp.x), h: clamp(sp.h + dy, 3, 100 - sp.y) });
            }
        }
        function onMouseUp() { dragging.current = null; shapeDrag.current = null; }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
    }, [onPosChange, onMultiPosChange, onShapeChange]);
    return (<div className={cx("lc-canvas", cssClass({
            background: layout.card_background,
            borderRadius: cardBorderRadius(layout),
            boxShadow: layout.card_shadow ? '0 8px 32px rgba(0,0,0,.45)' : 'none',
            paddingBottom: cardAspectRatio != null
                ? `${(1 / cardAspectRatio) * 100}%`
                : `${layout.card_height_ratio ?? 150}%`,
            /* expose canvas width as a CSS var so child elements can size relatively */
            ['--cw' as string]: `${canvasW}px`,
            ...(() => {
                const bw = layout.card_border_width ?? 0;
                if (bw > 0) {
                    return {
                        borderTopWidth: `${layout.card_border_top ?? bw}px`,
                        borderRightWidth: `${layout.card_border_right ?? bw}px`,
                        borderBottomWidth: `${layout.card_border_bottom ?? bw}px`,
                        borderLeftWidth: `${layout.card_border_left ?? bw}px`,
                        borderStyle: layout.card_border_style ?? 'solid',
                        borderColor: layout.card_border_color ?? '#49f2b6',
                    };
                }
                return { border: 'none' };
            })(),
            boxSizing: 'border-box',
        }))} ref={canvasRef} onMouseDown={e => {
            if (e.target === canvasRef.current) {
                setSelected(new Set());
                setSelectedShapeIds(new Set());
                setCardToolbarOpen(true);
            }
        }}>
      {renderCardFloatingToolbar()}
      {(layout.shapes ?? []).map(shape => (<div key={shape.id} className={cx(`lc-shape-preview${selectedShapeIds.has(shape.id) ? ' selected' : ''}`, cssClass({
                left: `${shape.x}%`,
                top: `${shape.y}%`,
                width: `${shape.w}%`,
                height: `${shape.h}%`,
                zIndex: shape.z ?? 30,
                transform: `rotate(${shape.rotation ?? 0}deg)`,
            }))} onMouseDown={e => startShapeInteraction(e, shape, 'move')} onClick={e => e.stopPropagation()} title={`${shape.type} shape`}>
          <ShapeSvg shape={shape}/>
          {selectedShapeIds.has(shape.id) && (<div className="lc-shape-resize-handle" onMouseDown={e => startShapeInteraction(e, shape, 'resize')} title="Drag to resize"/>)}
        </div>))}

      {/* Visible elements only */}
      {ALL_KEYS.filter(key => !!layout[SHOW_MAP[key]]).map(key => {
            const pos = positions[key] ?? DEFAULT_POSITIONS[key]!;
            const isSel = selected.has(key);
            const isLocked = lockedSet.has(key);
            const inGroup = elemGroups.some(g => g.includes(key));
            return (<div key={key} data-lc-elem-key={key} className={cx(`lc-elem${isSel ? ' selected' : ''}${isLocked ? ' lc-elem-locked' : ''}${inGroup ? ' lc-elem-grouped' : ''}`, cssClass({ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.w}%`, height: `${pos.h}%`, zIndex: pos.z ?? ALL_KEYS.indexOf(key) + 1, transform: `rotate(${pos.rotation ?? 0}deg)`, transformOrigin: 'center' }))} onMouseDown={e => startInteraction(e, key, 'move')} onClick={e => e.stopPropagation()} title={`${ELEM_LABELS[key]}${isLocked ? ' (locked)' : ''}${inGroup ? ' (grouped)' : ''}${!isSel ? ' · Shift+click to multi-select' : ''}`}>
            <ElemContent elemKey={key} layout={layout} canvasW={canvasW}/>
            {isLocked && (<div className="lc-elem-lock-badge" onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onToggleLock(key); }} title="Click to unlock">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>)}
            {inGroup && (<div className="lc-elem-group-badge" title="In group">
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/>
                  <rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/>
                </svg>
              </div>)}
            {isSel && renderFloatingToolbar(key, isLocked)}
            {isSel && !isLocked && <span className="lc-move-handle" title="Move" aria-label={`Move ${ELEM_LABELS[key]}`} onMouseDown={e => startInteraction(e, key, 'move')}>Move</span>}
            {isSel && !isLocked && <span className="lc-rotate-handle material-symbol" title="Rotate" aria-label={`Rotate ${ELEM_LABELS[key]}`} onMouseDown={e => startInteraction(e, key, 'rotate')}>rotate_right</span>}
            {isSel && !isLocked && <span className="lc-resize-handle" onMouseDown={e => startInteraction(e, key, 'resize')} title="Drag to resize"/>}
          </div>);
        })}
    </div>);
}
/* ── Element content (preview) ───────────────── */
function lcElemBorderRadius(es: TextElementStyle | undefined, scale = 1): string | number {
    if (!es)
        return 0;
    if (es.radius_mode === 'each') {
        const tl = (es.radius_tl ?? 0) * scale, tr = (es.radius_tr ?? 0) * scale, br = (es.radius_br ?? 0) * scale, bl = (es.radius_bl ?? 0) * scale;
        return `${tl}px ${tr}px ${br}px ${bl}px`;
    }
    return (es.radius ?? 3) * scale;
}
function applyElemTextStyle(es: TextElementStyle | undefined, color: string, fontSize: number, scale = 1, fontFamily?: string): React.CSSProperties {
    const fs = fontSize * scale;
    if (!es)
        return { color, fontSize: fs, lineHeight: 1.2, display: 'block', width: '100%', fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined };
    return {
        color,
        fontSize: es.script !== 'none' ? fs * 0.72 : fs,
        fontWeight: es.bold ? 700 : 400,
        fontStyle: es.italic ? 'italic' : 'normal',
        fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
        textTransform: es.transform === 'title_case' ? 'capitalize' : es.transform !== 'none' ? es.transform as React.CSSProperties['textTransform'] : undefined,
        verticalAlign: es.script === 'superscript' ? 'super' : es.script === 'subscript' ? 'sub' : undefined,
        textAlign: es.align,
        lineHeight: 1.2,
        display: 'block',
        width: '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
    };
}
function LcElemBorderSVG({ es }: {
    es: TextElementStyle | undefined;
}) {
    const w = es?.border_width ?? 0;
    if (!w || !es?.border_color)
        return null;
    const style = es.border_style ?? 'solid';
    if (style === 'solid')
        return null;
    const gap = es.border_gap ?? 4;
    const dashArray = style === 'dotted' ? `${w} ${gap}` : `${w * 3} ${gap}`;
    const rad = lcElemBorderRadius(es);
    const radStr = typeof rad === 'number' ? String(rad) : rad;
    const half = w / 2;
    return (<svg className={cssClass({ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' })}>
      <rect x={half} y={half} width={`calc(100% - ${w}px)`} height={`calc(100% - ${w}px)`} rx={radStr} ry={radStr} fill="none" stroke={es.border_color} strokeWidth={w} strokeDasharray={dashArray} strokeLinecap={style === 'dotted' ? 'round' : 'square'}/>
    </svg>);
}
function ElemContent({ elemKey, layout: l, canvasW }: {
    elemKey: ElemKey;
    layout: CardLayout;
    canvasW: number;
}) {
    /* scale factor: treat 280px canvas as 1× reference; everything scales proportionally */
    const scale = canvasW / 280;
    /* ── Flag elements ── */
    if (elemKey === 'origin_lan1_flag' || elemKey === 'origin_lan2_flag') {
        const fes = l.flag_element_style ?? DEFAULT_FLAG_ES;
        const sz = (l.flag_icon_size ?? 18) * scale;
        const color = l.flag_color ?? undefined;
        // Background
        const bgSolid = fes.bg ? hexToRgba(fes.bg, fes.bg_opacity ?? 0.15) : undefined;
        const bg = fes.bg_type === 'gradient' && fes.bg
            ? `linear-gradient(${fes.bg_gradient_angle ?? 135}deg, ${hexToRgba(fes.bg, fes.bg_opacity ?? 0.15)}, ${hexToRgba(fes.bg_color2 ?? '#ffffff', fes.bg_opacity ?? 0.15)})`
            : bgSolid;
        // Border
        const bw = fes.border_width ?? 0;
        const bc = fes.border_color ?? '';
        const bs = fes.border_style ?? 'solid';
        const bt = fes.border_top ?? bw;
        const br2 = fes.border_right ?? bw;
        const bb = fes.border_bottom ?? bw;
        const bl = fes.border_left ?? bw;
        const hasBorder = bw > 0 && bc;
        // Radius
        const rad = lcElemBorderRadius(fes, scale);
        // Align / VAlign
        const jc = fes.align === 'right' ? 'flex-end' : fes.align === 'center' ? 'center' : 'flex-start';
        const ai = fes.valign === 'bottom' ? 'flex-end' : fes.valign === 'middle' ? 'center' : 'flex-start';
        const pad = `${(fes.padding ?? 2) * scale}px`;
        return (<div className={cssClass({
                width: '100%', height: '100%',
                display: 'flex', alignItems: ai, justifyContent: jc,
                padding: pad,
                boxSizing: 'border-box',
                lineHeight: 1,
                userSelect: 'none',
                ...(bg ? { background: bg } : {}),
                ...(hasBorder ? {
                    borderTopWidth: `${bt * scale}px`,
                    borderRightWidth: `${br2 * scale}px`,
                    borderBottomWidth: `${bb * scale}px`,
                    borderLeftWidth: `${bl * scale}px`,
                    borderStyle: bs, borderColor: bc,
                } : {}),
                borderRadius: rad,
                overflow: 'hidden',
                ...(fes.shadow ? { boxShadow: `${1.5 * scale}px ${1.5 * scale}px ${4 * scale}px rgba(0,0,0,0.35)` } : {}),
            })}>
        <span className={cssClass({ fontSize: sz, ...(color ? { color } : {}) })}>🌍</span>
      </div>);
    }
    if (elemKey === 'image') {
        const bw = l.image_border_width ?? 0;
        const bc = l.image_border_color ?? '#49f2b6';
        const bs = l.image_border_style ?? 'solid';
        const rad = (() => {
            if ((l.image_radius_mode ?? 'all') === 'each') {
                const tl = l.image_radius_tl ?? 0, tr = l.image_radius_tr ?? 0;
                const br = l.image_radius_br ?? 0, bl = l.image_radius_bl ?? 0;
                return `${tl * scale}px ${tr * scale}px ${br * scale}px ${bl * scale}px`;
            }
            return `${(l.image_radius ?? 0) * scale}px`;
        })();
        return (<div className={cx("lc-elem-img-ph", cssClass({
                borderRadius: rad,
                ...(bw > 0 && bc && bs === 'solid' ? { border: `${bw * scale}px ${bs} ${bc}` } : {}),
                overflow: 'hidden',
                fontSize: `${14 * scale}px`,
            }))}>image</div>);
    }
    if (elemKey === 'product_url') {
        const es = l.element_styles?.product_url;
        const bgSolid = es?.bg ? hexToRgba(es.bg, es.bg_opacity ?? 0.15) : undefined;
        const bg = es?.bg_type === 'gradient' && es.bg
            ? `linear-gradient(${es.bg_gradient_angle ?? 135}deg, ${hexToRgba(es.bg, es.bg_opacity ?? 0.15)}, ${hexToRgba(es.bg_color2 ?? '#ffffff', es.bg_opacity ?? 0.15)})`
            : bgSolid;
        const vAlign = es?.valign ?? 'top';
        const alignItems = vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
        const pad = (es?.padding != null && es.padding >= 0) ? `${es.padding * scale}px` : `${2 * scale}px`;
        const rad = lcElemBorderRadius(es, scale);
        const bw = es?.border_width ?? 0;
        const bc = es?.border_color ?? '';
        const bs = es?.border_style ?? 'solid';
        const bt = es?.border_top ?? bw;
        const br = es?.border_right ?? bw;
        const bb = es?.border_bottom ?? bw;
        const bl = es?.border_left ?? bw;
        const hasBorder = bw > 0 && bc;
        const borderStyle = hasBorder ? {
            borderTopWidth: `${bt * scale}px`,
            borderRightWidth: `${br * scale}px`,
            borderBottomWidth: `${bb * scale}px`,
            borderLeftWidth: `${bl * scale}px`,
            borderStyle: bs,
            borderColor: bc,
        } : {};
        const shadow = es?.shadow ? '0 2px 8px rgba(0,0,0,0.28)' : undefined;
        const iconKey = l.url_icon ?? 'arrow';
        const iconSize = (l.url_icon_size ?? 16) * scale;
        const showText = l.url_show_text ?? true;
        const linkText = l.url_text ?? 'View product';
        const iconColor = l.url_icon_color || l.url_color;
        const ic = LINK_ICONS.find(i => i.key === iconKey);
        const iconEl = iconKey === 'none' ? null
            : iconKey === 'custom'
                ? (l.url_icon_url
                    ? <img src={l.url_icon_url} alt="icon" className={cssClass({ width: iconSize, height: iconSize, objectFit: 'contain', flexShrink: 0 })}/>
                    : <span className={cssClass({ fontSize: iconSize, color: iconColor, lineHeight: 1 })}>{l.url_custom_icon || '→'}</span>)
                : ic?.path ? (<svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor || l.url_color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d={ic.path}/>
          </svg>) : null;
        return (<div className={cssClass({ width: '100%', height: '100%', background: bg, display: 'flex', alignItems, borderRadius: rad, boxSizing: 'border-box', padding: pad, position: 'relative', boxShadow: shadow, ...borderStyle })}>
        <LcElemBorderSVG es={es}/>
        <span className={cssClass({ ...applyElemTextStyle(es, l.url_color, l.url_size, scale), display: 'flex', alignItems: 'center', gap: 3 * scale })}>
          {iconEl}
          {showText && <span>{linkText}</span>}
          {!showText && !iconEl && <span className={cssClass({ opacity: 0.3 })}>···</span>}
        </span>
      </div>);
    }
    const esMap: Record<TextElemKey, {
        color: string;
        size: number;
        text: string;
    }> = {
        name_lan1: { color: l.name_lan1_color, size: l.name_lan1_size, text: 'Product Name' },
        name_lan2: { color: l.name_lan2_color, size: l.name_lan2_size, text: 'اسم المنتج' },
        origin_lan1: { color: l.origin_lan1_color ?? l.origin_color, size: l.origin_lan1_size ?? l.origin_size, text: 'Country of Origin' },
        origin_lan2: { color: l.origin_lan2_color ?? l.origin_color, size: l.origin_lan2_size ?? l.origin_size, text: 'بلد المنشأ' },
        old_price: { color: l.old_price_color, size: l.old_price_size ?? 12, text: '24.99' },
        current_price: { color: l.price_color, size: l.price_size, text: '19.99' },
        product_url: { color: l.url_color, size: l.url_size, text: 'View product' },
        discount_badge: { color: l.badge_text_color ?? '#ffffff', size: l.badge_font_size ?? 11, text: '-20%' },
    };
    const key = elemKey as TextElemKey;
    const { color, size, text } = esMap[key];
    const es = l.element_styles?.[key];
    const bgSolid = es?.bg ? hexToRgba(es.bg, es.bg_opacity ?? 0.15) : undefined;
    const bg = es?.bg_type === 'gradient' && es.bg
        ? `linear-gradient(${es.bg_gradient_angle ?? 135}deg, ${hexToRgba(es.bg, es.bg_opacity ?? 0.15)}, ${hexToRgba(es.bg_color2 ?? '#ffffff', es.bg_opacity ?? 0.15)})`
        : bgSolid;
    const vAlign = es?.valign ?? 'top';
    const alignItems = vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
    const pad = (es?.padding != null && es.padding >= 0) ? `${es.padding * scale}px` : `${2 * scale}px`;
    const rad = lcElemBorderRadius(es, scale);
    const bw = es?.border_width ?? 0;
    const bc = es?.border_color ?? '';
    const bs = es?.border_style ?? 'solid';
    const bt2 = es?.border_top ?? bw;
    const br2 = es?.border_right ?? bw;
    const bb2 = es?.border_bottom ?? bw;
    const bl2 = es?.border_left ?? bw;
    const hasBorder2 = bw > 0 && bc;
    const borderStyle2 = hasBorder2 ? {
        borderTopWidth: `${bt2 * scale}px`,
        borderRightWidth: `${br2 * scale}px`,
        borderBottomWidth: `${bb2 * scale}px`,
        borderLeftWidth: `${bl2 * scale}px`,
        borderStyle: bs,
        borderColor: bc,
    } : {};
    const shadow = es?.shadow ? '0 2px 8px rgba(0,0,0,0.28)' : undefined;
    const extraStyle: React.CSSProperties = {};
    if (key === 'old_price')
        extraStyle.textDecoration = 'line-through';
    return (<div className={cssClass({ width: '100%', height: '100%', background: bg, display: 'flex', alignItems, borderRadius: rad, boxSizing: 'border-box', padding: pad, position: 'relative', boxShadow: shadow, ...borderStyle2 })}>
      <LcElemBorderSVG es={es}/>
      <span className={cssClass({ ...applyElemTextStyle(es, color, size, scale, l.font_family || undefined), ...extraStyle })}>{text}</span>
    </div>);
}
/* ── Font Picker Section ─────────────────────── */
export function FontPickerSection({ layout, set, }: {
    layout: CardLayout;
    set: (key: keyof CardLayout, value: unknown) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [dropOpen, setDropOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importErr, setImportErr] = useState('');
    const [importOk, setImportOk] = useState('');
    const [fontUrl, setFontUrl] = useState('');
    const [importMode, setImportMode] = useState<'upload' | 'url'>('upload');
    const [pendingFile, setPendingFile] = useState<{
        name: string;
        url: string;
    } | null>(null);
    const customFonts: string[] = layout.custom_fonts ?? [];
    const allFonts: FontEntry[] = [
        ...BUILTIN_FONTS,
        ...customFonts.map(n => ({ name: n, category: 'Imported', google: true as const })),
    ];
    const categories = Array.from(new Set(allFonts.map(f => f.category)));
    const active = layout.font_family || 'System Default';
    const activeFamily = active === 'System Default' ? undefined : `"${active}", sans-serif`;
    const filtered = query.trim()
        ? allFonts.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase()))
        : allFonts;
    function pickFont(name: string) {
        loadGoogleFont(name);
        set('font_family', name === 'System Default' ? '' : name);
        setDropOpen(false);
        setQuery('');
    }
    /* ── File upload handler ── */
    function setPendingFontFile(file: File) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
            setImportErr('Unsupported file format. Use .ttf, .otf, .woff, or .woff2');
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        const fontName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
        setPendingFile({ name: fontName, url: objectUrl });
        setFontUrl('');
        setImportErr('');
        setImportMode('upload');
    }
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setPendingFontFile(file);
    }
    /* ── Import & Apply ── */
    async function handleImport() {
        setImporting(true);
        setImportErr('');
        setImportOk('');
        try {
            if (pendingFile) {
                /* File-based font */
                const ff = new FontFace(pendingFile.name, `url(${pendingFile.url})`);
                await ff.load();
                document.fonts.add(ff);
                const already = customFonts.includes(pendingFile.name) || BUILTIN_FONTS.some(f => f.name === pendingFile.name);
                if (!already)
                    set('custom_fonts', [...customFonts, pendingFile.name]);
                set('font_family', pendingFile.name);
                setImportOk(`"${pendingFile.name}" applied!`);
                setPendingFile(null);
            }
            else if (fontUrl.trim()) {
                /* URL / Google Fonts link */
                const raw = fontUrl.trim();
                /* Detect if it's a Google Fonts URL and extract font name */
                const gfMatch = raw.match(/family=([^&:+]+)/);
                const fontName = gfMatch
                    ? decodeURIComponent(gfMatch[1]).replace(/\+/g, ' ')
                    : raw; /* treat raw string as font name */
                if (raw.startsWith('http')) {
                    /* CDN / Google Fonts URL — inject link tag */
                    const id = `custom-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
                    if (!document.getElementById(id)) {
                        const link = Object.assign(document.createElement('link'), {
                            id, rel: 'stylesheet', href: raw,
                        });
                        document.head.appendChild(link);
                        await document.fonts.ready;
                    }
                }
                else {
                    loadGoogleFont(raw);
                    await document.fonts.ready;
                }
                const already = customFonts.includes(fontName) || BUILTIN_FONTS.some(f => f.name === fontName);
                if (!already)
                    set('custom_fonts', [...customFonts, fontName]);
                set('font_family', fontName);
                setImportOk(`"${fontName}" applied!`);
                setFontUrl('');
            }
            else {
                setImportErr('Choose a file or paste a font URL first.');
            }
        }
        catch (err) {
            setImportErr('Failed to load font. Check the file or URL and try again.');
        }
        finally {
            setImporting(false);
            setTimeout(() => setImportOk(''), 3000);
        }
    }
    return (<div className="lc-font-section">

      {/* ─── Header ─── */}
      <div className="lc-font-hero">
        <div className="lc-font-hero-icon" aria-hidden="true">Aa</div>
        <div className="lc-font-hero-copy">
          <div className="lc-font-header">
            <span className="lc-font-header-title">Typography</span>
            <span className="lc-font-header-sub">Font Family</span>
          </div>
          <p className="lc-font-desc">
            Choose the font style for your leaflet. The selected font will apply to all text elements.
          </p>
        </div>
      </div>

      {/* ─── Font Dropdown ─── */}
      <div className="lc-font-label">Font List</div>
      <div className="lc-font-select-wrap">
        <button type="button" className={cx("lc-font-select-btn", cssClass({ fontFamily: activeFamily }))} onClick={() => setDropOpen(v => !v)}>
          <span className="lc-font-select-name">{active}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="lc-font-chevron">
            <path d={dropOpen ? 'M1 7l4-4 4 4' : 'M1 3l4 4 4-4'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {dropOpen && (<div className="lc-font-dropdown">
            <div className="lc-font-search-wrap">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="lc-font-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="lc-font-search" type="text" placeholder="Search fonts…" value={query} onChange={e => setQuery(e.target.value)} autoFocus/>
              {query && <button className="lc-font-search-clear" onClick={() => setQuery('')}>✕</button>}
            </div>

            <div className="lc-font-list">
              {query.trim() ? (filtered.length === 0
                ? <div className="lc-font-empty">No fonts match "{query}"</div>
                : filtered.map(f => (<button key={f.name} className={cx(`lc-font-item${active === f.name ? ' active' : ''}`, cssClass({ fontFamily: f.name !== 'System Default' ? `"${f.name}", sans-serif` : undefined }))} onClick={() => pickFont(f.name)} onMouseEnter={() => loadGoogleFont(f.name)}>
                        <span className="lc-font-item-name">{f.name}</span>
                        <span className="lc-font-item-sample">Aa Bb 123</span>
                      </button>))) : (categories.map(cat => (<div key={cat} className="lc-font-group">
                    <div className="lc-font-group-label">{cat}</div>
                    {allFonts.filter(f => f.category === cat).map(f => (<button key={f.name} className={cx(`lc-font-item${active === f.name ? ' active' : ''}`, cssClass({ fontFamily: f.name !== 'System Default' ? `"${f.name}", sans-serif` : undefined }))} onClick={() => pickFont(f.name)} onMouseEnter={() => loadGoogleFont(f.name)}>
                        <span className="lc-font-item-name">{f.name}</span>
                        <span className="lc-font-item-sample">Aa Bb 123</span>
                      </button>))}
                  </div>)))}
            </div>
          </div>)}
      </div>

      {/* ─── Live Preview ─── */}
      <div className={cx("lc-font-preview-box", cssClass({ fontFamily: activeFamily }))}>
        <span className="lc-font-preview-mark">Aa</span>
        <span className="lc-font-preview-text">The quick brown fox<br/>jumps over the lazy dog</span>
      </div>

      {/* ─── Import Custom Font ─── */}
      <div className="lc-font-import">
        <div className="lc-font-import-label">Import Custom Font</div>
        <div className="lc-font-import-tabs" role="tablist" aria-label="Font import method">
          <button type="button" role="tab" aria-selected={importMode === 'upload'} className={`lc-font-import-tab${importMode === 'upload' ? ' active' : ''}`} onClick={() => { setImportMode('upload'); setFontUrl(''); setImportErr(''); }}>
            <span className="material-symbol" aria-hidden="true">cloud_upload</span>
            Upload Font File
          </button>
          <button type="button" role="tab" aria-selected={importMode === 'url'} className={`lc-font-import-tab${importMode === 'url' ? ' active' : ''}`} onClick={() => { setImportMode('url'); setPendingFile(null); setImportErr(''); }}>
            <span className="material-symbol" aria-hidden="true">link</span>
            Paste Font URL
          </button>
        </div>

        {/* File upload */}
        {importMode === 'upload' ? (<button type="button" className={`lc-font-upload-btn${pendingFile ? ' has-file' : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file)
                    setPendingFontFile(file);
            }}>
            <span className="material-symbol lc-font-upload-main-icon" aria-hidden="true">backup</span>
            <span className="lc-font-upload-copy">
              <span>{pendingFile ? pendingFile.name : 'Drag & drop your font file here'}</span>
              <small>or click to browse</small>
            </span>
          </button>) : (<div className="lc-font-url-panel">
            <span className="material-symbol lc-font-upload-main-icon" aria-hidden="true">link</span>
            <input className="lc-font-url-input" type="text" placeholder="e.g. https://fonts.googleapis.com/css2?family=Cairo" value={fontUrl} onChange={e => { setFontUrl(e.target.value); setPendingFile(null); setImportErr(''); }} onKeyDown={e => {
                if (e.key === 'Enter')
                    handleImport();
            }}/>
            <div className="lc-font-url-example">Example: Google Fonts or CDN link</div>
          </div>)}
        <input ref={fileInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFileChange} className={cssClass({ display: 'none' })}/>
        <div className="lc-font-upload-hint"><span className="material-symbol" aria-hidden="true">check_circle</span> Supported formats: .ttf, .otf, .woff, .woff2</div>

        {/* Feedback */}
        {importErr && <div className="lc-font-import-err">{importErr}</div>}
        {importOk && <div className="lc-font-import-ok">{importOk}</div>}

        {/* CTA button */}
        <button type="button" className="lc-font-import-cta" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import & Apply Font'}
        </button>

        <p className="lc-font-import-helper">
          <span className="material-symbol" aria-hidden="true">info</span>
          Imported fonts will be added to your font list and applied across the entire leaflet.
        </p>
      </div>
    </div>);
}
/* ── Shared small components ─────────────────── */
function Section({ sectionKey, title, children, openSection, onOpen, }: {
    sectionKey: string;
    title: string;
    children: React.ReactNode;
    openSection: string | null;
    onOpen: (k: string | null) => void;
}) {
    const open = openSection === sectionKey;
    return (<div className="lc-section">
      <button type="button" className="lc-section-title" onClick={() => onOpen(open ? null : sectionKey)}>
        <span>{title}</span>
        <span className={`lc-section-arrow material-symbol${open ? ' open' : ''}`} aria-hidden="true">expand_more</span>
      </button>
      {<div className={cx("lc-section-body", cssClass({ display: open ? '' : 'none' }))}>{children}</div>}
    </div>);
}
function Row({ label, children }: {
    label: string;
    children: React.ReactNode;
}) {
    return <div className="lc-row"><span className="lc-row-label">{label}</span><div className="lc-row-control">{children}</div></div>;
}
function Toggle({ checked, onChange }: {
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (<button type="button" className={`lc-toggle${checked ? ' on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="lc-toggle-knob"/>
    </button>);
}
function UploadIconBtn({ current, onChange }: {
    current: string;
    onChange: (url: string) => void;
}) {
    const id = useId();
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');
    async function handle(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        setErr('');
        try {
            const url = await uploadImage(file);
            onChange(url);
        }
        catch {
            setErr('Upload failed');
        }
        finally {
            setUploading(false);
        }
    }
    return (<div className={cssClass({ display: 'flex', flexDirection: 'column', gap: 4 })}>
      {current && (<img src={current} alt="icon" className={cssClass({ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, background: '#333' })}/>)}
      <label htmlFor={id} className={cssClass({ cursor: 'pointer', fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#333', color: '#ccc', display: 'inline-block' })}>
        {uploading ? 'Uploading…' : 'Browse image'}
        <input id={id} type="file" accept="image/*" onChange={handle} disabled={uploading} className={cssClass({ display: 'none' })}/>
      </label>
      {err && <span className={cssClass({ color: '#f87171', fontSize: 10 })}>{err}</span>}
    </div>);
}
/* ── ELEM_COLORS ─────────────────────────────── */
const ELEM_COLORS: Record<ElemKey, string> = {
    image: '#f59e0b',
    name_lan1: '#6366f1',
    name_lan2: '#8b5cf6',
    origin_lan1: '#10b981',
    origin_lan2: '#059669',
    current_price: '#ef4444',
    old_price: '#f97316',
    product_url: '#3b82f6',
    discount_badge: '#ec4899',
};
/* ── SmartInspectorPanel ─────────────────────── */
interface InspPanelProps {
    selected: Set<ElemKey>;
    layout: CardLayout;
    setLayout: React.Dispatch<React.SetStateAction<CardLayout>>;
    onPosChange: (key: ElemKey, pos: CardElementPos) => void;
}
function SmartInspectorPanel({ selected, layout, setLayout, onPosChange }: InspPanelProps) {
    function set<K extends keyof CardLayout>(key: K, val: CardLayout[K]) {
        setLayout(prev => ({ ...prev, [key]: val }));
    }
    function getES(key: TextElemKey): TextElementStyle {
        return layout.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key];
    }
    function setES(key: TextElemKey, patch: Partial<TextElementStyle>) {
        setLayout(prev => ({
            ...prev,
            element_styles: {
                ...(prev.element_styles ?? DEFAULT_ELEM_STYLES),
                [key]: { ...(prev.element_styles?.[key] ?? DEFAULT_ELEM_STYLES[key]), ...patch },
            },
        }));
    }
    const selArr = Array.from(selected);
    const inspKey = selArr.length === 1 ? selArr[0] : null;
    const multiSel = selArr.length > 1;
    const elemColor = inspKey ? ELEM_COLORS[inspKey] : undefined;
    return (<div className="lc-inspector">
      <div className="lc-inspector-hdr">
        <span className="lc-inspector-hdr-title">Inspector</span>
        {inspKey && (<span className={cx("lc-inspector-elem-badge", cssClass({ background: elemColor + '22', color: elemColor, borderColor: elemColor + '55' }))}>
            {ELEM_LABELS[inspKey]}
          </span>)}
      </div>

      {!inspKey && !multiSel && (<div className="lc-inspector-ph">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            <path d="M13 13l6 6"/>
          </svg>
          <p className="lc-inspector-ph-title">No element selected</p>
          <p className="lc-inspector-ph-hint">Click any element in the card preview to inspect and edit it</p>
        </div>)}

      {multiSel && (<div className="lc-inspector-ph">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="8" height="8" rx="1"/>
            <rect x="14" y="3" width="8" height="8" rx="1"/>
            <rect x="2" y="15" width="8" height="8" rx="1"/>
            <rect x="14" y="15" width="8" height="8" rx="1"/>
          </svg>
          <p className="lc-inspector-ph-title">{selArr.length} elements selected</p>
          <p className="lc-inspector-ph-hint">Use the align &amp; order tools above the preview to reposition elements</p>
        </div>)}

      {inspKey && (<InspectorContent elemKey={inspKey} layout={layout} set={set} getES={getES} setES={setES} pos={(layout.positions ?? DEFAULT_POSITIONS)[inspKey] ?? DEFAULT_POSITIONS[inspKey]} onPosChange={handlePosChange}/>)}
    </div>);
}
/* ── InspectorContent ────────────────────────── */
function InspectorContent({ elemKey, layout, set, getES, setES, pos, onPosChange }: {
    elemKey: ElemKey;
    layout: CardLayout;
    set: <K extends keyof CardLayout>(key: K, val: CardLayout[K]) => void;
    getES: (key: TextElemKey) => TextElementStyle;
    setES: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
    pos?: CardElementPos;
    onPosChange?: (key: ElemKey, p: CardElementPos) => void;
}) {
    const showKey = SHOW_MAP[elemKey];
    const isVisible = showKey ? !!(layout[showKey as keyof CardLayout]) : true;
    const isTextKey = (TEXT_ELEM_KEYS as readonly string[]).includes(elemKey);
    const bodyRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleFocus(event: Event) {
            const section = (event as CustomEvent<{ section?: string }>).detail?.section;
            if (!section || !bodyRef.current)
                return;
            const target = bodyRef.current.querySelector<HTMLElement>(`[data-lc-inspector-section~="${section}"]`);
            target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
        window.addEventListener('lc-inspector-focus-section', handleFocus);
        return () => window.removeEventListener('lc-inspector-focus-section', handleFocus);
    }, []);
    return (<div className="lc-inspector-body" ref={bodyRef}>

      {/* Visibility row */}
      {showKey && (<div className="lc-insp-visibility-row">
          <span className="lc-insp-vis-label">{isVisible ? 'Visible' : 'Hidden'}</span>
          <Toggle checked={isVisible} onChange={v => set(showKey as keyof CardLayout, v as CardLayout[keyof CardLayout])}/>
        </div>)}

      {/* Size row */}
      {pos && onPosChange && (<div className="lc-insp-size-row">
          <div className="lc-insp-size-field">
            <span className="lc-insp-size-label">W</span>
            <NumericInput size="sm" min={1} max={100} step={0.1} value={+pos.w.toFixed(1)} onChange={v => { const val = Math.min(100, Math.max(0.1, v)); onPosChange(elemKey, { ...pos, w: val }); }}/>
            <span className="lc-insp-size-unit">%</span>
          </div>
          <div className="lc-insp-size-field">
            <span className="lc-insp-size-label">H</span>
            <NumericInput size="sm" min={1} max={100} step={0.1} value={+pos.h.toFixed(1)} onChange={v => { const val = Math.min(100, Math.max(0.1, v)); onPosChange(elemKey, { ...pos, h: val }); }}/>
            <span className="lc-insp-size-unit">%</span>
          </div>
        </div>)}

      {/* ─── IMAGE ─── */}
      {elemKey === 'image' && (<>
          <div className="lc-insp-section">
            <span className="lc-insp-section-label">Layout</span>
            <Row label="Aspect ratio">
              <input type="range" min={20} max={200} value={layout.image_aspect_ratio} onChange={e => set('image_aspect_ratio', +e.target.value)}/>
              <span className="lc-val">{layout.image_aspect_ratio}%</span>
            </Row>
          </div>

          {/* Border */}
          {false && <div className="lc-insp-section" data-lc-inspector-section="border">
            <span className="lc-insp-section-label">Border</span>
            <Row label="Width">
              <input type="range" min={0} max={16} value={layout.image_border_width ?? 0} onChange={e => set('image_border_width', +e.target.value)}/>
              <span className="lc-val">{layout.image_border_width ?? 0}px</span>
            </Row>
            {(layout.image_border_width ?? 0) > 0 && (<>
              <Row label="Color">
                <ColorSwatch value={layout.image_border_color ?? '#49f2b6'} onChange={v => set('image_border_color', v)}/>
                <span className="lc-val">{layout.image_border_color ?? '#49f2b6'}</span>
              </Row>
              <Row label="Style">
                <div className="lc-btn-group">
                  {(['solid', 'dashed', 'dotted'] as const).map(s => (<button key={s} type="button" className={`lc-btn-opt${(layout.image_border_style ?? 'solid') === s ? ' active' : ''}`} onClick={() => set('image_border_style', s)}>{s}</button>))}
                </div>
              </Row>
            </>)}
          </div>}

          {/* Radius */}
          {false && <div className="lc-insp-section" data-lc-inspector-section="radius">
            <span className="lc-insp-section-label">Radius</span>
            <Row label="Mode">
              <div className="lc-btn-group">
                <button type="button" className={`lc-btn-opt${(layout.image_radius_mode ?? 'all') === 'all' ? ' active' : ''}`} onClick={() => {
                const v = layout.image_radius_tl ?? layout.image_radius ?? 0;
                patchLayout({
                    image_radius_mode: 'all',
                    image_radius: v,
                    image_radius_tl: v,
                    image_radius_tr: v,
                    image_radius_br: v,
                    image_radius_bl: v,
                });
            }}>All corners</button>
                <button type="button" className={`lc-btn-opt${(layout.image_radius_mode ?? 'all') === 'each' ? ' active' : ''}`} onClick={() => {
                const v = layout.image_radius ?? layout.image_radius_tl ?? 0;
                patchLayout({
                    image_radius_mode: 'each',
                    image_radius_tl: v,
                    image_radius_tr: v,
                    image_radius_br: v,
                    image_radius_bl: v,
                });
            }}>Each corner</button>
              </div>
            </Row>
            {(layout.image_radius_mode ?? 'all') === 'all' ? (<Row label="Radius">
                <NumericInput min={0} max={64} step={1} size="sm" value={layout.image_radius ?? 0} onChange={v => {
                    patchLayout({
                        image_radius: v,
                        image_radius_tl: v,
                        image_radius_tr: v,
                        image_radius_br: v,
                        image_radius_bl: v,
                    });
                }} className={cssClass({ width: 82 })}/>
                <span className="lc-val">{layout.image_radius ?? 0}px</span>
              </Row>) : (<div className="lc-corner-grid lc-corner-grid--row">
                {([['tl', '↖ TL'], ['tr', '↗ TR'], ['br', '↘ BR'], ['bl', '↙ BL']] as const).map(([corner, label]) => {
                    const key = `image_radius_${corner}` as 'image_radius_tl' | 'image_radius_tr' | 'image_radius_br' | 'image_radius_bl';
                    const val = layout[key] ?? 0;
                    return (<div key={corner} className="lc-corner-item">
                      <span className="lc-corner-label">{corner.toUpperCase()}</span>
                      <NumericInput min={0} max={64} step={1} size="sm" value={val} onChange={v => set(key, v)} className={cssClass({ width: 82 })}/>
                      <span className="lc-val">{val}px</span>
                    </div>);
                })}
              </div>)}
          </div>}
        </>)}

      {/* ─── ORIGIN FLAG ELEMENT ─── */}
      {false && (elemKey === 'origin_lan1_flag' || elemKey === 'origin_lan2_flag') && (() => {
            const fes: TextElementStyle = layout.flag_element_style ?? DEFAULT_FLAG_ES;
            function setFES(patch: Partial<TextElementStyle>) {
                set('flag_element_style', { ...(layout.flag_element_style ?? DEFAULT_FLAG_ES), ...patch });
            }
            // Shim: lets us reuse ElemBg/Border/Radius sections by treating flagKey as a virtual TextElemKey
            const FLAG_KEY = '__flag__' as TextElemKey;
            const flagGetES = (_: TextElemKey) => fes;
            const flagSetES = (_: TextElemKey, patch: Partial<TextElementStyle>) => setFES(patch);
            return (<>
          {/* Typography */}
          {false && <div className="lc-insp-section" data-lc-inspector-section="typography color">
            <span className="lc-insp-section-label">Typography</span>
            <Row label="Icon size">
              <input type="range" min={10} max={64} value={layout.flag_icon_size ?? 18} onChange={e => set('flag_icon_size', +e.target.value)}/>
              <span className="lc-val">{layout.flag_icon_size ?? 18}px</span>
            </Row>
            <Row label="Color">
              <ColorSwatch value={layout.flag_color ?? '#000000'} onChange={v => set('flag_color', v)}/>
              <span className="lc-val">{layout.flag_color ?? '#000000'}</span>
            </Row>
            <TextStyleControls elemKey={FLAG_KEY} textStyle={fes} onChange={flagSetES}/>
          </div>}

          {/* Background */}
          <ElemBgSection elemKey={FLAG_KEY} getES={flagGetES} setES={flagSetES}/>

          {/* Drop Shadow */}
          <div className="lc-insp-section">
            <span className="lc-insp-section-label">Drop Shadow</span>
            <Row label="Drop shadow">
              <Toggle checked={!!fes.shadow} onChange={v => setFES({ shadow: v })}/>
            </Row>
          </div>

          {/* Border */}
          <ElemBorderSection elemKey={FLAG_KEY} getES={flagGetES} setES={flagSetES}/>

          {/* Radius */}
          <ElemRadiusSection elemKey={FLAG_KEY} getES={flagGetES} setES={flagSetES}/>
        </>);
        })()}

      {/* ─── TEXT ELEMENTS ─── */}
      {isTextKey && elemKey !== 'image' && (<>
          {false && <div className="lc-insp-section" data-lc-inspector-section="typography color">
            <span className="lc-insp-section-label">Typography</span>
            {elemKey === 'name_lan1' && (<>
              <Row label="Font size"><input type="range" min={8} max={36} value={layout.name_lan1_size} onChange={e => set('name_lan1_size', +e.target.value)}/><span className="lc-val">{layout.name_lan1_size}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.name_lan1_color} onChange={v => set('name_lan1_color', v)}/><span className="lc-val">{layout.name_lan1_color}</span></Row>
            </>)}
            {elemKey === 'name_lan2' && (<>
              <Row label="Font size"><input type="range" min={8} max={36} value={layout.name_lan2_size} onChange={e => set('name_lan2_size', +e.target.value)}/><span className="lc-val">{layout.name_lan2_size}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.name_lan2_color} onChange={v => set('name_lan2_color', v)}/><span className="lc-val">{layout.name_lan2_color}</span></Row>
            </>)}
            {elemKey === 'origin_lan1' && (<>
              <Row label="Font size"><input type="range" min={8} max={28} value={layout.origin_lan1_size ?? layout.origin_size} onChange={e => set('origin_lan1_size', +e.target.value)}/><span className="lc-val">{layout.origin_lan1_size ?? layout.origin_size}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.origin_lan1_color ?? layout.origin_color} onChange={v => set('origin_lan1_color', v)}/><span className="lc-val">{layout.origin_lan1_color ?? layout.origin_color}</span></Row>
            </>)}
            {elemKey === 'origin_lan2' && (<>
              <Row label="Font size"><input type="range" min={8} max={28} value={layout.origin_lan2_size ?? layout.origin_size} onChange={e => set('origin_lan2_size', +e.target.value)}/><span className="lc-val">{layout.origin_lan2_size ?? layout.origin_size}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.origin_lan2_color ?? layout.origin_color} onChange={v => set('origin_lan2_color', v)}/><span className="lc-val">{layout.origin_lan2_color ?? layout.origin_color}</span></Row>
            </>)}
            {elemKey === 'current_price' && (<>
              <Row label="Font size"><input type="range" min={8} max={48} value={layout.price_size} onChange={e => set('price_size', +e.target.value)}/><span className="lc-val">{layout.price_size}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.price_color} onChange={v => set('price_color', v)}/><span className="lc-val">{layout.price_color}</span></Row>
            </>)}
            {elemKey === 'old_price' && (<>
              <Row label="Font size"><input type="range" min={8} max={48} value={layout.old_price_size ?? 12} onChange={e => set('old_price_size', +e.target.value)}/><span className="lc-val">{layout.old_price_size ?? 12}px</span></Row>
              <Row label="Color"><ColorSwatch value={layout.old_price_color} onChange={v => set('old_price_color', v)}/><span className="lc-val">{layout.old_price_color}</span></Row>
            </>)}
            <TextStyleControls elemKey={elemKey as TextElemKey} textStyle={getES(elemKey as TextElemKey)} onChange={setES}/>
          </div>}

          {(elemKey === 'origin_lan1' || elemKey === 'origin_lan2') && (<div className="lc-insp-section">
              <span className="lc-insp-section-label">Options</span>
              <Row label="Show flag">
                <Toggle checked={elemKey === 'origin_lan1' ? (layout.show_origin_lan1_flag ?? true) : (layout.show_origin_lan2_flag ?? true)} onChange={v => elemKey === 'origin_lan1' ? set('show_origin_lan1_flag', v) : set('show_origin_lan2_flag', v)}/>
              </Row>
              <Row label="Flag size">
                <input type="range" min={10} max={48} value={layout.flag_icon_size ?? 18} onChange={e => set('flag_icon_size', +e.target.value)}/>
                <span className="lc-val">{layout.flag_icon_size ?? 18}px</span>
              </Row>
            </div>)}

          {elemKey === 'product_url' && (<div className="lc-insp-section">
              <span className="lc-insp-section-label">Link Options</span>
              <Row label="Link text"><input className="lc-text-input" type="text" maxLength={60} value={layout.url_text ?? 'View product'} onChange={e => set('url_text', e.target.value)} placeholder="View product"/></Row>
              <Row label="Show text"><Toggle checked={layout.url_show_text ?? true} onChange={v => set('url_show_text', v)}/></Row>
              <Row label="Icon">
                <div className="lc-icon-grid">
                  {LINK_ICONS.map(ic => (<button key={ic.key} type="button" title={ic.label} className={`lc-icon-btn${(layout.url_icon ?? 'arrow') === ic.key ? ' active' : ''}`} onClick={() => set('url_icon', ic.key)}>
                      {ic.key === 'none' ? '∅' : ic.key === 'custom' ? '+' : ic.path ? (<svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={ic.path}/></svg>) : ic.label}
                    </button>))}
                </div>
              </Row>
              {(layout.url_icon ?? 'arrow') === 'custom' && (<>
                <Row label="Custom icon"><input className="lc-text-input" type="text" maxLength={10} value={layout.url_custom_icon ?? ''} onChange={e => set('url_custom_icon', e.target.value)} placeholder="→ or emoji"/></Row>
                <Row label="Upload icon"><UploadIconBtn current={layout.url_icon_url ?? ''} onChange={url => set('url_icon_url', url)}/></Row>
              </>)}
              <Row label="Icon size"><input type="range" min={8} max={48} value={layout.url_icon_size ?? 16} onChange={e => set('url_icon_size', +e.target.value)}/><span className="lc-val">{layout.url_icon_size ?? 16}px</span></Row>
              <Row label="Icon color">
                <Toggle checked={!!(layout.url_icon_color)} onChange={v => set('url_icon_color', v ? (layout.url_color ?? '#49f2b6') : '')}/>
                {layout.url_icon_color ? <ColorSwatch value={layout.url_icon_color} onChange={v => set('url_icon_color', v)}/> : <span className="lc-val muted">same as text</span>}
              </Row>
            </div>)}

          {elemKey === 'discount_badge' && (<div className="lc-insp-section">
              <span className="lc-insp-section-label">Badge Style</span>
              <Row label="Show as">
                <div className="lc-seg-btns">
                  <button type="button" className={(layout.badge_display_mode ?? 'percent') === 'percent' ? 'active' : ''} onClick={() => set('badge_display_mode', 'percent')}>% Percent</button>
                  <button type="button" className={(layout.badge_display_mode ?? 'percent') === 'amount' ? 'active' : ''} onClick={() => set('badge_display_mode', 'amount')}>＄ Amount</button>
                </div>
              </Row>
              <Row label="Show bg"><Toggle checked={layout.badge_show_bg ?? true} onChange={v => set('badge_show_bg', v)}/></Row>
              {(layout.badge_show_bg ?? true) && (<>
                <Row label="Badge color"><ColorSwatch value={layout.badge_color ?? '#ff5c5c'} onChange={v => set('badge_color', v)}/><span className="lc-val">{layout.badge_color ?? '#ff5c5c'}</span></Row>
                <Row label="Radius"><input type="range" min={0} max={50} value={layout.badge_radius ?? 20} onChange={e => set('badge_radius', +e.target.value)}/><span className="lc-val">{layout.badge_radius ?? 20}px</span></Row>
              </>)}
            </div>)}

          {/* ── Background ── */}
          {false && <ElemBgSection elemKey={elemKey as TextElemKey} getES={getES} setES={setES}/>}

          {/* ── Drop shadow ── */}
          {false && <div className="lc-insp-section">
            <span className="lc-insp-section-label">Drop Shadow</span>
            <Row label="Drop shadow">
              <Toggle checked={!!(getES(elemKey as TextElemKey).shadow)} onChange={v => setES(elemKey as TextElemKey, { shadow: v })}/>
            </Row>
          </div>}

          {/* ── Border ── */}
          {false && <ElemBorderSection elemKey={elemKey as TextElemKey} getES={getES} setES={setES}/>}

          {/* ── Radius ── */}
          {false && <ElemRadiusSection elemKey={elemKey as TextElemKey} getES={getES} setES={setES}/>}
        </>)}
    </div>);
}
/* ── Element Background Section ─────────────── */
function ElemBgSection({ elemKey, getES, setES }: {
    elemKey: TextElemKey;
    getES: (key: TextElemKey) => TextElementStyle;
    setES: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
}) {
    const es = getES(elemKey);
    const bgType = es.bg_type ?? 'solid';
    return (<div className="lc-insp-section" data-lc-inspector-section="background">
      <span className="lc-insp-section-label">Background</span>
      <Row label="Background">
        <div className="lc-btn-group">
          {(['solid', 'gradient'] as const).map(m => (<button key={m} type="button" className={`lc-btn-opt${bgType === m ? ' active' : ''}`} onClick={() => setES(elemKey, {
                bg_type: m,
                ...(m === 'gradient' && !es.bg ? { bg: '#49f2b6', bg_opacity: 0.25 } : {}),
                bg_color2: es.bg_color2 ?? '#ffffff',
                bg_gradient_angle: es.bg_gradient_angle ?? 135,
            })}>{m}</button>))}
        </div>
      </Row>
      <Row label={bgType === 'gradient' ? 'Color 1' : 'Color'}>
        <Toggle checked={!!es.bg} onChange={v => setES(elemKey, { bg: v ? '#1a2a3a' : '', bg_opacity: v ? (es.bg_opacity ?? 0.25) : 0 })}/>
        {es.bg && (<>
            <ColorSwatch value={es.bg} onChange={v => setES(elemKey, { bg: v })}/>
            <span className="lc-val">{es.bg}</span>
          </>)}
      </Row>
      {es.bg && (<Row label="Opacity">
          <input type="range" min={0} max={1} step={0.05} value={es.bg_opacity ?? 0.25} onChange={e => setES(elemKey, { bg_opacity: +e.target.value })}/>
          <span className="lc-val">{Math.round((es.bg_opacity ?? 0.25) * 100)}%</span>
        </Row>)}
      {bgType === 'gradient' && es.bg && (<>
        <Row label="Color 2">
          <ColorSwatch value={es.bg_color2 ?? '#ffffff'} onChange={v => setES(elemKey, { bg_color2: v })}/>
          <span className="lc-val">{es.bg_color2 ?? '#ffffff'}</span>
        </Row>
        <Row label="Angle">
          <input type="range" min={0} max={360} value={es.bg_gradient_angle ?? 135} onChange={e => setES(elemKey, { bg_gradient_angle: +e.target.value })}/>
          <span className="lc-val">{es.bg_gradient_angle ?? 135}°</span>
        </Row>
      </>)}
    </div>);
}
/* ── Element Border Section ──────────────────── */
function ElemBorderSection({ elemKey, getES, setES }: {
    elemKey: TextElemKey;
    getES: (key: TextElemKey) => TextElementStyle;
    setES: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
}) {
    const es = getES(elemKey);
    const bw = es.border_width ?? 0;
    const bc = es.border_color ?? '#49f2b6';
    const bs = es.border_style ?? 'solid';
    const bt = es.border_top ?? bw;
    const br = es.border_right ?? bw;
    const bb = es.border_bottom ?? bw;
    const bl = es.border_left ?? bw;
    function setSide(side: 'border_top' | 'border_right' | 'border_bottom' | 'border_left', v: number) {
        setES(elemKey, { [side]: v });
    }
    return (<div className="lc-insp-section" data-lc-inspector-section="border">
      <span className="lc-insp-section-label">Border</span>
      <Row label="Width">
        <NumericInput min={0} max={20} step={0.1} size="sm" value={bw} onChange={v => setES(elemKey, { border_width: v, border_top: v, border_right: v, border_bottom: v, border_left: v })} className={cssClass({ width: 90 })}/>
        <span className="lc-val">{bw}px</span>
      </Row>
      {bw > 0 && (<>
        <Row label="Color">
          <ColorSwatch value={bc} onChange={v => setES(elemKey, { border_color: v })}/>
          <span className="lc-val">{bc}</span>
        </Row>
        <Row label="Style">
          <div className="lc-btn-group">
            {(['solid', 'dashed', 'dotted'] as const).map(s => (<button key={s} type="button" className={`lc-btn-opt${bs === s ? ' active' : ''}`} onClick={() => setES(elemKey, { border_style: s })}>{s}</button>))}
          </div>
        </Row>
        <span className="lc-insp-subsection-label">Per Side</span>
        <div className="lc-border-sides">
          {([
                ['T', 'border_top', bt],
                ['R', 'border_right', br],
                ['B', 'border_bottom', bb],
                ['L', 'border_left', bl],
            ] as [
                string,
                'border_top' | 'border_right' | 'border_bottom' | 'border_left',
                number
            ][]).map(([label, key, val]) => (<div key={key} className="lc-border-side-field">
              <span className="lc-border-side-label">{label}</span>
              <NumericInput size="xs" min={0} max={20} step={0.1} value={val} onChange={v => setSide(key, v)}/>
            </div>))}
        </div>
      </>)}
    </div>);
}
/* ── Element Radius Section ──────────────────── */
function ElemRadiusSection({ elemKey, getES, setES }: {
    elemKey: TextElemKey;
    getES: (key: TextElemKey) => TextElementStyle;
    setES: (key: TextElemKey, patch: Partial<TextElementStyle>) => void;
}) {
    const es = getES(elemKey);
    const radMode = es.radius_mode ?? 'all';
    return (<div className="lc-insp-section" data-lc-inspector-section="radius">
      <span className="lc-insp-section-label">Radius</span>
      <Row label="Mode">
        <div className="lc-btn-group">
          <button type="button" className={`lc-btn-opt${radMode === 'all' ? ' active' : ''}`} onClick={() => {
            const v = es.radius_tl ?? es.radius ?? 0;
            setES(elemKey, { radius_mode: 'all', radius: v, radius_tl: v, radius_tr: v, radius_br: v, radius_bl: v });
        }}>All corners</button>
          <button type="button" className={`lc-btn-opt${radMode === 'each' ? ' active' : ''}`} onClick={() => {
            const v = es.radius ?? es.radius_tl ?? 0;
            setES(elemKey, { radius_mode: 'each', radius_tl: v, radius_tr: v, radius_br: v, radius_bl: v });
        }}>Each corner</button>
        </div>
      </Row>
      {radMode === 'all' ? (<Row label="Radius">
          <NumericInput min={0} max={64} step={1} size="sm" value={es.radius ?? 0} onChange={v => {
                setES(elemKey, { radius: v, radius_tl: v, radius_tr: v, radius_br: v, radius_bl: v });
            }} className={cssClass({ width: 82 })}/>
          <span className="lc-val">{es.radius ?? 0}px</span>
        </Row>) : (<div className="lc-corner-grid lc-corner-grid--row">
          {([['tl', '↖ TL'], ['tr', '↗ TR'], ['br', '↘ BR'], ['bl', '↙ BL']] as const).map(([corner, label]) => {
                const key = `radius_${corner}` as 'radius_tl' | 'radius_tr' | 'radius_br' | 'radius_bl';
                const val = es[key] ?? 0;
                return (<div key={corner} className="lc-corner-item">
                <span className="lc-corner-label">{corner.toUpperCase()}</span>
                <NumericInput min={0} max={64} step={1} size="sm" value={val} onChange={v => setES(elemKey, { [key]: v })} className={cssClass({ width: 82 })}/>
                <span className="lc-val">{val}px</span>
              </div>);
            })}
        </div>)}
    </div>);
}
