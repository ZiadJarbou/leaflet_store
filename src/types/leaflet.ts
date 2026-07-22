/* ─────────────────────────────────────────────
   Leaflet domain types
───────────────────────────────────────────── */

export type LanguageMode = 'one' | 'two';

/** A fully-validated, normalised product row ready for submission */
export interface ParsedProduct {
  rowIndex: number;

  product_name_lan1: string;
  product_name_lan2: string;

  product_img_url: string;
  product_image_source?: string;
  product_image_license?: string;
  product_url: string;

  origin_lan1: string;
  origin_lan2: string;

  /** Null when the raw value was empty or unparseable */
  old_price: number | null;
  old_price_raw: string;

  current_price: number | null;
  current_price_raw: string;

  /** Human-readable validation messages for this row */
  errors: string[];
  isValid: boolean;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  languageMode: LanguageMode;
}

export interface ImportResult {
  products: ParsedProduct[];
  summary: ImportSummary;
  languageMode: LanguageMode;
}

export interface LeafletCreatePayload {
  title: string;
  description: string;
  languageMode: LanguageMode;
  products: ParsedProduct[];
}

export interface LeafletCreateResponse {
  id: number | string;
  title: string;
  createdAt: string;
}

export interface LeafletProduct {
  id: number;
  row_index: number;
  product_name_lan1: string;
  product_name_lan2: string;
  product_img_url: string;
  product_image_source?: string;
  product_image_license?: string;
  product_url: string;
  origin_lan1: string;
  origin_lan2: string;
  origin_lan1_iso: string;
  origin_lan2_iso: string;
  old_price: number | null;
  current_price: number | null;
}

export interface LeafletMeta {
  id: number;
  title: string;
  description: string;
  language_mode: LanguageMode;
  created_at: string;
}

export interface LeafletDetail {
  leaflet: LeafletMeta;
  products: LeafletProduct[];
}
