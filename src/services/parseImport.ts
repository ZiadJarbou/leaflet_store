/**
 * parseImport.ts
 * ──────────────
 * Handles CSV (PapaParse) and Excel (SheetJS) file parsing,
 * header validation, row normalisation and validation,
 * language-mode detection, and error-report CSV generation.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedProduct, ImportResult, LanguageMode } from '../types/leaflet';

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

/** Columns that MUST be present in the file header */
const REQUIRED_COLS = [
  'product_name_lan1',
  'product_img_url',
  'product_url',
  'origin_lan1',
  'old_price',
  'current_price',
] as const;

/** Optional columns that trigger 2-language mode when both are present + populated */
const LAN2_COLS = ['product_name_lan2', 'origin_lan2'] as const;

/* ─────────────────────────────────────────────
   Utilities
───────────────────────────────────────────── */

/** Normalise a column header: lower-case, trim, collapse inner spaces to _ */
function normaliseKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a price string that may contain currency symbols, commas, or spaces.
 * Supports both "12.50" and "12,50" (European) formats.
 * Returns { value: number } on success or { value: null, error: string } on failure.
 */
function parsePrice(raw: string): { value: number | null; error?: string } {
  if (!raw || raw.trim() === '') return { value: null };

  // Strip everything except digits, dots, commas, and a leading minus
  const cleaned = raw.replace(/[^0-9.,\-]/g, '');

  // Detect European decimal notation: "12,50" (no thousands separator)
  // Heuristic: if there's exactly one comma and it's the last separator → decimal
  const hasComma = cleaned.includes(',');
  const hasDot   = cleaned.includes('.');
  let normalised = cleaned;

  if (hasComma && !hasDot) {
    // "12,50" → "12.50"   OR   "1.234,56" already stripped → "1234.56"
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && hasDot) {
    // "1,234.56" — comma is thousands separator
    normalised = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(normalised);
  if (isNaN(num)) {
    return { value: null, error: `Cannot parse price "${raw}"` };
  }
  return { value: Math.round(num * 10000) / 10000 }; // 4 dp precision
}

/** Returns true only for absolute http/https URLs */
function isValidUrl(url: string): boolean {
  if (!url) return true; // field is optional; empty = OK
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────
   Header validation
───────────────────────────────────────────── */

/**
 * Given a list of normalised column names from the file, return the names
 * of any REQUIRED columns that are missing.
 */
function findMissingColumns(normalisedHeaders: string[]): string[] {
  return REQUIRED_COLS.filter(col => !normalisedHeaders.includes(col));
}

/* ─────────────────────────────────────────────
   Language-mode detection
───────────────────────────────────────────── */

/**
 * Detect whether the data carries bilingual content.
 * Condition: both lan2 columns must exist in headers
 * AND at least one data row has a non-empty product_name_lan2.
 */
function detectLanguageMode(
  normalisedHeaders: string[],
  rows: Record<string, string>[],
): LanguageMode {
  const bothPresent = LAN2_COLS.every(col => normalisedHeaders.includes(col));
  if (!bothPresent) return 'one';

  const hasData = rows.some(r => (r['product_name_lan2'] ?? '').trim() !== '');
  return hasData ? 'two' : 'one';
}

/* ─────────────────────────────────────────────
   Row validation
───────────────────────────────────────────── */

function validateRow(
  raw: Record<string, string>,
  rowIndex: number,
): ParsedProduct {
  const errors: string[] = [];

  const product_name_lan1  = (raw['product_name_lan1']  ?? '').trim();
  const product_name_lan2  = (raw['product_name_lan2']  ?? '').trim();
  const product_img_url    = (raw['product_img_url']    ?? '').trim();
  const product_url        = (raw['product_url']        ?? '').trim();
  const origin_lan1        = (raw['origin_lan1']        ?? '').trim();
  const origin_lan2        = (raw['origin_lan2']        ?? '').trim();
  const old_price_raw      = (raw['old_price']          ?? '').trim();
  const current_price_raw  = (raw['current_price']      ?? '').trim();

  /* ── Required fields ── */
  if (!product_name_lan1) {
    errors.push('product_name_lan1 is required');
  }
  if (!current_price_raw) {
    errors.push('current_price is required');
  }

  /* ── Price parsing ── */
  const { value: current_price, error: cpErr } = parsePrice(current_price_raw);
  if (current_price_raw && cpErr) {
    errors.push(cpErr);
  } else if (current_price !== null && current_price <= 0) {
    errors.push(`current_price must be > 0 (got ${current_price})`);
  }

  const { value: old_price, error: opErr } = parsePrice(old_price_raw);
  if (old_price_raw && opErr) {
    errors.push(opErr);
  }

  /* ── URL validation ── */
  if (product_img_url && !isValidUrl(product_img_url)) {
    errors.push(`product_img_url is not a valid URL`);
  }
  if (product_url && !isValidUrl(product_url)) {
    errors.push(`product_url is not a valid URL`);
  }

  const isValid = errors.length === 0;

  return {
    rowIndex,
    product_name_lan1,
    product_name_lan2,
    product_img_url,
    product_url,
    origin_lan1,
    origin_lan2,
    old_price: old_price_raw && !opErr ? old_price : null,
    old_price_raw,
    current_price: current_price_raw && !cpErr && current_price! > 0 ? current_price : null,
    current_price_raw,
    errors,
    isValid,
  };
}

/* ─────────────────────────────────────────────
   Core processor: raw rows → ImportResult
───────────────────────────────────────────── */

function processRows(rawRows: Record<string, unknown>[]): ImportResult {
  if (!rawRows.length) {
    throw new Error('The file is empty or contains no data rows.');
  }

  /* Normalise all keys in every row */
  const normRows: Record<string, string>[] = rawRows.map(row => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[normaliseKey(k)] = String(v ?? '');
    }
    return out;
  });

  /* Derive header list from first row keys */
  const headers = Object.keys(normRows[0]);

  /* Validate required columns */
  const missing = findMissingColumns(headers);
  if (missing.length > 0) {
    throw new Error(
      `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
      `Please check the header row of your file.`,
    );
  }

  /* Detect language mode */
  const languageMode = detectLanguageMode(headers, normRows);

  /* Validate each row */
  const products = normRows.map((row, i) => validateRow(row, i + 1));

  const valid   = products.filter(p => p.isValid).length;
  const invalid = products.length - valid;

  return {
    products,
    languageMode,
    summary: { total: products.length, valid, invalid, languageMode },
  };
}

/* ─────────────────────────────────────────────
   Public parse functions
───────────────────────────────────────────── */

/** Parse a .csv file using PapaParse */
export function parseCSVFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string) => h.trim(), // preserve original case; normalised later
      complete(results) {
        if (results.errors.length && !results.data.length) {
          reject(new Error(results.errors[0]?.message ?? 'CSV parse error'));
          return;
        }
        try {
          resolve(processRows(results.data));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      },
      error(err) {
        reject(new Error(err.message));
      },
    });
  });
}

/** Parse a .xlsx / .xls file using SheetJS */
export function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const buffer  = e.target!.result as ArrayBuffer;
        const data    = new Uint8Array(buffer);
        const wb      = XLSX.read(data, { type: 'array' });
        const sheet   = wb.Sheets[wb.SheetNames[0]];

        // raw:false → all values stringified (avoids date/number type surprises)
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        });

        resolve(processRows(rows));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Dispatcher: choose parser by extension */
export function parseFile(file: File): Promise<ImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv')               return parseCSVFile(file);
  if (ext === 'xlsx' || ext === 'xls') return parseExcelFile(file);
  return Promise.reject(new Error(`Unsupported file type ".${ext}". Use .csv, .xlsx, or .xls.`));
}

/* ─────────────────────────────────────────────
   Error-report CSV generator
───────────────────────────────────────────── */

function csvCell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function generateErrorReportCSV(products: ParsedProduct[]): string {
  const invalid = products.filter(p => !p.isValid);
  if (!invalid.length) return '';

  const HEADERS = [
    'row',
    'product_name_lan1',
    'product_name_lan2',
    'current_price',
    'old_price',
    'origin_lan1',
    'origin_lan2',
    'product_img_url',
    'product_url',
    'error_message',
  ];

  const dataRows = invalid.map(p => [
    p.rowIndex,
    p.product_name_lan1,
    p.product_name_lan2,
    p.current_price_raw,
    p.old_price_raw,
    p.origin_lan1,
    p.origin_lan2,
    p.product_img_url,
    p.product_url,
    p.errors.join('; '),
  ]);

  return [HEADERS, ...dataRows]
    .map(row => row.map(csvCell).join(','))
    .join('\n');
}
