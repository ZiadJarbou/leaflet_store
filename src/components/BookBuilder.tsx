import { cssClass, cx } from '../utils/styleClass';
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { CardLayout } from '../services/api';
import type { LeafletProduct } from '../types/leaflet';
import './BookBuilder.css';
/* ─────────────────────────── Types ─────────────────────────── */
type BookFormatId = 'a4-portrait' | 'a4-landscape' | 'a5-booklet' | 'square-catalog' | 'magazine' | 'custom';
type PreviewMode = 'reader' | 'print' | 'spread';
type ExportType = 'print-pdf' | 'booklet-pdf';
interface FormatPreset {
    id: BookFormatId;
    label: string;
    icon: string;
}
interface BookPageItem {
    id: string;
    type: 'cover' | 'products' | 'back' | 'blank';
    pageIdx?: number;
    label: string;
}
interface BookSettings {
    showPageNums: boolean;
    pageNumPos: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
    bookletMode: boolean;
    headerText: string;
    footerText: string;
    showHeader: boolean;
    showFooter: boolean;
}
interface PreflightIssue {
    level: 'error' | 'warning' | 'info';
    msg: string;
}
export interface BookBuilderProps {
    leafletTitle: string;
    pages: LeafletProduct[][];
    coverPage: {
        image: string;
        show: boolean;
    };
    backPage: {
        image: string;
        show: boolean;
    };
    cardLayout: CardLayout | null;
    /* Actual A4 page dimensions from LeafletView */
    a4W: number;
    a4H: number;
    gridW: number;
    gridH: number;
    cardWidth: number;
    cardHeight: number;
    colsPerPage: number;
    rowsPerPage: number;
    colGap: number;
    rowGap: number;
    pageBg: string;
    isLandscape: boolean;
    headerStyle: React.CSSProperties;
    footerStyle: React.CSSProperties;
    headerSettings: {
        show: boolean;
        text: string;
        showText: boolean;
        textAlign: string;
        blockAlign?: string;
        widthMode: string;
        widthPct?: number;
        height: number;
        logoUrl?: string;
        logoHeight?: number;
        logoWidth?: number;
        logoX?: number;
        logoY?: number;
        logoGap?: number;
        textWidth?: number;
        textHeight?: number;
        textX?: number;
        textY?: number;
    };
    footerSettings: {
        show: boolean;
        text: string;
        showText: boolean;
        textAlign: string;
        widthMode: string;
        height: number;
    };
    renderProductCard: (p: LeafletProduct, opts: {
        cardWidth: number;
        cardHeight: number;
    }) => React.ReactNode;
    onClose: () => void;
}
/* ─────────────────────── Format Presets ───────────────────── */
const PRESETS: FormatPreset[] = [
    { id: 'a4-portrait', label: 'A4 Portrait', icon: 'description' },
    { id: 'a4-landscape', label: 'A4 Landscape', icon: 'wallpaper' },
    { id: 'a5-booklet', label: 'A5 Booklet', icon: 'auto_stories' },
    { id: 'square-catalog', label: 'Square Catalog', icon: 'crop_square' },
    { id: 'magazine', label: 'Magazine', icon: 'newspaper' },
];
/* pixel dimensions at 96 dpi + CSS @page size string */
const FORMAT_DIMS: Record<BookFormatId, {
    w: number;
    h: number;
    cssSize: string;
}> = {
    'a4-portrait': { w: 794, h: 1123, cssSize: 'A4 portrait' },
    'a4-landscape': { w: 1123, h: 794, cssSize: 'A4 landscape' },
    'a5-booklet': { w: 559, h: 794, cssSize: 'A5 portrait' },
    'square-catalog': { w: 794, h: 794, cssSize: '210mm 210mm' },
    'magazine': { w: 794, h: 1020, cssSize: '210mm 270mm' },
    'custom': { w: 794, h: 1123, cssSize: 'A4 portrait' },
};
const DEFAULT_SETTINGS: BookSettings = {
    showPageNums: true, pageNumPos: 'bottom-center',
    bookletMode: false,
    headerText: '', footerText: '',
    showHeader: false, showFooter: false,
};
/* ─────────────────── Booklet imposition ───────────────────── */
function buildBookletPages(pages: BookPageItem[]): BookPageItem[][] {
    const padded = [...pages];
    while (padded.length % 4 !== 0)
        padded.push({ id: `blank-pad-${padded.length}`, type: 'blank', label: 'Blank' });
    const spreads: BookPageItem[][] = [];
    let lo = 0, hi = padded.length - 1;
    while (lo < hi) {
        spreads.push([padded[hi], padded[lo]]);
        spreads.push([padded[lo + 1], padded[hi - 1]]);
        lo += 2;
        hi -= 2;
    }
    return spreads;
}
/* ─────────────────── Preflight ────────────────────────────── */
function runPreflight(bookPages: BookPageItem[], pages: LeafletProduct[][], coverPage: {
    image: string;
    show: boolean;
}, backPage: {
    image: string;
    show: boolean;
}): PreflightIssue[] {
    const issues: PreflightIssue[] = [];
    if (bookPages.length === 0)
        issues.push({ level: 'error', msg: 'No pages selected.' });
    const prods = bookPages.filter(p => p.type === 'products');
    if (prods.length === 0 && !coverPage.show && !backPage.show)
        issues.push({ level: 'error', msg: 'No content pages found.' });
    prods.forEach(pg => {
        if (pg.pageIdx !== undefined && pages[pg.pageIdx]?.length === 0)
            issues.push({ level: 'warning', msg: `Page ${(pg.pageIdx ?? 0) + 1} has no products.` });
    });
    return issues;
}
/* ─────────────────── Page thumbnail ───────────────────────── */
function BookPageThumb({ item, index, selected, onSelect, onRemove, draggingIdx, onDragStart, onDragOver, onDrop }: {
    item: BookPageItem;
    index: number;
    selected: boolean;
    onSelect: () => void;
    onRemove: () => void;
    draggingIdx: number | null;
    onDragStart: (i: number) => void;
    onDragOver: (i: number) => void;
    onDrop: () => void;
}) {
    return (<div className={`bb-thumb${selected ? ' selected' : ''}${draggingIdx !== null && draggingIdx !== index ? ' drag-over' : ''}`} draggable onDragStart={() => onDragStart(index)} onDragOver={e => { e.preventDefault(); onDragOver(index); }} onDrop={e => { e.preventDefault(); onDrop(); }} onClick={onSelect}>
      <div className="bb-thumb-page">
        {item.type === 'cover' && <span className="bb-thumb-type-badge cover">Cover</span>}
        {item.type === 'back' && <span className="bb-thumb-type-badge back">Back</span>}
        {item.type === 'blank' && <span className="bb-thumb-type-badge blank">Blank</span>}
        {item.type === 'products' && <span className="bb-thumb-pg-num">{(item.pageIdx ?? 0) + 1}</span>}
      </div>
      <div className="bb-thumb-label">{item.label}</div>
      {item.type !== 'cover' && item.type !== 'back' && (<button className="bb-thumb-remove" onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>)}
    </div>);
}
/* ─────────────────── Main Component ───────────────────────── */
export default function BookBuilder({ leafletTitle, pages, coverPage, backPage, a4W, a4H, gridW, gridH, cardWidth, cardHeight, colsPerPage, rowsPerPage, colGap, rowGap, pageBg, isLandscape, headerStyle, footerStyle, headerSettings, footerSettings, renderProductCard, onClose, }: BookBuilderProps) {
    /* ── Book pages list ── */
    const [bookPages, setBookPages] = useState<BookPageItem[]>(() => {
        const items: BookPageItem[] = [];
        if (coverPage.show)
            items.push({ id: 'cover', type: 'cover', label: 'Cover Page' });
        pages.forEach((_, i) => items.push({ id: `pg-${i}`, type: 'products', pageIdx: i, label: `Page ${i + 1}` }));
        if (backPage.show)
            items.push({ id: 'back', type: 'back', label: 'Back Page' });
        return items;
    });
    const [previewPageId, setPreviewPageId] = useState<string>(bookPages[0]?.id ?? '');
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    /* ── Settings ── */
    const [settings, setSettings] = useState<BookSettings>({
        ...DEFAULT_SETTINGS,
        headerText: headerSettings.text || leafletTitle,
        footerText: footerSettings.text || leafletTitle,
        showHeader: headerSettings.show,
        showFooter: footerSettings.show,
    });
    function setSetting<K extends keyof BookSettings>(k: K, v: BookSettings[K]) {
        setSettings(prev => ({ ...prev, [k]: v }));
    }
    /* ── Format ── */
    const defaultFmtId: BookFormatId = isLandscape ? 'a4-landscape' : 'a4-portrait';
    const [selectedFormat, setSelectedFormat] = useState<BookFormatId>(defaultFmtId);
    const fmt = FORMAT_DIMS[selectedFormat];
    const fmtW = fmt.w;
    const fmtH = fmt.h;
    /* scale source A4 content (a4W × a4H) to fit target format */
    const scaleX = fmtW / a4W;
    const scaleY = fmtH / a4H;
    const contentScale = Math.min(scaleX, scaleY);
    /* ── Preview ── */
    const [previewMode, setPreviewMode] = useState<PreviewMode>('reader');
    const [previewZoom, setPreviewZoom] = useState(55);
    const scale = previewZoom / 100;
    /* ── Export ── */
    const [exporting, setExporting] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    /* ── Preflight ── */
    const preflight = runPreflight(bookPages, pages, coverPage, backPage);
    const hasErrors = preflight.some(i => i.level === 'error');
    /* ── Drag/drop ── */
    function handleDrop() {
        if (draggingIdx === null || dragOverIdx === null || draggingIdx === dragOverIdx) {
            setDraggingIdx(null);
            setDragOverIdx(null);
            return;
        }
        const next = [...bookPages];
        const [moved] = next.splice(draggingIdx, 1);
        next.splice(dragOverIdx, 0, moved);
        setBookPages(next);
        setDraggingIdx(null);
        setDragOverIdx(null);
    }
    function removePage(id: string) { setBookPages(prev => prev.filter(p => p.id !== id)); }
    function addBlankPage() {
        const id = `blank-${Date.now()}`;
        setBookPages(prev => [...prev, { id, type: 'blank', label: 'Blank Page' }]);
    }
    function addProductPage(idx: number) {
        const id = `pg-${idx}`;
        if (bookPages.some(p => p.id === id))
            return;
        setBookPages(prev => [...prev, { id, type: 'products', pageIdx: idx, label: `Page ${idx + 1}` }]);
    }
    /* ── Page content renderer ─────────────────────────────────
       Uses the EXACT same CSS classes and structure as the
       visible lv-a4-page in LeafletView so the output is
       pixel-identical to what the user sees on screen.
    ─────────────────────────────────────────────────────────── */
    function renderPageContent(item: BookPageItem, pageNum: number) {
        /* wrapper that clips the scaled A4 content to fmtW × fmtH */
        const fmtWrap: React.CSSProperties = {
            width: fmtW,
            height: fmtH,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
        };
        const innerScale: React.CSSProperties = contentScale === 1 ? {} : {
            transform: `scale(${contentScale})`,
            transformOrigin: 'top left',
            width: a4W,
            height: a4H,
            position: 'absolute',
            top: 0,
            left: 0,
        };
        const needsScale = contentScale !== 1;
        /* blank */
        if (item.type === 'blank')
            return (<div className={cssClass(fmtWrap)}>
          <div className={cx("lv-pdf-page", cssClass({ width: a4W, height: a4H, ...(needsScale ? innerScale : {}), display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '2px dashed #e2e8f0', boxSizing: 'border-box' }))}>
            <span className={cssClass({ color: '#94a3b8', fontSize: 14 })}>Blank Page</span>
          </div>
        </div>);
        /* cover */
        if (item.type === 'cover')
            return (<div className={cssClass(fmtWrap)}>
          <div className={cx("lv-pdf-page lv-a4-cover-page", cssClass({ ...(needsScale ? innerScale : {}), width: a4W, height: a4H, background: '#1a1a2e', overflow: 'hidden', boxSizing: 'border-box' }))}>
            {coverPage.image
                    ? <img src={coverPage.image} alt="" className={cssClass({ width: '100%', height: '100%', objectFit: 'cover', display: 'block' })}/>
                    : <div className={cssClass({ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,.3)' })}>
                  <span className={cssClass({ fontSize: 40 })}>description</span>
                  <p className={cssClass({ margin: 0, fontSize: 14 })}>Cover Page</p>
                </div>}
          </div>
        </div>);
        /* back */
        if (item.type === 'back')
            return (<div className={cssClass(fmtWrap)}>
          <div className={cx("lv-pdf-page lv-a4-cover-page", cssClass({ ...(needsScale ? innerScale : {}), width: a4W, height: a4H, background: '#1a1a2e', overflow: 'hidden', boxSizing: 'border-box' }))}>
            {backPage.image
                    ? <img src={backPage.image} alt="" className={cssClass({ width: '100%', height: '100%', objectFit: 'cover', display: 'block' })}/>
                    : <div className={cssClass({ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,.3)' })}>
                  <span className={cssClass({ fontSize: 40 })}>description</span>
                  <p className={cssClass({ margin: 0, fontSize: 14 })}>Back Cover</p>
                </div>}
          </div>
        </div>);
        /* product page — identical to lv-a4-page structure */
        const idx = item.pageIdx ?? 0;
        const prod = pages[idx] ?? [];
        const hs = headerSettings;
        const fs = footerSettings;
        const showHdr = settings.showHeader && hs.show;
        const showFtr = settings.showFooter && fs.show;
        return (<div className={cssClass(fmtWrap)}>
      <div className={cx("lv-pdf-page", cssClass({
            '--a4-cols': colsPerPage,
            '--a4-col-gap': `${colGap}px`,
            '--a4-row-gap': `${rowGap}px`,
            '--a4-rows': rowsPerPage,
            background: pageBg || '#ffffff',
            width: a4W,
            height: a4H,
            ...(needsScale ? innerScale : {}),
        } as React.CSSProperties))}>
        {/* Header — same as lv-a4-header */}
        {showHdr && (<div className={cx(`lv-a4-header${hs.widthMode === 'full' ? ' full-bleed' : ''}`, cssClass({
                ...headerStyle,
                justifyContent: hs.textAlign === 'center' ? 'center' : hs.textAlign === 'right' ? 'flex-end' : 'flex-start',
            }))}>
            {hs.logoUrl && (<div className={cx(`lv-a4-header-logo-box${typeof hs.logoX === 'number' && typeof hs.logoY === 'number' ? ' positioned' : ''}`, cssClass(typeof hs.logoX === 'number' && typeof hs.logoY === 'number'
                    ? { left: hs.logoX, top: hs.logoY, width: hs.logoWidth ?? hs.logoHeight ?? 44, height: hs.logoHeight ?? 44 }
                    : { width: hs.logoWidth, height: hs.logoHeight ?? 44, marginRight: hs.showText ? hs.logoGap ?? 10 : 0 }))}>
                <img src={hs.logoUrl} alt="" className={cx("lv-a4-header-logo", cssClass({ width: hs.logoWidth || (typeof hs.logoX === 'number' && typeof hs.logoY === 'number') ? '100%' : 'auto' }))}/>
              </div>)}
            {hs.showText && (<div className={cx(`lv-a4-title-box${typeof hs.textX === 'number' && typeof hs.textY === 'number' ? ' positioned' : ''}`, cssClass(typeof hs.textX === 'number' && typeof hs.textY === 'number'
                    ? { left: hs.textX, top: hs.textY, width: hs.textWidth ?? 180, height: hs.textHeight ?? 44 }
                    : undefined))}>
                <span className="lv-a4-title">
                  {settings.headerText || hs.text}
                </span>
              </div>)}
          </div>)}

        {/* Grid — same as lv-a4-grid-wrap > lv-a4-grid */}
        {prod.length > 0 ? (<div className="lv-a4-grid-wrap">
            <div className={cx("lv-a4-grid", cssClass({ width: gridW, height: gridH }))}>
              {prod.slice(0, colsPerPage * rowsPerPage).map(p => (<div key={p.id} className="lv-card-wrap">
                  {renderProductCard(p, { cardWidth, cardHeight })}
                </div>))}
            </div>
          </div>) : (<div className={cssClass({ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 })}>
            No products on this page
          </div>)}

        {/* Footer — same as lv-a4-footer */}
        {showFtr && (<div className={cx(`lv-a4-footer${fs.widthMode === 'full' ? ' full-bleed' : ''}`, cssClass({
                ...footerStyle,
                justifyContent: fs.textAlign === 'center' ? 'center' : fs.textAlign === 'right' ? 'flex-end' : 'flex-start',
            }))}>
            {fs.showText && (<span className="lv-a4-footer-text">
                {settings.footerText || fs.text}
              </span>)}
            {settings.showPageNums && (<span className="lv-a4-footer-pagenum">{pageNum}</span>)}
          </div>)}

        {/* Page number standalone */}
        {settings.showPageNums && !showFtr && (<div className={cssClass({
                position: 'absolute',
                fontSize: 11,
                color: '#64748b',
                ...(settings.pageNumPos === 'bottom-center' ? { bottom: 10, left: '50%', transform: 'translateX(-50%)' } :
                    settings.pageNumPos === 'bottom-right' ? { bottom: 10, right: 14 } :
                        settings.pageNumPos === 'bottom-left' ? { bottom: 10, left: 14 } :
                            settings.pageNumPos === 'top-center' ? { top: 10, left: '50%', transform: 'translateX(-50%)' } :
                                settings.pageNumPos === 'top-right' ? { top: 10, right: 14 } :
                                    { top: 10, left: 14 }),
            })}>
            {pageNum}
          </div>)}
      </div>
      </div>);
    }
    /* ── Scaled preview wrapper ─────────────────────────────────
       Container is sized to scaled dimensions so it takes the
       correct layout space. Content renders at full A4 size
       inside, then CSS transform scales it down visually.
       overflow:hidden clips any sub-pixel rounding.
    ─────────────────────────────────────────────────────────── */
    function renderPreviewPage(item: BookPageItem, pageNum: number) {
        return (<div className={cssClass({ width: Math.round(a4W * scale), height: Math.round(a4H * scale), overflow: 'hidden', flexShrink: 0, borderRadius: 2 })}>
        <div className={cssClass({ transform: `scale(${scale})`, transformOrigin: 'top left', width: a4W, height: a4H })}>
          {renderPageContent(item, pageNum)}
        </div>
      </div>);
    }
    /* ── Export via iframe ──────────────────────────────────────
       Creates a hidden iframe, injects all app CSS + renders
       the pages via React into the iframe body, then prints.
       The lv-pdf-page @media print rules in LeafletView.css
       handle page sizing automatically.
    ─────────────────────────────────────────────────────────── */
    async function handleExport(type: ExportType) {
        if (hasErrors || exporting)
            return;
        setExporting(true);
        /* decide which pages and page-number mapping */
        let printGroups: Array<Array<{
            item: BookPageItem;
            num: number;
        }>> = [];
        const productPages = bookPages.filter(p => p.type === 'products');
        if (type === 'booklet-pdf') {
            const spreads = buildBookletPages(bookPages);
            printGroups = spreads.map(spread => spread.map(item => ({
                item,
                num: productPages.findIndex(p => p.pageIdx === item.pageIdx) + 1,
            })));
        }
        else {
            printGroups = bookPages.map(item => ([{
                    item,
                    num: productPages.findIndex(p => p.pageIdx === item.pageIdx) + 1,
                }]));
        }
        /* collect all app stylesheets */
        const styleLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
            .map(el => `<link rel="stylesheet" href="${el.href}">`)
            .join('\n');
        const inlineStyles = Array.from(document.querySelectorAll<HTMLStyleElement>('style'))
            .filter(el => el.id !== 'bb-print-style')
            .map(el => `<style>${el.textContent}</style>`)
            .join('\n');
        /* page size for @page */
        const pageSize = fmt.cssSize;
        const spreadSize = `${(fmtW * 2 / 96 * 25.4).toFixed(1)}mm ${(fmtH / 96 * 25.4).toFixed(1)}mm`;
        /* create iframe */
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;visibility:hidden;';
        document.body.appendChild(iframe);
        iframeRef.current = iframe;
        const iDoc = iframe.contentDocument!;
        iDoc.open();
        iDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${leafletTitle}</title>
${styleLinks}
${inlineStyles}
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; }
  @page {
    size: ${type === 'booklet-pdf' ? spreadSize : pageSize};
    margin: 0;
  }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body > *:not(#bb-print-body) { display: none !important; }
    body > #bb-print-body { display: block !important; }

    /* Force exact format page dimensions in pixels */
    .lv-pdf-page {
      display: flex !important;
      flex-direction: column !important;
      width: ${fmtW}px !important;
      height: ${fmtH}px !important;
      max-height: ${fmtH}px !important;
      min-height: ${fmtH}px !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .lv-pdf-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Header / footer fixed heights */
    .lv-a4-header {
      flex-shrink: 0 !important;
      width: 100% !important;
      height: ${headerSettings.height}px !important;
      min-height: ${headerSettings.height}px !important;
      max-height: ${headerSettings.height}px !important;
      overflow: hidden !important;
    }
    .lv-a4-footer {
      flex-shrink: 0 !important;
      width: 100% !important;
      height: ${footerSettings.height}px !important;
      min-height: ${footerSettings.height}px !important;
      max-height: ${footerSettings.height}px !important;
      margin-top: 0 !important;
      overflow: hidden !important;
    }

    /* Grid wrap: take remaining space, no extra flex growth */
    .lv-a4-grid-wrap {
      flex: 1 1 0 !important;
      min-height: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Grid: exact fixed size, no stretching */
    .lv-a4-grid {
      display: grid !important;
      grid-template-columns: repeat(${colsPerPage}, ${cardWidth}px) !important;
      grid-template-rows: repeat(${rowsPerPage}, ${cardHeight}px) !important;
      column-gap: ${colGap}px !important;
      row-gap: ${rowGap}px !important;
      width: ${gridW}px !important;
      height: ${gridH}px !important;
      flex-shrink: 0 !important;
      overflow: hidden !important;
    }

    /* Cards: exact dimensions */
    .lv-a4-grid .lv-card-wrap {
      width: ${cardWidth}px !important;
      height: ${cardHeight}px !important;
      overflow: hidden !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .lv-a4-grid .lv-card {
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
    }

    /* Booklet spreads */
    .bb-spread {
      page-break-after: always !important;
      break-after: page !important;
      display: flex !important;
      width: ${a4W * 2}px !important;
      height: ${a4H}px !important;
    }
    .bb-spread:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    /* Hide interactive card elements */
    .lv-card-actions,
    .lv-confirm-del,
    .lv-card-wrap > [draggable] { pointer-events: none !important; }
    .lv-card-actions { display: none !important; }
  }
</style>
</head>
<body>
<div id="bb-print-body"></div>
</body>
</html>`);
        iDoc.close();
        /* render all pages into iframe via React */
        const container = iDoc.getElementById('bb-print-body')!;
        const PrintDoc = () => (<div>
        {printGroups.map((group, gi) => type === 'booklet-pdf' ? (<div key={gi} className="bb-spread">
              {group.map(({ item, num }, pi) => (<div key={`${item.id}-${num}-${pi}`} className={cssClass({ width: a4W, height: a4H, overflow: 'hidden', flexShrink: 0 })}>
                  {renderPageContent(item, num)}
                </div>))}
            </div>) : (<React.Fragment key={gi}>
              {group.map(({ item, num }, pi) => (<React.Fragment key={`${item.id}-${num}-${pi}`}>
                  {renderPageContent(item, num)}
                </React.Fragment>))}
            </React.Fragment>))}
      </div>);
        const root = createRoot(container);
        root.render(<PrintDoc />);
        /* wait for React paint + image loads */
        await new Promise<void>(resolve => {
            setTimeout(() => {
                const imgs = Array.from(iDoc.querySelectorAll<HTMLImageElement>('img'));
                if (imgs.length === 0) {
                    resolve();
                    return;
                }
                let done = 0;
                const tick = () => { if (++done >= imgs.length)
                    resolve(); };
                imgs.forEach(img => {
                    if (img.complete)
                        tick();
                    else {
                        img.onload = tick;
                        img.onerror = tick;
                    }
                });
                setTimeout(resolve, 4000);
            }, 300);
        });
        iframe.contentWindow!.focus();
        iframe.contentWindow!.print();
        const cleanup = () => {
            try {
                root.unmount();
            }
            catch { /* ignore */ }
            iframe.remove();
            iframeRef.current = null;
            setExporting(false);
        };
        iframe.contentWindow!.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 20000);
    }
    /* ── Derived ── */
    const previewItem = bookPages.find(p => p.id === previewPageId) ?? bookPages[0];
    const previewIdx = bookPages.indexOf(previewItem);
    const productPages = bookPages.filter(p => p.type === 'products');
    const previewNum = productPages.findIndex(p => p.pageIdx === previewItem?.pageIdx) + 1;
    const missingIdxs = pages.map((_, i) => i).filter(i => !bookPages.some(p => p.type === 'products' && p.pageIdx === i));
    /* ─────────────── Render ───────────────────────────────────── */
    return (<div className="bb-overlay" onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}>
      <div className="bb-modal">

        {/* Header */}
        <div className="bb-header">
          <div className="bb-header-left">
            <span className="bb-header-icon">menu_book</span>
            <div>
              <div className="bb-header-title">Convert to Printable Book</div>
              <div className="bb-header-sub">{leafletTitle} · {bookPages.length} page{bookPages.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <button className="bb-btn bb-btn-ghost" onClick={onClose}>✕ Close</button>
        </div>

        {/* Body */}
        <div className="bb-body">

          {/* ── Left: Pages ── */}
          <div className="bb-panel-left">
            <div className="bb-panel-title">Pages</div>

            {missingIdxs.length > 0 && (<div className="bb-missing-pages">
                <div className="bb-missing-label">Add pages:</div>
                <div className="bb-missing-list">
                  {missingIdxs.map(i => (<button key={i} className="bb-add-pg-btn" onClick={() => addProductPage(i)}>+ Page {i + 1}</button>))}
                </div>
              </div>)}

            <div className="bb-thumbs" onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null); }}>
              {bookPages.map((item, idx) => (<BookPageThumb key={item.id} item={item} index={idx} selected={previewPageId === item.id} onSelect={() => setPreviewPageId(item.id)} onRemove={() => removePage(item.id)} draggingIdx={draggingIdx} onDragStart={setDraggingIdx} onDragOver={setDragOverIdx} onDrop={handleDrop}/>))}
            </div>

            <div className="bb-page-actions">
              <button className="bb-btn bb-btn-sm bb-btn-ghost" onClick={addBlankPage}>+ Blank Page</button>
            </div>

            {preflight.length > 0 && (<div className="bb-preflight">
                <div className="bb-preflight-title">Preflight</div>
                {preflight.map((issue, i) => (<div key={i} className={`bb-preflight-item bb-pf-${issue.level}`}>
                    <span className="bb-pf-icon">{issue.level === 'error' ? 'cancel' : issue.level === 'warning' ? 'warning' : 'info'}</span>
                    <span>{issue.msg}</span>
                  </div>))}
              </div>)}
          </div>

          {/* ── Center: Preview ── */}
          <div className="bb-panel-center">
            <div className="bb-preview-toolbar">
              <div className="bb-preview-modes">
                {(['reader', 'print', 'spread'] as PreviewMode[]).map(m => (<button key={m} className={`bb-mode-btn${previewMode === m ? ' active' : ''}`} onClick={() => setPreviewMode(m)}>
                    {m === 'reader' ? 'visibility Reader' : m === 'print' ? 'print Print' : 'content_paste Spread'}
                  </button>))}
              </div>
              <div className="bb-zoom-row">
                <button className="bb-zoom-btn" onClick={() => setPreviewZoom(z => Math.max(15, z - 10))}>−</button>
                <input type="range" min={15} max={110} step={5} value={previewZoom} onChange={e => setPreviewZoom(+e.target.value)} className="bb-zoom-slider"/>
                <button className="bb-zoom-btn" onClick={() => setPreviewZoom(z => Math.min(110, z + 10))}>+</button>
                <span className="bb-zoom-label">{previewZoom}%</span>
              </div>
            </div>

            <div className="bb-preview-area">
              {previewMode === 'spread' ? (<div className="bb-spread-preview">
                  {bookPages.reduce<BookPageItem[][]>((acc, p, i) => {
                if (i % 2 === 0)
                    acc.push([p]);
                else
                    acc[acc.length - 1]?.push(p);
                return acc;
            }, []).map((spread, si) => (<div key={si} className="bb-spread-row">
                      {spread.map((item, pi) => {
                    const pn = productPages.findIndex(p => p.pageIdx === item.pageIdx) + 1;
                    return (<div key={pi} className={`bb-spread-page-wrap${previewPageId === item.id ? ' selected' : ''}`} onClick={() => setPreviewPageId(item.id)}>
                            <div className="bb-page-shadow">
                              {renderPreviewPage(item, pn)}
                            </div>
                          </div>);
                })}
                    </div>))}
                </div>) : (<div className="bb-single-preview">
                  {previewItem && (<div className="bb-page-shadow">
                      {renderPreviewPage(previewItem, previewNum)}
                    </div>)}
                  <div className="bb-page-nav">
                    <button className="bb-nav-btn" disabled={previewIdx <= 0} onClick={() => previewIdx > 0 && setPreviewPageId(bookPages[previewIdx - 1]!.id)}>‹</button>
                    <span className="bb-nav-label">{previewIdx + 1} / {bookPages.length}</span>
                    <button className="bb-nav-btn" disabled={previewIdx >= bookPages.length - 1} onClick={() => previewIdx < bookPages.length - 1 && setPreviewPageId(bookPages[previewIdx + 1]!.id)}>›</button>
                  </div>
                </div>)}
            </div>
          </div>

          {/* ── Right: Settings ── */}
          <div className="bb-panel-right">
            <div className="bb-right-scroll">

              {/* Format presets (info only) */}
              <div className="bb-section">
                <div className="bb-section-title">Format</div>
                <div className="bb-presets-grid">
                  {PRESETS.map(p => (<div key={p.id} className={`bb-preset-btn${selectedFormat === p.id ? ' active' : ''}`} onClick={() => setSelectedFormat(p.id as BookFormatId)}>
                      <span className="bb-preset-icon">{p.icon}</span>
                      <span className="bb-preset-label">{p.label}</span>
                    </div>))}
                </div>
                <div className="bb-format-note">
                  Output format: {PRESETS.find(p => p.id === selectedFormat)?.label ?? 'A4 Portrait'}.
                  {contentScale < 0.99 ? ` Content scaled to ${Math.round(contentScale * 100)}% to fit.` : ''}
                </div>
              </div>

              {/* Page numbers */}
              <div className="bb-section">
                <div className="bb-section-title">Page Numbers</div>
                <div className="bb-row bb-row-switch">
                  <label className="bb-label">Show</label>
                  <label className="bb-switch"><input type="checkbox" checked={settings.showPageNums} onChange={e => setSetting('showPageNums', e.target.checked)}/><span className="bb-switch-track"/></label>
                </div>
                {settings.showPageNums && (<div className="bb-row"><label className="bb-label">Position</label>
                    <select className="bb-select" value={settings.pageNumPos} onChange={e => setSetting('pageNumPos', e.target.value as BookSettings['pageNumPos'])}>
                      <option value="bottom-center">Bottom Center</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-center">Top Center</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>)}
              </div>

              {/* Header / Footer */}
              <div className="bb-section">
                <div className="bb-section-title">Header / Footer</div>
                <div className="bb-row bb-row-switch"><label className="bb-label">Header</label>
                  <label className="bb-switch"><input type="checkbox" checked={settings.showHeader} onChange={e => setSetting('showHeader', e.target.checked)}/><span className="bb-switch-track"/></label></div>
                {settings.showHeader && <div className="bb-row"><input className="bb-input-text" type="text" value={settings.headerText} placeholder="Header text…" onChange={e => setSetting('headerText', e.target.value)}/></div>}
                <div className="bb-row bb-row-switch"><label className="bb-label">Footer</label>
                  <label className="bb-switch"><input type="checkbox" checked={settings.showFooter} onChange={e => setSetting('showFooter', e.target.checked)}/><span className="bb-switch-track"/></label></div>
                {settings.showFooter && <div className="bb-row"><input className="bb-input-text" type="text" value={settings.footerText} placeholder="Footer text…" onChange={e => setSetting('footerText', e.target.value)}/></div>}
              </div>

              {/* Booklet */}
              <div className="bb-section">
                <div className="bb-section-title">Booklet Mode</div>
                <div className="bb-row bb-row-switch"><label className="bb-label">Saddle-stitch</label>
                  <label className="bb-switch"><input type="checkbox" checked={settings.bookletMode} onChange={e => setSetting('bookletMode', e.target.checked)}/><span className="bb-switch-track"/></label></div>
                {settings.bookletMode && (<div className="bb-booklet-info">
                    Pages rearranged for folded printing.
                    {bookPages.length % 4 !== 0 && <strong> {4 - bookPages.length % 4} blank page(s) will be added.</strong>}
                  </div>)}
              </div>

              {/* Export */}
              <div className="bb-section bb-export-section">
                <div className="bb-section-title">Export</div>
                {hasErrors && <div className="bb-export-error">Fix preflight errors first.</div>}
                <button className="bb-export-btn bb-export-primary" disabled={hasErrors || exporting} onClick={() => handleExport('print-pdf')}>
                  {exporting ? '⏳ Preparing…' : 'print Export Print-Ready PDF'}
                </button>
                <button className="bb-export-btn bb-export-secondary" disabled={hasErrors || exporting || !settings.bookletMode} onClick={() => handleExport('booklet-pdf')} title={!settings.bookletMode ? 'Enable Booklet Mode first' : ''}>
                  auto_stories Export Booklet PDF
                </button>
                <div className="bb-export-hint">Opens browser print dialog — save as PDF for best results.</div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>);
}
