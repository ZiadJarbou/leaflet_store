/**
 * api.ts
 * ──────
 * Thin fetch wrapper for all authenticated API calls.
 * Reads the JWT from localStorage (via authService helper) and injects it
 * as a Bearer token on every request.
 */

import { getStoredToken, getStoredUser } from './authService';
import type { LeafletCreatePayload, LeafletCreateResponse, LeafletDetail } from '../types/leaflet';

const BASE = '/api';

/* ─────────────────────────────────────────────
   Core request helper
───────────────────────────────────────────── */

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
    const errs = payload.errors as Record<string, string> | undefined;
    const message =
      (payload.error  as string | undefined) ??
      (payload.message as string | undefined) ??
      errs?.general ??
      (errs ? Object.values(errs)[0] : undefined) ??
      `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

/* ─────────────────────────────────────────────
   Leaflet endpoints
───────────────────────────────────────────── */

/**
 * POST /api/leaflets
 * Creates a new leaflet and its associated products.
 * Only valid products should be passed in the payload.
 */
export function getLeaflets(): Promise<{ leaflets: { id: number; title: string; description: string; language_mode: string; created_at: string }[] }> {
  return request('/leaflets');
}

export function saveLeafletThumbnail(id: number, thumbnail: string): Promise<{ success: boolean }> {
  return request(`/leaflets/${id}/thumbnail`, { method: 'PUT', body: JSON.stringify({ thumbnail }) });
}

export function generateA4CoverImage(payload: {
  prompt: string;
  orientation: 'portrait' | 'landscape';
  resolution: '1k' | '2k' | '4k';
  width: number;
  height: number;
  referenceImage?: {
    mimeType: string;
    data: string;
  } | null;
  referenceImages?: {
    mimeType: string;
    data: string;
  }[];
}): Promise<{
  imageUrl: string;
  mimeType: string;
  width: number;
  height: number;
  orientation: string;
  resolution: string;
  duration?: number;
  textResponse?: string | null;
}> {
  return request('/generate-a4', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


export function deleteLeaflet(id: number): Promise<{ success: boolean }> {
  return request(`/leaflets/${id}`, { method: 'DELETE' });
}

export function createLeaflet(
  payload: LeafletCreatePayload,
): Promise<LeafletCreateResponse> {
  return request<LeafletCreateResponse>('/leaflets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getLeaflet(id: string | number): Promise<LeafletDetail> {
  return request<LeafletDetail>(`/leaflets/${id}`);
}

export function getAdminLeaflet(id: string | number): Promise<LeafletDetail> {
  return request<LeafletDetail>(`/admin/leaflets/${id}`);
}

export interface LibraryIcon {
  id: number;
  label: string;
  url: string;
  active: number;
  sort_order: number;
  created_at: string;
}

export interface PresetIconOverride {
  icon_key: string;
  label: string | null;
  active: number;
  sort_order: number;
  deleted: number;
  updated_at: string;
}

export function getIconLibrary(): Promise<{ icons: LibraryIcon[]; preset_overrides?: PresetIconOverride[] }> {
  return request('/icons');
}

export function updateProduct(
  leafletId: string | number,
  productId: number,
  data: Partial<import('../types/leaflet').LeafletProduct>,
): Promise<{ product: import('../types/leaflet').LeafletProduct }> {
  return request(`/leaflets/${leafletId}/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteProduct(
  leafletId: string | number,
  productId: number,
): Promise<{ success: boolean }> {
  return request(`/leaflets/${leafletId}/products/${productId}`, {
    method: 'DELETE',
  });
}

/* ─────────────────────────────────────────────
   Card Layout customization
───────────────────────────────────────────── */

export interface CardElementPos {
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  rotation?: number;
}

export type CardShapeType = 'rectangle' | 'triangle' | 'ellipse' | 'polygon' | 'star' | 'line';

export interface CardShape {
  id: string;
  type: CardShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  fillType?: 'solid' | 'gradient';
  fill?: string;
  fillColor2?: string;
  fillGradientAngle?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  radiusMode?: 'all' | 'each';
  radius?: number;
  radiusTl?: number;
  radiusTr?: number;
  radiusBr?: number;
  radiusBl?: number;
  sides?: number;
  points?: number;
  z?: number;
}

export interface CardPositions {
  image?:             CardElementPos;
  name_lan1?:         CardElementPos;
  name_lan2?:         CardElementPos;
  origin_lan1?:       CardElementPos;
  origin_lan2?:       CardElementPos;
  origin_lan1_flag?:  CardElementPos;
  origin_lan2_flag?:  CardElementPos;
  old_price?:         CardElementPos;
  current_price?:     CardElementPos;
  product_url?:       CardElementPos;
  discount_badge?:    CardElementPos;
}

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'title_case';
export type TextScript    = 'none' | 'superscript' | 'subscript';
export type TextAlign     = 'left' | 'center' | 'right';
export type TextVAlign    = 'top' | 'middle' | 'bottom';
export type TextElemKey   = 'name_lan1' | 'name_lan2' | 'origin_lan1' | 'origin_lan2' | 'old_price' | 'current_price' | 'product_url' | 'discount_badge';

export interface TextElementStyle {
  bold:       boolean;
  italic:     boolean;
  transform:  TextTransform;
  script:     TextScript;
  align:      TextAlign;
  valign:     TextVAlign;
  padding:    number;
  radius:     number;
  bg:              string;
  bg_opacity:      number;
  bg_type?:        'solid' | 'gradient';
  bg_color2?:      string;
  bg_gradient_angle?: number;
  border_width?:   number;
  border_color?:   string;
  border_style?:   'solid' | 'dashed' | 'dotted';
  border_gap?:     number;
  border_top?:     number;
  border_right?:   number;
  border_bottom?:  number;
  border_left?:    number;
  radius_mode?:    'all' | 'each';
  radius_tl?:      number;
  radius_tr?:      number;
  radius_br?:      number;
  radius_bl?:      number;
  shadow?:         boolean;
}

export type ElementStyles = Partial<Record<TextElemKey, TextElementStyle>>;

export interface CardLayout {
  card_background:         string;
  card_bg_type?:           'solid' | 'gradient';
  card_bg_color2?:         string;
  card_bg_gradient_angle?: number;
  card_border_radius:   number;
  accent_color:         string;
  image_aspect_ratio:      number;
  image_border_width?:     number;
  image_border_color?:     string;
  image_border_style?:     'solid' | 'dashed' | 'dotted';
  image_radius?:           number;
  image_radius_mode?:      'all' | 'each';
  image_radius_tl?:        number;
  image_radius_tr?:        number;
  image_radius_br?:        number;
  image_radius_bl?:        number;
  show_image:           boolean;
  show_name_lan1:       boolean;
  show_name_lan2:       boolean;
  show_origin:          boolean;
  show_origin_lan1:     boolean;
  show_origin_lan2:     boolean;
  show_origin_lan1_flag?: boolean;
  show_origin_lan2_flag?: boolean;
  flag_icon_size?:        number;
  flag_color?:            string;
  flag_bg?:               string;
  flag_border_width?:     number;
  flag_border_color?:     string;
  flag_radius?:           number;
  flag_radius_mode?:      'all' | 'each';
  flag_radius_tl?:        number;
  flag_radius_tr?:        number;
  flag_radius_br?:        number;
  flag_radius_bl?:        number;
  flag_element_style?:    TextElementStyle;
  show_old_price:       boolean;
  show_current_price:   boolean;
  show_product_url:     boolean;
  show_discount_badge?: boolean;
  badge_color?:         string;
  badge_text_color?:    string;
  badge_font_size?:     number;
  badge_radius?:        number;
  badge_show_bg?:       boolean;
  badge_display_mode?:  'percent' | 'amount';
  currency_symbol?:          string;
  currency_code?:            string;
  currency_symbol_position?: 'before' | 'after';
  currency_symbol_icon?:     string;
  currency_symbol_icon_color?: string;
  currency_symbol_icon_color_current?: string;
  currency_symbol_icon_color_old?:     string;
  currency_symbol_size?:     number;
  currency_symbol_icon_size?: number;
  currency_symbol_icon_size_current?: number;
  currency_symbol_icon_size_old?:     number;
  currency_symbol_gap?:      number;
  url_icon?:            string;
  url_icon_size?:       number;
  url_icon_url?:        string;
  url_text?:            string;
  url_show_text?:       boolean;
  url_icon_color?:      string;
  url_custom_icon?:     string;
  name_lan1_size:       number;
  name_lan2_size:       number;
  origin_size:          number;
  origin_lan1_size?:    number;
  origin_lan2_size?:    number;
  price_size:           number;
  old_price_size?:       number;
  url_size:             number;
  name_lan1_color:      string;
  name_lan2_color:      string;
  origin_color:         string;
  origin_lan1_color?:   string;
  origin_lan2_color?:   string;
  price_color:          string;
  old_price_color:      string;
  url_color:            string;
  card_shadow:          boolean;
  name_lan1_bold:       boolean;
  name_lan2_italic:     boolean;
  positions?:           CardPositions;
  card_height_ratio?:   number;
  element_styles?:      ElementStyles;
  /* card border */
  card_border_width?:   number;
  card_border_color?:   string;
  card_border_style?:   'solid' | 'dashed' | 'dotted';
  card_border_top?:     number;
  card_border_right?:   number;
  card_border_bottom?:  number;
  card_border_left?:    number;
  /* card radius */
  card_radius_mode?:    'all' | 'each';
  card_radius_tl?:      number;
  card_radius_tr?:      number;
  card_radius_br?:      number;
  card_radius_bl?:      number;
  /* cover / back pages */
  cover_page?: { image: string; show: boolean; builder?: boolean };
  back_page?:  { image: string; show: boolean; builder?: boolean };
  cover_builder?: Record<string, unknown>;
  back_cover_builder?: Record<string, unknown>;
  /* lock & group */
  locked_elems?: string[];
  elem_groups?:  string[][];
  /* typography */
  font_family?:  string;
  custom_fonts?: string[];
  /* page / header / footer settings */
  header_settings?: Record<string, unknown>;
  footer_settings?: Record<string, unknown>;
  page_settings?:   Record<string, unknown>;
  cols_per_page?:   number;
  rows_per_page?:   number;
  page_overrides?:  Record<string, { header?: boolean; footer?: boolean }>;
  shapes?:          CardShape[];
}

export function getLeafletLayout(leafletId: string): Promise<{ layout: CardLayout }> {
  return request(`/leaflets/${leafletId}/layout`);
}

export function getAdminLeafletLayout(leafletId: string): Promise<{ layout: CardLayout }> {
  return request(`/admin/leaflets/${leafletId}/layout`);
}

export function saveLeafletLayout(leafletId: string, layout: CardLayout): Promise<{ layout: CardLayout }> {
  return request(`/leaflets/${leafletId}/layout`, {
    method: 'PUT',
    body: JSON.stringify(layout),
  });
}

export function resetLeafletLayout(leafletId: string): Promise<{ layout: CardLayout }> {
  return request(`/leaflets/${leafletId}/layout/reset`, { method: 'PUT' });
}

/* ─────────────────────────────────────────────
   Layout Templates
───────────────────────────────────────────── */

export interface LayoutTemplate {
  id: number;
  name: string;
  layout: CardLayout;
  created_at: string;
  owner_id?: number;
  is_default?: boolean;
  is_platform?: boolean;
  can_delete?: boolean;
}

export function getLayoutTemplates(): Promise<{ templates: LayoutTemplate[] }> {
  return request('/layout-templates');
}

export function saveLayoutTemplate(name: string, layout: CardLayout): Promise<{ template: { id: number; name: string; created_at: string } }> {
  return request('/layout-templates', {
    method: 'POST',
    body: JSON.stringify({ name, layout }),
  });
}

export function savePlatformLayoutTemplate(name: string, layout: CardLayout): Promise<{ template: LayoutTemplate }> {
  return request('/layout-templates', {
    method: 'POST',
    body: JSON.stringify({ name, layout, is_platform: true }),
  });
}

export function deleteLayoutTemplate(id: number): Promise<{ success: boolean }> {
  return request(`/layout-templates/${id}`, { method: 'DELETE' });
}

export function updateLayoutTemplate(id: number, body: Partial<Pick<LayoutTemplate, 'name' | 'layout' | 'is_platform'>>): Promise<{ template: LayoutTemplate }> {
  return request(`/layout-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/* ─────────────────────────────────────────────
   Image upload
───────────────────────────────────────────── */

export interface CoverLayoutTemplate {
  id: string;
  name: string;
  layout_id?: string;
  owner_id?: number;
  owner_role?: string;
  is_platform?: boolean;
  can_delete?: boolean;
  headline_lines?: 1 | 2 | 3;
  headline_ai_style?: string;
  contact_ai_style?: string;
  headline_accent_color?: string;
  contact_accent_color?: string;
  styles?: Record<string, Record<string, unknown>>;
  elements?: Record<string, Record<string, unknown>>;
  template_key?: string;
  created_at?: string;
}

export function getCoverLayoutTemplates(): Promise<{ templates: CoverLayoutTemplate[] }> {
  return request('/cover-layout-templates');
}

export interface PublicSettings {
  nano_a4_enabled?: string;
  deleted_deal_tags?: string;
  home_demo_video_url?: string;
  help_video_1_url?: string;
  help_video_2_url?: string;
  help_video_3_url?: string;
  help_video_4_url?: string;
  help_video_5_url?: string;
  help_video_6_url?: string;
}

export function getPublicSettings(): Promise<PublicSettings> {
  return request('/public-settings', { cache: 'no-store' });
}

export function deleteAdminDealTag(key: string): Promise<{ ok: boolean; deleted_file: boolean; deleted_deal_tags: string[] }> {
  return request(`/admin/deal-tags/${encodeURIComponent(key)}`, { method: 'DELETE' });
}

export function createCoverLayoutTemplate(body: Omit<CoverLayoutTemplate, 'id' | 'created_at' | 'can_delete' | 'owner_id' | 'owner_role' | 'is_platform'>): Promise<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }> {
  return request('/cover-layout-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function createAdminCoverLayoutTemplate(body: Omit<CoverLayoutTemplate, 'id' | 'created_at' | 'can_delete' | 'owner_id' | 'owner_role' | 'is_platform'>): Promise<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }> {
  return request<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }>('/admin/cover-layout-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  }).catch(async (error) => {
    if (!(error instanceof Error) || !error.message.includes('404')) throw error;
    const token = getStoredToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const settingsRes = await fetch('/api/admin/settings', { headers });
    if (!settingsRes.ok) throw error;
    const settings = await settingsRes.json() as Record<string, string>;
    let existing: CoverLayoutTemplate[] = [];
    try {
      const parsed = JSON.parse(settings.cover_layout_templates || '[]');
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      existing = [];
    }
    const user = getStoredUser();
    const template: CoverLayoutTemplate = {
      ...body,
      id: `admin-${Date.now()}`,
      owner_id: user?.id,
      owner_role: 'admin',
      is_platform: true,
      can_delete: true,
      created_at: new Date().toISOString(),
    };
    const templates = [template, ...existing.filter(item => item.id !== template.id)];
    const saveRes = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ cover_layout_templates: JSON.stringify(templates) }),
    });
    if (!saveRes.ok) throw error;
    return { template, templates };
  });
}

type CoverLayoutTemplateBody = Omit<CoverLayoutTemplate, 'id' | 'created_at' | 'can_delete' | 'owner_id' | 'owner_role' | 'is_platform'>;

export function updateCoverLayoutTemplate(id: string, body: CoverLayoutTemplateBody): Promise<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }> {
  return request(`/cover-layout-templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function updateAdminCoverLayoutTemplate(id: string, body: CoverLayoutTemplateBody): Promise<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }> {
  return request<{ template: CoverLayoutTemplate; templates: CoverLayoutTemplate[] }>(`/admin/cover-layout-templates/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }).catch(async (error) => {
    if (!(error instanceof Error) || !error.message.includes('404')) throw error;
    const token = getStoredToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const settingsRes = await fetch('/api/admin/settings', { headers });
    if (!settingsRes.ok) throw error;
    const settings = await settingsRes.json() as Record<string, string>;
    let existing: CoverLayoutTemplate[] = [];
    try {
      const parsed = JSON.parse(settings.cover_layout_templates || '[]');
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      existing = [];
    }
    const previous = existing.find(item => String(item.id) === id);
    if (!previous) throw error;
    const user = getStoredUser();
    const template: CoverLayoutTemplate = {
      ...previous,
      ...body,
      id,
      owner_id: previous.owner_id ?? user?.id,
      owner_role: previous.owner_role || 'admin',
      is_platform: previous.is_platform ?? true,
      can_delete: true,
      created_at: previous.created_at || new Date().toISOString(),
    };
    const templates = existing.map(item => String(item.id) === id ? template : item);
    const saveRes = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ cover_layout_templates: JSON.stringify(templates) }),
    });
    if (!saveRes.ok) throw error;
    return { template, templates };
  });
}

export function deleteCoverLayoutTemplate(id: string): Promise<{ success: boolean; templates: CoverLayoutTemplate[] }> {
  return request(`/cover-layout-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function deleteAdminCoverLayoutTemplate(id: string): Promise<{ success: boolean; templates: CoverLayoutTemplate[] }> {
  return request<{ success: boolean; templates: CoverLayoutTemplate[] }>(`/admin/cover-layout-templates/${encodeURIComponent(id)}`, { method: 'DELETE' })
    .catch(async (error) => {
      if (!(error instanceof Error) || !error.message.includes('404')) throw error;
      const token = getStoredToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const settingsRes = await fetch('/api/admin/settings', { headers });
      if (!settingsRes.ok) throw error;
      const settings = await settingsRes.json() as Record<string, string>;
      let existing: CoverLayoutTemplate[] = [];
      try {
        const parsed = JSON.parse(settings.cover_layout_templates || '[]');
        existing = Array.isArray(parsed) ? parsed : [];
      } catch {
        existing = [];
      }
      const templates = existing.filter(item => String(item.id) !== id);
      if (templates.length === existing.length) throw error;
      const saveRes = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ cover_layout_templates: JSON.stringify(templates) }),
      });
      if (!saveRes.ok) throw error;
      return { success: true, templates };
    });
}

export async function uploadImage(file: File): Promise<string> {
  const token = getStoredToken();
  const form  = new FormData();
  form.append('image', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const payload = await res.json() as { url?: string; error?: string };
  if (!res.ok || !payload.url) throw new Error(payload.error ?? 'Upload failed.');
  return payload.url;
}

/* ─────────────────────────────────────────────
   Stripe / Subscription
───────────────────────────────────────────── */

export interface SubscriptionInfo {
  subscription_plan:    'free' | 'pro' | 'business' | 'admin';
  subscription_status:  'active' | 'cancelled' | 'past_due';
  subscription_period:  'monthly' | 'annual';
  subscription_start:   string | null;
  subscription_end:     string | null;
  unlimited?:           boolean;
}

export interface LocalizedPlanPrice {
  currency: string;
  amount: number;
}

export interface LocalizedAnnualPlanPrice extends LocalizedPlanPrice {
  totalAmount: number;
}

export interface LocalizedPricing {
  country: string;
  currency: string;
  plans: Partial<Record<'pro' | 'business', {
    monthly: LocalizedPlanPrice;
    annual: LocalizedAnnualPlanPrice;
  }>>;
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  return request<SubscriptionInfo>('/stripe/subscription');
}

function detectBillingLocale() {
  const locale = navigator.languages?.[0] || navigator.language || '';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const timezoneCountry =
    timeZone === 'Asia/Dubai' ? 'AE' :
    timeZone === 'Asia/Riyadh' ? 'SA' :
    timeZone === 'Asia/Qatar' ? 'QA' :
    timeZone === 'Asia/Kuwait' ? 'KW' :
    timeZone === 'Asia/Bahrain' ? 'BH' :
    timeZone === 'Asia/Muscat' ? 'OM' :
    '';
  return {
    locale,
    country: timezoneCountry,
  };
}

export interface ProductImageSuggestion {
  title: string;
  url: string;
  thumb: string;
  source: string;
  license?: string;
  licenseUrl?: string;
  mime?: string;
}

export function searchProductImages(query: string): Promise<{ images: ProductImageSuggestion[] }> {
  return request<{ images: ProductImageSuggestion[] }>(`/product-image-search?q=${encodeURIComponent(query)}`).catch(async err => {
    if (!(err instanceof Error) || !err.message.includes('404')) throw err;

    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '8',
      gsrsearch: `${query} product image`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata',
      iiurlwidth: '360',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
    if (!res.ok) throw err;
    const payload = await res.json();
    const pages = Object.values(payload?.query?.pages || {}) as Array<{
      title?: string;
      imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }>;
    }>;
    const images: ProductImageSuggestion[] = pages
        .map<ProductImageSuggestion | null>(page => {
          const info = page.imageinfo?.[0];
          if (!info?.url) return null;
          return {
            title: String(page.title || '').replace(/^File:/, ''),
            url: info.url,
            thumb: info.thumburl || info.url,
            source: 'Wikimedia Commons',
            license: info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || 'Creative Commons / reusable media',
            licenseUrl: info.extmetadata?.LicenseUrl?.value || '',
            mime: info.mime || '',
          };
        })
        .filter((image): image is ProductImageSuggestion => image !== null);
    return { images };
  });
}

export async function createCheckoutSession(plan: 'pro' | 'business', period: 'monthly' | 'annual'): Promise<string> {
  const { locale, country } = detectBillingLocale();
  const { url } = await request<{ url: string }>('/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ plan, period, locale, country }),
  });
  return url;
}

export function confirmCheckoutSession(sessionId: string): Promise<SubscriptionInfo & { confirmed: boolean }> {
  return request<SubscriptionInfo & { confirmed: boolean }>('/stripe/confirm-session', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function getLocalizedPricing(): Promise<LocalizedPricing> {
  const { locale, country } = detectBillingLocale();
  const params = new URLSearchParams();
  if (locale) params.set('locale', locale);
  if (country) params.set('country', country);
  return request<LocalizedPricing>(`/stripe/localized-pricing?${params.toString()}`);
}

export async function createPortalSession(): Promise<string> {
  const { url } = await request<{ url: string }>('/stripe/create-portal-session', {
    method: 'POST',
  });
  return url;
}

/* ─────────────────────────────────────────────
   User / Account
───────────────────────────────────────────── */

export interface UserStats {
  leaflets_count:      number;
  products_count:      number;
  recent_leaflets:     { id: number; name: string; created_at: string; thumbnail_url: string | null }[];
  subscription_plan:   'free' | 'pro' | 'business' | 'admin';
  subscription_status: string;
  subscription_period: 'monthly' | 'annual';
  subscription_start:  string | null;
  subscription_end:    string | null;
  member_since:        string | null;
  unlimited?:          boolean;
}

export async function getUserStats(): Promise<UserStats> {
  return request<UserStats>('/user/stats');
}

export async function updateProfile(name: string): Promise<{ token: string; name: string }> {
  return request<{ token: string; name: string }>('/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function changePassword(current_password: string, new_password: string): Promise<{ message: string }> {
  return request<{ message: string }>('/user/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  });
}

export async function deleteAccount(password: string): Promise<{ message: string }> {
  return request<{ message: string }>('/user/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

/* ─────────────────── Insights ─────────────────── */
export interface ClickedProduct {
  id:         number;
  name:       string;
  leaflet_id: number;
  clicks:     number;
}
export interface WeeklyClicks {
  week:   string;
  clicks: number;
}
export interface UserInsights {
  avg_leaflets_per_week:    number;
  avg_products_per_leaflet: number;
  most_productive_day:      string | null;
  last_leaflet_created_at:  string | null;
  top_clicked_products:     ClickedProduct[];
  weekly_clicks:            WeeklyClicks[];
  total_clicks:             number;
}

export function getUserInsights(): Promise<UserInsights> {
  return request<UserInsights>('/user/insights');
}

export function trackProductClick(productId: number, leafletId: number, userId?: number): Promise<void> {
  return fetch('/api/track/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, leaflet_id: leafletId, user_id: userId ?? 0 }),
  }).then(() => undefined);
}
