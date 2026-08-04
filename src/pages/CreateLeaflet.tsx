import { cssClass, cx } from '../utils/styleClass';
/**
 * CreateLeaflet.tsx
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Protected page (requires auth) for creating a new leaflet by importing
 * products from a CSV or Excel file.
 *
 * Stepper flow:
 *   Step 1 â†’ Upload file
 *   Step 2 â†’ Preview & Fix imported data
 *   Step 3 â†’ Name & submit the leaflet
 */
import { useRef, useState, useEffect, useCallback, type CSSProperties, type DragEvent, type ChangeEvent, } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { parseFile, generateErrorReportCSV } from '../services/parseImport';
import { createLeaflet, saveLeafletLayout } from '../services/api';
import type { ImportResult, ParsedProduct } from '../types/leaflet';
import './CreateLeaflet.css';
const CREATE_LEAFLET_TOUR_SEEN_KEY = 'leafletai_create_leaflet_tour_seen';
const CREATE_LEAFLET_TOUR_SKIPPED_KEY = 'leafletai_create_leaflet_tour_skipped';
function defaultLeafletTitle(fileName?: string) {
    const base = String(fileName || '')
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (base)
        return base.slice(0, 100);
    return `Leaflet ${new Date().toISOString().slice(0, 10)}`;
}
const CREATE_LEAFLET_TOUR_STEPS = [
    {
        target: '.cl-topbar',
        title: 'Create Leaflet overview',
        body: 'Start here when you need a new leaflet. The flow keeps the upload, review, and creation steps in one place.',
    },
    {
        target: '.cl-step-nav',
        title: 'Follow the creation steps',
        body: 'Use this rail to see where you are: upload the file, review product rows, then create the leaflet.',
    },
    {
        target: '.cl-dropzone',
        title: 'Upload product data',
        body: 'Drag a CSV or Excel file into this area, or browse from your computer. Imported rows become product cards.',
    },
    {
        target: '.cl-header-note',
        title: 'Header row and template',
        body: 'The first row must contain the column headers. Open the schema area or download the Excel template when you need the correct format.',
    },
    {
        target: '.cl-content',
        title: 'Templates and cards',
        body: 'New leaflets automatically use Template 2 for the product card layout, including colors, spacing, fonts, and title alignment.',
    },
    {
        target: '.cl-content',
        title: 'Header and design tools',
        body: 'After the leaflet is created, open it to adjust cards, the header, layout spacing, shapes, and other design tools.',
    },
] as const;
const TEMPLATE_EDITABLE_ROWS = 1000;
function addStyleElement(stylesXml: string, tagName: 'fonts' | 'fills' | 'cellXfs', elementXml: string) {
    const openTag = new RegExp(`<${tagName}([^>]*)count="(\\d+)"([^>]*)>`);
    const match = stylesXml.match(openTag);
    const styleId = match ? Number(match[2]) : 0;
    const nextXml = stylesXml
        .replace(openTag, `<${tagName}$1count="${styleId + 1}"$3>`)
        .replace(`</${tagName}>`, `${elementXml}</${tagName}>`);
    return { stylesXml: nextXml, styleId };
}
function applyCellStyle(sheetXml: string, cellRef: string, styleId: number) {
    const cellTag = new RegExp(`<c r="${cellRef}"([^>]*)>`);
    return sheetXml.replace(cellTag, (_match, attrs: string) => {
        const nextAttrs = attrs.replace(/\s+s="\d+"/, '');
        return `<c r="${cellRef}"${nextAttrs} s="${styleId}">`;
    });
}
function patchTemplateWorkbookStyles(buffer: ArrayBuffer, headers: string[]) {
    const zip = unzipSync(new Uint8Array(buffer));
    let stylesXml = strFromU8(zip['xl/styles.xml']);
    const boldFont = '<font><b/><sz val="12"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>';
    const yellowFill = '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>';
    let fontResult = addStyleElement(stylesXml, 'fonts', boldFont);
    stylesXml = fontResult.stylesXml;
    let fillResult = addStyleElement(stylesXml, 'fills', yellowFill);
    stylesXml = fillResult.stylesXml;
    const headerCellXf = `<xf numFmtId="0" fontId="${fontResult.styleId}" fillId="${fillResult.styleId}" borderId="0" xfId="0" ` +
        'applyFont="1" applyFill="1" applyAlignment="1">' +
        '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>';
    let headerResult = addStyleElement(stylesXml, 'cellXfs', headerCellXf);
    stylesXml = headerResult.stylesXml;
    let sheetXml = strFromU8(zip['xl/worksheets/sheet1.xml']);
    headers.forEach((_header, col) => {
        const column = XLSX.utils.encode_col(col);
        sheetXml = applyCellStyle(sheetXml, `${column}1`, headerResult.styleId);
    });
    sheetXml = sheetXml.replace(/<sheetProtection[^>]*\/>/, '');
    sheetXml = sheetXml.replace(/<sheetProtection[^>]*>.*?<\/sheetProtection>/, '');
    zip['xl/styles.xml'] = strToU8(stylesXml);
    zip['xl/worksheets/sheet1.xml'] = strToU8(sheetXml);
    return zipSync(zip, { level: 6 });
}
function downloadStyledTemplateWorkbook(wb: XLSX.WorkBook, headers: string[], filename: string) {
    const workbookBuffer = XLSX.write(wb, {
        type: 'array',
        bookType: 'xlsx',
        cellStyles: true,
    }) as ArrayBuffer;
    const patchedWorkbook = patchTemplateWorkbookStyles(workbookBuffer, headers);
    const blobBuffer = new ArrayBuffer(patchedWorkbook.byteLength);
    new Uint8Array(blobBuffer).set(patchedWorkbook);
    const blob = new Blob([blobBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
function styleTemplateWorksheet(ws: XLSX.WorkSheet, headers: string[], editableRows = TEMPLATE_EDITABLE_ROWS) {
    const headerStyle = {
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } },
        font: { bold: true, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
    headers.forEach((header, col) => {
        const headerAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        ws[headerAddress] = ws[headerAddress] || { t: 's', v: header };
        ws[headerAddress].s = headerStyle;
        for (let row = 1; row <= editableRows; row += 1) {
            const address = XLSX.utils.encode_cell({ r: row, c: col });
            ws[address] = ws[address] || { t: 's', v: '' };
        }
    });
    ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: editableRows, c: headers.length - 1 },
    });
    ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }),
    };
}
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Template download
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function downloadTemplate() {
    const headers = [
        'product_name_lan1',
        'product_name_lan2',
        'product_img_url',
        'product_url',
        'origin_lan1',
        'origin_lan2',
        'old_price',
        'current_price',
    ];
    const sampleRows = [
        {
            product_name_lan1: 'Organic Olive Oil 500ml',
            product_name_lan2: 'Ø²ÙŠØª Ø²ÙŠØªÙˆÙ† Ø¹Ø¶ÙˆÙŠ 500 Ù…Ù„',
            product_img_url: 'https://example.com/images/olive-oil.jpg',
            product_url: 'https://example.com/products/olive-oil',
            origin_lan1: 'Greece',
            origin_lan2: 'Ø§Ù„ÙŠÙˆÙ†Ø§Ù†',
            old_price: '12.99',
            current_price: '9.99',
        },
        {
            product_name_lan1: 'Fresh Whole Milk 1L',
            product_name_lan2: 'Ø­Ù„ÙŠØ¨ Ø·Ø§Ø²Ø¬ ÙƒØ§Ù…Ù„ Ø§Ù„Ø¯Ø³Ù… 1 Ù„ØªØ±',
            product_img_url: 'https://example.com/images/milk.jpg',
            product_url: 'https://example.com/products/milk',
            origin_lan1: 'France',
            origin_lan2: 'ÙØ±Ù†Ø³Ø§',
            old_price: '',
            current_price: '1.49',
        },
        {
            product_name_lan1: 'Basmati Rice 5kg',
            product_name_lan2: 'Ø£Ø±Ø² Ø¨Ø³Ù…ØªÙŠ 5 ÙƒÙŠÙ„Ùˆ',
            product_img_url: 'https://example.com/images/rice.jpg',
            product_url: 'https://example.com/products/rice',
            origin_lan1: 'India',
            origin_lan2: 'Ø§Ù„Ù‡Ù†Ø¯',
            old_price: '8.50',
            current_price: '6.99',
        },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const wb = XLSX.utils.book_new();
    /* Style the header row by setting column widths */
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 22) }));
    styleTemplateWorksheet(ws, headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    /* Second sheet: column reference guide */
    const guideData = [
        { Column: 'product_name_lan1', Required: 'Yes', Description: 'Primary product name (language 1)' },
        { Column: 'product_name_lan2', Required: 'No', Description: 'Secondary product name (language 2 / bilingual mode)' },
        { Column: 'product_img_url', Required: 'Yes', Description: 'Full URL to the product image' },
        { Column: 'product_url', Required: 'Yes', Description: 'Full URL to the product page' },
        { Column: 'origin_lan1', Required: 'Yes', Description: 'Country of origin (language 1)' },
        { Column: 'origin_lan2', Required: 'No', Description: 'Country of origin (language 2 / bilingual mode)' },
        { Column: 'old_price', Required: 'Yes', Description: 'Original price before discount (leave blank if no discount). Formats: 12.50 Â· 12,50 Â· $12.50 Â· â‚¬12,50' },
        { Column: 'current_price', Required: 'Yes', Description: 'Current / sale price. Formats: 12.50 Â· 12,50 Â· $12.50 Â· â‚¬12,50' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Column Guide');
    downloadStyledTemplateWorkbook(wb, headers, 'leaflet_products_template.xlsx');
}
function downloadOneLanguageTemplate() {
    const headers = [
        'product_name_lan1',
        'product_img_url',
        'product_url',
        'origin_lan1',
        'old_price',
        'current_price',
    ];
    const sampleRows = [
        {
            product_name_lan1: 'Organic Olive Oil 500ml',
            product_img_url: 'https://example.com/images/olive-oil.jpg',
            product_url: 'https://example.com/products/olive-oil',
            origin_lan1: 'Greece',
            old_price: '12.99',
            current_price: '9.99',
        },
        {
            product_name_lan1: 'Fresh Whole Milk 1L',
            product_img_url: 'https://example.com/images/milk.jpg',
            product_url: 'https://example.com/products/milk',
            origin_lan1: 'France',
            old_price: '',
            current_price: '1.49',
        },
        {
            product_name_lan1: 'Basmati Rice 5kg',
            product_img_url: 'https://example.com/images/rice.jpg',
            product_url: 'https://example.com/products/rice',
            origin_lan1: 'India',
            old_price: '8.50',
            current_price: '6.99',
        },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const wb = XLSX.utils.book_new();
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 22) }));
    styleTemplateWorksheet(ws, headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const guideData = [
        { Column: 'product_name_lan1', Required: 'Yes', Description: 'Product name (language 1)' },
        { Column: 'product_img_url', Required: 'Yes', Description: 'Full URL to the product image' },
        { Column: 'product_url', Required: 'Yes', Description: 'Full URL to the product page' },
        { Column: 'origin_lan1', Required: 'Yes', Description: 'Country of origin (language 1)' },
        { Column: 'old_price', Required: 'Yes', Description: 'Original price before discount (leave blank if no discount). Formats: 12.50 - 12,50 - $12.50 - EUR12,50' },
        { Column: 'current_price', Required: 'Yes', Description: 'Current / sale price. Formats: 12.50 - 12,50 - $12.50 - EUR12,50' },
    ];
    const wsGuide = XLSX.utils.json_to_sheet(guideData);
    wsGuide['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Column Guide');
    downloadStyledTemplateWorkbook(wb, headers, 'leaflet_products_one_language_template.xlsx');
}
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Small reusable helpers
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function downloadBlob(content: string, filename: string, mime = 'text/csv') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
/** Truncate a string for table display */
function trunc(s: string, max = 40): string {
    return s.length > max ? s.slice(0, max) + 'â€¦' : s;
}
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Sub-components
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/* â”€â”€ Breadcrumb â”€â”€ */
function Breadcrumb() {
    return (<nav className="cl-breadcrumb" aria-label="breadcrumb">
      <Link to="/">App</Link>
      <span className="sep material-symbol" aria-hidden="true">chevron_right</span>
      <span>Leaflets</span>
      <span className="sep material-symbol" aria-hidden="true">chevron_right</span>
      <span className="current">Create</span>
    </nav>);
}
/* â”€â”€ Stepper header â”€â”€ */
type TourStep = (typeof CREATE_LEAFLET_TOUR_STEPS)[number];
function CreateLeafletTour({ open, stepIndex, steps, onBack, onNext, onSkip, onDone, }: {
    open: boolean;
    stepIndex: number;
    steps: readonly TourStep[];
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
    onDone: () => void;
}) {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({ top: 120, left: 32 });
    const current = steps[stepIndex];
    const isLast = stepIndex === steps.length - 1;
    useEffect(() => {
        if (!open || !current)
            return;
        let raf = 0;
        const updatePosition = () => {
            const target = document.querySelector(current.target);
            const rect = target?.getBoundingClientRect() ?? null;
            setTargetRect(rect);
            if (!rect) {
                setPopoverStyle({ top: 120, left: Math.max(16, window.innerWidth - 390) });
                return;
            }
            const popoverWidth = Math.min(360, window.innerWidth - 32);
            const popoverHeight = 230;
            const left = Math.min(window.innerWidth - popoverWidth - 16, Math.max(16, rect.left));
            const below = rect.bottom + 14;
            const above = rect.top - popoverHeight - 14;
            const top = below + popoverHeight < window.innerHeight ? below : Math.max(16, above);
            setPopoverStyle({ top, left });
        };
        const target = document.querySelector(current.target);
        target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        raf = window.requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [current, open]);
    if (!open || !current)
        return null;
    return (<>
      {targetRect && (<div className={cx("cl-tour-highlight", cssClass({
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
        }))} aria-hidden="true"/>)}
      <section className={cx("cl-tour-popover", cssClass(popoverStyle))} role="dialog" aria-live="polite" aria-label="Create Leaflet product tour">
        <div className="cl-tour-progress">
          <span>Step {stepIndex + 1} of {steps.length}</span>
          <button type="button" onClick={onSkip}>Skip tour</button>
        </div>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="cl-tour-dots" aria-hidden="true">
          {steps.map((_, idx) => (<span key={idx} className={idx === stepIndex ? 'active' : ''}/>))}
        </div>
        <div className="cl-tour-actions">
          <button type="button" className="cl-tour-secondary" onClick={onBack} disabled={stepIndex === 0}>
            Back
          </button>
          <button type="button" className="cl-tour-primary" onClick={isLast ? onDone : onNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </section>
    </>);
}
type StepStatus = 'pending' | 'active' | 'done';
function Stepper({ current }: {
    current: 1 | 2 | 3;
}) {
    const steps: {
        label: string;
    }[] = [
        { label: 'Upload File' },
        { label: 'Preview & Fix' },
        { label: 'Create Leaflet' },
    ];
    function status(n: number): StepStatus {
        if (n < current)
            return 'done';
        if (n === current)
            return 'active';
        return 'pending';
    }
    return (<div className="cl-stepper" role="list" aria-label="Progress steps">
      {steps.map((s, i) => {
            const n = i + 1;
            const st = status(n);
            return (<div key={s.label} className={`cl-step cl-step--${st}`} role="listitem" aria-current={st === 'active' ? 'step' : undefined}>
            <div className="cl-step-dot">
              {st === 'done' ? <span className="material-symbol" aria-hidden="true">check</span> : n}
            </div>
            <span className="cl-step-label">{s.label}</span>
          </div>);
        })}
    </div>);
}
/* â”€â”€ Import summary card â”€â”€ */
function SummaryCard({ result }: {
    result: ImportResult;
}) {
    const { summary } = result;
    return (<div className="cl-summary-grid">
      <div className="cl-summary-item">
        <div className="s-label">Total rows</div>
        <div className="s-value">{summary.total}</div>
      </div>
      <div className="cl-summary-item s-valid">
        <div className="s-label">Valid</div>
        <div className="s-value">{summary.valid}</div>
      </div>
      <div className="cl-summary-item s-invalid">
        <div className="s-label">Invalid</div>
        <div className="s-value">{summary.invalid}</div>
      </div>
      <div className="cl-summary-item">
        <div className="s-label">Language mode</div>
        <div className={cssClass({ marginTop: 8 })}>
          <span className={`cl-mode-badge ${summary.languageMode}`}>
            {summary.languageMode === 'two' ? 'public Bilingual' : 'edit_note Single language'}
          </span>
        </div>
      </div>
    </div>);
}
/* â”€â”€ Product table â”€â”€ */
const INITIAL_ROWS_SHOWN = 50;
function ProductTable({ products, languageMode, showOnlyInvalid, }: {
    products: ParsedProduct[];
    languageMode: 'one' | 'two';
    showOnlyInvalid: boolean;
}) {
    const [rowsShown, setRowsShown] = useState(INITIAL_ROWS_SHOWN);
    const filtered = showOnlyInvalid ? products.filter(p => !p.isValid) : products;
    const visible = filtered.slice(0, rowsShown);
    const remaining = filtered.length - visible.length;
    const isTwoLang = languageMode === 'two';
    if (!filtered.length) {
        return (<div className={cssClass({ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 })}>
        <span className="material-symbol">celebration</span> No invalid rows found.
      </div>);
    }
    return (<div className="cl-table-wrap">
      <table className="cl-table" aria-label="Imported products">
        <thead>
          <tr>
            <th>#</th>
            <th>Name {isTwoLang ? '(lan1)' : ''}</th>
            {isTwoLang && <th>Name (lan2)</th>}
            <th>Current Price</th>
            <th>Old Price</th>
            <th>Origin {isTwoLang ? '(lan1)' : ''}</th>
            {isTwoLang && <th>Origin (lan2)</th>}
            <th>Image URL</th>
            <th>Product URL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(p => (<tr key={p.rowIndex} className={p.isValid ? '' : 'row-invalid'}>
              <td className="td-row">{p.rowIndex}</td>
              <td title={p.product_name_lan1}>{trunc(p.product_name_lan1)}</td>
              {isTwoLang && <td title={p.product_name_lan2}>{trunc(p.product_name_lan2)}</td>}
              <td>
                {p.current_price !== null
                ? p.current_price.toFixed(2)
                : <span className={cssClass({ color: '#ff8b8b' })}>{p.current_price_raw || 'â€”'}</span>}
              </td>
              <td>
                {p.old_price !== null
                ? p.old_price.toFixed(2)
                : (p.old_price_raw ? <span className={cssClass({ color: '#ff8b8b' })}>{p.old_price_raw}</span> : 'â€”')}
              </td>
              <td>{trunc(p.origin_lan1) || 'â€”'}</td>
              {isTwoLang && <td>{trunc(p.origin_lan2) || 'â€”'}</td>}
              <td title={p.product_img_url}>
                {p.product_img_url
                ? <a href={p.product_img_url} target="_blank" rel="noreferrer" className={cssClass({ color: 'var(--brand)' })}>link</a>
                : 'â€”'}
              </td>
              <td title={p.product_url}>
                {p.product_url
                ? <a href={p.product_url} target="_blank" rel="noreferrer" className={cx("material-symbol", cssClass({ color: 'var(--brand)' }))} aria-label="Open product link">link</a>
                : 'â€”'}
              </td>
              <td className="td-status">
                {p.isValid ? (<span className="cl-badge valid"><span className="material-symbol" aria-hidden="true">check</span> Valid</span>) : (<>
                    <span className="cl-badge invalid"><span className="material-symbol" aria-hidden="true">close</span> {p.errors.length} error{p.errors.length > 1 ? 's' : ''}</span>
                    <ul className="cl-row-errors">
                      {p.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </>)}
              </td>
            </tr>))}
        </tbody>
      </table>

      {remaining > 0 && (<button className="cl-show-more" onClick={() => setRowsShown(n => n + INITIAL_ROWS_SHOWN)}>
          Show {Math.min(remaining, INITIAL_ROWS_SHOWN)} more rows ({remaining} remaining)
        </button>)}
    </div>);
}
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main page component
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
type Step = 1 | 2 | 3;
export default function CreateLeaflet() {
    const navigate = useNavigate();
    /* â”€â”€ Step navigation â”€â”€ */
    const [step, setStep] = useState<Step>(1);
    /* â”€â”€ Step 1: file upload â”€â”€ */
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    /* â”€â”€ Step 2: preview â”€â”€ */
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
    const [importAll, setImportAll] = useState(true);
    /* â”€â”€ Add-product modal â”€â”€ */
    const EMPTY_PRODUCT = (): ParsedProduct => ({
        rowIndex: Date.now(),
        name: '', price: null, originalPrice: null,
        image: '', origin: '', unit: '', barcode: '', url: '',
        isValid: true, errors: [],
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProduct, setNewProduct] = useState<ParsedProduct>(EMPTY_PRODUCT);
    /* â”€â”€ Step 3: create form â”€â”€ */
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | number | null>(null);
    /* â”€â”€ Default leaflet â”€â”€ */
    const [defaultLeaflet, setDefaultLeaflet] = useState<{
        id: number;
        title: string;
        layout_json: string | null;
    } | null>(null);
    const [applyDefault, setApplyDefault] = useState(true);
    /* Create Leaflet product tour */
    const [tourOpen, setTourOpen] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    const [tourSkipped, setTourSkipped] = useState(false);
    const startTour = useCallback(() => {
        setTourStep(0);
        setTourSkipped(false);
        setTourOpen(true);
    }, []);
    const closeTour = useCallback((skipped: boolean) => {
        localStorage.setItem(CREATE_LEAFLET_TOUR_SEEN_KEY, '1');
        localStorage.setItem(CREATE_LEAFLET_TOUR_SKIPPED_KEY, skipped ? '1' : '0');
        setTourSkipped(skipped);
        setTourOpen(false);
    }, []);
    useEffect(() => {
        const hasSeenTour = localStorage.getItem(CREATE_LEAFLET_TOUR_SEEN_KEY) === '1';
        setTourSkipped(localStorage.getItem(CREATE_LEAFLET_TOUR_SKIPPED_KEY) === '1');
        if (!hasSeenTour) {
            const timer = window.setTimeout(() => setTourOpen(true), 350);
            return () => window.clearTimeout(timer);
        }
    }, []);
    useEffect(() => {
        const token = localStorage.getItem('leafletai_token') || localStorage.getItem('token');
        if (!token)
            return;
        fetch('/api/user/default-leaflet', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(() => setDefaultLeaflet(null))
            .catch(() => { });
    }, []);
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       File handling
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const acceptedFile = useCallback(async (f: File) => {
        setFile(f);
        setTitle(current => current.trim() ? current : defaultLeafletTitle(f.name));
        setParseError(null);
        setParsing(true);
        try {
            const result = await parseFile(f);
            setImportResult(result);
            setStep(2);
        }
        catch (e) {
            setParseError(e instanceof Error ? e.message : 'Unknown error while parsing file.');
            setImportResult(null);
        }
        finally {
            setParsing(false);
        }
    }, []);
    function onFileInput(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f)
            acceptedFile(f);
        e.target.value = ''; // allow re-selecting same file
    }
    function onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files[0];
        if (f)
            acceptedFile(f);
    }
    function onDragOver(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragActive(true);
    }
    function removeFile() {
        setFile(null);
        setImportResult(null);
        setParseError(null);
        setStep(1);
    }
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Error-report download
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    function downloadErrorReport() {
        if (!importResult)
            return;
        const csv = generateErrorReportCSV(importResult.products);
        if (!csv)
            return;
        downloadBlob(csv, `leaflet-errors-${Date.now()}.csv`);
    }
    function handleAddProduct() {
        if (!importResult || !newProduct.name.trim())
            return;
        const product: ParsedProduct = {
            ...newProduct,
            rowIndex: Date.now(),
            isValid: !!newProduct.name.trim(),
            errors: newProduct.name.trim() ? [] : ['Name is required'],
        };
        const updated = [...importResult.products, product];
        setImportResult({
            ...importResult,
            products: updated,
            summary: {
                ...importResult.summary,
                total: updated.length,
                valid: updated.filter(p => p.isValid).length,
                invalid: updated.filter(p => !p.isValid).length,
            },
        });
        setShowAddModal(false);
        setNewProduct(EMPTY_PRODUCT());
    }
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Reset
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    function reset() {
        setFile(null);
        setImportResult(null);
        setParseError(null);
        setTitle('');
        setDescription('');
        setSubmitError(null);
        setSuccessId(null);
        setShowOnlyInvalid(false);
        setImportAll(true);
        setStep(1);
    }
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Submission
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    async function handleSubmit(redirectToLeaflet = false) {
        if (!importResult)
            return;
        const finalTitle = (title.trim() || defaultLeafletTitle(file?.name)).slice(0, 100);
        const validProducts = importAll
            ? importResult.products
            : importResult.products.filter(p => p.isValid);
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await createLeaflet({
                title: finalTitle,
                description: description.trim(),
                languageMode: importResult.languageMode,
                products: validProducts,
            });
            // Apply default leaflet layout if user opted in
            if (false && applyDefault && defaultLeaflet?.layout_json) {
                try {
                    const layout = JSON.parse(String(defaultLeaflet?.layout_json ?? '{}'));
                    await saveLeafletLayout(String(res.id), layout);
                }
                catch {
                    // non-fatal â€” leaflet was still created
                }
            }
            if (redirectToLeaflet) {
                navigate(`/app/leaflet/${res.id}`);
                return;
            }
            setTitle(finalTitle);
            setSuccessId(res.id);
        }
        catch (e) {
            setSubmitError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
            if (redirectToLeaflet)
                setStep(3);
        }
        finally {
            setSubmitting(false);
        }
    }
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Derived values
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const validCount = importResult?.summary.valid ?? 0;
    const invalidCount = importResult?.summary.invalid ?? 0;
    const totalCount = validCount + invalidCount;
    const canProceed = importAll ? totalCount > 0 : validCount > 0;
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
       Render
    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
    const STEPS = [
        { num: 1, label: 'Upload File', icon: 'upload', desc: 'Import your product list from a CSV or Excel file.' },
        { num: 2, label: 'Review Products', icon: 'visibility', desc: 'Check imported rows, fix errors, and add products manually.' },
        { num: 3, label: 'Create Leaflet', icon: 'rocket_launch', desc: 'Name your leaflet. Template 2 is applied automatically.' },
    ];
    return (<div className="cl-page">
      {/* â”€â”€ Top bar â”€â”€ */}
      <div className="cl-topbar">
        <nav className="cl-breadcrumb" aria-label="breadcrumb">
          <a href="/my-leaflets">My Leaflets</a>
          <span className="cl-sep material-symbol" aria-hidden="true">chevron_right</span>
          <span className="cl-bc-current">Create Leaflet</span>
        </nav>
        <div className="cl-topbar-title">
          <h1 className="cl-page-title">Create a new leaflet</h1>
          <p className="cl-page-sub">Import your products from a file and build a professional leaflet in minutes.</p>
        </div>
        <div className="cl-tour-tools">
          {tourSkipped && !tourOpen && (<span className="cl-tour-reminder">Tour available anytime</span>)}
          <button type="button" className="cl-tour-replay" onClick={startTour}>
            Show Tour Again
          </button>
        </div>
      </div>

      {/* â”€â”€ Body: left step nav + right content â”€â”€ */}
      <CreateLeafletTour open={tourOpen} stepIndex={tourStep} steps={CREATE_LEAFLET_TOUR_STEPS} onBack={() => setTourStep(s => Math.max(0, s - 1))} onNext={() => setTourStep(s => Math.min(CREATE_LEAFLET_TOUR_STEPS.length - 1, s + 1))} onSkip={() => closeTour(true)} onDone={() => closeTour(false)}/>

      <div className="cl-body">
        <div className="cl-content">
          <aside className="cl-step-nav">
          {STEPS.map(s => {
            const done = step > s.num;
            const active = step === s.num;
            return (<div key={s.num} className={cx(`cl-snav-item${active ? ' cl-snav--active' : ''}${done ? ' cl-snav--done' : ''}`, cssClass({ cursor: done ? 'pointer' : 'default' }))} onClick={() => { if (done)
                setStep(s.num as Step); }}>
                <div className="cl-snav-dot">
                  {done ? <span className="material-symbol" aria-hidden="true">check</span> : s.num}
                </div>
                <div className="cl-snav-info">
                  <span className="cl-snav-label">{s.label}</span>
                  {active && <span className="cl-snav-desc">{s.desc}</span>}
                </div>
                {s.num < 3 && <div className="cl-snav-line"/>}
              </div>);
        })}

          {/* Default leaflet indicator in nav */}
          {defaultLeaflet && (<div className="cl-snav-default-badge">
              <span className="material-symbol" aria-hidden="true">star</span>
              <span>Default: <em>{defaultLeaflet.title}</em></span>
            </div>)}
          </aside>

        {/* â”€â”€ Right content â”€â”€ */}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            STEP 1 â€” Upload
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {step === 1 && (<div className="cl-card">
            <h2 className="cl-card-title"><span>upload</span> Upload your product file</h2>

            {/* Drop zone */}
            <div className={[
                'cl-dropzone',
                dragActive ? 'cl-dz--drag' : '',
                file ? 'cl-dz--has-file' : '',
            ].join(' ')} role="button" tabIndex={0} aria-label="Upload product file by drag & drop or click to browse" onClick={() => !file && inputRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ')
            inputRef.current?.click(); }} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={() => setDragActive(false)}>
              {file ? (<>
                  <span className="cl-dz-icon">description</span>
                  <div className="cl-file-badge">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{formatBytes(file.size)}</span>
                  <button className="cl-remove-file material-symbol" onClick={e => { e.stopPropagation(); removeFile(); }} aria-label="Remove file" title="Remove file">close</button>
                  </div>
                  {parsing && (<p className={cssClass({ marginTop: 14, color: 'var(--muted)', fontSize: 13 })}>
                      <span className="material-symbol" aria-hidden="true">progress_activity</span> Parsing file...
                    </p>)}
                </>) : (<>
                  <span className="cl-dz-icon">upload</span>
                  <p className="cl-dz-title">Drag & drop your file here</p>
                  <p className="cl-dz-sub">or click to browse from your computer</p>
                  <button type="button" className="btn primary" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
                    Browse file
                  </button>
                  <div className="cl-dz-types">
                    {['.csv', '.xlsx', '.xls'].map(t => (<span key={t} className="cl-type-chip">{t}</span>))}
                  </div>
                </>)}
            </div>

            {/* Hidden file input */}
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFileInput} className={cssClass({ display: 'none' })}/>

            {/* First-row-is-header note */}
            <div className="cl-header-note">
              <input type="checkbox" id="hdr-note" checked disabled readOnly/>
              <label htmlFor="hdr-note">
                First row is header â€” this is always required and cannot be changed.
              </label>
            </div>

            {/* Parse error */}
            {parseError && (<div className="cl-parse-error" role="alert">
                <strong><span className="material-symbol" aria-hidden="true">warning</span> Parse error:</strong> {parseError}
              </div>)}

            {/* Expected schema reference */}
            <details className="cl-schema-details" open>
              <summary className="cl-schema-summary" onClick={e => e.preventDefault()}>
                <span className="cl-schema-title-wrap">
                    <span className="cl-schema-main-icon" aria-hidden="true">view_column</span>
                  <span>
                    <span className="cl-schema-title">View expected column schema</span>
                    <span className="cl-schema-subtitle">Download a template and fill your product data using the required schema.</span>
                  </span>
                </span>
                <div className="cl-schema-downloads">
                  <button type="button" className="cl-schema-download cl-schema-download--single" onClick={downloadOneLanguageTemplate}>
                    <span className="cl-schema-download-icon" aria-hidden="true">download</span>
                    <span>
                      <strong>Download One-Language Excel Template</strong>
                      <small>For single language product data</small>
                    </span>
                  </button>
                  <button type="button" className="cl-schema-download cl-schema-download--bilingual" onClick={downloadTemplate}>
                    <span className="cl-schema-download-icon" aria-hidden="true">download</span>
                    <span>
                      <strong>Download Bilingual Language Excel Template</strong>
                      <small>For bilingual product data</small>
                    </span>
                  </button>
                </div>
              </summary>
              <div className="cl-schema-panel">
                <section className="cl-schema-section cl-schema-section--required">
                  <div className="cl-schema-section-head">
                    <span className="cl-schema-dot" aria-hidden="true"/>
                    <span className="cl-schema-section-icon" aria-hidden="true">description</span>
                    <h3>Required columns</h3>
                    <span className="cl-schema-pill">Must include</span>
                  </div>
                  <p>These columns are mandatory for your file to be accepted.</p>
                  <div className="cl-schema-chip-row">
                    <span className="cl-schema-chip"><span aria-hidden="true">text_fields</span>product_name_lan1</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">photo_camera</span>product_img_url</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">link</span>product_url</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">public</span>origin_lan1</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">sell</span>old_price</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">payments</span>current_price</span>
                  </div>
                </section>

                <section className="cl-schema-section cl-schema-section--optional">
                  <div className="cl-schema-section-head">
                    <span className="cl-schema-dot" aria-hidden="true"/>
                    <span className="cl-schema-section-icon" aria-hidden="true">translate</span>
                    <h3>Optional (Bilingual mode)</h3>
                    <span className="cl-schema-pill">Include if applicable</span>
                  </div>
                  <p>These columns are required only when using bilingual mode.</p>
                  <div className="cl-schema-chip-row">
                    <span className="cl-schema-chip"><span aria-hidden="true">text_fields</span>product_name_lan2</span>
                    <span className="cl-schema-chip"><span aria-hidden="true">public</span>origin_lan2</span>
                  </div>
                </section>

                <div className="cl-schema-tip">
                  <span aria-hidden="true">info</span>
                  <strong>Tip:</strong> Make sure to keep the column names unchanged. Additional columns will be ignored.
                </div>
              </div>
            </details>
          </div>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            STEP 2 â€” Preview & Fix
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {step === 2 && importResult && (<>
            {/* Summary card */}
            <div className={cx("cl-card", cssClass({ marginBottom: 20 }))}>
              <h2 className="cl-card-title"><span>monitoring</span> Import summary</h2>
              <SummaryCard result={importResult}/>

              {invalidCount > 0 && (<div className={cssClass({
                padding: '12px 16px', borderRadius: 12, fontSize: 13,
                background: 'rgba(255,107,107,.07)',
                border: '1px solid rgba(255,107,107,.20)',
                color: 'var(--muted)',
            })}>
                  <span className="material-symbol" aria-hidden="true">warning</span>&nbsp; <strong className={cssClass({ color: '#ff8b8b' })}>{invalidCount} row{invalidCount > 1 ? 's' : ''}</strong> have
                  validation errors and will be skipped during import. Review them below or
                  fix your file and re-upload.
                </div>)}

              {/* Import-all checkbox */}
              <label className="cl-import-all-row">
                <input type="checkbox" className="cl-import-all-checkbox" checked={importAll} onChange={e => setImportAll(e.target.checked)}/>
                <span className="cl-import-all-label">
                  Import all rows&nbsp;
                  <span className="cl-import-all-count">
                    ({totalCount} total â€” {validCount} valid
                    {invalidCount > 0 ? `, ${invalidCount} invalid` : ''})
                  </span>
                </span>
                {importAll && invalidCount > 0 && (<span className="cl-import-all-warn">
                    <span className="material-symbol" aria-hidden="true">warning</span> Invalid rows will be imported with missing fields left blank
                  </span>)}
              </label>
            </div>

            {/* Table card */}
            <div className="cl-card">
              <div className="cl-table-toolbar">
                <h3>
                  {importResult.summary.total} product{importResult.summary.total !== 1 ? 's' : ''}
                  &nbsp;
                  {file && (<span className={cssClass({ fontWeight: 400, color: 'var(--muted)', fontSize: 12 })}>
                      from {file.name}
                    </span>)}
                </h3>
                <div className="cl-toolbar-right">
                  <label className="cl-toggle-label">
                    <input type="checkbox" checked={showOnlyInvalid} onChange={e => setShowOnlyInvalid(e.target.checked)} disabled={invalidCount === 0}/>
                    Show only invalid ({invalidCount})
                  </label>
                  <button className="cl-btn-add-product" onClick={() => { setNewProduct(EMPTY_PRODUCT()); setShowAddModal(true); }} title="Add a new product manually">
                    <span className="material-symbol" aria-hidden="true">add</span> Add Product
                  </button>
                  <div className="cl-actions-right">
                    <button className="btn primary big" disabled={!canProceed || submitting} title={!canProceed ? 'At least 1 valid row is required' : undefined} onClick={() => handleSubmit(true)}>
                      {submitting ? <><span className="material-symbol" aria-hidden="true">progress_activity</span> Creating...</> : <>Continue to create <span className="material-symbol" aria-hidden="true">arrow_forward</span></>}
                    </button>
                  </div>
                </div>
              </div>

              <ProductTable products={importResult.products} languageMode={importResult.languageMode} showOnlyInvalid={showOnlyInvalid}/>

              {/* Action bar */}
              <div className="cl-actions">
                <div className={cssClass({ display: 'flex', gap: 10 })}>
                  <button className="btn ghost" onClick={reset}>
                    <span className="material-symbol" aria-hidden="true">undo</span> Reset import
                  </button>
                  {invalidCount > 0 && (<button className="btn ghost" onClick={downloadErrorReport}>
                      <span className="material-symbol" aria-hidden="true">download</span> Download error report
                    </button>)}
                </div>
                <div className="cl-actions-right">
                  <button className="btn primary big" disabled={!canProceed || submitting} title={!canProceed ? 'At least 1 valid row is required' : undefined} onClick={() => handleSubmit(true)}>
                    {submitting ? <><span className="material-symbol" aria-hidden="true">progress_activity</span> Creating...</> : <>Continue to create <span className="material-symbol" aria-hidden="true">arrow_forward</span></>}
                  </button>
                </div>
              </div>

              {!canProceed && (<p className={cssClass({ textAlign: 'right', fontSize: 12, color: '#ff8b8b', marginTop: 8 })}>
                  No valid rows â€” fix your file and re-upload.
                </p>)}
            </div>
          </>)}

        {/* â”€â”€ Add Product Modal â”€â”€ */}
        {showAddModal && (<div className="cl-modal-overlay" onClick={e => { if (e.target === e.currentTarget)
            setShowAddModal(false); }}>
            <div className="cl-modal-box" role="dialog" aria-modal="true" aria-label="Add product">
              <div className="cl-modal-header">
                <h3>Add New Product</h3>
                <button className="cl-modal-close material-symbol" onClick={() => setShowAddModal(false)} aria-label="Close">close</button>
              </div>
              <div className="cl-modal-body">
                <div className="cl-add-product-grid">
                  <div className="cl-field">
                    <label>Product Name <span className="cl-required">*</span></label>
                    <input className="cl-input" type="text" placeholder="e.g. Organic Milk 1L" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}/>
                  </div>
                  <div className="cl-field">
                    <label>Price</label>
                    <input className="cl-input" type="number" min="0" step="0.01" placeholder="0.00" value={newProduct.price ?? ''} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))}/>
                  </div>
                  <div className="cl-field">
                    <label>Original Price</label>
                    <input className="cl-input" type="number" min="0" step="0.01" placeholder="0.00" value={newProduct.originalPrice ?? ''} onChange={e => setNewProduct(p => ({ ...p, originalPrice: e.target.value ? Number(e.target.value) : null }))}/>
                  </div>
                  <div className="cl-field">
                    <label>Origin / Country</label>
                    <input className="cl-input" type="text" placeholder="e.g. UAE" value={newProduct.origin ?? ''} onChange={e => setNewProduct(p => ({ ...p, origin: e.target.value }))}/>
                  </div>
                  <div className="cl-field">
                    <label>Unit</label>
                    <input className="cl-input" type="text" placeholder="e.g. kg, L, pcs" value={newProduct.unit ?? ''} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}/>
                  </div>
                  <div className="cl-field">
                    <label>Barcode</label>
                    <input className="cl-input" type="text" placeholder="e.g. 6291003470214" value={newProduct.barcode ?? ''} onChange={e => setNewProduct(p => ({ ...p, barcode: e.target.value }))}/>
                  </div>
                  <div className="cl-field cl-field-full">
                    <label>Product URL</label>
                    <input className="cl-input" type="url" placeholder="https://example.com/product" value={newProduct.url ?? ''} onChange={e => setNewProduct(p => ({ ...p, url: e.target.value }))}/>
                  </div>
                  <div className="cl-field cl-field-full">
                    <label>Image URL</label>
                    <input className="cl-input" type="url" placeholder="https://example.com/image.jpg" value={newProduct.image ?? ''} onChange={e => setNewProduct(p => ({ ...p, image: e.target.value }))}/>
                    {newProduct.image && (<img src={newProduct.image} alt="preview" className="cl-add-img-preview" onError={e => (e.currentTarget.style.display = 'none')}/>)}
                  </div>
                </div>
              </div>
              <div className="cl-modal-footer">
                <button className="cl-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="cl-btn-primary" disabled={!newProduct.name.trim()} onClick={handleAddProduct}>Add Product</button>
              </div>
            </div>
          </div>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            STEP 3 â€” Create form
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {step === 3 && importResult && (<div className="cl-card">

            {successId !== null ? (
            /* â”€â”€ Success screen â”€â”€ */
            <div className="cl-success">
                <span className="cl-success-icon">celebration</span>
                <h2>Leaflet created!</h2>
                <p>
                  <strong className={cssClass({ color: 'var(--brand)' })}>{validCount}</strong> products
                  have been imported successfully.
                </p>
                <div className={cssClass({ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' })}>
                  <Link to={`/app/leaflet/${successId}`} className="btn primary big">
                    View leaflet <span className="material-symbol" aria-hidden="true">arrow_forward</span>
                  </Link>
                  <button className="btn ghost big" onClick={reset}>
                    Create another
                  </button>
                </div>
              </div>) : (
            /* â”€â”€ Create form â”€â”€ */
            <>
                <h2 className={cssClass({ margin: '0 0 24px', fontSize: 16, fontWeight: 700, color: 'var(--text)' })}>
                  Name your leaflet
                </h2>

                {/* Submission summary */}
                <div className="cl-submit-summary">
                  <strong>{validCount}</strong> valid product{validCount !== 1 ? 's' : ''} will be
                  imported
                  {invalidCount > 0 && (<>, <span className={cssClass({ color: '#ff8b8b' })}>{invalidCount} invalid row{invalidCount > 1 ? 's' : ''} will be skipped</span></>)}.
                  &nbsp;Language mode:
                  <span className={cx(`cl-mode-badge ${importResult.languageMode}`, cssClass({ marginLeft: 6 }))}>
                    <span className="material-symbol" aria-hidden="true">{importResult.languageMode === 'two' ? 'public' : 'edit_note'}</span>
                    {importResult.languageMode === 'two' ? 'Bilingual' : 'Single language'}
                  </span>
                </div>

                <div className={cssClass({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 10,
                background: 'rgba(73,242,182,.08)',
                border: '1px solid rgba(73,242,182,.28)',
                marginBottom: 20,
            })}>
                  <div className={cssClass({ flex: 1, fontSize: '.85rem', color: '#cbd5e1', lineHeight: 1.5 })}>
                    <span className={cssClass({ color: '#49f2b6', fontWeight: 700 })}>Template 2 is applied automatically.</span>
                    {' '}New leaflets will use Template 2 product card layout, including its colors, fonts, spacing, header height, and title alignment.
                  </div>
                </div>

                {/* Default leaflet banner */}
                {defaultLeaflet && (<div className={cssClass({
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(245,197,24,.08)',
                    border: '1px solid rgba(245,197,24,.3)',
                    marginBottom: 20,
                })}>
                    <span className={cx("material-symbol", cssClass({ flexShrink: 0, color: '#f5c518' }))} aria-hidden="true">star</span>
                    <div className={cssClass({ flex: 1, fontSize: '.85rem', color: '#cbd5e1' })}>
                      <span className={cssClass({ color: '#f5c518', fontWeight: 600 })}>Default layout</span>
                      {' '}<span className={cssClass({ color: '#94a3b8' })}>&ldquo;{defaultLeaflet.title}&rdquo; will be applied to this new leaflet.</span>
                    </div>
                    <label className={cssClass({ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '.8rem', color: '#94a3b8', flexShrink: 0 })}>
                      <input type="checkbox" checked={applyDefault} onChange={e => setApplyDefault(e.target.checked)} className={cssClass({ accentColor: '#f5c518' })}/>
                      Apply
                    </label>
                  </div>)}

                {/* Title */}
                <div className="cl-form-group">
                  <label htmlFor="lf-title">
                    Leaflet title <span className={cssClass({ color: '#ff8b8b' })}>*</span>
                    <span className="char-count">{title.length}/100</span>
                  </label>
                  <input id="lf-title" type="text" className={`input${!title.trim() && submitError ? ' error-border' : ''}`} placeholder="e.g. Summer 2025 Catalogue" value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} maxLength={100} autoFocus/>
                </div>

                {/* Description */}
                <div className="cl-form-group">
                  <label htmlFor="lf-desc">
                    Description <span className={cssClass({ color: 'var(--muted2)' })}>(optional)</span>
                    <span className="char-count">{description.length}/500</span>
                  </label>
                  <textarea id="lf-desc" className="cl-textarea" placeholder="Brief description of this leafletâ€¦" value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} maxLength={500}/>
                </div>

                {submitError && (<div className="cl-submit-error" role="alert"><span className="material-symbol" aria-hidden="true">warning</span> {submitError}</div>)}

                {/* Action bar */}
                <div className="cl-actions">
                  <button className="btn ghost" onClick={() => { setSubmitError(null); setStep(2); }}>
                    <span className="material-symbol" aria-hidden="true">arrow_back</span> Back to preview
                  </button>
                  <div className="cl-actions-right">
                    <button className="btn ghost" onClick={reset}>Reset</button>
                    <button className="btn primary big" disabled={!title.trim() || submitting} onClick={() => handleSubmit()}>
                      {submitting ? <><span className="material-symbol" aria-hidden="true">progress_activity</span> Creating...</> : <><span className="material-symbol" aria-hidden="true">rocket_launch</span> Create leaflet ({validCount} products)</>}
                    </button>
                  </div>
                </div>
              </>)}
          </div>)}
      </div>{/* /cl-content */}
      </div>{/* /cl-body */}
    </div>);
}

