import { cssClass, cx } from '../utils/styleClass';
import React, { useEffect, useRef, useState, Component } from 'react';
import ReactDOM from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Link, useParams } from 'react-router-dom';
import { getLeaflet, getAdminLeaflet, updateProduct, uploadImage, deleteProduct, getLeafletLayout, getAdminLeafletLayout, saveLeafletLayout, resetLeafletLayout, saveLeafletThumbnail, createCheckoutSession, searchProductImages, getIconLibrary, getLayoutTemplates, deleteLayoutTemplate, startA4CoverImageJob, getA4CoverImageJob, getCoverLayoutTemplates, createCoverLayoutTemplate, createAdminCoverLayoutTemplate, updateAdminCoverLayoutTemplate, deleteCoverLayoutTemplate, deleteAdminCoverLayoutTemplate, getPublicSettings, deleteAdminDealTag } from '../services/api';
import { getStoredToken } from '../services/authService';
import { countryToFlag, countryToIso } from '../utils/countryToFlag';
import type { CardLayout, CardElementPos, TextElementStyle, ProductImageSuggestion, LayoutTemplate, CoverLayoutTemplate } from '../services/api';
import { trackProductClick } from '../services/api';
import { WORLD_CURRENCIES } from '../data/currencies';
import { PRESET_ICON_URLS } from '../data/editorIcons';
import type { LeafletDetail, LeafletProduct } from '../types/leaflet';
import { hexToRgba, LINK_ICONS, DEFAULT_POSITIONS, loadGoogleFont, FontPickerSection } from '../components/LayoutCustomizer';
import LayoutCustomizer from '../components/LayoutCustomizer';
import NumericInput from '../components/NumericInput';
import BookBuilder from '../components/BookBuilder';
import CardTemplateModal, { LayoutThumbnail } from '../components/CardTemplateModal';
import ColorSwatch from '../components/ColorSwatch';
import CountryPicker from '../components/CountryPicker';
import OriginInput from '../components/OriginInput';
import './LeafletView.css';
import './NotFoundPage.css';
const LEAFLET_EDITOR_TOUR_SEEN_KEY = 'leafletai_leaflet_editor_tour_seen';
const LEAFLET_EDITOR_TOUR_SKIPPED_KEY = 'leafletai_leaflet_editor_tour_skipped';
const NANO_A4_VISIBILITY_STORAGE_KEY = 'leafletai_nano_a4_enabled';
const DEAL_TAG_USAGE_STORAGE_KEY = 'leafletai_deal_tag_usage';
const BASKET_USAGE_STORAGE_KEY = 'leafletai_basket_usage';
const BACKGROUND_USAGE_STORAGE_KEY = 'leafletai_background_usage';
const GENERATED_BACKGROUNDS_STORAGE_KEY = 'leafletai_generated_backgrounds';
function readAuthToken() {
    return getStoredToken() || localStorage.getItem('authToken') || localStorage.getItem('token') || '';
}
function toCanvasSafeImageUrl(rawUrl: string | null) {
    if (!rawUrl)
        return rawUrl;
    try {
        const url = new URL(rawUrl, window.location.href);
        if (!['http:', 'https:'].includes(url.protocol))
            return rawUrl;
        if (url.origin === window.location.origin)
            return rawUrl;
        if (['localhost', '127.0.0.1', '::1'].includes(url.hostname))
            return rawUrl;
        return `/api/image-proxy?url=${encodeURIComponent(url.href)}`;
    }
    catch {
        return rawUrl;
    }
}
function prepareHtml2CanvasClone(doc: Document) {
    doc.querySelectorAll<HTMLImageElement>('img').forEach(img => {
        const src = img.getAttribute('src');
        const safeSrc = toCanvasSafeImageUrl(src);
        if (safeSrc && safeSrc !== src) {
            img.setAttribute('src', safeSrc);
            img.removeAttribute('srcset');
        }
    });
}
const canvasImageDataUrlCache = new Map<string, string>();
type UiGradient = { name: string; colors: string[] };
const UI_GRADIENTS_URL = 'https://raw.githubusercontent.com/ghosh/uiGradients/master/gradients.json';
const UI_GRADIENT_FALLBACK: UiGradient[] = [
    { name: 'Quepal', colors: ['#11998e', '#38ef7d'] },
    { name: 'Cherry', colors: ['#EB3349', '#F45C43'] },
    { name: 'Flare', colors: ['#f12711', '#f5af19'] },
    { name: 'JShine', colors: ['#12c2e9', '#c471ed', '#f64f59'] },
    { name: 'Moon Purple', colors: ['#4e54c8', '#8f94fb'] },
    { name: 'Midnight City', colors: ['#232526', '#414345'] },
];
let uiGradientsCache: UiGradient[] | null = null;
async function loadUiGradients(): Promise<UiGradient[]> {
    if (uiGradientsCache)
        return uiGradientsCache;
    const response = await fetch(UI_GRADIENTS_URL);
    if (!response.ok)
        throw new Error(`Could not load UIGradients (${response.status})`);
    const data = await response.json() as UiGradient[];
    uiGradientsCache = data.filter(gradient => Array.isArray(gradient.colors) && gradient.colors.length >= 2);
    return uiGradientsCache;
}
function uiGradientHexToRgba(hex: string, opacity: number): string {
    const normalized = hex.trim().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');
    return hexToRgba(normalized, opacity);
}
const CoverEyeOn = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const CoverEyeOff = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
type CoverBuilderBgType = 'solid' | 'gradient' | 'image';
type CoverBuilderItemKey = 'logo' | 'headline' | 'subline' | 'contact' | 'products' | 'dealTag' | 'basket';
interface CoverBuilderElementStyle {
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    fontSize: number;
    color: string;
    bg: string;
    bgOpacity?: number;
    opacity: number;
    bold: boolean;
    italic: boolean;
    radius: number;
    borderWidth: number;
    borderColor: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
    radiusTL?: number;
    radiusTR?: number;
    radiusBR?: number;
    radiusBL?: number;
    align: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    fontFamily?: string;
    textType?: string;
    imageScale?: number;
    rotation?: number;
}
interface CoverBuilderState {
    bgType: CoverBuilderBgType;
    bgColor: string;
    gradFrom: string;
    gradTo: string;
    gradAngle: number;
    gradFromStop: number;
    gradToStop: number;
    aiGradientCss: string;
    bgImage: string;
    aiGeneratedBg: boolean;
    logo: string;
    logoText: string;
    logoAiStyle: string;
    headline: string;
    headlineAiStyle: string;
    headlineAccentColor: string;
    subline: string;
    contact: string;
    contactAiStyle: string;
    contactAccentColor: string;
    dealTagUrl: string;
    basketUrl: string;
    basketFit: 'contain' | 'cover';
    basketCropX: number;
    basketCropY: number;
    basketCropZoom: number;
    selectedProductIds: number[];
    visibleItems: Record<CoverBuilderItemKey, boolean>;
    itemStyles: Record<CoverBuilderItemKey, CoverBuilderElementStyle>;
    productCardLayout?: CardLayout | null;
    productCardTemplateName?: string;
}
interface CoverBuilderTemplateState {
    templateId: string;
    elements: Record<string, Record<string, unknown>>;
    config: CoverBuilderState;
}
const DEFAULT_COVER_BUILDER_ITEM_STYLES: Record<CoverBuilderItemKey, CoverBuilderElementStyle> = {
    logo: { x: 6, y: 5, w: 22, h: 9, z: 5, fontSize: 14, color: '#0f172a', bg: '#ffffff', opacity: 100, bold: true, italic: false, radius: 8, borderWidth: 0, borderColor: '#ffffff', align: 'center', valign: 'middle', imageScale: 82 },
    headline: { x: 6, y: 32, w: 78, h: 14, z: 6, fontSize: 42, color: '#ffffff', bg: 'transparent', opacity: 100, bold: true, italic: false, radius: 0, borderWidth: 0, borderColor: '#ffffff', align: 'left', valign: 'middle' },
    subline: { x: 6, y: 47, w: 70, h: 8, z: 6, fontSize: 16, color: '#e2e8f0', bg: '#ffffff', bgOpacity: 0, opacity: 100, bold: false, italic: false, radius: 0, borderWidth: 0, borderColor: '#ffffff', align: 'left', valign: 'middle' },
    products: { x: 6, y: 60, w: 88, h: 26, z: 7, fontSize: 12, color: '#0f172a', bg: 'transparent', opacity: 100, bold: true, italic: false, radius: 8, borderWidth: 0, borderColor: '#ffffff', align: 'left', valign: 'top' },
    contact: { x: 6, y: 91, w: 88, h: 5, z: 8, fontSize: 13, color: '#ffffff', bg: 'transparent', opacity: 100, bold: true, italic: false, radius: 0, borderWidth: 0, borderColor: '#ffffff', align: 'left', valign: 'middle' },
    dealTag: { x: 68, y: 8, w: 24, h: 16, z: 9, fontSize: 12, color: '#ffffff', bg: 'transparent', opacity: 100, bold: true, italic: false, radius: 0, borderWidth: 0, borderColor: '#ffffff', align: 'center', valign: 'middle' },
    basket: { x: 55, y: 48, w: 36, h: 33, z: 6, fontSize: 12, color: '#ffffff', bg: 'transparent', opacity: 100, bold: true, italic: false, radius: 0, borderWidth: 0, borderColor: '#ffffff', align: 'center', valign: 'middle' },
};
const DEFAULT_COVER_BUILDER: CoverBuilderState = {
    bgType: 'gradient',
    bgColor: '#0f172a',
    gradFrom: '#0f172a',
    gradTo: '#2563eb',
    gradAngle: 135,
    gradFromStop: 0,
    gradToStop: 100,
    aiGradientCss: '',
    bgImage: '',
    aiGeneratedBg: false,
    logo: '',
    logoText: 'Logo',
    logoAiStyle: '',
    headline: 'Weekly Fresh Offers',
    headlineAiStyle: '',
    headlineAccentColor: '#ff3f8f',
    subline: 'Handpicked deals for your supermarket customers',
    contact: 'www.leafletai.com | +971 00 000 0000',
    contactAiStyle: '',
    contactAccentColor: '#60a5fa',
    dealTagUrl: '/deal-tags/deal-tag_20.png',
    basketUrl: '/baskets/basket_16.png',
    basketFit: 'contain',
    basketCropX: 50,
    basketCropY: 50,
    basketCropZoom: 100,
    selectedProductIds: [],
    visibleItems: {
        logo: true,
        headline: true,
        subline: true,
        contact: true,
        products: true,
        dealTag: false,
        basket: false,
    },
    itemStyles: DEFAULT_COVER_BUILDER_ITEM_STYLES,
    productCardLayout: null,
    productCardTemplateName: '',
};
function normalizeCoverBuilder(value: unknown): CoverBuilderState {
    const raw = value && typeof value === 'object' ? value as Partial<CoverBuilderState> : {};
    const visibleItems = raw.visibleItems && typeof raw.visibleItems === 'object'
        ? raw.visibleItems as Partial<Record<CoverBuilderItemKey, boolean>>
        : {};
    return {
        ...DEFAULT_COVER_BUILDER,
        ...raw,
        bgType: raw.bgType === 'solid' || raw.bgType === 'image' || raw.bgType === 'gradient' ? raw.bgType : DEFAULT_COVER_BUILDER.bgType,
        gradAngle: typeof raw.gradAngle === 'number' && Number.isFinite(raw.gradAngle) ? Math.max(0, Math.min(360, raw.gradAngle)) : DEFAULT_COVER_BUILDER.gradAngle,
        gradFromStop: typeof raw.gradFromStop === 'number' && Number.isFinite(raw.gradFromStop) ? Math.max(0, Math.min(100, raw.gradFromStop)) : DEFAULT_COVER_BUILDER.gradFromStop,
        gradToStop: typeof raw.gradToStop === 'number' && Number.isFinite(raw.gradToStop) ? Math.max(0, Math.min(100, raw.gradToStop)) : DEFAULT_COVER_BUILDER.gradToStop,
        aiGradientCss: typeof raw.aiGradientCss === 'string' ? raw.aiGradientCss : '',
        aiGeneratedBg: raw.aiGeneratedBg === true,
        logoText: typeof raw.logoText === 'string' ? raw.logoText : DEFAULT_COVER_BUILDER.logoText,
        logoAiStyle: typeof raw.logoAiStyle === 'string' ? raw.logoAiStyle : '',
        headlineAiStyle: typeof raw.headlineAiStyle === 'string' ? raw.headlineAiStyle : '',
        headlineAccentColor: typeof raw.headlineAccentColor === 'string' ? raw.headlineAccentColor : DEFAULT_COVER_BUILDER.headlineAccentColor,
        contactAiStyle: typeof raw.contactAiStyle === 'string' ? raw.contactAiStyle : '',
        contactAccentColor: typeof raw.contactAccentColor === 'string' ? raw.contactAccentColor : DEFAULT_COVER_BUILDER.contactAccentColor,
        dealTagUrl: typeof raw.dealTagUrl === 'string' && raw.dealTagUrl ? raw.dealTagUrl : DEFAULT_COVER_BUILDER.dealTagUrl,
        basketUrl: typeof raw.basketUrl === 'string' && raw.basketUrl ? raw.basketUrl : DEFAULT_COVER_BUILDER.basketUrl,
        basketFit: raw.basketFit === 'cover' || raw.basketFit === 'contain' ? raw.basketFit : DEFAULT_COVER_BUILDER.basketFit,
        basketCropX: typeof raw.basketCropX === 'number' && Number.isFinite(raw.basketCropX) ? Math.max(0, Math.min(100, raw.basketCropX)) : DEFAULT_COVER_BUILDER.basketCropX,
        basketCropY: typeof raw.basketCropY === 'number' && Number.isFinite(raw.basketCropY) ? Math.max(0, Math.min(100, raw.basketCropY)) : DEFAULT_COVER_BUILDER.basketCropY,
        basketCropZoom: typeof raw.basketCropZoom === 'number' && Number.isFinite(raw.basketCropZoom) ? Math.max(100, Math.min(260, raw.basketCropZoom)) : DEFAULT_COVER_BUILDER.basketCropZoom,
        selectedProductIds: Array.isArray(raw.selectedProductIds) ? raw.selectedProductIds.map(Number).filter(Number.isFinite).slice(0, 12) : [],
        visibleItems: {
            ...DEFAULT_COVER_BUILDER.visibleItems,
            ...visibleItems,
        },
        itemStyles: (Object.keys(DEFAULT_COVER_BUILDER_ITEM_STYLES) as CoverBuilderItemKey[]).reduce((acc, key) => {
            const rawStyles = raw.itemStyles && typeof raw.itemStyles === 'object'
                ? (raw.itemStyles as Partial<Record<CoverBuilderItemKey, Partial<CoverBuilderElementStyle>>>)[key]
                : undefined;
            acc[key] = { ...DEFAULT_COVER_BUILDER_ITEM_STYLES[key], ...(rawStyles || {}) };
            return acc;
        }, {} as Record<CoverBuilderItemKey, CoverBuilderElementStyle>),
        productCardLayout: raw.productCardLayout && typeof raw.productCardLayout === 'object' ? raw.productCardLayout as CardLayout : null,
        productCardTemplateName: typeof raw.productCardTemplateName === 'string' ? raw.productCardTemplateName : '',
    };
}
const A4_GENERATOR_MAX_PIXELS = 2048 * 2048;
const A4_GENERATOR_DPI = 220;
const A4_NANO_TEMPLATE_PROMPTS = [
    { label: '🛒 Supermarket', prompt: 'Bright supermarket background with clean empty space for offers, no text.' },
    { label: '🥬 Fresh Produce', prompt: 'Fresh produce supermarket background with fruits and vegetables, clean empty offer space, no text.' },
    { label: '🏪 Store Entrance', prompt: 'Modern supermarket entrance background with shopping carts and welcoming lighting, no text.' },
    { label: '✨ Clean Offers Space', prompt: 'Clean supermarket offers background with a large empty center area for editable prices and products, no text.' },
];
const LEGACY_COVER_DEAL_TAGS = [
    { key: 'deal-tag_20.png', name: '50% Off', url: '/deal-tags/deal-tag_20.png' },
    { key: 'deal-tag_03.png', name: 'Sale', url: '/deal-tags/deal-tag_03.png' },
    { key: 'deal-tag_04.png', name: 'Super savings', url: '/deal-tags/deal-tag_04.png' },
    { key: 'deal-tag_05.png', name: 'Limited time', url: '/deal-tags/deal-tag_05.png' },
    { key: 'deal-tag_06.png', name: 'Mega discount', url: '/deal-tags/deal-tag_06.png' },
    { key: 'deal-tag_09.png', name: 'Big sale', url: '/deal-tags/deal-tag_09.png' },
    { key: 'deal-tag_13.png', name: 'Hot deals', url: '/deal-tags/deal-tag_13.png' },
    { key: 'deal-tag_14.png', name: 'Special offer', url: '/deal-tags/deal-tag_14.png' },
    { key: 'deal-tag_17.png', name: 'Clearance sale', url: '/deal-tags/deal-tag_17.png' },
    { key: 'deal-tag_18.png', name: 'Deal of the day', url: '/deal-tags/deal-tag_18.png' },
] as const;
const coverDealTagAssetModules = import.meta.glob<string>(
    '../assets/library/deal_tag/*.{png,jpg,jpeg,webp,gif,svg,avif}',
    { eager: true, query: '?url', import: 'default' },
);
function coverDealTagName(path: string) {
    const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Deal tag';
    return filename
        .replace(/-Firefly-Upscaler.*$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}
const libraryCoverDealTags = Object.entries(coverDealTagAssetModules)
    .map(([path, url]) => ({ key: path.split('/').pop() || path, name: coverDealTagName(path), url }))
    .sort((first, second) => first.name.localeCompare(second.name));
const COVER_DEAL_TAGS = libraryCoverDealTags.length > 0
    ? libraryCoverDealTags
    : [...LEGACY_COVER_DEAL_TAGS];
const LEGACY_COVER_BASKETS = [
    { name: 'Grocery tote', url: '/baskets/basket_16.png' },
    { name: 'White grocery bag', url: '/baskets/basket_19.png' },
    { name: 'Wire grocery basket', url: '/baskets/basket_20.png' },
    { name: 'Electronics basket', url: '/baskets/basket_22.png' },
    { name: 'Black supermarket basket', url: '/baskets/basket_02.png' },
    { name: 'Teal market bag', url: '/baskets/basket_03.png' },
    { name: 'White family basket', url: '/baskets/basket_05.png' },
    { name: 'Pink cooler bag', url: '/baskets/basket_06.png' },
    { name: 'Black wire basket', url: '/baskets/basket_07.png' },
    { name: 'Cooler food bag', url: '/baskets/basket_14.png' },
] as const;
const coverBasketAssetModules = import.meta.glob<string>(
    '../assets/library/basket/*.{png,jpg,jpeg,webp,gif,svg,avif}',
    { eager: true, query: '?url', import: 'default' },
);
function coverBasketName(path: string) {
    const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Basket';
    return filename
        .replace(/-Firefly-Upscaler.*$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}
const libraryCoverBaskets = Object.entries(coverBasketAssetModules)
    .map(([path, url]) => ({ key: path.split('/').pop() || path, name: coverBasketName(path), url }))
    .sort((first, second) => first.name.localeCompare(second.name));
const COVER_BASKETS = libraryCoverBaskets.length > 0
    ? libraryCoverBaskets
    : [...LEGACY_COVER_BASKETS].map(basket => ({
        key: basket.url.split('/').pop() || basket.url,
        name: basket.name,
        url: basket.url,
    }));
const coverBackgroundAssetModules = import.meta.glob<string>(
    '../assets/library/background/*.{png,jpg,jpeg,webp,gif,svg,avif}',
    { eager: true, query: '?url', import: 'default' },
);
function coverBackgroundName(path: string) {
    const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Background';
    return filename
        .replace(/-Firefly-Upscaler.*$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}
const COVER_BACKGROUNDS = Object.entries(coverBackgroundAssetModules)
    .map(([path, url]) => ({ key: path.split('/').pop() || path, name: coverBackgroundName(path), url }))
    .sort((first, second) => first.name.localeCompare(second.name));
const COVER_AI_TEMPLATE_PRODUCT_LIMIT = 3;
function calculateA4GeneratorDimensions(orientation: 'portrait' | 'landscape') {
    const ratio = orientation === 'portrait' ? 297 / 210 : 210 / 297;
    let width = 0;
    let height = 0;
    if (orientation === 'portrait') {
        width = Math.sqrt(A4_GENERATOR_MAX_PIXELS / ratio);
        height = width * ratio;
    }
    else {
        height = Math.sqrt(A4_GENERATOR_MAX_PIXELS / ratio);
        width = height * ratio;
    }
    width = Math.floor(width / 8) * 8;
    height = Math.floor(height / 8) * 8;
    while (width * height > A4_GENERATOR_MAX_PIXELS) {
        if (orientation === 'portrait') {
            width -= 8;
            height = Math.floor((width * ratio) / 8) * 8;
        }
        else {
            height -= 8;
            width = Math.floor((height * ratio) / 8) * 8;
        }
    }
    return {
        width,
        height,
        mmWidth: orientation === 'portrait' ? 210 : 297,
        mmHeight: orientation === 'portrait' ? 297 : 210,
        dpi: A4_GENERATOR_DPI,
    };
}
function enhanceA4CoverPrompt(prompt: string, orientation: 'portrait' | 'landscape') {
    const format = orientation === 'portrait'
        ? 'A4 portrait aspect ratio, vertical full-bleed composition'
        : 'A4 landscape aspect ratio, horizontal full-bleed composition';
    return [
        `${format}. ${prompt.trim()}`,
        'Create background artwork only, filling the entire image edge to edge. No white margins, no page border, no decorative frame, no inner frame, no crop marks, no trim marks, no registration marks, no print guide lines, no page outline, and no blank paper area around the artwork. Do not design it as a poster mockup or printable sheet. No written words, no letters, no numbers, no prices, no labels, no badges with text, no logo text, no watermark, no readable typography anywhere. Leave clean empty areas inside the artwork for editable text overlays. Fast clean leaflet cover background, sharp commercial style.',
    ].join(' ');
}
function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Unable to read image data.'));
        reader.readAsDataURL(blob);
    });
}
async function loadImageElement(img: HTMLImageElement, timeoutMs = 10000) {
    img.loading = 'eager';
    img.decoding = 'async';
    if (img.complete && img.naturalWidth > 0)
        return;
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = window.setTimeout(() => {
            if (settled)
                return;
            settled = true;
            reject(new Error(`Timed out loading image: ${img.currentSrc || img.src}`));
        }, timeoutMs);
        const done = () => {
            if (settled)
                return;
            settled = true;
            window.clearTimeout(timer);
            resolve();
        };
        const fail = () => {
            if (settled)
                return;
            settled = true;
            window.clearTimeout(timer);
            reject(new Error(`Unable to load image: ${img.currentSrc || img.src}`));
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', fail, { once: true });
        img.decode?.().then(done).catch(() => { });
    });
}
async function getCanvasImageSource(rawUrl: string) {
    const safeUrl = toCanvasSafeImageUrl(rawUrl);
    if (!safeUrl || safeUrl === rawUrl)
        return safeUrl;
    const cacheKey = new URL(rawUrl, window.location.href).href;
    const cached = canvasImageDataUrlCache.get(cacheKey);
    if (cached)
        return cached;
    const response = await fetch(safeUrl, { credentials: 'same-origin' });
    if (!response.ok)
        throw new Error(`Unable to prepare image for PDF export (${response.status}).`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/'))
        throw new Error('The image URL did not return an image.');
    const dataUrl = await blobToDataUrl(blob);
    canvasImageDataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
}
function createFittedImageDataUrl(img: HTMLImageElement) {
    const rect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!rect.width || !rect.height || !naturalW || !naturalH)
        return null;
    const scaleFactor = 2;
    const canvasW = Math.max(1, Math.round(rect.width * scaleFactor));
    const canvasH = Math.max(1, Math.round(rect.height * scaleFactor));
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    const computed = window.getComputedStyle(img);
    const fit = computed.objectFit || 'cover';
    const boxW = canvasW;
    const boxH = canvasH;
    const containScale = Math.min(boxW / naturalW, boxH / naturalH);
    const coverScale = Math.max(boxW / naturalW, boxH / naturalH);
    const drawScale = fit === 'contain'
        ? containScale
        : fit === 'scale-down'
            ? Math.min(1, containScale)
            : coverScale;
    const drawW = naturalW * drawScale;
    const drawH = naturalH * drawScale;
    const dx = (boxW - drawW) / 2;
    const dy = (boxH - drawH) / 2;
    ctx.clearRect(0, 0, boxW, boxH);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    return canvas.toDataURL('image/png');
}
const LEAFLET_EDITOR_TOUR_STEPS = [
    {
        target: '.lv-header',
        title: 'Leaflet editor overview',
        body: 'This editor is where you review the leaflet, open card templates, and customize the product card layout.',
    },
    {
        target: '.lv-sidebar',
        title: 'Design sections',
        body: 'Use the left design sections to control header, page layout, footer, cover pages, typography, and price settings.',
    },
    {
        target: '.lv-header-right',
        title: 'Templates and card design',
        body: 'Open Card Template for saved/default designs, or Customize Layout to move elements, add shapes, and style product cards.',
    },
    {
        target: '.lv-toolbar',
        title: 'Product tools',
        body: 'Search, sort, filter, set this leaflet as default, duplicate it, or add products manually from this toolbar.',
    },
    {
        target: '.lv-a4-controls',
        title: 'Page navigation and export',
        body: 'Move between pages, change zoom, export PDF, or convert the leaflet to a printable book from here.',
    },
    {
        target: '.lv-a4-page',
        title: 'Live leaflet canvas',
        body: 'This A4 preview shows the header, product cards, spacing, shapes, and footer exactly as your layout changes are applied.',
    },
    {
        target: '.lv-card-wrap',
        title: 'Product cards',
        body: 'Each card uses the active template and layout settings. Drag products between cards to reorder the leaflet.',
    },
] as const;
/* --------
   Icon overlays
-------- */
interface CardOverlay {
    id: string;
    src: string; // data-url or preset svg data-url
    label: string;
    x: number; // % from left of card
    y: number; // % from top of card
    w: number; // % of card width
    h: number; // % of card width (maintain aspect via %)
}
type EditorTourStep = (typeof LEAFLET_EDITOR_TOUR_STEPS)[number];
function LeafletEditorTour({ open, stepIndex, steps, onBack, onNext, onSkip, onDone, }: {
    open: boolean;
    stepIndex: number;
    steps: readonly EditorTourStep[];
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
    onDone: () => void;
}) {
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ top: 120, left: 96 });
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
            const popoverWidth = Math.min(370, window.innerWidth - 32);
            const popoverHeight = 240;
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
      {targetRect && (<div className={cx("lv-tour-highlight", cssClass({
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
            }))} aria-hidden="true"/>)}
      <section className={cx("lv-tour-popover", cssClass(popoverStyle))} role="dialog" aria-live="polite" aria-label="Leaflet editor product tour">
        <div className="lv-tour-progress">
          <span>Step {stepIndex + 1} of {steps.length}</span>
          <button type="button" onClick={onSkip}>Skip tour</button>
        </div>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="lv-tour-dots" aria-hidden="true">
          {steps.map((_, idx) => (<span key={idx} className={idx === stepIndex ? 'active' : ''}/>))}
        </div>
        <div className="lv-tour-actions">
          <button type="button" className="lv-tour-secondary" onClick={onBack} disabled={stepIndex === 0}>
            Back
          </button>
          <button type="button" className="lv-tour-primary" onClick={isLast ? onDone : onNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </section>
    </>);
}
function formatDate(iso: string): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso));
}
function formatPrice(n: number | null, sym?: string, pos?: string): string {
    if (n === null)
        return '-';
    const num = n.toLocaleString('en-US', { maximumFractionDigits: 10 });
    if (!sym)
        return num;
    return pos === 'before' ? `${sym}${num}` : `${num} ${sym}`;
}
/** Returns true when the string contains any non-ASCII character. */
function isNonLatin(s: string): boolean {
    return /[^\x00-\x7F]/.test(s);
}
/** Compute inline styles for the flag wrapper from the card layout. */
function flagWrapStyle(cl: import('../services/api').CardLayout | null | undefined): React.CSSProperties {
    if (!cl)
        return {};
    const fes = cl.flag_element_style;
    // Background
    const bg = fes?.bg || cl.flag_bg || '';
    const bgOpacity = fes?.bg_opacity ?? 0.15;
    const bgType = fes?.bg_type ?? 'solid';
    const bgColor2 = fes?.bg_color2 ?? '#ffffff';
    const bgAngle = fes?.bg_gradient_angle ?? 135;
    // Border
    const bw = fes?.border_width ?? cl.flag_border_width ?? 0;
    const bc = fes?.border_color ?? cl.flag_border_color ?? '#000000';
    const bs = fes?.border_style ?? 'solid';
    const bt = fes?.border_top ?? bw;
    const br = fes?.border_right ?? bw;
    const bb = fes?.border_bottom ?? bw;
    const bl = fes?.border_left ?? bw;
    // Radius
    const radMode = fes?.radius_mode ?? (cl.flag_radius_mode === 'each' ? 'each' : 'all');
    const radius = radMode === 'each'
        ? `${fes?.radius_tl ?? cl.flag_radius_tl ?? 0}px ${fes?.radius_tr ?? cl.flag_radius_tr ?? 0}px ${fes?.radius_br ?? cl.flag_radius_br ?? 0}px ${fes?.radius_bl ?? cl.flag_radius_bl ?? 0}px`
        : `${fes?.radius ?? cl.flag_radius ?? 0}px`;
    // Alignment
    const jc = fes?.align === 'right' ? 'flex-end' : fes?.align === 'center' ? 'center' : 'flex-start';
    const ai = fes?.valign === 'bottom' ? 'flex-end' : fes?.valign === 'middle' ? 'center' : 'flex-start';
    // Build background
    let background: string | undefined;
    if (bg) {
        if (bgType === 'gradient') {
            background = `linear-gradient(${bgAngle}deg, ${hexToRgba(bg, bgOpacity)}, ${hexToRgba(bgColor2, bgOpacity)})`;
        }
        else {
            background = hexToRgba(bg, bgOpacity);
        }
    }
    return {
        display: 'flex',
        alignItems: ai,
        justifyContent: jc,
        lineHeight: 1,
        padding: `${fes?.padding ?? 2}px`,
        overflow: 'hidden',
        boxSizing: 'border-box' as const,
        borderRadius: radius,
        // CSS variable for img width
        '--flag-icon-size': `${cl.flag_icon_size ?? 18}px`,
        ...(background ? { background } : {}),
        ...(bw > 0 ? {
            borderTopWidth: `${bt}px`,
            borderRightWidth: `${br}px`,
            borderBottomWidth: `${bb}px`,
            borderLeftWidth: `${bl}px`,
            borderStyle: bs,
            borderColor: bc,
        } : {}),
        ...(fes?.shadow ? { boxShadow: '2px 2px 6px rgba(0,0,0,0.35)' } : {}),
    } as React.CSSProperties;
}
/** Returns true when the data-URL is an SVG image. */
function isSvgDataUrl(url: string): boolean {
    return url.startsWith('data:image/svg+xml');
}
/**
 * Decode an SVG data-URL, replace every fill/stroke that is not "none"
 * with the requested color, then re-encode as a data-URL.
 */
function applyColorToSvg(dataUrl: string, color: string): string {
    try {
        let svgText: string;
        if (dataUrl.includes(';base64,')) {
            svgText = atob(dataUrl.split(';base64,')[1]);
        }
        else {
            svgText = decodeURIComponent(dataUrl.split(',')[1]);
        }
        // Replace fill / stroke attributes (skip "none")
        svgText = svgText
            .replace(/fill="(?!none)[^"]*"/g, `fill="${color}"`)
            .replace(/stroke="(?!none)[^"]*"/g, `stroke="${color}"`)
            // Also replace inline style fill/stroke
            .replace(/fill:\s*(?!none)[^;}"]+/g, `fill:${color}`)
            .replace(/stroke:\s*(?!none)[^;}"]+/g, `stroke:${color}`);
        // If no explicit fill found, inject fill on the root <svg>
        if (!/fill=/.test(svgText)) {
            svgText = svgText.replace('<svg', `<svg fill="${color}"`);
        }
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgText)))}`;
    }
    catch {
        return dataUrl;
    }
}
interface PriceDisplayProps {
    value: number | null;
    sym?: string;
    pos?: string;
    iconUrl?: string;
    iconColor?: string;
    symSize?: number;
    iconSize?: number;
    gap?: number;
    textStyle?: React.CSSProperties;
    strikethrough?: boolean;
}
function PriceDisplay({ value, sym, pos, iconUrl, iconColor, symSize, iconSize, gap, textStyle, strikethrough }: PriceDisplayProps) {
    if (value === null)
        return <span className={cssClass(textStyle)}>-</span>;
    const num = value.toLocaleString('en-US', { maximumFractionDigits: 10 });
    const spacing = gap ?? 2;
    const isBefore = pos === 'before' || pos === 'left';
    const isTop = pos === 'top';
    const isBottom = pos === 'bottom';
    const isVertical = isTop || isBottom;
    const marginStyle: React.CSSProperties = isVertical
        ? (isTop ? { marginBottom: spacing } : { marginTop: spacing })
        : (isBefore ? { marginRight: spacing } : { marginLeft: spacing });
    let iconEl: React.ReactNode = null;
    if (iconUrl) {
        const resolvedUrl = (iconColor && isSvgDataUrl(iconUrl))
            ? applyColorToSvg(iconUrl, iconColor)
            : iconUrl;
        const px = iconSize ?? 16;
        iconEl = (<img src={resolvedUrl} alt="" className={cssClass({ height: `${px}px`, width: 'auto', verticalAlign: 'middle', marginBottom: '0.1em', ...marginStyle })}/>);
    }
    else if (sym) {
        iconEl = (<span className={cssClass({ fontSize: symSize ? `${symSize}px` : undefined, ...marginStyle })}>
        {sym}
      </span>);
    }
    const numEl = <span className={cssClass(strikethrough ? { textDecoration: 'line-through' } : undefined)}>{num}</span>;
    if (isVertical) {
        return (<span className={cssClass({ ...textStyle, display: 'inline-flex', flexDirection: 'column', alignItems: 'center' })}>
        {iconEl && isTop ? iconEl : null}
        {numEl}
        {iconEl && isBottom ? iconEl : null}
      </span>);
    }
    return (<span className={cssClass({ ...textStyle, display: 'inline-flex', alignItems: 'center' })}>
      {iconEl && isBefore ? iconEl : null}
      {numEl}
      {iconEl && !isBefore ? iconEl : null}
    </span>);
}
function parsePrice(s: string): number | null {
    const cleaned = s.replace(/[^0-9.,]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) || n < 0 ? null : n;
}
function LinkIconEl({ iconKey, customIcon, customIconUrl, color, size }: {
    iconKey: string;
    customIcon?: string;
    customIconUrl?: string;
    color?: string;
    size?: number;
}) {
    const px = size ?? 16;
    if (iconKey === 'none')
        return null;
    if (iconKey === 'custom') {
        if (customIconUrl)
            return <img src={customIconUrl} alt="icon" className={cssClass({ width: px, height: px, objectFit: 'contain', flexShrink: 0 })}/>;
        return <span className={cssClass({ color, fontSize: px, lineHeight: 1 })}>{customIcon || '->'}</span>;
    }
    const ic = LINK_ICONS.find(i => i.key === iconKey);
    if (!ic)
        return null;
    if (ic.path)
        return (<svg xmlns="http://www.w3.org/2000/svg" width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={cssClass({ flexShrink: 0 })}>
      <path d={ic.path}/>
    </svg>);
    return null;
}
function elemStyle(pos: CardElementPos | undefined, key?: keyof typeof DEFAULT_POSITIONS): React.CSSProperties {
    const p = pos ?? (key ? DEFAULT_POSITIONS[key] : undefined);
    if (!p)
        return { display: 'none' };
    return {
        position: 'absolute',
        left: `${p.x}%`,
        top: `${p.y}%`,
        width: `${p.w}%`,
        height: `${p.h}%`,
        zIndex: p.z ?? 'auto',
        overflow: 'hidden',
        boxSizing: 'border-box',
    };
}
function CardShapes({ layout }: {
    layout?: CardLayout | null;
}) {
    return (<>
      {(layout?.shapes ?? []).map(shape => {
            const gradientId = `lv-shape-grad-${shape.id}`;
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
            const gx = Math.cos(angle) * 50;
            const gy = Math.sin(angle) * 50;
            const rectPath = roundedCardShapeRectPath(4, 4, 92, 92, shape.radiusMode === 'each' ? (shape.radiusTl ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusTr ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusBr ?? 0) : (shape.radius ?? 4), shape.radiusMode === 'each' ? (shape.radiusBl ?? 0) : (shape.radius ?? 4));
            const trianglePath = roundedCardShapePolygonPath([{ x: 50, y: 4 }, { x: 96, y: 96 }, { x: 4, y: 96 }], shape.radiusMode === 'each'
                ? [shape.radiusTl ?? 0, shape.radiusBr ?? 0, shape.radiusBl ?? 0]
                : [shape.radius ?? 4, shape.radius ?? 4, shape.radius ?? 4]);
            return (<div key={shape.id} className={cx("lv-card-shape", cssClass({
                    position: 'absolute',
                    left: `${shape.x}%`,
                    top: `${shape.y}%`,
                    width: `${shape.w}%`,
                    height: `${shape.h}%`,
                    zIndex: shape.z ?? 60,
                    transform: `rotate(${shape.rotation ?? 0}deg)`,
                    transformOrigin: 'center',
                    pointerEvents: 'none',
                }))}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cssClass({ display: 'block', width: '100%', height: '100%', overflow: 'visible' })}>
              {(shape.fillType ?? 'solid') === 'gradient' && shape.type !== 'line' && (<defs>
                  <linearGradient id={gradientId} x1={50 - gx} y1={50 - gy} x2={50 + gx} y2={50 + gy} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor={shape.fill ?? '#49f2b6'}/>
                    <stop offset="100%" stopColor={shape.fillColor2 ?? '#ffffff'}/>
                  </linearGradient>
                </defs>)}
              {shape.type === 'rectangle' && <path d={rectPath} {...common}/>}
              {shape.type === 'triangle' && <path d={trianglePath} {...common}/>}
              {shape.type === 'ellipse' && <ellipse cx="50" cy="50" rx="46" ry="44" {...common}/>}
              {shape.type === 'polygon' && <polygon points={cardShapePolygonPoints(shape.sides ?? 6)} {...common}/>}
              {shape.type === 'star' && <polygon points={cardShapeStarPoints(shape.points ?? 5)} {...common}/>}
              {shape.type === 'line' && <line x1="4" y1="50" x2="96" y2="50" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} strokeDasharray={dasharray} strokeLinecap={shape.strokeStyle === 'solid' ? 'round' : common.strokeLinecap} vectorEffect="non-scaling-stroke"/>}
            </svg>
          </div>);
        })}
    </>);
}
function cardShapePolygonPoints(sides: number) {
    const count = Math.max(3, Math.min(12, Math.round(sides)));
    const pts: string[] = [];
    for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        pts.push(`${50 + Math.cos(angle) * 46} ${50 + Math.sin(angle) * 46}`);
    }
    return pts.join(' ');
}
function cardShapeStarPoints(points: number) {
    const count = Math.max(3, Math.min(12, Math.round(points)));
    const pts: string[] = [];
    for (let i = 0; i < count * 2; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / count;
        const radius = i % 2 === 0 ? 46 : 20;
        pts.push(`${50 + Math.cos(angle) * radius} ${50 + Math.sin(angle) * radius}`);
    }
    return pts.join(' ');
}
function roundedCardShapeRectPath(x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
    const max = Math.min(w, h) / 2;
    const clampRadius = (v: number) => Math.max(0, Math.min(max, v));
    const r = [tl, tr, br, bl].map(clampRadius);
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
function roundedCardShapePolygonPath(points: {
    x: number;
    y: number;
}[], radii: number[]) {
    if (points.length < 3)
        return '';
    const clampRadius = (v: number, max: number) => Math.max(0, Math.min(max, v));
    const corner = points.map((point, i) => {
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const prevLen = Math.hypot(prev.x - point.x, prev.y - point.y);
        const nextLen = Math.hypot(next.x - point.x, next.y - point.y);
        const radius = clampRadius(radii[i] ?? 0, Math.min(prevLen, nextLen) / 2);
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
function elemBorderRadius(es: TextElementStyle | undefined): string | number {
    if (!es)
        return 0;
    if (es.radius_mode === 'each') {
        const tl = es.radius_tl ?? 0, tr = es.radius_tr ?? 0, br = es.radius_br ?? 0, bl = es.radius_bl ?? 0;
        return `${tl}px ${tr}px ${br}px ${bl}px`;
    }
    return es.radius ?? 3;
}
function ElemBorderSVG({ es }: {
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
    const rad = elemBorderRadius(es);
    const radStr = typeof rad === 'number' ? String(rad) : rad;
    const half = w / 2;
    return (<svg className={cssClass({ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' })}>
      <rect x={half} y={half} width={`calc(100% - ${w}px)`} height={`calc(100% - ${w}px)`} rx={radStr} ry={radStr} fill="none" stroke={es.border_color} strokeWidth={w} strokeDasharray={dashArray} strokeLinecap={style === 'dotted' ? 'round' : 'square'}/>
    </svg>);
}
function applyElemTS(es: TextElementStyle | undefined, color?: string, fontSize?: number, fontFamily?: string): {
    outer: React.CSSProperties;
    text: React.CSSProperties;
} {
    const bg = es?.bg ? hexToRgba(es.bg, es.bg_opacity ?? 0.15) : undefined;
    const vAlign = es?.valign ?? 'top';
    const alignItems = vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'flex-end' : 'flex-start';
    const hAlign = es?.align ?? 'left';
    const justifyContent = hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start';
    const pad = (es?.padding != null && es.padding >= 0) ? `${es.padding}px` : '2px';
    const rad = elemBorderRadius(es);
    const bw = es?.border_width ?? 0;
    const bc = es?.border_color ?? '';
    const bs = es?.border_style ?? 'solid';
    const bt = es?.border_top ?? bw;
    const br = es?.border_right ?? bw;
    const bb = es?.border_bottom ?? bw;
    const bl = es?.border_left ?? bw;
    const hasBorder = bw > 0 && bc;
    return {
        outer: {
            background: bg,
            display: 'flex', alignItems, justifyContent,
            boxSizing: 'border-box',
            padding: pad,
            borderRadius: rad,
            ...(hasBorder ? {
                borderTopWidth: `${bt}px`,
                borderRightWidth: `${br}px`,
                borderBottomWidth: `${bb}px`,
                borderLeftWidth: `${bl}px`,
                borderStyle: bs,
                borderColor: bc,
            } : {}),
        },
        text: {
            color,
            fontSize: es && es.script !== 'none' && fontSize ? `${fontSize * 0.72}px` : fontSize ? `${fontSize}px` : undefined,
            fontWeight: es?.bold ? 700 : undefined,
            fontStyle: es?.italic ? 'italic' : undefined,
            fontFamily: fontFamily ? `"${fontFamily}", sans-serif` : undefined,
            textTransform: es?.transform === 'title_case' ? 'capitalize' : es?.transform && es.transform !== 'none' ? es.transform as React.CSSProperties['textTransform'] : undefined,
            verticalAlign: es?.script === 'superscript' ? 'super' : es?.script === 'subscript' ? 'sub' : undefined,
            textAlign: es?.align ?? 'left',
            display: 'block', width: '100%', lineHeight: 1.3, overflow: 'hidden',
        },
    };
}
/* --------
   Image Uploader (drag & drop + browse)
-------- */
interface ImageUploaderProps {
    currentUrl: string;
    onUploaded: (url: string) => void;
}
const IMAGE_URL_RE = /^https?:\/\/.+\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
function ImageUploader({ currentUrl, onUploaded }: ImageUploaderProps) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState<string | null>(null);
    const [preview, setPreview] = useState<string>(currentUrl);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    // Sync preview when the modal opens for a different product
    useEffect(() => {
        setPreview(currentUrl);
        setUploadErr(null);
    }, [currentUrl]);
    async function handleFile(file: File) {
        if (!file.type.startsWith('image/')) {
            setUploadErr('Please select an image file.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setUploadErr('Image must be smaller than 20 MB.');
            return;
        }
        setUploadErr(null);
        setUploading(true);
        // Show local preview immediately
        const local = URL.createObjectURL(file);
        setPreview(local);
        try {
            const url = await uploadImage(file);
            setPreview(url);
            onUploaded(url);
        }
        catch (e) {
            setUploadErr(e instanceof Error ? e.message : 'Upload failed.');
            setPreview(currentUrl); // revert preview
        }
        finally {
            setUploading(false);
        }
    }
    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file)
            handleFile(file);
    }
    function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file)
            handleFile(file);
        e.target.value = '';
    }
    function onPaste(e: React.ClipboardEvent) {
        const file = Array.from(e.clipboardData.files).find(item => item.type.startsWith('image/'))
            || Array.from(e.clipboardData.items)
                .find(item => item.kind === 'file' && item.type.startsWith('image/'))
                ?.getAsFile();
        if (file) {
            e.preventDefault();
            handleFile(file);
            return;
        }
        const text = e.clipboardData.getData('text/plain').trim();
        if (IMAGE_URL_RE.test(text)) {
            e.preventDefault();
            setUploadErr(null);
            setPreview(text);
            onUploaded(text);
        }
    }
    async function pasteFromClipboard() {
        setUploadErr(null);
        try {
            const clipboard = navigator.clipboard;
            if (!clipboard)
                throw new Error('Clipboard access is not available in this browser.');
            if ('read' in clipboard) {
                const items = await clipboard.read();
                for (const item of items) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        const ext = imageType.split('/')[1] || 'png';
                        await handleFile(new File([blob], `pasted-image.${ext}`, { type: imageType }));
                        return;
                    }
                }
            }
            const text = await clipboard.readText();
            const url = text.trim();
            if (IMAGE_URL_RE.test(url)) {
                setPreview(url);
                onUploaded(url);
                return;
            }
            throw new Error('Clipboard does not contain an image or direct image URL.');
        }
        catch (err) {
            setUploadErr(err instanceof Error ? err.message : 'Could not paste image from clipboard.');
        }
    }
    return (<div className="lv-img-upload-wrap" onPaste={onPaste}>
      {/* Drop zone */}
      <div ref={dropRef} className={`lv-img-dropzone${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}`} onClick={() => { dropRef.current?.focus(); inputRef.current?.click(); }} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} role="button" tabIndex={0} aria-label="Upload product image" onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ')
                inputRef.current?.click();
        }} onPaste={onPaste}>
        {preview ? (<div className="lv-img-preview-wrap">
            <img src={preview} alt="Product preview" className="lv-img-preview"/>
            <div className="lv-img-preview-overlay">
              {uploading ? (<span className="lv-upload-spinner"/>) : (<span className="lv-img-preview-hint">Click or drag to replace</span>)}
            </div>
          </div>) : (<div className="lv-img-dropzone-empty">
            {uploading ? (<span className="lv-upload-spinner"/>) : (<>
                <span className="lv-img-icon">image</span>
                <span className="lv-img-hint">
                  {dragging ? 'Drop image here' : 'Click, paste, or drag & drop image'}
                </span>
                <span className="lv-img-sub">JPEG, PNG, SVG, WebP, GIF, AVIF - paste supported - max 20 MB</span>
              </>)}
          </div>)}
      </div>
      <button type="button" className="lv-img-paste-btn" onClick={pasteFromClipboard} disabled={uploading}>
        Paste image
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onInputChange} className={cssClass({ display: 'none' })}/>
      {uploadErr && <p className="lv-upload-err">{uploadErr}</p>}
    </div>);
}
interface HeaderLogoUploaderProps {
    currentUrl: string;
    onUploaded: (url: string) => void;
    onRemove: () => void;
}
function HeaderLogoUploader({ currentUrl, onUploaded, onRemove }: HeaderLogoUploaderProps) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadErr, setUploadErr] = useState<string | null>(null);
    const [preview, setPreview] = useState(currentUrl);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        setPreview(currentUrl);
        setUploadErr(null);
    }, [currentUrl]);
    async function handleFile(file: File) {
        if (!file.type.startsWith('image/')) {
            setUploadErr('Please select an image file.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setUploadErr('Logo must be smaller than 20 MB.');
            return;
        }
        setUploadErr(null);
        setUploading(true);
        const local = URL.createObjectURL(file);
        setPreview(local);
        try {
            const url = await uploadImage(file);
            setPreview(url);
            onUploaded(url);
        }
        catch (e) {
            setUploadErr(e instanceof Error ? e.message : 'Logo upload failed.');
            setPreview(currentUrl);
        }
        finally {
            URL.revokeObjectURL(local);
            setUploading(false);
        }
    }
    function handlePaste(e: React.ClipboardEvent) {
        const file = Array.from(e.clipboardData.files).find(item => item.type.startsWith('image/'))
            || Array.from(e.clipboardData.items)
                .find(item => item.kind === 'file' && item.type.startsWith('image/'))
                ?.getAsFile();
        if (file) {
            e.preventDefault();
            handleFile(file);
            return;
        }
        const text = e.clipboardData.getData('text/plain').trim();
        if (IMAGE_URL_RE.test(text)) {
            e.preventDefault();
            setUploadErr(null);
            setPreview(text);
            onUploaded(text);
        }
    }
    async function pasteFromClipboard() {
        setUploadErr(null);
        try {
            const clipboard = navigator.clipboard;
            if (!clipboard)
                throw new Error('Clipboard access is not available in this browser.');
            if ('read' in clipboard) {
                const items = await clipboard.read();
                for (const item of items) {
                    const imageType = item.types.find(type => type.startsWith('image/'));
                    if (imageType) {
                        const blob = await item.getType(imageType);
                        const ext = imageType.split('/')[1] || 'png';
                        await handleFile(new File([blob], `pasted-logo.${ext}`, { type: imageType }));
                        return;
                    }
                }
            }
            const text = await clipboard.readText();
            if (IMAGE_URL_RE.test(text.trim())) {
                setPreview(text.trim());
                onUploaded(text.trim());
                return;
            }
            throw new Error('Clipboard does not contain a logo image or direct image URL.');
        }
        catch (e) {
            setUploadErr(e instanceof Error ? e.message : 'Could not paste logo from clipboard.');
        }
    }
    return (<div className="lv-logo-upload-wrap" onPaste={handlePaste}>
      <div className={`lv-logo-dropzone${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}`} role="button" tabIndex={0} aria-label="Upload header logo" onClick={() => inputRef.current?.click()} onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ')
                inputRef.current?.click();
        }} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file)
                handleFile(file);
        }} onPaste={handlePaste}>
        {preview ? (<div className="lv-logo-preview-row">
            <img src={preview} alt="Header logo preview" className="lv-logo-preview"/>
            <span>{uploading ? 'Uploading logo...' : 'Click, paste, or drop to replace'}</span>
          </div>) : (<div className="lv-logo-empty">
            <span className="lv-logo-empty-icon">add</span>
            <span>{dragging ? 'Drop your logo here' : 'Click, paste, or drag and drop your logo'}</span>
          </div>)}
      </div>
      <div className="lv-logo-actions">
        <button type="button" className="lv-img-paste-btn" onClick={pasteFromClipboard} disabled={uploading}>
          Paste logo
        </button>
        {currentUrl && (<button type="button" className="lv-logo-remove" onClick={onRemove} disabled={uploading}>
            Remove
          </button>)}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0];
            if (file)
                handleFile(file);
            e.target.value = '';
        }} className={cssClass({ display: 'none' })}/>
      {uploadErr && <p className="lv-upload-err">{uploadErr}</p>}
    </div>);
}
/* --------
   Edit Modal
-------- */
interface EditModalProps {
    product: LeafletProduct;
    isTwoLang: boolean;
    leafletId: string;
    onClose: () => void;
    onSave: (updated: LeafletProduct) => void;
}
function EditModal({ product, isTwoLang, leafletId, onClose, onSave }: EditModalProps) {
    const [form, setForm] = useState({
        product_name_lan1: product.product_name_lan1,
        product_name_lan2: product.product_name_lan2,
        product_img_url: product.product_img_url,
        product_image_license: product.product_image_license ?? '',
        product_url: product.product_url,
        origin_lan1: product.origin_lan1,
        origin_lan2: product.origin_lan2,
        origin_lan1_iso: product.origin_lan1_iso ?? '',
        origin_lan2_iso: product.origin_lan2_iso ?? '',
        old_price: product.old_price !== null ? String(product.old_price) : '',
        current_price: product.current_price !== null ? String(product.current_price) : '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageSearchStatus, setImageSearchStatus] = useState<string | null>(null);
    const [pendingImage, setPendingImage] = useState<ProductImageSuggestion | null>(null);
    const [confirmedImageMeta, setConfirmedImageMeta] = useState<ProductImageSuggestion | null>(null);
    const [licenseSearching, setLicenseSearching] = useState(false);
    const [imageSearchEngine, setImageSearchEngine] = useState<'google' | 'bing' | 'duckduckgo' | 'custom'>(() => {
        const saved = localStorage.getItem('leafletai_image_search_engine');
        return saved === 'bing' || saved === 'duckduckgo' || saved === 'custom' ? saved : 'google';
    });
    const [customImageSearchUrl, setCustomImageSearchUrl] = useState(() => (localStorage.getItem('leafletai_custom_image_search_url') || ''));
    useEffect(() => {
        localStorage.setItem('leafletai_image_search_engine', imageSearchEngine);
    }, [imageSearchEngine]);
    useEffect(() => {
        localStorage.setItem('leafletai_custom_image_search_url', customImageSearchUrl);
    }, [customImageSearchUrl]);
    const [showUrlInput, setShowUrl] = useState(!!product.product_img_url && !product.product_img_url.startsWith('/uploads/'));
    const firstRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        firstRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    function set(field: string, value: string) {
        setForm(f => ({ ...f, [field]: value }));
        if (field === 'product_img_url') {
            setPendingImage(null);
            setConfirmedImageMeta(null);
        }
    }
    async function saveProduct(imageUrl = form.product_img_url.trim(), imageMeta?: ProductImageSuggestion) {
        const current_price = parsePrice(form.current_price);
        const old_price = parsePrice(form.old_price);
        const { product: updated } = await updateProduct(leafletId, product.id, {
            product_name_lan1: form.product_name_lan1.trim(),
            product_name_lan2: form.product_name_lan2.trim(),
            product_img_url: imageUrl,
            product_image_license: (imageMeta ?? confirmedImageMeta)?.licenseUrl || (imageMeta ?? confirmedImageMeta)?.license || form.product_image_license.trim(),
            ...(imageMeta || confirmedImageMeta ? {
                product_image_source: (imageMeta ?? confirmedImageMeta)?.source ?? '',
            } : {}),
            product_url: form.product_url.trim(),
            origin_lan1: form.origin_lan1.trim(),
            origin_lan2: form.origin_lan2.trim(),
            origin_lan1_iso: form.origin_lan1_iso,
            origin_lan2_iso: form.origin_lan2_iso,
            old_price: old_price,
            current_price: current_price,
        });
        onSave(updated);
        onClose();
    }
    async function findReusableImage() {
        const productName = form.product_name_lan1.trim();
        setImageSearchStatus('Searching Creative Commons images for this product...');
        const { images } = await searchProductImages(productName);
        const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const ranked = [...images].sort((a, b) => {
            const aTitle = a.title.toLowerCase();
            const bTitle = b.title.toLowerCase();
            const aScore = words.reduce((score, word) => score + (aTitle.includes(word) ? 1 : 0), 0);
            const bScore = words.reduce((score, word) => score + (bTitle.includes(word) ? 1 : 0), 0);
            return bScore - aScore;
        });
        const selected = ranked[0] ?? null;
        if (!selected)
            throw new Error('No reusable image was found for this product name. Please upload an image or paste a direct image URL.');
        setPendingImage(selected);
        setImageSearchStatus(null);
    }
    async function findImageLicense() {
        const productName = form.product_name_lan1.trim();
        if (!productName) {
            setError('Product name is required before searching for an image license.');
            return;
        }
        const searchQuery = `${productName} product image Creative Commons license`;
        const imageSearchUrls = {
            google: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`,
            bing: `https://www.bing.com/images/search?q=${encodeURIComponent(searchQuery)}`,
            duckduckgo: `https://duckduckgo.com/?iax=images&ia=images&q=${encodeURIComponent(searchQuery)}`,
            custom: customImageSearchUrl.trim()
                ? customImageSearchUrl.trim().replace('{query}', encodeURIComponent(searchQuery))
                : `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`,
        };
        const popup = window.open(imageSearchUrls[imageSearchEngine], 'leafletai_image_license_search', 'popup=yes,width=1180,height=760,menubar=no,toolbar=yes,location=yes,status=no,scrollbars=yes,resizable=yes');
        if (!popup) {
            setError('Popup was blocked. Please allow popups, then click Find license again.');
            return;
        }
        popup.focus();
        setError(null);
        setLicenseSearching(true);
        try {
            const { images } = await searchProductImages(productName);
            const match = images.find(img => img.url === form.product_img_url.trim())
                || images.find(img => img.licenseUrl)
                || images[0];
            if (!match)
                throw new Error('No reusable image license was found for this product.');
            set('product_image_license', match.licenseUrl || match.license || 'Creative Commons / reusable media');
            if (!form.product_img_url.trim()) {
                setPendingImage(match);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Could not find an image license.');
        }
        finally {
            setLicenseSearching(false);
        }
    }
    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setImageSearchStatus(null);
        if (!form.product_name_lan1.trim()) {
            setError('Product name is required.');
            return;
        }
        const current_price = parsePrice(form.current_price);
        if (form.current_price && current_price === null) {
            setError('Current price must be a valid number.');
            return;
        }
        setSaving(true);
        try {
            if (!form.product_img_url.trim()) {
                if (pendingImage) {
                    await saveProduct(pendingImage.url, pendingImage);
                }
                else {
                    await findReusableImage();
                }
            }
            else {
                await saveProduct();
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
        }
        finally {
            setSaving(false);
        }
    }
    return ReactDOM.createPortal(<div className="lv-modal-backdrop" onClick={e => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
      <div className="lv-modal" role="dialog" aria-modal="true" aria-label="Edit product">
        <div className="lv-modal-header">
          <h2 className="lv-modal-title">Edit Product</h2>
          <button className="lv-modal-close" onClick={onClose} aria-label="Close">x</button>
        </div>

        <form className="lv-modal-body" onSubmit={handleSave}>
          {error && <div className="lv-modal-error">{error}</div>}

          <div className="lv-modal-grid">
            {/* Name lan1 */}
            <label className="lv-field">
              <span className="lv-label">Name {isTwoLang ? '(Language 1)' : ''} *</span>
              <input ref={firstRef} className="input" value={form.product_name_lan1} onChange={e => set('product_name_lan1', e.target.value)} placeholder="Product name"/>
            </label>

            {/* Name lan2 */}
            {isTwoLang && (<label className="lv-field">
                <span className="lv-label">Name (Language 2)</span>
                <input className="input" value={form.product_name_lan2} onChange={e => set('product_name_lan2', e.target.value)} placeholder="Product name - language 2"/>
              </label>)}

            {/* Origin lan1 - auto-syncing country picker */}
            <label className="lv-field">
              <span className="lv-label">Origin {isTwoLang ? '(Language 1)' : ''}</span>
              <OriginInput value={form.origin_lan1} onChange={v => set('origin_lan1', v)} onIsoChange={iso => set('origin_lan1_iso', iso)} crossCheckValue={form.origin_lan2} placeholder="e.g. Saudi Arabia"/>
            </label>

            {/* Origin lan2 - auto-syncing country picker with cross-check from lan1 */}
            {isTwoLang && (<label className="lv-field">
                <span className="lv-label">Origin (Language 2)</span>
                <OriginInput value={form.origin_lan2} onChange={v => set('origin_lan2', v)} onIsoChange={iso => set('origin_lan2_iso', iso)} crossCheckValue={form.origin_lan1} placeholder="e.g. Saudi Arabia"/>
              </label>)}

            {/* Old price */}
            <label className="lv-field">
              <span className="lv-label">Old price</span>
              <input className="input" value={form.old_price} onChange={e => set('old_price', e.target.value)} placeholder="e.g. 9.99" inputMode="decimal"/>
            </label>

            {/* Current price */}
            <label className="lv-field">
              <span className="lv-label">Current price</span>
              <input className="input" value={form.current_price} onChange={e => set('current_price', e.target.value)} placeholder="e.g. Saudi Arabia" inputMode="decimal"/>
            </label>

            {/* Live discount preview */}
            {(() => {
            const op = parseFloat(form.old_price);
            const cp = parseFloat(form.current_price);
            if (!isNaN(op) && !isNaN(cp) && op > 0 && cp > 0) {
                if (op > cp) {
                    const pct = Math.round(100 - (cp / op) * 100);
                    const saved = (op - cp).toFixed(2);
                    return (<div className="lv-discount-preview">
                      <span className="lv-discount-preview-badge">-{pct}%</span>
                      <span className="lv-discount-preview-text">Save {saved} - {pct}% discount</span>
                    </div>);
                }
                if (cp > op) {
                    return (<div className="lv-discount-preview lv-discount-preview--warn">
                      <span className="lv-discount-preview-text">Warning Current price is higher than old price - no discount badge will show</span>
                    </div>);
                }
            }
            return null;
        })()}

            {/* Image upload + URL - full width */}
            <div className="lv-field lv-field-full">
              <span className="lv-label">Product Image <span className="lv-label-opt">(optional)</span></span>
              <ImageUploader currentUrl={form.product_img_url} onUploaded={url => { set('product_img_url', url); setShowUrl(false); }}/>
              {showUrlInput ? (<div className="lv-img-url-row">
                  <input className="input lv-img-url-input" value={form.product_img_url} onChange={e => set('product_img_url', e.target.value)} placeholder="e.g. Saudi Arabia" type="url" autoFocus/>
                  <button type="button" className="lv-img-url-clear" onClick={() => { set('product_img_url', ''); setShowUrl(false); }} title="Clear URL">x</button>
                </div>) : (<button type="button" className="lv-img-url-toggle" onClick={() => setShowUrl(true)}>
                  or paste an image URL
                </button>)}
              {imageSearchStatus && <p className="lv-image-search-status">{imageSearchStatus}</p>}
              {pendingImage && (<div className="lv-image-suggestion">
                  <img src={pendingImage.thumb || pendingImage.url} alt={form.product_name_lan1.trim()} className="lv-image-suggestion-preview"/>
                  <div className="lv-image-suggestion-copy">
                    <strong>Suggested reusable image</strong>
                    <span>{pendingImage.title}</span>
                    <small>{pendingImage.source} - {pendingImage.licenseUrl || pendingImage.license || 'Creative Commons / reusable media'}</small>
                    <div className="lv-image-suggestion-actions">
                      <button type="button" className="btn primary" onClick={() => {
                set('product_img_url', pendingImage.url);
                set('product_image_license', pendingImage.licenseUrl || pendingImage.license || 'Creative Commons / reusable media');
                setConfirmedImageMeta(pendingImage);
                setPendingImage(null);
                setShowUrl(false);
            }}>
                        Use this image
                      </button>
                      <button type="button" className="btn ghost" onClick={() => setPendingImage(null)}>
                        Choose manually
                      </button>
                    </div>
                  </div>
                </div>)}
              <div className="lv-image-search-row">
                <select className="lv-image-search-select" value={imageSearchEngine} onChange={e => setImageSearchEngine(e.target.value as 'google' | 'bing' | 'duckduckgo' | 'custom')} aria-label="Image search engine">
                  <option value="google">Google Images</option>
                  <option value="bing">Bing Images</option>
                  <option value="duckduckgo">DuckDuckGo Images</option>
                  <option value="custom">My search engine</option>
                </select>
                <button type="button" className="lv-license-find-btn" onClick={findImageLicense} disabled={licenseSearching}>
                  {licenseSearching ? 'Searching...' : 'Search for product image'}
                </button>
              </div>
              {imageSearchEngine === 'custom' && (<input className="input lv-custom-search-input" value={customImageSearchUrl} onChange={e => setCustomImageSearchUrl(e.target.value)} placeholder="e.g. Saudi Arabia" type="url"/>)}
            </div>

            {/* Product URL - full width */}
            <label className="lv-field lv-field-full">
              <span className="lv-label">Product URL</span>
              <input className="input" value={form.product_url} onChange={e => set('product_url', e.target.value)} placeholder="e.g. Saudi Arabia" type="url"/>
            </label>
          </div>

          <div className="lv-modal-actions">
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>, document.body);
}
/* --------
   Overlay item (draggable + resizable icon on card)
-------- */
function OverlayItem({ ov, onUpdate, onRemove }: {
    ov: CardOverlay;
    onUpdate: (patch: Partial<CardOverlay>) => void;
    onRemove: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [selected, setSelected] = useState(false);
    /* click outside to deselect */
    useEffect(() => {
        if (!selected)
            return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node))
                setSelected(false);
        }
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [selected]);
    /* helper - find the nearest lv-card ancestor */
    function getCard() {
        let el: HTMLElement | null = ref.current?.parentElement ?? null;
        while (el && !el.classList.contains('lv-card'))
            el = el.parentElement;
        return el;
    }
    /* -- Move (drag body) -------- */
    function onMouseDownMove(e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        setSelected(true);
        const card = getCard();
        if (!card)
            return;
        const { width: cw, height: ch } = card.getBoundingClientRect();
        const startX = e.clientX, startY = e.clientY;
        const sx = ov.x, sy = ov.y;
        function onMove(ev: MouseEvent) {
            const nx = sx + ((ev.clientX - startX) / cw) * 100;
            const ny = sy + ((ev.clientY - startY) / ch) * 100;
            onUpdate({ x: Math.max(0, Math.min(100 - ov.w, nx)), y: Math.max(0, Math.min(100 - ov.h, ny)) });
        }
        function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    /* -- Resize (8 handles) -------- */
    type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
    function onMouseDownResize(e: React.MouseEvent, handle: Handle) {
        e.stopPropagation();
        e.preventDefault();
        const card = getCard();
        if (!card)
            return;
        const { width: cw, height: ch } = card.getBoundingClientRect();
        const startX = e.clientX, startY = e.clientY;
        const sx = ov.x, sy = ov.y, sw = ov.w, sh = ov.h;
        function onMove(ev: MouseEvent) {
            const dx = ((ev.clientX - startX) / cw) * 100;
            const dy = ((ev.clientY - startY) / ch) * 100;
            let nx = sx, ny = sy, nw = sw, nh = sh;
            if (handle.includes('e'))
                nw = Math.max(5, sw + dx);
            if (handle.includes('s'))
                nh = Math.max(5, sh + dy);
            if (handle.includes('w')) {
                nw = Math.max(5, sw - dx);
                nx = sx + sw - nw;
            }
            if (handle.includes('n')) {
                nh = Math.max(5, sh - dy);
                ny = sy + sh - nh;
            }
            onUpdate({ x: nx, y: ny, w: nw, h: nh });
        }
        function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    const handles: {
        key: Handle;
        cursor: string;
        style: React.CSSProperties;
    }[] = [
        { key: 'nw', cursor: 'nw-resize', style: { top: 2, left: 2 } },
        { key: 'n', cursor: 'n-resize', style: { top: 2, left: '50%', transform: 'translateX(-50%)' } },
        { key: 'ne', cursor: 'ne-resize', style: { top: 2, right: 2 } },
        { key: 'e', cursor: 'e-resize', style: { top: '50%', right: 2, transform: 'translateY(-50%)' } },
        { key: 'se', cursor: 'se-resize', style: { bottom: 2, right: 2 } },
        { key: 's', cursor: 's-resize', style: { bottom: 2, left: '50%', transform: 'translateX(-50%)' } },
        { key: 'sw', cursor: 'sw-resize', style: { bottom: 2, left: 2 } },
        { key: 'w', cursor: 'w-resize', style: { top: '50%', left: 2, transform: 'translateY(-50%)' } },
    ];
    return (<div ref={ref} className={cx(`lv-overlay-item${selected ? ' selected' : ''}`, cssClass({ left: `${ov.x}%`, top: `${ov.y}%`, width: `${ov.w}%`, height: `${ov.h}%` }))} onMouseDown={onMouseDownMove}>
      <img src={ov.src} alt={ov.label} draggable={false} className={cssClass({ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', display: 'block' })}/>
      {/* Delete button - top-right, inside bounds */}
      <button className="lv-overlay-remove" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">x</button>
      {/* 8 resize handles - visible only when selected */}
      {selected && handles.map(h => (<div key={h.key} className={cx("lv-overlay-handle", cssClass({ ...h.style, cursor: h.cursor }))} onMouseDown={e => onMouseDownResize(e, h.key)}/>))}
    </div>);
}
type HeaderLogoSettings = {
    logoUrl?: string;
    logoHeight?: number;
    logoWidth?: number;
    logoX?: number;
    logoY?: number;
    logoGap?: number;
    showText?: boolean;
};
type HeaderLogoBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};
type HeaderTextBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};
type HeaderTextSettings = {
    text?: string;
    textX?: number;
    textY?: number;
    textWidth?: number;
    textHeight?: number;
};
type HeaderToolbarPosition = { left: number; top: number; placeBelow: boolean };
function getHeaderContainer(start: HTMLElement | null) {
    let el: HTMLElement | null = start?.parentElement ?? null;
    while (el && !el.classList.contains('lv-a4-header') && !el.classList.contains('lv-a4-footer'))
        el = el.parentElement;
    return el;
}
function HeaderLogoItem({ settings, editable = false, onUpdate }: {
    settings: HeaderLogoSettings;
    editable?: boolean;
    onUpdate?: (patch: Partial<HeaderLogoSettings>) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [selected, setSelected] = useState(false);
    const [draftBox, setDraftBox] = useState<HeaderLogoBox | null>(null);
    const isPositioned = typeof settings.logoX === 'number' && typeof settings.logoY === 'number';
    const height = Number(settings.logoHeight ?? 44);
    const width = typeof settings.logoWidth === 'number' ? Number(settings.logoWidth) : undefined;
    const box = draftBox ?? (isPositioned ? { x: settings.logoX!, y: settings.logoY!, w: width ?? height, h: height } : null);
    const marginRight = settings.showText ? Number(settings.logoGap ?? 10) : 0;
    useEffect(() => {
        if (!selected)
            return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node))
                setSelected(false);
        }
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [selected]);
    function currentBox(header: HTMLElement) {
        const headerRect = header.getBoundingClientRect();
        const logoRect = ref.current?.getBoundingClientRect();
        const scale = headerRect.width && header.offsetWidth ? headerRect.width / header.offsetWidth : 1;
        return {
            scale: scale || 1,
            x: typeof settings.logoX === 'number' ? settings.logoX : ((logoRect?.left ?? headerRect.left) - headerRect.left) / (scale || 1),
            y: typeof settings.logoY === 'number' ? settings.logoY : ((logoRect?.top ?? headerRect.top) - headerRect.top) / (scale || 1),
            w: width ?? ((logoRect?.width ?? height) / (scale || 1)),
            h: height,
        };
    }
    function startMove(e: React.MouseEvent) {
        if (!editable || !onUpdate)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSelected(true);
        const header = getHeaderContainer(ref.current);
        const update = onUpdate;
        if (!header || !update)
            return;
        const headerEl = header;
        const start = currentBox(headerEl);
        const startX = e.clientX;
        const startY = e.clientY;
        let latest: HeaderLogoBox = { x: start.x, y: start.y, w: start.w, h: start.h };
        function onMove(ev: MouseEvent) {
            const headerW = headerEl.offsetWidth;
            const headerH = headerEl.offsetHeight;
            const nx = start.x + (ev.clientX - startX) / start.scale;
            const ny = start.y + (ev.clientY - startY) / start.scale;
            latest = {
                x: Math.max(0, Math.min(headerW - start.w, nx)),
                y: Math.max(0, Math.min(headerH - start.h, ny)),
                w: start.w,
                h: start.h,
            };
            setDraftBox(latest);
        }
        function onUp() {
            setDraftBox(null);
            update({
                logoX: latest.x,
                logoY: latest.y,
                logoWidth: latest.w,
            });
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    function startResize(e: React.MouseEvent) {
        if (!editable || !onUpdate)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSelected(true);
        const header = getHeaderContainer(ref.current);
        const update = onUpdate;
        if (!header || !update)
            return;
        const headerEl = header;
        const start = currentBox(headerEl);
        const startX = e.clientX;
        const startY = e.clientY;
        let latest: HeaderLogoBox = { x: start.x, y: start.y, w: start.w, h: start.h };
        function onMove(ev: MouseEvent) {
            const dx = (ev.clientX - startX) / start.scale;
            const dy = (ev.clientY - startY) / start.scale;
            const nextW = Math.max(18, Math.min(headerEl.offsetWidth - start.x, start.w + dx));
            const nextH = Math.max(18, Math.min(headerEl.offsetHeight - start.y, start.h + dy));
            latest = { x: start.x, y: start.y, w: nextW, h: nextH };
            setDraftBox(latest);
        }
        function onUp() {
            setDraftBox(null);
            update({
                logoX: latest.x,
                logoY: latest.y,
                logoWidth: latest.w,
                logoHeight: latest.h,
            });
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    if (!settings.logoUrl)
        return null;
    return (<div ref={ref} className={cx(`lv-a4-header-logo-box${editable ? ' editable' : ''}${selected ? ' selected' : ''}${box ? ' positioned' : ''}`, cssClass(box
            ? { left: box.x, top: box.y, width: box.w, height: box.h }
            : { width, height, marginRight }))} onMouseDown={startMove} title={editable ? 'Drag to move logo' : undefined}>
      <img src={String(settings.logoUrl)} alt="" className={cx("lv-a4-header-logo", cssClass({ width: width || box ? '100%' : 'auto' }))} draggable={false}/>
      {editable && selected && (<div className="lv-a4-header-logo-resize" onMouseDown={startResize} title="Drag to resize"/>)}
    </div>);
}
function HeaderTextItem({ settings, text, editable = false, fontFamily, onUpdate }: {
    settings: HeaderTextSettings;
    text: string;
    editable?: boolean;
    fontFamily?: string;
    onUpdate?: (patch: Partial<HeaderTextSettings>) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [selected, setSelected] = useState(false);
    const [draftBox, setDraftBox] = useState<HeaderTextBox | null>(null);
    const [editingText, setEditingText] = useState(false);
    const [draftText, setDraftText] = useState(text);
    const isPositioned = typeof settings.textX === 'number' && typeof settings.textY === 'number';
    const box = draftBox ?? (isPositioned
        ? {
            x: settings.textX!,
            y: settings.textY!,
            w: Number(settings.textWidth ?? 180),
            h: Number(settings.textHeight ?? 44),
        }
        : null);
    useEffect(() => {
        if (!selected)
            return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setSelected(false);
                setEditingText(false);
            }
        }
        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [selected]);
    useEffect(() => {
        if (!editingText)
            setDraftText(text);
    }, [editingText, text]);
    useEffect(() => {
        if (!editingText)
            return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editingText]);
    function currentBox(header: HTMLElement) {
        const headerRect = header.getBoundingClientRect();
        const textRect = ref.current?.getBoundingClientRect();
        const scale = headerRect.width && header.offsetWidth ? headerRect.width / header.offsetWidth : 1;
        return {
            scale: scale || 1,
            x: typeof settings.textX === 'number' ? settings.textX : ((textRect?.left ?? headerRect.left) - headerRect.left) / (scale || 1),
            y: typeof settings.textY === 'number' ? settings.textY : ((textRect?.top ?? headerRect.top) - headerRect.top) / (scale || 1),
            w: Number(settings.textWidth ?? ((textRect?.width ?? 180) / (scale || 1))),
            h: Number(settings.textHeight ?? ((textRect?.height ?? 44) / (scale || 1))),
        };
    }
    function startMove(e: React.MouseEvent) {
        if (!editable || !onUpdate)
            return;
        e.preventDefault();
        e.stopPropagation();
        if ((e.target as HTMLElement | null)?.closest('.lv-a4-title')) {
            setSelected(true);
            setDraftText(text);
            setEditingText(true);
            return;
        }
        setSelected(true);
        const header = getHeaderContainer(ref.current);
        const update = onUpdate;
        if (!header || !update)
            return;
        const headerEl = header;
        const start = currentBox(headerEl);
        const startX = e.clientX;
        const startY = e.clientY;
        let latest: HeaderTextBox = { x: start.x, y: start.y, w: start.w, h: start.h };
        function onMove(ev: MouseEvent) {
            const nx = start.x + (ev.clientX - startX) / start.scale;
            const ny = start.y + (ev.clientY - startY) / start.scale;
            latest = {
                x: Math.max(0, Math.min(headerEl.offsetWidth - start.w, nx)),
                y: Math.max(0, Math.min(headerEl.offsetHeight - start.h, ny)),
                w: start.w,
                h: start.h,
            };
            setDraftBox(latest);
        }
        function onUp() {
            setDraftBox(null);
            update({
                textX: latest.x,
                textY: latest.y,
                textWidth: latest.w,
                textHeight: latest.h,
            });
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    function commitTextEdit() {
        if (!editingText)
            return;
        const nextText = draftText.trim();
        setEditingText(false);
        onUpdate?.({ text: nextText || text });
    }
    function startResize(e: React.MouseEvent) {
        if (!editable || !onUpdate)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSelected(true);
        const header = getHeaderContainer(ref.current);
        const update = onUpdate;
        if (!header || !update)
            return;
        const headerEl = header;
        const start = currentBox(headerEl);
        const startX = e.clientX;
        const startY = e.clientY;
        let latest: HeaderTextBox = { x: start.x, y: start.y, w: start.w, h: start.h };
        function onMove(ev: MouseEvent) {
            const dx = (ev.clientX - startX) / start.scale;
            const dy = (ev.clientY - startY) / start.scale;
            latest = {
                x: start.x,
                y: start.y,
                w: Math.max(40, Math.min(headerEl.offsetWidth - start.x, start.w + dx)),
                h: Math.max(20, Math.min(headerEl.offsetHeight - start.y, start.h + dy)),
            };
            setDraftBox(latest);
        }
        function onUp() {
            setDraftBox(null);
            update({
                textX: latest.x,
                textY: latest.y,
                textWidth: latest.w,
                textHeight: latest.h,
            });
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }
    return (<div ref={ref} className={cx(`lv-a4-title-box${editable ? ' editable' : ''}${editingText ? ' editing' : ''}${selected ? ' selected' : ''}${box ? ' positioned' : ''}`, cssClass(box ? { left: box.x, top: box.y, width: box.w, height: box.h } : undefined))} onMouseDown={startMove} title={editable ? 'Click text to edit, drag box to move' : undefined}>
      {editingText ? (<input ref={inputRef} className={cx("lv-a4-title-input", cssClass({ fontFamily }))} value={draftText} onChange={e => setDraftText(e.target.value)} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onBlur={commitTextEdit} onKeyDown={e => {
                if (e.key === 'Enter')
                    commitTextEdit();
                if (e.key === 'Escape') {
                    setDraftText(text);
                    setEditingText(false);
                }
            }}/>) : (<span className={cx("lv-a4-title", cssClass({ fontFamily }))}>
        {text}
      </span>)}
      {editable && selected && (<div className="lv-a4-title-resize" onMouseDown={startResize} title="Drag to resize"/>)}
    </div>);
}
/* --------
   Product card
-------- */
interface ProductCardProps {
    p: LeafletProduct;
    isTwoLang: boolean;
    leafletId: string;
    onUpdate: (updated: LeafletProduct) => void;
    onDelete: (id: number) => void;
    cardLayout?: CardLayout | null;
    overlays?: CardOverlay[];
    cardWidth?: number;
    cardHeight?: number;
    onAddOverlay?: (src: string, label: string) => void;
    onUpdateOverlay?: (id: string, patch: Partial<CardOverlay>) => void;
    onRemoveOverlay?: (id: string) => void;
    showShapes?: boolean;
    imageLoading?: 'lazy' | 'eager';
    captureSafeImages?: boolean;
    showActions?: boolean;
}
/* Compute the card's box-level inline style (background, border, radius, shadow) */
function cardBoxStyle(cl: CardLayout | null | undefined): React.CSSProperties {
    const bw = cl?.card_border_width ?? 0;
    const bc = cl?.card_border_color ?? '#49f2b6';
    const bs = cl?.card_border_style ?? 'solid';
    const bt = cl?.card_border_top ?? bw;
    const br = cl?.card_border_right ?? bw;
    const bb = cl?.card_border_bottom ?? bw;
    const bl = cl?.card_border_left ?? bw;
    const borderRadius = cl?.card_radius_mode === 'each'
        ? `${cl.card_radius_tl ?? 16}px ${cl.card_radius_tr ?? 16}px ${cl.card_radius_br ?? 16}px ${cl.card_radius_bl ?? 16}px`
        : cl?.card_border_radius != null ? `${cl.card_border_radius}px` : undefined;
    return {
        background: cl?.card_background ?? undefined,
        borderRadius,
        boxShadow: cl?.card_shadow === false ? 'none' : undefined,
        ...(bw > 0 ? {
            borderTopWidth: `${bt}px`,
            borderRightWidth: `${br}px`,
            borderBottomWidth: `${bb}px`,
            borderLeftWidth: `${bl}px`,
            borderStyle: bs,
            borderColor: bc,
        } : { border: 'none' }),
    };
}
/* Reference card width: default 3-col layout on A4 portrait (794px wide, 12px gaps) */
const BASE_CARD_W = (794 - 2 * 12) / 3; // approx. 256.67px
function ProductCard({ p, isTwoLang, leafletId, onUpdate, onDelete, cardLayout, overlays = [], cardWidth, cardHeight, onAddOverlay, onUpdateOverlay, onRemoveOverlay, showShapes = true, imageLoading = 'lazy', captureSafeImages = false, showActions = true }: ProductCardProps) {
    const cl = cardLayout;
    const [imgErr, setImgErr] = useState(false);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    useEffect(() => {
        setImgErr(false);
    }, [p.product_img_url]);
    /* Scale factor - all text/spacing scales proportionally with card width */
    const cardScale = cardWidth != null ? cardWidth / BASE_CARD_W : 1;
    const sc = (px: number) => px * cardScale;
    const hasDiscount = p.old_price !== null && p.current_price !== null && p.old_price > p.current_price;
    const discountPct = hasDiscount
        ? Math.round(100 - (p.current_price! / p.old_price!) * 100)
        : 0;
    const saveAmount = hasDiscount
        ? formatPrice(p.old_price! - p.current_price!, cl?.currency_symbol || undefined, cl?.currency_symbol_position || undefined)
        : '';
    const badgeText = hasDiscount
        ? (cl?.badge_display_mode === 'amount' ? `Save ${saveAmount}` : `-${discountPct}%`)
        : '';
    async function handleDelete() {
        try {
            await deleteProduct(leafletId, p.id);
            onDelete(p.id);
        }
        catch (e) {
            setDeleting(false);
            setConfirmDel(false);
            alert(e instanceof Error ? e.message : 'Failed to delete product.');
        }
    }
    const hasPositions = !!cl?.positions;
    const pos = cl?.positions;
    const cardActions = (<div className="lv-card-actions" data-html2canvas-ignore="true" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <button className="lv-edit-btn" onClick={e => { e.stopPropagation(); setEditing(true); }} aria-label={`Edit ${p.product_name_lan1}`} title="Edit product">
        <span className="material-symbol" aria-hidden="true">edit</span>
      </button>
      {confirmDel ? (<div className="lv-confirm-del">
          <span>Delete?</span>
          <button className="lv-del-yes" onClick={e => { e.stopPropagation(); void handleDelete(); }} disabled={deleting}>{deleting ? '...' : 'Yes'}</button>
          <button className="lv-del-no" onClick={e => { e.stopPropagation(); setConfirmDel(false); }} disabled={deleting}>No</button>
        </div>) : (<button className="lv-delete-btn" onClick={e => { e.stopPropagation(); setConfirmDel(true); }} aria-label={`Delete ${p.product_name_lan1}`} title="Delete product">
          <span className="material-symbol" aria-hidden="true">delete</span>
        </button>)}
    </div>);
    const imageLicense = (p.product_image_license || '').trim();
    const imageLicenseNode = imageLicense ? (/^https?:\/\//i.test(imageLicense) ? (<a href={imageLicense} target="_blank" rel="noreferrer" className="lv-card-image-license">
        Image license
      </a>) : (<span className="lv-card-image-license">{imageLicense}</span>)) : null;
    const displayImageUrl = p.product_img_url ? toCanvasSafeImageUrl(p.product_img_url) : '';
    const imgNode = (displayImageUrl && !imgErr)
        ? captureSafeImages
            ? <img src={displayImageUrl} alt={p.product_name_lan1} className={cx("lv-card-img", cssClass({ objectFit: 'contain' }))} loading={imageLoading} decoding="async" crossOrigin="anonymous" onError={() => setImgErr(true)}/>
            : <img src={displayImageUrl} alt={p.product_name_lan1} className={cx("lv-card-img", cssClass({ objectFit: hasPositions ? 'scale-down' : 'cover' }))} loading={imageLoading} decoding="async" onError={() => setImgErr(true)}/>
        : (<div className="lv-card-img-placeholder" aria-hidden={!imageLicenseNode}>
        <span className="lv-card-img-placeholder-icon" aria-hidden="true">image</span>
        {imageLicenseNode}
      </div>);
    if (hasPositions) {
        const es = cl?.element_styles;
        return (<>
        <div className={cx("lv-card lv-card-positioned", cssClass({ ...cardBoxStyle(cl), width: cardWidth, height: cardHeight, '--card-scale': cardScale, '--flag-icon-size': `${cl?.flag_icon_size ?? 18}px` } as React.CSSProperties))}>
          {/* Drop layer - always rendered; pointer-events enabled via CSS body.dragging-icon */}
          <div className="lv-card-drop-layer" onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                onAddOverlay?.(_dragIconSrc, _dragIconLabel);
            }}/>
          {cl?.show_image !== false && (<div className="lv-pos-img-wrap" style={elemStyle(pos?.image)}>
              {imgNode}
            </div>)}
          {hasDiscount && (cl?.show_discount_badge ?? true) && (() => {
                const badgePos = pos?.discount_badge ?? { x: 65, y: 2, w: 32, h: 8 };
                const es = cl?.element_styles?.discount_badge;
                const s = applyElemTS(es, cl?.badge_text_color ?? '#ffffff', sc(cl?.badge_font_size ?? 11), cl?.font_family || undefined);
                return (<div className={cssClass({ ...elemStyle(badgePos), display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
                <div className={cssClass({ ...s.outer, letterSpacing: '.4px', whiteSpace: 'nowrap', width: '100%', height: '100%' })}>
                  <ElemBorderSVG es={es}/>
                  <span className={cssClass(s.text)}>{badgeText}</span>
                </div>
              </div>);
            })()}
          {cl?.show_name_lan1 !== false && (() => {
                const s = applyElemTS(es?.name_lan1, cl?.name_lan1_color, cl?.name_lan1_size != null ? sc(cl.name_lan1_size) : undefined, cl?.font_family || undefined);
                return (<div className={cssClass({ ...elemStyle(pos?.name_lan1), ...s.outer })}><ElemBorderSVG es={es?.name_lan1}/><span className={cssClass(s.text)}>{p.product_name_lan1}</span></div>);
            })()}
          {isTwoLang && p.product_name_lan2 && cl?.show_name_lan2 !== false && (() => {
                const s = applyElemTS(es?.name_lan2, cl?.name_lan2_color, cl?.name_lan2_size != null ? sc(cl.name_lan2_size) : undefined, cl?.font_family || undefined);
                return (<div className={cssClass({ ...elemStyle(pos?.name_lan2), ...s.outer })}><ElemBorderSVG es={es?.name_lan2}/><span className={cssClass(s.text)}>{p.product_name_lan2}</span></div>);
            })()}
          {p.origin_lan1 && (cl?.show_origin_lan1 ?? true) && (() => {
                const s = applyElemTS(es?.origin_lan1, cl?.origin_lan1_color ?? cl?.origin_color, (cl?.origin_lan1_size ?? cl?.origin_size) != null ? sc(cl?.origin_lan1_size ?? cl?.origin_size!) : undefined, cl?.font_family || undefined);
                return (<div className={cssClass({ ...elemStyle(pos?.origin_lan1, 'origin_lan1'), ...s.outer })}>
              <ElemBorderSVG es={es?.origin_lan1}/>
              <span className={cssClass(s.text)}>{p.origin_lan1}</span>
            </div>);
            })()}
          {(cl?.show_origin_lan1_flag ?? true) && (() => {
                const iso = countryToIso(p.origin_lan1_iso || p.origin_lan2_iso || p.origin_lan1 || p.origin_lan2);
                if (!iso)
                    return null;
                return (<div className={cssClass({ ...elemStyle(pos?.origin_lan1_flag, 'origin_lan1_flag'), ...flagWrapStyle(cl) })}>
                <img src={`https://flagcdn.com/w40/${iso}.png`} srcSet={`https://flagcdn.com/w80/${iso}.png 2x`} alt={iso.toUpperCase()} className={cx("lv-flag-img", cssClass({ width: sc(cl?.flag_icon_size ?? 18), height: 'auto', flexShrink: 0 }))}/>
              </div>);
            })()}
          {isTwoLang && p.origin_lan2 && (cl?.show_origin_lan2 ?? true) && (() => {
                const s = applyElemTS(es?.origin_lan2, cl?.origin_lan2_color ?? cl?.origin_color, (cl?.origin_lan2_size ?? cl?.origin_size) != null ? sc(cl?.origin_lan2_size ?? cl?.origin_size!) : undefined, cl?.font_family || undefined);
                return (<div className={cssClass({ ...elemStyle(pos?.origin_lan2, 'origin_lan2'), ...s.outer })}>
              <ElemBorderSVG es={es?.origin_lan2}/>
              <span className={cssClass(s.text)}>{p.origin_lan2}</span>
            </div>);
            })()}
          {p.old_price !== null && cl?.show_old_price !== false && (() => {
                const s = applyElemTS(es?.old_price, cl?.old_price_color, cl?.old_price_size != null ? sc(cl.old_price_size) : sc(12), cl?.font_family || undefined);
                const { width: _w1, display: _d1, ...priceTextOld } = s.text;
                return (<div className={cssClass({ ...elemStyle(pos?.old_price), ...s.outer })}><ElemBorderSVG es={es?.old_price}/><PriceDisplay value={p.old_price!} sym={cl?.show_currency_old !== false ? (cl?.currency_symbol || undefined) : undefined} pos={cl?.currency_symbol_position || undefined} iconUrl={cl?.show_currency_old !== false ? (cl?.currency_symbol_icon || undefined) : undefined} iconColor={cl?.currency_symbol_icon_color_old || cl?.currency_symbol_icon_color || undefined} symSize={(cl?.currency_symbol_size_old ?? cl?.currency_symbol_size) || undefined} iconSize={cl?.currency_symbol_icon_size_old ?? cl?.currency_symbol_icon_size ?? 16} gap={cl?.currency_symbol_gap ?? 2} textStyle={priceTextOld} strikethrough/></div>);
            })()}
          {cl?.show_current_price !== false && (() => {
                const s = applyElemTS(es?.current_price, cl?.price_color, cl?.price_size != null ? sc(cl.price_size) : undefined, cl?.font_family || undefined);
                const { width: _w2, display: _d2, ...priceTextCur } = s.text;
                return (<div className={cssClass({ ...elemStyle(pos?.current_price), ...s.outer })}><ElemBorderSVG es={es?.current_price}/><PriceDisplay value={p.current_price} sym={cl?.show_currency_current !== false ? (cl?.currency_symbol || undefined) : undefined} pos={(cl?.currency_symbol_position_current ?? cl?.currency_symbol_position) || undefined} iconUrl={cl?.show_currency_current !== false ? (cl?.currency_symbol_icon || undefined) : undefined} iconColor={cl?.currency_symbol_icon_color_current || cl?.currency_symbol_icon_color || undefined} symSize={(cl?.currency_symbol_size_current ?? cl?.currency_symbol_size) || undefined} iconSize={cl?.currency_symbol_icon_size_current ?? cl?.currency_symbol_icon_size ?? 16} gap={cl?.currency_symbol_gap ?? 2} textStyle={priceTextCur}/></div>);
            })()}
          {p.product_url && cl?.show_product_url !== false && (() => {
                const s = applyElemTS(es?.product_url, cl?.url_color, cl?.url_size != null ? sc(cl.url_size) : undefined, cl?.font_family || undefined);
                const iconKey = cl?.url_icon ?? 'arrow';
                const iconColor = cl?.url_icon_color || cl?.url_color || '#3b82f6';
                const iconSize = cl?.url_icon_size ?? 14;
                const showText = cl?.url_show_text ?? true;
                const linkText = cl?.url_text ?? 'View product';
                const ic = LINK_ICONS.find(i => i.key === iconKey);
                const customIcon = iconKey === 'custom' ? (cl?.url_custom_icon || '->') : null;
                const iconUrl = iconKey === 'custom' ? (cl?.url_icon_url || null) : null;
                return (<div className={cssClass({ ...elemStyle(pos?.product_url), ...s.outer })}>
                <ElemBorderSVG es={es?.product_url}/>
                <a href={p.product_url} target="_blank" rel="noreferrer" onClick={() => {
                        if (p.id && leafletId)
                            trackProductClick(p.id, Number(leafletId));
                    }} className={cssClass({ ...s.text, color: s.text.color || '#3b82f6', textDecoration: 'none', fontWeight: s.text.fontWeight ?? 600, display: 'flex', alignItems: 'center', gap: 4 })}>
                  {showText && <span>{linkText}</span>}
                  {iconKey !== 'none' && (iconUrl ? (<img src={iconUrl} alt="" className={cssClass({ width: iconSize, height: iconSize, objectFit: 'contain', flexShrink: 0 })}/>) : customIcon ? (<span className={cssClass({ fontSize: iconSize, color: iconColor, flexShrink: 0 })}>{customIcon}</span>) : ic?.path ? (<svg xmlns="http://www.w3.org/2000/svg" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cssClass({ flexShrink: 0 })}>
                        <path d={ic.path}/>
                      </svg>) : null)}
                </a>
              </div>);
            })()}
          {showShapes && <CardShapes layout={cl}/>}
          {showActions && cardActions}
          {/* Overlays - rendered last so they sit above all card content */}
          {overlays.map(ov => (<OverlayItem key={ov.id} ov={ov} onUpdate={patch => onUpdateOverlay?.(ov.id, patch)} onRemove={() => onRemoveOverlay?.(ov.id)}/>))}
        </div>
        {editing && (<EditModal product={p} isTwoLang={isTwoLang} leafletId={leafletId} onClose={() => setEditing(false)} onSave={updated => { onUpdate(updated); setImgErr(false); }}/>)}
      </>);
    }
    return (<>
      <div className={cx("lv-card", cssClass({ ...cardBoxStyle(cl), width: cardWidth, height: cardHeight, '--card-scale': cardScale, '--flag-icon-size': `${cl?.flag_icon_size ?? 18}px` } as React.CSSProperties))}>
        {/* Drop layer - always rendered; pointer-events enabled via CSS body.dragging-icon */}
        <div className="lv-card-drop-layer" onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            onAddOverlay?.(_dragIconSrc, _dragIconLabel);
        }}/>
        {/* Image */}
        {cl?.show_image !== false && (<div className={cx("lv-card-img-wrap", cssClass({ aspectRatio: cl?.image_aspect_ratio ? `100 / ${cl.image_aspect_ratio}` : undefined }))}>
          {imgNode}
          {hasDiscount && (cl?.show_discount_badge ?? true) && (() => {
                const es = cl?.element_styles?.discount_badge;
                const s = applyElemTS(es, cl?.badge_text_color ?? '#ffffff', cl?.badge_font_size ?? 11, cl?.font_family || undefined);
                return (<span className={cx("lv-discount-badge", cssClass({ ...s.outer, letterSpacing: '.4px', whiteSpace: 'nowrap' }))}>
                <ElemBorderSVG es={es}/>
                <span className={cssClass(s.text)}>{badgeText}</span>
              </span>);
            })()}
          {showActions && cardActions}
        </div>)}

        {/* Body */}
        <div className="lv-card-body">
          {cl?.show_name_lan1 !== false && (<div className={cx("lv-card-name", cssClass({
                fontSize: cl?.name_lan1_size != null ? `${sc(cl.name_lan1_size)}px` : undefined,
                color: cl?.name_lan1_color ?? undefined,
                fontWeight: cl?.name_lan1_bold ? 'bold' : undefined,
            }))} title={p.product_name_lan1}>
            {p.product_name_lan1}
          </div>)}
          {isTwoLang && p.product_name_lan2 && cl?.show_name_lan2 !== false && (<div className={cx("lv-card-name-lan2", cssClass({
                fontSize: cl?.name_lan2_size != null ? `${sc(cl.name_lan2_size)}px` : undefined,
                color: cl?.name_lan2_color ?? undefined,
                fontStyle: cl?.name_lan2_italic ? 'italic' : undefined,
            }))} title={p.product_name_lan2}>
              {p.product_name_lan2}
            </div>)}

          {p.origin_lan1 && (cl?.show_origin_lan1 ?? true) && (<div className={cx("lv-card-origin", cssClass({ display: 'flex', alignItems: 'center', gap: 3 }))}>
              {(cl?.show_origin_lan1_flag ?? true) && (() => { const iso = countryToIso(p.origin_lan1_iso || p.origin_lan2_iso || p.origin_lan1 || p.origin_lan2); return iso ? <span className={cssClass({ display: 'inline-flex', ...flagWrapStyle(cl) })}><img src={`https://flagcdn.com/w40/${iso}.png`} srcSet={`https://flagcdn.com/w80/${iso}.png 2x`} alt={iso.toUpperCase()} className={cx("lv-flag-img", cssClass({ width: sc(cl?.flag_icon_size ?? 18), height: 'auto', flexShrink: 0 }))}/></span> : null; })()}
              {p.origin_lan1}
            </div>)}
          {isTwoLang && p.origin_lan2 && (cl?.show_origin_lan2 ?? true) && (<div className={cx("lv-card-origin lv-origin-lan2", cssClass({ display: 'flex', alignItems: 'center', gap: 3 }))}>
              {p.origin_lan2}
            </div>)}

          {cl?.show_current_price !== false && (<div className="lv-card-prices">
            {p.old_price !== null && cl?.show_old_price !== false && (<span className={cx("lv-old-price", cssClass({
                    fontSize: cl?.old_price_size != null ? `${sc(cl.old_price_size)}px` : undefined,
                    color: cl?.old_price_color ?? undefined,
                    display: 'flex',
                    justifyContent: cl?.element_styles?.old_price?.align === 'center' ? 'center' : cl?.element_styles?.old_price?.align === 'right' ? 'flex-end' : 'flex-start',
                }))}><PriceDisplay value={p.old_price} sym={cl?.show_currency_old !== false ? (cl?.currency_symbol || undefined) : undefined} pos={cl?.currency_symbol_position || undefined} iconUrl={cl?.show_currency_old !== false ? (cl?.currency_symbol_icon || undefined) : undefined} iconColor={cl?.currency_symbol_icon_color_old || cl?.currency_symbol_icon_color || undefined} symSize={(cl?.currency_symbol_size_old ?? cl?.currency_symbol_size) || undefined} iconSize={cl?.currency_symbol_icon_size_old ?? cl?.currency_symbol_icon_size ?? 16} gap={cl?.currency_symbol_gap ?? 2} strikethrough/></span>)}
            <span className={cx(`lv-current-price${hasDiscount ? ' discounted' : ''}`, cssClass({
                fontSize: cl?.price_size != null ? `${sc(cl.price_size)}px` : undefined,
                color: cl?.price_color ?? undefined,
                fontWeight: cl?.price_bold ? 'bold' : undefined,
                display: 'flex',
                justifyContent: cl?.element_styles?.current_price?.align === 'center' ? 'center' : cl?.element_styles?.current_price?.align === 'right' ? 'flex-end' : 'flex-start',
            }))}>
              <PriceDisplay value={p.current_price} sym={cl?.show_currency_current !== false ? (cl?.currency_symbol || undefined) : undefined} pos={(cl?.currency_symbol_position_current ?? cl?.currency_symbol_position) || undefined} iconUrl={cl?.show_currency_current !== false ? (cl?.currency_symbol_icon || undefined) : undefined} iconColor={cl?.currency_symbol_icon_color || undefined} symSize={(cl?.currency_symbol_size_current ?? cl?.currency_symbol_size) || undefined} iconSize={cl?.currency_symbol_icon_size_current ?? cl?.currency_symbol_icon_size ?? 16} gap={cl?.currency_symbol_gap ?? 2}/>
            </span>
          </div>)}

          {p.product_url && cl?.show_product_url !== false && (() => {
            const iconKey = cl?.url_icon ?? 'arrow';
            const iconColor = cl?.url_icon_color || cl?.url_color;
            const showText = cl?.url_show_text ?? true;
            const linkText = cl?.url_text ?? 'View product';
            return (<a href={p.product_url} target="_blank" rel="noreferrer" className={cx("lv-card-link", cssClass({ display: 'flex', alignItems: 'center', gap: 4, color: cl?.url_color ?? undefined }))} onClick={() => {
                    if (p.id && leafletId)
                        trackProductClick(p.id, Number(leafletId));
                }}>
                <LinkIconEl iconKey={iconKey} customIcon={cl?.url_custom_icon} customIconUrl={cl?.url_icon_url} color={iconColor} size={cl?.url_icon_size != null ? sc(cl.url_icon_size) : 16}/>
                {showText && linkText}
              </a>);
        })()}
          {imageLicenseNode}
        </div>
        {showShapes && <CardShapes layout={cl}/>}
        {/* Overlays - rendered last to sit above all card content */}
        {overlays.map(ov => (<OverlayItem key={ov.id} ov={ov} onUpdate={patch => onUpdateOverlay?.(ov.id, patch)} onRemove={() => onRemoveOverlay?.(ov.id)}/>))}
      </div>

      {/* Edit modal */}
      {editing && (<EditModal product={p} isTwoLang={isTwoLang} leafletId={leafletId} onClose={() => setEditing(false)} onSave={updated => {
                onUpdate(updated);
                setImgErr(false); // reset image error in case URL changed
            }}/>)}
    </>);
}
/* --------
   Main page
-------- */
/* Module-level drag state - avoids React re-renders during native drag */
let _dragIconSrc = '';
let _dragIconLabel = '';
/* -- Sidebar section - defined OUTSIDE LeafletView so it is stable
      across renders (no unmount/remount = color pickers stay open).
      Body is hidden via CSS display:none, NOT unmounted, so native
      <input type="color"> dialogs are never closed by section toggling. -- */
type BarSettings = {
    fontSize: number;
    fontColor: string;
    fontWeight: string;
    fontItalic: boolean;
    [key: string]: unknown;
};
type BarSetter = (k: string, v: unknown) => void;
type BarState = {
    bgType: string;
    bgColor: string;
    gradFrom: string;
    gradTo: string;
    gradAngle: number;
    bgImage?: string;
    height: number;
    widthMode: string;
    fontSize: number;
    fontColor: string;
    fontWeight: string;
    fontItalic: boolean;
    [key: string]: unknown;
};
function makeBg(s: BarState) {
    if (s.bgType === 'gradient')
        return `linear-gradient(${s.gradAngle}deg, ${s.gradFrom}, ${s.gradTo})`;
    if (s.bgType === 'image' && s.bgImage)
        return `url(${s.bgImage}) center/cover no-repeat`;
    return s.bgColor;
}
function makeBarStyle(s: BarState, pad: number): React.CSSProperties {
    return {
        height: s.height,
        background: makeBg(s),
        fontSize: s.fontSize,
        color: s.fontColor,
        fontWeight: s.fontWeight,
        fontStyle: s.fontItalic ? 'italic' : 'normal',
        width: s.widthMode === 'full' ? `calc(100% + ${2 * pad}px)` : '100%',
        marginLeft: s.widthMode === 'full' ? -pad : 0,
        paddingLeft: s.widthMode === 'full' ? pad : 0,
        paddingRight: s.widthMode === 'full' ? pad : 0,
        boxSizing: 'border-box' as const,
        flexShrink: 0,
    };
}
async function uploadBarImage(file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) {
    setUploading(true);
    try {
        const fd = new FormData();
        fd.append('image', file);
        const token = localStorage.getItem('leafletai_token') ?? '';
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) {
            console.error('Upload failed', res.status, await res.text());
            return;
        }
        const data = await res.json();
        if (data.url)
            setter(data.url);
    }
    catch (e) {
        console.error('Upload error', e);
    }
    finally {
        setUploading(false);
    }
}
function BgTypeControls({ s, setter, uploading: up, setUploading: setUp }: {
    s: BarState;
    setter: BarSetter;
    uploading: boolean;
    setUploading: (v: boolean) => void;
}) {
    return (<>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Background</span>
      <div className="lv-sb-tabs">
        <button className={`lv-sb-tab${s.bgType === 'solid' ? ' active' : ''}`} onClick={() => setter('bgType', 'solid')}>Solid</button>
        <button className={`lv-sb-tab${s.bgType === 'gradient' ? ' active' : ''}`} onClick={() => setter('bgType', 'gradient')}>Grad</button>
        <button className={`lv-sb-tab${s.bgType === 'image' ? ' active' : ''}`} onClick={() => setter('bgType', 'image')}>Image</button>
      </div>
    </div>
    {s.bgType === 'solid' && (<div className="lv-sb-row">
        <span className="lv-sb-label">Color</span>
        <div className="lv-sb-color-wrap">
          <ColorSwatch value={s.bgColor} onChange={v => setter('bgColor', v)}/>
          <span className="lv-sb-val">{s.bgColor}</span>
        </div>
      </div>)}
    {s.bgType === 'gradient' && (<>
      <div className="lv-sb-row">
        <span className="lv-sb-label">From</span>
        <div className="lv-sb-color-wrap">
          <ColorSwatch value={s.gradFrom} onChange={v => setter('gradFrom', v)}/>
          <span className="lv-sb-val">{s.gradFrom}</span>
        </div>
      </div>
      <div className="lv-sb-row">
        <span className="lv-sb-label">To</span>
        <div className="lv-sb-color-wrap">
          <ColorSwatch value={s.gradTo} onChange={v => setter('gradTo', v)}/>
          <span className="lv-sb-val">{s.gradTo}</span>
        </div>
      </div>
      <div className="lv-sb-row">
        <span className="lv-sb-label">Angle</span>
        <div className="lv-sb-slider-wrap">
          <input type="range" min={0} max={360} value={s.gradAngle as number} onChange={e => setter('gradAngle', +e.target.value)}/>
          <span className="lv-sb-val">{s.gradAngle}deg</span>
        </div>
      </div>
      <div className={cx("lv-sb-preview", cssClass({ background: makeBg(s) }))}/>
    </>)}
    {s.bgType === 'image' && (<div className="lv-sb-row">
        <span className="lv-sb-label">Image</span>
        <label className="lv-sb-upload-btn">
          {up ? 'Uploading...' : s.bgImage ? 'Change Change' : '+ Upload'}
          <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (file)
                    uploadBarImage(file, url => setter('bgImage', url), setUp);
            }} className={cssClass({ display: 'none' })}/>
        </label>
        {s.bgImage && <div className={cx("lv-sb-preview", cssClass({ background: makeBg(s), marginTop: 6 }))}/>}
      </div>)}
  </>);
}
function BorderRadiusControls({ s, setter }: {
    s: BarSettings;
    setter: BarSetter;
}) {
    const bw = s.borderWidth ?? 0;
    const ps = s.perSide ?? false;
    const rm = s.radiusMode ?? 'all';
    return (<>
    {/* -- Border -- */}
    <div className="lv-sb-sub-title">Border</div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Width</span>
      <div className="lv-sb-input-row">
        <NumericInput size="sm" min={0} max={20} step={0.5} value={bw} onChange={v => setter('borderWidth', v)} className={cssClass({ width: 80 })}/>
        <span className="lv-sb-unit">px</span>
      </div>
    </div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Color</span>
      <div className="lv-sb-color-row">
        <ColorSwatch value={String(s.borderColor ?? '#000000')} onChange={v => setter('borderColor', v)}/>
        <span className="lv-sb-val">{String(s.borderColor ?? '#000000')}</span>
      </div>
    </div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Style</span>
      <div className="lv-sb-tabs">
        {(['solid', 'dashed', 'dotted'] as const).map(st => (<button key={st} className={`lv-sb-tab${(s.borderStyle ?? 'solid') === st ? ' active' : ''}`} onClick={() => setter('borderStyle', st)}>
            {st.charAt(0).toUpperCase() + st.slice(1)}
          </button>))}
      </div>
    </div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Per Side</span>
      <label className="lv-sb-switch">
        <input type="checkbox" checked={ps} onChange={e => setter('perSide', e.target.checked)}/>
        <span className="lv-sb-switch-track"/>
      </label>
    </div>
    {ps && (<div className="lv-sb-per-side-grid">
        {(['Top', 'Right', 'Bottom', 'Left'] as const).map(side => {
                const key = `border${side}` as 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft';
                return (<div key={side} className="lv-sb-per-side-cell">
              <span className="lv-sb-per-side-label">{side[0]}</span>
              <NumericInput size="xs" min={0} max={20} step={0.5} value={s[key] ?? 0} onChange={v => setter(key, v)} className={cssClass({ width: 62 })}/>
            </div>);
            })}
      </div>)}

    {/* -- Radius -- */}
    <div className="lv-sb-sub-title">Radius</div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Mode</span>
      <div className="lv-sb-tabs">
        {(['all', 'each'] as const).map(m => (<button key={m} className={`lv-sb-tab${rm === m ? ' active' : ''}`} onClick={() => setter('radiusMode', m)}>
            {m === 'all' ? 'All corners' : 'Each corner'}
          </button>))}
      </div>
    </div>
    {rm === 'all' ? (<div className="lv-sb-row">
        <span className="lv-sb-label">Radius</span>
        <div className="lv-sb-slider-wrap">
          <input type="range" min={0} max={100} value={s.radius ?? 0} onChange={e => setter('radius', +e.target.value)}/>
          <span className="lv-sb-val">{s.radius ?? 0}px</span>
        </div>
      </div>) : (<div className="lv-sb-per-side-grid">
        {(['TL', 'TR', 'BR', 'BL'] as const).map(c => {
                const key = `radius${c}` as 'radiusTL' | 'radiusTR' | 'radiusBR' | 'radiusBL';
                return (<div key={c} className="lv-sb-per-side-cell">
              <span className="lv-sb-per-side-label">{c}</span>
              <NumericInput size="xs" min={0} max={200} step={1} value={s[key] ?? 0} onChange={v => setter(key, v)} className={cssClass({ width: 62 })}/>
            </div>);
            })}
      </div>)}
  </>);
}
function FontControls({ s, setter }: {
    s: BarSettings;
    setter: BarSetter;
}) {
    const [draftFontSize, setDraftFontSize] = useState<number | null>(null);
    const fontSizeValue = draftFontSize ?? s.fontSize;
    useEffect(() => {
        setDraftFontSize(null);
    }, [s.fontSize]);
    function commitFontSize(value = fontSizeValue) {
        const next = Math.max(8, Math.min(36, Number(value) || s.fontSize));
        setDraftFontSize(null);
        if (next !== s.fontSize)
            setter('fontSize', next);
    }
    return (<>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Font size</span>
      <div className="lv-sb-slider-wrap">
        <input type="range" min={8} max={36} value={fontSizeValue} onChange={e => setDraftFontSize(+e.target.value)} onPointerUp={() => commitFontSize()} onKeyUp={() => commitFontSize()} onBlur={() => commitFontSize()}/>
        <span className="lv-sb-val">{fontSizeValue}px</span>
      </div>
    </div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Font color</span>
      <div className="lv-sb-color-wrap">
        <ColorSwatch value={s.fontColor} onChange={v => setter('fontColor', v)}/>
        <span className="lv-sb-val">{s.fontColor}</span>
      </div>
    </div>
    <div className="lv-sb-row">
      <span className="lv-sb-label">Font style</span>
      <div className="lv-sb-btn-group">
        <button className={`lv-sb-style-btn bold${s.fontWeight === 'bold' ? ' active' : ''}`} onClick={() => setter('fontWeight', s.fontWeight === 'bold' ? 'normal' : 'bold')} title="Bold">B</button>
        <button className={`lv-sb-style-btn italic${s.fontItalic ? ' active' : ''}`} onClick={() => setter('fontItalic', !s.fontItalic)} title="Italic">I</button>
      </div>
    </div>
  </>);
}
function InfoTooltip({ text }: {
    text: string;
}) {
    const [pos, setPos] = React.useState<{
        top: number;
        left: number;
    } | null>(null);
    const ref = React.useRef<HTMLSpanElement>(null);
    const TOOLTIP_W = 210;
    const TOOLTIP_H = 80;
    function computePos() {
        if (!ref.current)
            return;
        const r = ref.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = r.right + 8;
        let top = r.top + r.height / 2 - TOOLTIP_H / 2;
        if (left + TOOLTIP_W > vw - 8)
            left = r.left - TOOLTIP_W - 8;
        top = Math.max(8, Math.min(top, vh - TOOLTIP_H - 8));
        setPos({ top, left });
    }
    return (<span className="lv-sb-info-wrap" ref={ref} onMouseEnter={computePos} onMouseLeave={() => setPos(null)} onFocus={computePos} onBlur={() => setPos(null)} tabIndex={0}>
      <svg className="lv-sb-info-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      {pos && ReactDOM.createPortal(<span className={cx("lv-sb-tooltip", cssClass({ position: 'fixed', top: pos.top, left: pos.left, width: TOOLTIP_W }))}>
          {text}
        </span>, document.body)}
    </span>);
}
const SB_TOOLTIPS: Record<string, string> = {
    // Section tooltips
    header: 'Add and style a header bar at the top of every A4 page. Control text, alignment, height, and border.',
    templates: 'Open card templates to apply saved or platform product-card designs.',
    page: 'Set the background color or gradient of the A4 page, choose orientation (portrait/landscape), and adjust card grid size and spacing.',
    footer: 'Add and style a footer bar at the bottom of every A4 page. Control text, alignment, page numbers, height, and border.',
    icons: 'Upload or choose icons to use as decorative elements inside the product cards.',
    firstpage: 'Upload a full-page cover image that appears as the first page of your leaflet and exported PDF.',
    lastpage: 'Upload a full-page back-cover image that appears as the last page of your leaflet and exported PDF.',
    typography: 'Set the global font family applied to all text inside every product card.',
    currency: 'Choose a currency symbol, control its visibility, position, size, and spacing relative to the price values.',
    border: 'Add and style borders and corner radius on the product cards.',
    shadow: 'Apply a drop shadow to the product cards.',
    // Page Layout control tooltips
    'page.bgType': 'Choose between a solid flat color or a two-color gradient as the page background.',
    'page.bgColor': 'Pick the solid background color of the A4 page.',
    'page.gradFrom': 'Starting color of the background gradient.',
    'page.gradTo': 'Ending color of the background gradient.',
    'page.gradAngle': 'Rotation angle of the gradient in degrees (0deg = top-to-bottom, 90deg = left-to-right).',
    'page.colsPerPage': 'Number of product cards displayed side by side in each row across the page.',
    'page.rowsPerPage': 'Number of product card rows displayed per page. Card height adjusts automatically.',
    'page.horizontal': 'Horizontal gap (spacing) between cards in the same row.',
    'page.vertical': 'Vertical gap (spacing) between card rows.',
    'page.orientation': 'Switch the A4 page between portrait (tall) and landscape (wide) format.',
    'page.gridWidth': 'Width of the card grid as a percentage of the total page width.',
    'page.gridHeight': 'Height of the card grid as a percentage of the page height (excluding header and footer).',
    // Header control tooltips
    'header.show': 'Toggle the header bar on or off for this page.',
    'header.applyAll': 'Apply the current header visibility setting to all pages at once.',
    'header.text': 'Text displayed in the header bar. Defaults to the leaflet title if left empty.',
    'header.showText': 'Show or hide the header text independently from the header bar itself.',
    'header.align': 'Horizontal alignment of the header text (left, center, or right).',
    'header.height': 'Height of the header bar in pixels.',
    'header.width': 'Width of the header bar as a percentage of the page width.',
    'header.position': 'Horizontal position of the header bar when its width is less than 100% - left, center, or right.',
    'header.marginTop': 'Space from the very top of the page to the top edge of the header bar.',
    'header.marginBottom': 'Space between the bottom of the header and the top of the card grid.',
    'header.bgColor': 'Background color of the header bar.',
    'header.textColor': 'Color of the header text.',
    'header.fontSize': 'Font size of the header text in pixels.',
    // Footer control tooltips
    'footer.show': 'Toggle the footer bar on or off for this page.',
    'footer.applyAll': 'Apply the current footer visibility to all pages at once.',
    'footer.text': 'Text displayed in the footer bar.',
    'footer.showText': 'Show or hide the footer text independently from the footer bar.',
    'footer.showPageNum': 'Show or hide the automatic page number in the footer.',
    'footer.align': 'Horizontal alignment of the footer text.',
    'footer.height': 'Height of the footer bar in pixels.',
    'footer.width': 'Width of the footer bar as a percentage of the page width.',
    'footer.position': 'Horizontal position of the footer bar when its width is less than 100%.',
    'footer.marginTop': 'Space between the bottom of the card grid and the top of the footer.',
    'footer.bgColor': 'Background color of the footer bar.',
    'footer.textColor': 'Color of the footer text.',
    'footer.fontSize': 'Font size of the footer text in pixels.',
    // Price control tooltips
    'price.showCurrCurrent': 'Show or hide the currency symbol next to the current price.',
    'price.showCurrOld': 'Show or hide the currency symbol next to the old (original) price.',
    'price.symbol': 'Select a currency from the world currency list to display its symbol.',
    'price.symbolStyle': 'Choose between the original currency script or the Latin/English version of the symbol.',
    'price.posOld': 'Position of the currency symbol relative to the old price - before or after the number.',
    'price.posCurrent': 'Position of the currency symbol relative to the current price - top, bottom, left, or right.',
    'price.sizeCurrent': 'Font size of the currency symbol shown with the current price.',
    'price.sizeOld': 'Font size of the currency symbol shown with the old price.',
    'price.spacing': 'Gap in pixels between the currency symbol and the price number.',
};
function SbSection({ id, title, open, tooltip, children }: {
    id: string;
    title: string;
    open: boolean;
    tooltip?: string;
    onToggle?: (id: string) => void;
    children: React.ReactNode;
}) {
    if (!open)
        return null;
    return (<div className={`lv-sb-section lv-sb-section--${id}`}>
      {(title || tooltip) && (<div className="lv-sb-section-title-row">
          {title && <span className="lv-sb-section-title">{title}</span>}
          {tooltip && <InfoTooltip text={tooltip}/>}
        </div>)}
      {children}
    </div>);
}
class LeafletErrorBoundary extends Component<{
    children: React.ReactNode;
}, {
    error: string | null;
}> {
    constructor(props: {
        children: React.ReactNode;
    }) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(e: unknown) {
        return { error: e instanceof Error ? e.message + '\n' + e.stack : String(e) };
    }
    render() {
        if (this.state.error) {
            return (<div className={cssClass({ padding: 32, fontFamily: 'monospace', background: '#1e1e2e', color: '#f87171', minHeight: '100vh' })}>
          <h2 className={cssClass({ color: '#f87171', marginBottom: 16 })}>Render error - check the details below:</h2>
          <pre className={cssClass({ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13 })}>{this.state.error}</pre>
        </div>);
        }
        return this.props.children;
    }
}
interface LeafletViewModeProps {
    coverBuilderOnly?: boolean;
    leafletId?: string;
    nanoA4VisibleOverride?: boolean;
}
export default function LeafletViewPage(props: LeafletViewModeProps = {}) {
    return <LeafletErrorBoundary><LeafletView {...props} /></LeafletErrorBoundary>;
}
function LeafletView({ coverBuilderOnly = false, leafletId, nanoA4VisibleOverride }: LeafletViewModeProps) {
    const routeParams = useParams<{
        id: string;
    }>();
    const id = leafletId ?? routeParams.id;
    const [data, setData] = useState<LeafletDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
    const [customizerOpen, setCustomizerOpen] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [sidebarTemplates, setSidebarTemplates] = useState<LayoutTemplate[]>([]);
    const [sidebarTemplatesLoading, setSidebarTemplatesLoading] = useState(false);
    const [sidebarTemplatesErr, setSidebarTemplatesErr] = useState<string | null>(null);
    const [sidebarTemplateApplying, setSidebarTemplateApplying] = useState<string | null>(null);
    const [sidebarTemplateDeleteId, setSidebarTemplateDeleteId] = useState<number | null>(null);
    const [bookBuilderOpen, setBookBuilderOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'name'>('default');
    const [onlyDiscounted, setOnlyDiscounted] = useState(false);
    const [colsPerPage, setColsPerPage] = useState(() => {
        const saved = localStorage.getItem(`leaflet_cols_${id}`);
        return saved ? parseInt(saved, 10) : 3;
    });
    const [rowsPerPage, setRowsPerPage] = useState(() => {
        const saved = localStorage.getItem(`leaflet_rows_${id}`);
        return saved ? parseInt(saved, 10) : 3;
    });
    const [currentPage, setCurrentPage] = useState(0);
    const [zoom, setZoom] = useState(90);
    const [overlays, setOverlays] = useState<Record<number, CardOverlay[]>>({});
    const [customIcons, setCustomIcons] = useState<{
        label: string;
        url: string;
    }[]>([]);
    const [adminIcons, setAdminIcons] = useState<{
        label: string;
        url: string;
    }[]>([]);
    const [presetIcons, setPresetIcons] = useState<{
        label: string;
        url: string;
    }[]>(PRESET_ICON_URLS);
    const [dragSrcId, setDragSrcId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [exportQuota, setExportQuota] = React.useState<{
        plan: string;
        free_pdf_used: number;
        free_pdf_limit: number;
        free_book_used: number;
    } | null>(null);
    /* -- Add-product modal -- */
    const EMPTY_LP = () => ({
        product_name_lan1: '', product_name_lan2: '',
        product_img_url: '', product_url: '',
        origin_lan1: '', origin_lan2: '',
        origin_lan1_iso: '', origin_lan2_iso: '',
        old_price: '',
        current_price: '',
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [dupModal, setDupModal] = useState(false);
    const [dupName, setDupName] = useState('');
    const [dupLoading, setDupLoading] = useState(false);
    const [isDefault, setIsDefault] = useState(false);
    const [defaultModal, setDefaultModal] = useState(false);
    const [coverBuilderOpen, setCoverBuilderOpen] = useState(coverBuilderOnly);
    const [coverBuilderZoom, setCoverBuilderZoom] = useState(70);
    const [coverBuilderCollapsedSections, setCoverBuilderCollapsedSections] = useState<Record<string, boolean>>({});
    const [coverBuilderSaveTick, setCoverBuilderSaveTick] = useState(0);
    const [coverBuilderSavingTemplate, setCoverBuilderSavingTemplate] = useState(false);
    const [coverBuilderAddingTemplate, setCoverBuilderAddingTemplate] = useState(false);
    const [coverBuilderNotice, setCoverBuilderNotice] = useState<string | null>(null);
    const [defaultLoading, setDefaultLoading] = useState(false);
    const [newProd, setNewProd] = useState(EMPTY_LP());
    const [addingProd, setAddingProd] = useState(false);
    const [addProdError, setAddProdError] = useState<string | null>(null);
    const [addShowUrl, setAddShowUrl] = useState(false);
    const [addImageSearchStatus, setAddImageSearchStatus] = useState<string | null>(null);
    const [addPendingImage, setAddPendingImage] = useState<ProductImageSuggestion | null>(null);
    const [addConfirmedImageMeta, setAddConfirmedImageMeta] = useState<ProductImageSuggestion | null>(null);
    const [upgradePdfModal, setUpgradePdfModal] = useState(false);
    const [upgradeFeature, setUpgradeFeature] = useState<'pdf' | 'book'>('pdf');
    const [upgradeLoading, setUpgradeLoading] = useState(false);
    const [upgradeError, setUpgradeError] = useState<string | null>(null);
    const [savingPdf, setSavingPdf] = useState(false);
    const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null);
    const [savedPdfFile, setSavedPdfFile] = useState<File | null>(null);
    const [savePdfError, setSavePdfError] = useState<string | null>(null);
    const allowSharedPdfEdit = true;
    const [, setSharePdfNotice] = useState<string | null>(null);
    const [sharePdfMenuOpen, setSharePdfMenuOpen] = useState(false);
    const [sharePdfFallbackOpen, setSharePdfFallbackOpen] = useState(false);
    const [editorTourOpen, setEditorTourOpen] = useState(false);
    const [editorTourStep, setEditorTourStep] = useState(0);
    const [editorTourSkipped, setEditorTourSkipped] = useState(false);
    const [coverPage, setCoverPage] = useState<{
        image: string;
        show: boolean;
        builder?: boolean;
    }>({ image: '', show: false });
    const [backPage, setBackPage] = useState<{
        image: string;
        show: boolean;
        builder?: boolean;
    }>({ image: '', show: false });
    const [coverBuilder, setCoverBuilder] = useState<CoverBuilderState>(() => normalizeCoverBuilder(DEFAULT_COVER_BUILDER));
    const [frontCoverBuilder, setFrontCoverBuilder] = useState<CoverBuilderState>(() => normalizeCoverBuilder(DEFAULT_COVER_BUILDER));
    const [backCoverBuilder, setBackCoverBuilder] = useState<CoverBuilderState>(() => normalizeCoverBuilder(DEFAULT_COVER_BUILDER));
    const [coverBuilderTarget, setCoverBuilderTarget] = useState<'front' | 'back'>('front');
    const [platformCoverTemplates, setPlatformCoverTemplates] = useState<CoverLayoutTemplate[]>([]);
    const [selectedCoverTemplate, setSelectedCoverTemplate] = useState<{
        id: string;
        templateKey: string;
        label: string;
        layoutId: string;
        isStored: boolean;
        canUpdate: boolean;
    } | null>(null);
    const [selectedCoverTemplateId, setSelectedCoverTemplateId] = useState<string | null>(null);
    const [coverBuilderTemplateLayouts, setCoverBuilderTemplateLayouts] = useState<Record<string, CoverBuilderTemplateState>>({});
    const selectedCoverTemplateRef = useRef<typeof selectedCoverTemplate>(null);
    const coverBuilderTemplatesStateRef = useRef<Record<string, CoverBuilderTemplateState>>({});
    const coverBuilderTemplateOriginalsRef = useRef<Record<string, CoverBuilderTemplateState>>({});
    const coverBuilderTemplateLayoutsLoadedRef = useRef(false);
    const coverBuilderTemplateSwitchingRef = useRef(false);
    const coverBuilderTemplateAutosaveTimerRef = useRef<number | null>(null);
    const coverBuilderTemplateAutosaveBusyRef = useRef(false);
    const coverBuilderTemplateAutosaveQueuedRef = useRef(false);
    const coverBuilderTemplateLayoutSyncTimerRef = useRef<number | null>(null);
    const coverBuilderHistoryApplyingRef = useRef(false);
    const coverBuilderHistoryRef = useRef<{
        past: CoverBuilderState[];
        future: CoverBuilderState[];
    }>({ past: [], future: [] });
    const [coverBuilderHistoryCounts, setCoverBuilderHistoryCounts] = useState({ past: 0, future: 0 });
    const [hiddenCoverTemplateIds, setHiddenCoverTemplateIds] = useState<string[]>([]);
    const [coverTemplateDeleteTarget, setCoverTemplateDeleteTarget] = useState<{
        id: string;
        label: string;
        isPlatformTemplate: boolean;
        hideOnly?: boolean;
    } | null>(null);
    const [coverBuilderSelected, setCoverBuilderSelected] = useState<CoverBuilderItemKey | 'background' | null>('background');
    const [coverBuilderSelectedItems, setCoverBuilderSelectedItems] = useState<CoverBuilderItemKey[]>([]);
    const [coverBuilderDealTagLibraryOpen, setCoverBuilderDealTagLibraryOpen] = useState(false);
    const [coverBuilderBasketLibraryOpen, setCoverBuilderBasketLibraryOpen] = useState(false);
    const [coverBuilderBackgroundLibraryOpen, setCoverBuilderBackgroundLibraryOpen] = useState(false);
    const [coverBuilderBackgroundTab, setCoverBuilderBackgroundTab] = useState<'aiImage' | 'aiColor' | 'library'>('aiImage');
    const [nanoRecentChatsOpen, setNanoRecentChatsOpen] = useState(false);
    const [nanoSettingsOpen, setNanoSettingsOpen] = useState(false);
    const [coverBuilderLibrarySearch, setCoverBuilderLibrarySearch] = useState('');
    const [deletedCoverDealTagKeys, setDeletedCoverDealTagKeys] = useState<string[]>([]);
    const [deletingCoverDealTagKey, setDeletingCoverDealTagKey] = useState<string | null>(null);
    const [coverDealTagDeleteTarget, setCoverDealTagDeleteTarget] = useState<{
        key: string;
        name: string;
        url: string;
    } | null>(null);
    const [coverBuilderDealTagUsage, setCoverBuilderDealTagUsage] = useState<Record<string, number>>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(DEAL_TAG_USAGE_STORAGE_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored as Record<string, number> : {};
        }
        catch {
            return {};
        }
    });
    const [coverBuilderBasketUsage, setCoverBuilderBasketUsage] = useState<Record<string, number>>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(BASKET_USAGE_STORAGE_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored as Record<string, number> : {};
        }
        catch {
            return {};
        }
    });
    const [coverBuilderBackgroundUsage, setCoverBuilderBackgroundUsage] = useState<Record<string, number>>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(BACKGROUND_USAGE_STORAGE_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored as Record<string, number> : {};
        }
        catch {
            return {};
        }
    });
    const [generatedCoverBackgrounds, setGeneratedCoverBackgrounds] = useState<{
        key: string;
        name: string;
        url: string;
        prompt: string;
        generated: true;
        createdAt: number;
    }[]>(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(GENERATED_BACKGROUNDS_STORAGE_KEY) || '[]');
            return Array.isArray(stored)
                ? stored
                    .filter(item => item && typeof item.key === 'string' && typeof item.url === 'string')
                    .map(item => ({
                        key: item.key,
                        name: typeof item.name === 'string' ? item.name : 'Generated background',
                        url: item.url,
                        prompt: typeof item.prompt === 'string' ? item.prompt : '',
                        generated: true,
                        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
                    }))
                : [];
        }
        catch {
            return [];
        }
    });
    const [coverBuilderToolbarOpenGroup, setCoverBuilderToolbarOpenGroup] = useState<string | null>(null);
    const [coverBuilderFloatingToolbarHidden, setCoverBuilderFloatingToolbarHidden] = useState(false);
    const [coverBuilderEditingProduct, setCoverBuilderEditingProduct] = useState<LeafletProduct | null>(null);
    const [coverBuilderLogoTextDraft, setCoverBuilderLogoTextDraft] = useState(DEFAULT_COVER_BUILDER.logoText);
    const [coverBuilderToolbarMenuPosition, setCoverBuilderToolbarMenuPosition] = useState<{
        openKey: string;
        left: number;
        top: number;
        maxHeight: number;
        arrowTop: number;
        placement: 'left' | 'right';
        ready: boolean;
    } | null>(null);
    const [nanoPrompt, setNanoPrompt] = useState('');
    const [nanoConversation, setNanoConversation] = useState<{
        id: string;
        role: 'user' | 'ai';
        text: string;
        status?: 'loading' | 'error';
    }[]>([]);
    const [nanoReferenceImages, setNanoReferenceImages] = useState<{
        id: string;
        dataUrl: string;
        mimeType: string;
        data: string;
        name: string;
    }[]>([]);
    const [nanoGenerating, setNanoGenerating] = useState(false);
    const [nanoListening, setNanoListening] = useState(false);
    const [nanoError, setNanoError] = useState<string | null>(null);
    const availableCoverDealTags = COVER_DEAL_TAGS.filter(tag => !deletedCoverDealTagKeys.includes(tag.key));
    const defaultCoverDealTag = availableCoverDealTags[0] ?? COVER_DEAL_TAGS[0];
    const [nanoA4Enabled, setNanoA4Enabled] = useState(() => typeof nanoA4VisibleOverride === 'boolean' ? nanoA4VisibleOverride : localStorage.getItem(NANO_A4_VISIBILITY_STORAGE_KEY) !== '0');
    const nanoReferenceInputRef = useRef<HTMLInputElement>(null);
    const nanoConversationBottomRef = useRef<HTMLDivElement>(null);
    const nanoSpeechRef = useRef<any>(null);
    const nanoSpeechBasePromptRef = useRef('');
    const nanoSpeechFinalRef = useRef('');
    const nanoSpeechManualStopRef = useRef(false);
    const coverBuilderPreviewRef = useRef<HTMLDivElement>(null);
    const coverBuilderStageRef = useRef<HTMLDivElement>(null);
    const coverBuilderLogoTextDraftRef = useRef(DEFAULT_COVER_BUILDER.logoText);
    const coverBuilderLogoTextCommittedRef = useRef(DEFAULT_COVER_BUILDER.logoText);
    const coverBuilderLogoTextCommitTimerRef = useRef<number | null>(null);
    const coverBuilderEditingLiveRef = useRef(false);
    const coverBuilderSliderDragRef = useRef(false);
    const coverBuilderNativeDragCleanupRef = useRef<(() => void) | null>(null);
    const coverBuilderToolbarLiveEditRef = useRef<{
        key: CoverBuilderItemKey;
        startState: CoverBuilderState;
        pendingPatch: Partial<CoverBuilderElementStyle>;
        frame: number | null;
    } | null>(null);
    const coverBuilderCanvasDragRef = useRef<{
        key: CoverBuilderItemKey;
        mode: 'move' | 'resize' | 'rotate';
        startX: number;
        startY: number;
        startAngle?: number;
        startState: CoverBuilderState;
        startStyle: CoverBuilderElementStyle;
        canvasRect: DOMRect;
        elementRect?: DOMRect;
        element: HTMLElement;
        captureTarget: HTMLElement;
        pointerId: number;
        pendingStyle: Partial<CoverBuilderElementStyle>;
        constrainedAxis: 'x' | 'y' | null;
    } | null>(null);
    const coverBuilderNudgeRef = useRef<number | null>(null);
    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const startEditorTour = React.useCallback(() => {
        setEditorTourStep(0);
        setEditorTourSkipped(false);
        setEditorTourOpen(true);
    }, []);
    const closeEditorTour = React.useCallback((skipped: boolean) => {
        localStorage.setItem(LEAFLET_EDITOR_TOUR_SEEN_KEY, '1');
        localStorage.setItem(LEAFLET_EDITOR_TOUR_SKIPPED_KEY, skipped ? '1' : '0');
        setEditorTourSkipped(skipped);
        setEditorTourOpen(false);
    }, []);
    useEffect(() => {
        const hasSeenTour = localStorage.getItem(LEAFLET_EDITOR_TOUR_SEEN_KEY) === '1';
        setEditorTourSkipped(localStorage.getItem(LEAFLET_EDITOR_TOUR_SKIPPED_KEY) === '1');
        if (!hasSeenTour) {
            const timer = window.setTimeout(() => setEditorTourOpen(true), 500);
            return () => window.clearTimeout(timer);
        }
    }, []);
    const prevCols = useRef(2);
    useEffect(() => {
        if (prevCols.current !== colsPerPage) {
            prevCols.current = colsPerPage;
            setCurrentPage(0);
        }
    }, [colsPerPage]);
    useEffect(() => {
        if (id)
            localStorage.setItem(`leaflet_cols_${id}`, String(colsPerPage));
    }, [colsPerPage, id]);
    useEffect(() => {
        if (id)
            localStorage.setItem(`leaflet_rows_${id}`, String(rowsPerPage));
    }, [rowsPerPage, id]);
    useEffect(() => {
        nanoConversationBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [nanoConversation, nanoGenerating]);
    useEffect(() => {
        const shouldHideChatTrigger = coverBuilderOpen || customizerOpen;
        document.body.classList.toggle('cb-trigger-hidden', shouldHideChatTrigger);
        return () => document.body.classList.remove('cb-trigger-hidden');
    }, [coverBuilderOpen, customizerOpen]);
    useEffect(() => () => {
        if (coverBuilderTemplateLayoutSyncTimerRef.current !== null) {
            window.clearTimeout(coverBuilderTemplateLayoutSyncTimerRef.current);
            coverBuilderTemplateLayoutSyncTimerRef.current = null;
        }
        if (coverBuilderLogoTextCommitTimerRef.current !== null) {
            window.clearTimeout(coverBuilderLogoTextCommitTimerRef.current);
            coverBuilderLogoTextCommitTimerRef.current = null;
        }
        coverBuilderNativeDragCleanupRef.current?.();
        nanoSpeechManualStopRef.current = true;
        nanoSpeechRef.current?.abort?.();
        nanoSpeechRef.current = null;
        const liveEditFrame = coverBuilderToolbarLiveEditRef.current?.frame;
        if (typeof liveEditFrame === 'number')
            window.cancelAnimationFrame(liveEditFrame);
        coverBuilderToolbarLiveEditRef.current = null;
    }, []);
    useEffect(() => {
        setCoverBuilderLogoTextDraft(coverBuilder.logoText);
        coverBuilderLogoTextDraftRef.current = coverBuilder.logoText;
        coverBuilderLogoTextCommittedRef.current = coverBuilder.logoText;
    }, [coverBuilder.logoText]);
    useEffect(() => {
        if (!coverBuilderOpen && !coverBuilderOnly)
            return;
        const handleCoverBuilderHistoryShortcut = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const hasModifier = e.ctrlKey || e.metaKey;
            if (!hasModifier || e.altKey)
                return;
            if (key === 'z') {
                e.preventDefault();
                if (e.shiftKey)
                    redoCoverBuilderChange();
                else
                    undoCoverBuilderChange();
            }
            if (key === 'y') {
                e.preventDefault();
                redoCoverBuilderChange();
            }
        };
        window.addEventListener('keydown', handleCoverBuilderHistoryShortcut, true);
        return () => window.removeEventListener('keydown', handleCoverBuilderHistoryShortcut, true);
    }, [coverBuilderOpen, coverBuilderOnly]);
    useEffect(() => {
        const openKey = coverBuilderToolbarOpenGroup;
        if (!openKey) {
            setCoverBuilderToolbarMenuPosition(null);
            return;
        }
        let frame = 0;
        let resizeObserver: ResizeObserver | null = null;
        const updatePosition = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                const trigger = document.querySelector<HTMLElement>(`[data-toolbar-group-key="${openKey}"]`);
                const menu = document.querySelector<HTMLElement>(`[data-toolbar-menu-key="${openKey}"]`);
                if (!trigger || !menu)
                    return;
                const triggerRect = trigger.getBoundingClientRect();
                const toolbarRect = trigger.closest<HTMLElement>('.lv-cb-floating-toolbar')?.getBoundingClientRect() ?? triggerRect;
                const menuWidth = Math.max(menu.offsetWidth, 1);
                const menuHeight = Math.max(menu.scrollHeight, menu.offsetHeight, 1);
                const viewportMargin = 12;
                const menuGap = 12;
                const spaceRight = window.innerWidth - toolbarRect.right - menuGap - viewportMargin;
                const spaceLeft = toolbarRect.left - menuGap - viewportMargin;
                const placement: 'left' | 'right' = menuWidth > spaceRight && spaceLeft > spaceRight ? 'left' : 'right';
                const availableHeight = Math.max(96, window.innerHeight - viewportMargin * 2);
                const renderedHeight = Math.min(menuHeight, availableHeight);
                const preferredLeft = placement === 'right'
                    ? toolbarRect.right + menuGap
                    : toolbarRect.left - menuGap - menuWidth;
                const left = Math.min(Math.max(viewportMargin, preferredLeft), Math.max(viewportMargin, window.innerWidth - menuWidth - viewportMargin));
                const triggerCenterY = triggerRect.top + triggerRect.height / 2;
                const preferredTop = triggerCenterY - renderedHeight / 2;
                const top = Math.min(Math.max(viewportMargin, preferredTop), Math.max(viewportMargin, window.innerHeight - viewportMargin - renderedHeight));
                const arrowTop = Math.min(Math.max(12, triggerCenterY - top), Math.max(12, renderedHeight - 12));
                setCoverBuilderToolbarMenuPosition(previous => {
                    const next = { openKey, left, top, maxHeight: availableHeight, arrowTop, placement, ready: true };
                    return previous
                        && previous.openKey === next.openKey
                        && Math.abs(previous.left - next.left) < .5
                        && Math.abs(previous.top - next.top) < .5
                        && Math.abs(previous.maxHeight - next.maxHeight) < .5
                        && Math.abs(previous.arrowTop - next.arrowTop) < .5
                        && previous.placement === next.placement
                        ? previous
                        : next;
                });
                resizeObserver?.disconnect();
                resizeObserver = new ResizeObserver(updatePosition);
                resizeObserver.observe(trigger);
                resizeObserver.observe(menu);
            });
        };
        setCoverBuilderToolbarMenuPosition({ openKey, left: 0, top: 0, maxHeight: 460, arrowTop: 20, placement: 'right', ready: false });
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.cancelAnimationFrame(frame);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [coverBuilderToolbarOpenGroup, coverBuilderZoom]);
    useEffect(() => {
        if (!coverBuilderOpen && !coverBuilderOnly)
            return;
        if (!coverBuilderSelected && coverBuilderSelectedItems.length === 0 && !coverBuilderToolbarOpenGroup)
            return;
        const handleCoverBuilderOutsidePointer = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target)
                return;
            if (target.closest('.lv-cb-floating-toolbar')
                || target.closest('.lv-cb-toolbar-menu')
                || target.closest('.cs-popover')
                || target.closest('[data-element-id]')) {
                return;
            }
            setCoverBuilderToolbarOpenGroup(null);
            setCoverBuilderFloatingToolbarHidden(true);
        };
        window.addEventListener('pointerdown', handleCoverBuilderOutsidePointer, true);
        return () => window.removeEventListener('pointerdown', handleCoverBuilderOutsidePointer, true);
    }, [coverBuilderOpen, coverBuilderOnly, coverBuilderSelected, coverBuilderSelectedItems.length, coverBuilderToolbarOpenGroup]);
    const [pageSettings, setPageSettings] = useState({
        bgType: 'solid' as 'solid' | 'gradient',
        bgColor: '#ffffff',
        gradFrom: '#ffffff',
        gradTo: '#e8f4fd',
        gradAngle: 135,
        colGap: 0,
        rowGap: 0,
        orientation: 'portrait' as 'portrait' | 'landscape',
        gridWidthPct: 95,
        gridHeightPct: 100,
    });
    function setPg<K extends keyof typeof pageSettings>(k: K, v: typeof pageSettings[K]) {
        setPageSettings(prev => ({ ...prev, [k]: v }));
    }
    const [headerSettings, setHeaderSettings] = useState({
        show: true,
        text: 'Header',
        showText: true,
        textAlign: 'center' as 'left' | 'center' | 'right',
        blockAlign: 'center' as 'left' | 'center' | 'right',
        widthMode: 'full' as 'full' | 'grid',
        widthPct: 100,
        height: 70,
        marginTop: 0,
        marginBottom: 0,
        bgType: 'solid' as 'solid' | 'gradient' | 'image',
        bgColor: '#cccccc',
        gradFrom: '#cccccc',
        gradTo: '#aaaaaa',
        gradAngle: 90,
        bgImage: '',
        logoUrl: '',
        logoHeight: 44,
        logoWidth: undefined as number | undefined,
        logoX: undefined as number | undefined,
        logoY: undefined as number | undefined,
        logoGap: 10,
        textWidth: undefined as number | undefined,
        textHeight: undefined as number | undefined,
        textX: undefined as number | undefined,
        textY: undefined as number | undefined,
        fontSize: 13,
        fontColor: '#1e293b',
        fontWeight: 'bold' as 'normal' | 'bold',
        fontItalic: false,
        borderWidth: 0,
        borderColor: '#000000',
        borderStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
        borderTop: 0,
        borderRight: 0,
        borderBottom: 0,
        borderLeft: 0,
        perSide: false,
        radiusMode: 'all' as 'all' | 'each',
        radius: 0,
        radiusTL: 0,
        radiusTR: 0,
        radiusBR: 0,
        radiusBL: 0,
    });
    function setH(k: string, v: unknown) {
        setHeaderSettings(prev => ({ ...prev, [k]: v }));
    }
    function setHeaderWidthPct(value: number) {
        const widthPct = Math.max(20, Math.min(100, value));
        setHeaderSettings(prev => ({
            ...prev,
            widthPct,
            widthMode: widthPct >= 100 ? 'full' : 'grid',
        }));
    }
    const headerBarRef = useRef<HTMLDivElement>(null);
    const [headerSelected, setHeaderSelected] = useState(false);
    const [headerToolbarPos, setHeaderToolbarPos] = useState<HeaderToolbarPosition | null>(null);
    const [headerToolbarPanel, setHeaderToolbarPanel] = useState<'content' | 'layout' | 'text' | 'background' | 'border' | null>(null);
    const footerBarRef = useRef<HTMLDivElement>(null);
    const [footerSelected, setFooterSelected] = useState(false);
    const [footerToolbarPos, setFooterToolbarPos] = useState<HeaderToolbarPosition | null>(null);
    const [footerToolbarPanel, setFooterToolbarPanel] = useState<'content' | 'layout' | 'text' | 'background' | 'border' | null>(null);
    const [footerSettings, setFooterSettings] = useState({
        show: true,
        text: '',
        showText: true,
        showPageNum: true,
        textAlign: 'left' as 'left' | 'center' | 'right',
        blockAlign: 'center' as 'left' | 'center' | 'right',
        widthMode: 'full' as 'full' | 'grid',
        widthPct: 100,
        height: 36,
        marginTop: 0,
        marginBottom: 0,
        logoUrl: '',
        logoHeight: 28,
        logoWidth: undefined as number | undefined,
        logoX: undefined as number | undefined,
        logoY: undefined as number | undefined,
        logoGap: 8,
        bgType: 'solid' as 'solid' | 'gradient' | 'image',
        bgColor: '#cccccc',
        gradFrom: '#cccccc',
        gradTo: '#aaaaaa',
        gradAngle: 90,
        bgImage: '',
        fontSize: 11,
        fontColor: '#1e293b',
        fontWeight: 'normal' as 'normal' | 'bold',
        fontItalic: false,
        borderWidth: 0,
        borderColor: '#000000',
        borderStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
        borderTop: 0,
        borderRight: 0,
        borderBottom: 0,
        borderLeft: 0,
        perSide: false,
        radiusMode: 'all' as 'all' | 'each',
        radius: 0,
        radiusTL: 0,
        radiusTR: 0,
        radiusBR: 0,
        radiusBL: 0,
    });
    function setF(k: string, v: unknown) {
        setFooterSettings(prev => ({ ...prev, [k]: v }));
    }
    function setFooterWidthPct(value: number) {
        const widthPct = Math.max(20, Math.min(100, value));
        setFooterSettings(prev => ({
            ...prev,
            widthPct,
            widthMode: widthPct >= 100 ? 'full' : 'grid',
        }));
    }
    const [pageOverrides, setPageOverrides] = useState<Record<number, {
        header?: boolean;
        footer?: boolean;
    }>>({});
    function headerShowFor(pageIdx: number) {
        return pageOverrides[pageIdx]?.header ?? headerSettings.show;
    }
    function footerShowFor(pageIdx: number) {
        return pageOverrides[pageIdx]?.footer ?? footerSettings.show;
    }
    function toggleHeaderForPage(pageIdx: number) {
        const current = headerShowFor(pageIdx);
        setPageOverrides(prev => ({ ...prev, [pageIdx]: { ...prev[pageIdx], header: !current } }));
    }
    function toggleFooterForPage(pageIdx: number) {
        const current = footerShowFor(pageIdx);
        setPageOverrides(prev => ({ ...prev, [pageIdx]: { ...prev[pageIdx], footer: !current } }));
    }
    function applyHeaderToAll() {
        const val = headerShowFor(safePage);
        setHeaderSettings(prev => ({ ...prev, show: val }));
        setPageOverrides(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
                const o = { ...next[+k] };
                delete o.header;
                if (Object.keys(o).length)
                    next[+k] = o;
                else
                    delete next[+k];
            });
            return next;
        });
    }
    function applyFooterToAll() {
        const val = footerShowFor(safePage);
        setFooterSettings(prev => ({ ...prev, show: val }));
        setPageOverrides(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => {
                const o = { ...next[+k] };
                delete o.footer;
                if (Object.keys(o).length)
                    next[+k] = o;
                else
                    delete next[+k];
            });
            return next;
        });
    }
    const [openSbSection, setOpenSbSection] = useState<string | null>(null);
    const [currencySearch, setCurrencySearch] = useState('');
    const coverBackLoadedRef = useRef(false);
    useEffect(() => {
        if (!id)
            return;
        setLoading(true);
        const fetchLeaflet = coverBuilderOnly ? getAdminLeaflet : getLeaflet;
        const fetchLeafletLayout = coverBuilderOnly ? getAdminLeafletLayout : getLeafletLayout;
        fetchLeaflet(id)
            .then(d => { setData(d); setError(null); })
            .catch(e => setError(e instanceof Error ? e.message : 'Failed to load leaflet.'))
            .finally(() => setLoading(false));
        fetchLeafletLayout(id)
            .then(r => {
            setCardLayout(r.layout);
            if (r.layout.font_family)
                loadGoogleFont(r.layout.font_family);
            (r.layout.custom_fonts ?? []).forEach(loadGoogleFont);
            if (r.layout.cover_page)
                setCoverPage(r.layout.cover_page);
            if (r.layout.back_page)
                setBackPage(r.layout.back_page);
            const loadedFrontCoverBuilder = normalizeCoverBuilder(r.layout.cover_builder);
            const loadedBackCoverBuilder = normalizeCoverBuilder(r.layout.back_cover_builder || r.layout.cover_builder);
            setFrontCoverBuilder(loadedFrontCoverBuilder);
            setBackCoverBuilder(loadedBackCoverBuilder);
            setCoverBuilder(loadedFrontCoverBuilder);
            /* -- Restore header / footer / page settings -- */
            if (r.layout.header_settings)
                setHeaderSettings(prev => ({ ...prev, ...(r.layout.header_settings as object) }));
            if (r.layout.footer_settings)
                setFooterSettings(prev => ({ ...prev, ...(r.layout.footer_settings as object) }));
            if (r.layout.page_settings)
                setPageSettings(prev => ({ ...prev, ...(r.layout.page_settings as object) }));
            if (typeof r.layout.cols_per_page === 'number')
                setColsPerPage(r.layout.cols_per_page);
            if (typeof r.layout.rows_per_page === 'number')
                setRowsPerPage(r.layout.rows_per_page);
            if (r.layout.page_overrides)
                setPageOverrides(r.layout.page_overrides as Record<number, {
                    header?: boolean;
                    footer?: boolean;
                }>);
            setTimeout(() => { coverBackLoadedRef.current = true; }, 0);
        })
            .catch(() => { coverBackLoadedRef.current = true; });
        // Check if this leaflet is the user's default
        fetch('/api/user/default-leaflet', {
            headers: { Authorization: `Bearer ${localStorage.getItem('leafletai_token')}` },
        })
            .then(r => r.json())
            .then(d => { setIsDefault(String(d.default_leaflet_id) === String(id)); })
            .catch(() => { });
    }, [id]);
    /* -- Persist cover/back page changes -- */
    useEffect(() => {
        if (!coverBackLoadedRef.current)
            return;
        if (!id || !cardLayout)
            return;
        if (coverBuilderEditingLiveRef.current)
            return;
        const timer = setTimeout(() => {
            saveLeafletLayout(id, { ...cardLayout, cover_page: coverPage, back_page: backPage, cover_builder: frontCoverBuilder as unknown as Record<string, unknown>, back_cover_builder: backCoverBuilder as unknown as Record<string, unknown> })
                .then(r => setCardLayout(r.layout))
                .catch(() => null);
        }, 600);
        return () => clearTimeout(timer);
    }, [coverPage, backPage, frontCoverBuilder, backCoverBuilder, coverBuilderSaveTick]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        selectedCoverTemplateRef.current = selectedCoverTemplate;
    }, [selectedCoverTemplate]);
    function updateHeaderToolbarPosition() {
        const el = headerBarRef.current;
        if (!el || !headerSelected) {
            setHeaderToolbarPos(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        const estimatedToolbarHeight = 112;
        const margin = 12;
        const placeBelow = rect.top < estimatedToolbarHeight + margin;
        setHeaderToolbarPos({
            left: Math.max(margin, Math.min(window.innerWidth - margin, rect.left + rect.width / 2)),
            top: placeBelow ? Math.min(window.innerHeight - margin, rect.bottom + margin) : Math.max(margin, rect.top - margin),
            placeBelow,
        });
    }
    function updateFooterToolbarPosition() {
        const el = footerBarRef.current;
        if (!el || !footerSelected) {
            setFooterToolbarPos(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        const estimatedToolbarHeight = 112;
        const margin = 12;
        const placeBelow = rect.top < estimatedToolbarHeight + margin;
        setFooterToolbarPos({
            left: Math.max(margin, Math.min(window.innerWidth - margin, rect.left + rect.width / 2)),
            top: placeBelow ? Math.min(window.innerHeight - margin, rect.bottom + margin) : Math.max(margin, rect.top - margin),
            placeBelow,
        });
    }
    useEffect(() => {
        if (!headerSelected)
            return;
        let frame = window.requestAnimationFrame(updateHeaderToolbarPosition);
        const schedule = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(updateHeaderToolbarPosition);
        };
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
        };
    }, [headerSelected, currentPage, zoom, headerSettings.height, headerSettings.widthPct, headerSettings.marginTop, headerSettings.marginBottom]);
    useEffect(() => {
        if (!headerSelected)
            return;
        function onDocumentPointerDown(e: PointerEvent) {
            const target = e.target as HTMLElement | null;
            if (!target)
                return;
            if (target.closest('.lc-floating-toolbar') || target.closest('.lv-a4-header') || target.closest('.cs-popover'))
                return;
            setHeaderSelected(false);
            setHeaderToolbarPanel(null);
        }
        document.addEventListener('pointerdown', onDocumentPointerDown);
        return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
    }, [headerSelected]);
    useEffect(() => {
        if (headerSelected)
            updateHeaderToolbarPosition();
    }, [headerSelected, headerSettings, zoom]);
    useEffect(() => {
        if (!footerSelected)
            return;
        let frame = window.requestAnimationFrame(updateFooterToolbarPosition);
        const schedule = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(updateFooterToolbarPosition);
        };
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
        };
    }, [footerSelected, currentPage, zoom, footerSettings.height, footerSettings.widthPct, footerSettings.marginTop, footerSettings.marginBottom]);
    useEffect(() => {
        if (!footerSelected)
            return;
        function onDocumentPointerDown(e: PointerEvent) {
            const target = e.target as HTMLElement | null;
            if (!target)
                return;
            if (target.closest('.lc-floating-toolbar') || target.closest('.lv-a4-footer') || target.closest('.cs-popover'))
                return;
            setFooterSelected(false);
            setFooterToolbarPanel(null);
        }
        document.addEventListener('pointerdown', onDocumentPointerDown);
        return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
    }, [footerSelected]);
    useEffect(() => {
        if (footerSelected)
            updateFooterToolbarPosition();
    }, [footerSelected, footerSettings, zoom]);
    useEffect(() => {
        if (!coverBuilderOnly || !selectedCoverTemplate || !selectedCoverTemplateId)
            return;
        if (coverBuilderTemplateSwitchingRef.current) {
            coverBuilderTemplateSwitchingRef.current = false;
            return;
        }
        if (coverBuilderEditingLiveRef.current)
            return;
        if (coverBuilderTemplateAutosaveTimerRef.current !== null)
            window.clearTimeout(coverBuilderTemplateAutosaveTimerRef.current);
        coverBuilderTemplateAutosaveTimerRef.current = window.setTimeout(() => {
            coverBuilderTemplateAutosaveTimerRef.current = null;
            void saveSelectedCoverBuilderTemplate({ silent: true, reason: 'autosave' });
        }, 900);
        return () => {
            if (coverBuilderTemplateAutosaveTimerRef.current !== null) {
                window.clearTimeout(coverBuilderTemplateAutosaveTimerRef.current);
                coverBuilderTemplateAutosaveTimerRef.current = null;
            }
        };
    }, [coverBuilderOnly, selectedCoverTemplateId, selectedCoverTemplate, coverBuilder, coverBuilderSaveTick]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        coverBuilderTemplateLayoutsLoadedRef.current = false;
        const storageKey = `leaflet_cover_template_layouts_${id || 'new'}`;
        try {
            const rawLayouts = localStorage.getItem(storageKey);
            const parsedLayouts = rawLayouts ? JSON.parse(rawLayouts) as Record<string, Partial<CoverBuilderTemplateState>> : {};
            const restoredLayouts = Object.entries(parsedLayouts).reduce((acc, [templateId, templateState]) => {
                if (!templateState?.config)
                    return acc;
                acc[templateId] = coverBuilderStateToTemplateState(templateId, normalizeCoverBuilder(templateState.config));
                return acc;
            }, {} as Record<string, CoverBuilderTemplateState>);
            coverBuilderTemplatesStateRef.current = restoredLayouts;
            setCoverBuilderTemplateLayouts(restoredLayouts);
        }
        catch {
            coverBuilderTemplatesStateRef.current = {};
            setCoverBuilderTemplateLayouts({});
        }
        finally {
            coverBuilderTemplateLayoutsLoadedRef.current = true;
        }
    }, [id]);
    useEffect(() => {
        if (!coverBuilderTemplateLayoutsLoadedRef.current)
            return;
        const storageKey = `leaflet_cover_template_layouts_${id || 'new'}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(coverBuilderTemplateLayouts));
        }
        catch { }
    }, [id, coverBuilderTemplateLayouts]);
    /* -- Persist header / footer / page settings changes -- */
    const pageSettingsLoadedRef = useRef(false);
    useEffect(() => { pageSettingsLoadedRef.current = false; }, [id]);
    useEffect(() => {
        if (!pageSettingsLoadedRef.current) {
            pageSettingsLoadedRef.current = true;
            return;
        }
        if (!id || !cardLayout)
            return;
        const timer = setTimeout(() => {
            saveLeafletLayout(id, {
                ...cardLayout,
                header_settings: headerSettings as unknown as Record<string, unknown>,
                footer_settings: footerSettings as unknown as Record<string, unknown>,
                page_settings: pageSettings as unknown as Record<string, unknown>,
                cols_per_page: colsPerPage,
                rows_per_page: rowsPerPage,
                page_overrides: pageOverrides as unknown as Record<string, {
                    header?: boolean;
                    footer?: boolean;
                }>,
            }).then(r => setCardLayout(r.layout)).catch(() => null);
        }, 800);
        return () => clearTimeout(timer);
    }, [headerSettings, footerSettings, pageSettings, colsPerPage, rowsPerPage, pageOverrides]); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchExportQuota = React.useCallback(async () => {
        const token = readAuthToken();
        if (!token)
            return;
        try {
            const r = await fetch('/api/user/export-quota', { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok)
                setExportQuota(await r.json());
        }
        catch { }
    }, []);
    useEffect(() => { fetchExportQuota(); }, [fetchExportQuota]);
    useEffect(() => {
        getIconLibrary()
            .then(r => {
            const overrides = new Map((r.preset_overrides ?? []).map(o => [o.icon_key, o]));
            const nextPresetIcons = PRESET_ICON_URLS
                .map((ic, index) => {
                const override = overrides.get(ic.label);
                return {
                    ...ic,
                    label: override?.label || ic.label,
                    active: override ? override.active !== 0 && override.deleted !== 1 : true,
                    order: override ? override.sort_order : index,
                };
            })
                .filter(ic => ic.active)
                .sort((a, b) => a.order - b.order)
                .map(({ label, url }) => ({ label, url }));
            setPresetIcons(nextPresetIcons);
            setAdminIcons(r.icons.map(ic => ({ label: ic.label, url: ic.url })));
        })
            .catch(() => {
            setPresetIcons(PRESET_ICON_URLS);
            setAdminIcons([]);
        });
    }, []);
    useEffect(() => {
        getCoverLayoutTemplates()
            .then(r => setPlatformCoverTemplates(Array.isArray(r.templates) ? r.templates.map(cloneCoverTemplate) : []))
            .catch(() => setPlatformCoverTemplates([]));
    }, []);
    useEffect(() => {
        const readStoredNanoA4Enabled = () => localStorage.getItem(NANO_A4_VISIBILITY_STORAGE_KEY) !== '0';
        if (typeof nanoA4VisibleOverride === 'boolean') {
            setNanoA4Enabled(nanoA4VisibleOverride);
            return;
        }
        if (coverBuilderOnly) {
            setNanoA4Enabled(true);
            return;
        }
        setNanoA4Enabled(readStoredNanoA4Enabled());
        const handleNanoA4SettingChanged = (event: Event) => {
            const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
            if (typeof detail?.enabled === 'boolean') {
                setNanoA4Enabled(detail.enabled);
                return;
            }
            setNanoA4Enabled(readStoredNanoA4Enabled());
        };
        const handleNanoA4Storage = (event: StorageEvent) => {
            if (event.key === NANO_A4_VISIBILITY_STORAGE_KEY) {
                setNanoA4Enabled(event.newValue !== '0');
            }
        };
        window.addEventListener('leafletai:nano-a4-setting-changed', handleNanoA4SettingChanged);
        window.addEventListener('storage', handleNanoA4Storage);
        getPublicSettings()
            .then(settings => {
            const enabled = String(settings.nano_a4_enabled ?? '1') !== '0';
            localStorage.setItem(NANO_A4_VISIBILITY_STORAGE_KEY, enabled ? '1' : '0');
            setNanoA4Enabled(enabled);
            try {
                const parsed = JSON.parse(String(settings.deleted_deal_tags ?? '[]'));
                setDeletedCoverDealTagKeys(Array.isArray(parsed) ? parsed.map(String) : []);
            }
            catch {
                setDeletedCoverDealTagKeys([]);
            }
        })
            .catch(() => setNanoA4Enabled(readStoredNanoA4Enabled()));
        return () => {
            window.removeEventListener('leafletai:nano-a4-setting-changed', handleNanoA4SettingChanged);
            window.removeEventListener('storage', handleNanoA4Storage);
        };
    }, [coverBuilderOnly, nanoA4VisibleOverride]);
    const loadSidebarTemplates = React.useCallback(() => {
        setSidebarTemplatesLoading(true);
        setSidebarTemplatesErr(null);
        getLayoutTemplates()
            .then(r => setSidebarTemplates(r.templates || []))
            .catch(e => setSidebarTemplatesErr(e instanceof Error ? e.message : 'Failed to load templates.'))
            .finally(() => setSidebarTemplatesLoading(false));
    }, []);
    useEffect(() => {
        if (openSbSection === 'templates')
            loadSidebarTemplates();
    }, [openSbSection, loadSidebarTemplates]);
    useEffect(() => {
        if (coverBuilderOpen && coverBuilderSelected === 'products' && sidebarTemplates.length === 0 && !sidebarTemplatesLoading) {
            loadSidebarTemplates();
        }
    }, [coverBuilderOpen, coverBuilderSelected, sidebarTemplates.length, sidebarTemplatesLoading, loadSidebarTemplates]);
    useEffect(() => {
        if (!coverBuilderOpen || coverBuilderSelected !== 'background')
            return;
        window.requestAnimationFrame(() => {
            coverBuilderStageRef.current?.focus({ preventScroll: true });
        });
    }, [coverBuilderOpen, coverBuilderSelected]);
    function coverBuilderWithProductTemplate(builder: CoverBuilderState, layout: CardLayout, templateName?: string): CoverBuilderState {
        return {
            ...builder,
            productCardLayout: layout,
            productCardTemplateName: templateName || 'Applied template',
        };
    }
    function applyCardTemplateToLeafletAndCovers(layout: CardLayout, templateName?: string) {
        setCardLayout(layout);
        if (layout.header_settings)
            setHeaderSettings(prev => ({ ...prev, ...(layout.header_settings as object) }));
        if (layout.footer_settings)
            setFooterSettings(prev => ({ ...prev, ...(layout.footer_settings as object) }));
        if (layout.page_settings)
            setPageSettings(prev => ({ ...prev, ...(layout.page_settings as object) }));
        if (typeof layout.cols_per_page === 'number')
            setColsPerPage(layout.cols_per_page);
        if (typeof layout.rows_per_page === 'number')
            setRowsPerPage(layout.rows_per_page);
        if (layout.page_overrides)
            setPageOverrides(layout.page_overrides as Record<number, { header?: boolean; footer?: boolean }>);
        setFrontCoverBuilder(prev => coverBuilderWithProductTemplate(prev, layout, templateName));
        setBackCoverBuilder(prev => coverBuilderWithProductTemplate(prev, layout, templateName));
        setCoverBuilder(prev => coverBuilderWithProductTemplate(prev, layout, templateName));
        setCoverBuilderSaveTick(t => t + 1);
    }
    async function applySidebarTemplate(layout: CardLayout, key: string, templateName?: string) {
        if (!id)
            return;
        setSidebarTemplateApplying(key);
        setSidebarTemplatesErr(null);
        try {
            const nextFrontCoverBuilder = coverBuilderWithProductTemplate(frontCoverBuilder, layout, templateName);
            const nextBackCoverBuilder = coverBuilderWithProductTemplate(backCoverBuilder, layout, templateName);
            const nextLayout = { ...layout, cover_page: coverPage, back_page: backPage, cover_builder: nextFrontCoverBuilder as unknown as Record<string, unknown>, back_cover_builder: nextBackCoverBuilder as unknown as Record<string, unknown> } as CardLayout;
            const r = await saveLeafletLayout(id, nextLayout);
            applyCardTemplateToLeafletAndCovers(r.layout, templateName);
            setFrontCoverBuilder(nextFrontCoverBuilder);
            setBackCoverBuilder(nextBackCoverBuilder);
        }
        catch (e) {
            setSidebarTemplatesErr(e instanceof Error ? e.message : 'Failed to apply template.');
        }
        finally {
            setSidebarTemplateApplying(null);
        }
    }
    async function confirmSidebarTemplateDelete(templateId: number) {
        setSidebarTemplatesErr(null);
        try {
            await deleteLayoutTemplate(templateId);
            setSidebarTemplates(prev => prev.filter(t => t.id !== templateId));
        }
        catch (e) {
            setSidebarTemplatesErr(e instanceof Error ? e.message : 'Delete failed.');
        }
        finally {
            setSidebarTemplateDeleteId(null);
        }
    }
    const sidebarVisibleTemplates = sidebarTemplates.filter(t => t.is_default === true || t.is_platform === true);
    const sidebarSavedTemplates = sidebarTemplates.filter(t => t.is_default !== true && t.is_platform !== true && t.can_delete !== false);
    const thumbnailSavedRef = useRef<'none' | 'page' | 'cover'>('none');
    useEffect(() => {
        if (loading || !data)
            return;
        // If cover image is available and we haven't saved it as thumbnail yet, prefer it
        if (coverPage.image && thumbnailSavedRef.current !== 'cover') {
            thumbnailSavedRef.current = 'cover';
            saveLeafletThumbnail(Number(id), coverPage.image).catch(() => null);
            return;
        }
        // Fall back to html2canvas of page 1 (only once, and only if no cover image)
        if (thumbnailSavedRef.current !== 'none')
            return;
        const timer = setTimeout(async () => {
            if (coverPage.image)
                return; // cover arrived during the delay - handled above on next render
            try {
                const container = pdfContainerRef.current;
                if (!container)
                    return;
                const firstPage = container.querySelector<HTMLElement>('.lv-pdf-page');
                if (!firstPage)
                    return;
                thumbnailSavedRef.current = 'page';
                const cvs = await html2canvas(firstPage, {
                    scale: 0.5,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    width: firstPage.offsetWidth || 794,
                    height: firstPage.offsetHeight || 1123,
                    onclone: prepareHtml2CanvasClone,
                });
                const dataUrl = cvs.toDataURL('image/jpeg', 0.75);
                await saveLeafletThumbnail(Number(id), dataUrl);
            }
            catch { /* silent - thumbnail is non-critical */ }
        }, 1800);
        return () => clearTimeout(timer);
    }, [loading, data, id, coverPage]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => stopCoverBuilderNudge(), []); // eslint-disable-line react-hooks/exhaustive-deps
    function moveCard(fromId: number, toId: number) {
        if (fromId === toId)
            return;
        setData(prev => {
            if (!prev)
                return prev;
            const prods = [...prev.products];
            const fromIdx = prods.findIndex(p => p.id === fromId);
            const toIdx = prods.findIndex(p => p.id === toId);
            if (fromIdx === -1 || toIdx === -1)
                return prev;
            const [item] = prods.splice(fromIdx, 1);
            prods.splice(toIdx, 0, item);
            return { ...prev, products: prods };
        });
    }
    function handleDragStart(e: React.DragEvent, productId: number) {
        setDragSrcId(productId);
        e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragOver(e: React.DragEvent, productId: number) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(productId);
    }
    function handleDrop(e: React.DragEvent, productId: number) {
        e.preventDefault();
        if (dragSrcId !== null)
            moveCard(dragSrcId, productId);
        setDragSrcId(null);
        setDragOverId(null);
    }
    function handleDragEnd() {
        setDragSrcId(null);
        setDragOverId(null);
    }
    function handleProductUpdate(updated: LeafletProduct) {
        setData(prev => {
            if (!prev)
                return prev;
            return {
                ...prev,
                products: prev.products.map(p => p.id === updated.id ? updated : p),
            };
        });
    }
    function handleProductDelete(id: number) {
        setData(prev => {
            if (!prev)
                return prev;
            return { ...prev, products: prev.products.filter(p => p.id !== id) };
        });
    }
    // -- data fetch --------
    if (loading) {
        return (<div className="lv-state-page">
        <div className="lv-spinner" aria-label="Loading"/>
        <p>Loading leaflet...</p>
      </div>);
    }
    if (error || !data) {
        return (<div className="lv-state-page">
        <span className="nf-code">404</span>
        <h2>{error ?? 'Leaflet not found'}</h2>
        <p>We could not find the leaflet you were looking for.</p>
        <Link to="/" className="nf-home-btn">Go back to home page</Link>
      </div>);
    }
    const { leaflet, products } = data;
    const isTwoLang = leaflet.language_mode === 'two';
    function setPageOrientation(nextOrientation: 'portrait' | 'landscape') {
        setPg('orientation', nextOrientation);
    }
    async function handleDuplicate() {
        if (!id || !dupName.trim())
            return;
        setDupLoading(true);
        try {
            const res = await fetch(`/api/leaflets/${id}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('leafletai_token')}`,
                },
                body: JSON.stringify({ title: dupName.trim() }),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(`${res.status}: ${errBody.error || 'Failed'}`);
            }
            const data = await res.json();
            setDupModal(false);
            window.open(`/app/leaflet/${data.id}`, '_blank');
        }
        catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Could not duplicate leaflet: ${msg}`);
        }
        finally {
            setDupLoading(false);
        }
    }
    async function handleSetDefault() {
        if (!id)
            return;
        setDefaultLoading(true);
        try {
            const newDefault = isDefault ? null : Number(id);
            const token = localStorage.getItem('leafletai_token') || localStorage.getItem('token') || '';
            const res = await fetch('/api/user/default-leaflet', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ leaflet_id: newDefault }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(`${res.status}: ${body.error || 'Server error'}`);
            }
            setIsDefault(!isDefault);
            setDefaultModal(false);
        }
        catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Could not update default leaflet: ${msg}`);
        }
        finally {
            setDefaultLoading(false);
        }
    }
    async function handleAddProduct() {
        setAddProdError(null);
        setAddImageSearchStatus(null);
        if (!newProd.product_name_lan1.trim()) {
            setAddProdError('Product name is required.');
            return;
        }
        const current_price = parsePrice(newProd.current_price);
        if (newProd.current_price && current_price === null) {
            setAddProdError('Current price must be a valid number.');
            return;
        }
        const old_price = parsePrice(newProd.old_price);
        setAddingProd(true);
        try {
            let imageUrl = newProd.product_img_url.trim();
            let imageMeta = addConfirmedImageMeta;
            if (!imageUrl) {
                if (addPendingImage) {
                    imageUrl = addPendingImage.url;
                    imageMeta = addPendingImage;
                }
                else {
                    setAddImageSearchStatus('Searching Creative Commons images for this product...');
                    const { images } = await searchProductImages(newProd.product_name_lan1.trim());
                    const words = newProd.product_name_lan1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                    const selected = [...images].sort((a, b) => {
                        const aScore = words.reduce((score, word) => score + (a.title.toLowerCase().includes(word) ? 1 : 0), 0);
                        const bScore = words.reduce((score, word) => score + (b.title.toLowerCase().includes(word) ? 1 : 0), 0);
                        return bScore - aScore;
                    })[0] ?? null;
                    setAddImageSearchStatus(null);
                    if (!selected)
                        throw new Error('No reusable image was found for this product name. Please upload an image or paste a direct image URL.');
                    setAddPendingImage(selected);
                    return;
                }
            }
            const body = {
                product_name_lan1: newProd.product_name_lan1.trim(),
                product_name_lan2: newProd.product_name_lan2.trim(),
                product_img_url: imageUrl,
                product_image_source: imageMeta?.source ?? '',
                product_image_license: imageMeta?.licenseUrl || imageMeta?.license || (imageMeta ? 'Creative Commons / reusable media' : ''),
                product_url: newProd.product_url.trim(),
                origin_lan1: newProd.origin_lan1.trim(),
                origin_lan2: newProd.origin_lan2.trim(),
                origin_lan1_iso: newProd.origin_lan1_iso,
                origin_lan2_iso: newProd.origin_lan2_iso,
                old_price,
                current_price,
            };
            const resp = await fetch(`/api/leaflets/${id}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken')}` },
                body: JSON.stringify(body),
            });
            if (!resp.ok)
                throw new Error(await resp.text());
            const { product } = await resp.json();
            setData(prev => prev ? { ...prev, products: [...prev.products, product] } : prev);
            setShowAddModal(false);
            setNewProd(EMPTY_LP());
            setAddShowUrl(false);
            setAddPendingImage(null);
            setAddConfirmedImageMeta(null);
        }
        catch (e: any) {
            setAddProdError(e.message || 'Failed to add product.');
        }
        finally {
            setAddingProd(false);
        }
    }
    const q = search.trim().toLowerCase();
    const coverProductIds = new Set(coverBuilder.selectedProductIds);
    let visible = products.filter(p => {
        if (coverProductIds.has(p.id))
            return false;
        if (onlyDiscounted) {
            if (p.old_price === null || p.current_price === null || p.old_price <= p.current_price)
                return false;
        }
        if (!q)
            return true;
        return ((p.product_name_lan1 ?? '').toLowerCase().includes(q) ||
            (p.product_name_lan2 ?? '').toLowerCase().includes(q) ||
            (p.origin_lan1 ?? '').toLowerCase().includes(q) ||
            (p.origin_lan2 ?? '').toLowerCase().includes(q));
    });
    if (sortBy === 'price_asc')
        visible = [...visible].sort((a, b) => (a.current_price ?? Infinity) - (b.current_price ?? Infinity));
    if (sortBy === 'price_desc')
        visible = [...visible].sort((a, b) => (b.current_price ?? -Infinity) - (a.current_price ?? -Infinity));
    if (sortBy === 'name')
        visible = [...visible].sort((a, b) => (a.product_name_lan1 ?? '').localeCompare(b.product_name_lan1 ?? ''));
    const discountedCount = products.filter(p => p.old_price !== null && p.current_price !== null && p.old_price > p.current_price).length;
    const isLandscape = pageSettings.orientation === 'landscape';
    const A4_W = isLandscape ? 1123 : 794;
    const A4_H = isLandscape ? 794 : 1123;
    const nanoDimensions = calculateA4GeneratorDimensions(pageSettings.orientation);
    async function waitForA4CoverImageJob(jobId: string) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < 4 * 60 * 1000) {
            await new Promise(resolve => window.setTimeout(resolve, 2500));
            const job = await getA4CoverImageJob(jobId);
            if (job.status === 'complete' && job.result)
                return job.result;
            if (job.status === 'error')
                throw new Error(job.message || 'Failed to generate A4 cover.');
        }
        throw new Error('Image generation is taking longer than expected. Please check Recent Chats or try again.');
    }
    async function generateNanoCover() {
        const prompt = nanoPrompt.trim();
        if (!prompt) {
            setNanoError('Enter a prompt first.');
            return;
        }
        const userMessageId = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setNanoConversation(previous => [
            ...previous,
            { id: userMessageId, role: 'user', text: prompt },
            { id: aiMessageId, role: 'ai', text: 'Generating your supermarket background...', status: 'loading' },
        ]);
        setNanoPrompt('');
        setNanoGenerating(true);
        setNanoError(null);
        try {
            const job = await startA4CoverImageJob({
                prompt: enhanceA4CoverPrompt(prompt, pageSettings.orientation),
                orientation: pageSettings.orientation,
                resolution: '2k',
                width: nanoDimensions.width,
                height: nanoDimensions.height,
                referenceImages: nanoReferenceImages.map(image => ({ mimeType: image.mimeType, data: image.data })),
            });
            setNanoConversation(previous => previous.map(message => message.id === aiMessageId
                ? { ...message, text: 'Working on it. This can take a minute, and I will apply it when it is ready.', status: 'loading' }
                : message));
            const result = job.status === 'complete' && job.result
                ? job.result
                : await waitForA4CoverImageJob(job.jobId);
            saveGeneratedCoverBackground(result.imageUrl, prompt);
            await applyGeneratedCoverImage(result.imageUrl);
            setNanoConversation(previous => previous.map(message => message.id === aiMessageId
                ? { ...message, text: 'Done. I created the background, applied it to the cover, and saved it in your Library.', status: undefined }
                : message));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate A4 cover.';
            const errorMessage = /quota|rate limit|429/i.test(message)
                ? 'Google image generation quota is exceeded for this API key. Check AI Studio billing/quota or try again later.'
                : message;
            setNanoError(errorMessage);
            setNanoConversation(previous => previous.map(chatMessage => chatMessage.id === aiMessageId
                ? { ...chatMessage, text: errorMessage, status: 'error' }
                : chatMessage));
        }
        finally {
            setNanoGenerating(false);
        }
    }
    function saveGeneratedCoverBackground(imageUrl: string, prompt: string) {
        const entry = {
            key: `generated-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: `Generated ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
            url: imageUrl,
            prompt,
            generated: true as const,
            createdAt: Date.now(),
        };
        setGeneratedCoverBackgrounds(previous => {
            const next = [entry, ...previous.filter(background => background.url !== imageUrl)].slice(0, 24);
            localStorage.setItem(GENERATED_BACKGROUNDS_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }
    function deleteGeneratedCoverBackground(key: string) {
        setGeneratedCoverBackgrounds(previous => {
            const target = previous.find(background => background.key === key);
            const next = previous.filter(background => background.key !== key);
            localStorage.setItem(GENERATED_BACKGROUNDS_STORAGE_KEY, JSON.stringify(next));
            if (target) {
                setCoverBuilderBackgroundUsage(usage => {
                    const updated = { ...usage };
                    delete updated[target.url];
                    localStorage.setItem(BACKGROUND_USAGE_STORAGE_KEY, JSON.stringify(updated));
                    return updated;
                });
                if (coverBuilder.bgType === 'image' && coverBuilder.bgImage === target.url) {
                    setCoverBuilderValue('bgType', 'solid');
                }
            }
            return next;
        });
    }
    function enhanceNanoPromptDraft() {
        const basePrompt = nanoPrompt.trim() || 'Supermarket background with clean space for offers';
        const enhancedPrompt = `${basePrompt.replace(/\s+$/g, '')}, full-bleed A4 ${pageSettings.orientation} supermarket leaflet background, bright professional retail lighting, clean product shelves, large empty center area for editable offers, modern commercial design, no text, no logos, no borders, no frames, no crop marks, no print guide lines.`;
        setNanoPrompt(enhancedPrompt.slice(0, 4000));
        setNanoError(null);
    }
    function startNewNanoChat() {
        setNanoConversation([]);
        setNanoPrompt('');
        setNanoError(null);
        setNanoRecentChatsOpen(false);
        setNanoSettingsOpen(false);
    }
    function openRecentNanoChat(background: (typeof generatedCoverBackgrounds)[number]) {
        const prompt = background.prompt || background.name;
        setNanoConversation([
            { id: `${background.key}-user`, role: 'user', text: prompt },
            { id: `${background.key}-ai`, role: 'ai', text: 'This generated background is saved in your Library and ready to reuse.' },
        ]);
        setNanoPrompt('');
        setNanoRecentChatsOpen(false);
        setNanoSettingsOpen(false);
    }
    async function applyGeneratedCoverImage(imageUrl: string) {
        const dynamicCoverBuilder = cloneCoverBuilderState({
            ...coverBuilder,
            bgType: 'image',
            bgImage: imageUrl,
            aiGeneratedBg: true,
            visibleItems: { ...coverBuilder.visibleItems },
        });
        updateCoverBuilderForSelectedTemplate(dynamicCoverBuilder);
        setFrontCoverBuilder(dynamicCoverBuilder);
        setCoverBuilderSelected('background');
        setCoverPage({ image: '', show: true, builder: true });
        setCurrentPage(-1);
    }
    async function handleNanoReferenceUpload(files: FileList | File[] | File | null) {
        const selectedFiles = files instanceof File
            ? [files]
            : Array.from(files || []);
        if (selectedFiles.length === 0)
            return;
        try {
            const nextImages: typeof nanoReferenceImages = [];
            for (const file of selectedFiles) {
                if (!file.type.startsWith('image/')) {
                    setNanoError('Upload image files for logo/reference.');
                    return;
                }
                if (file.size > 6 * 1024 * 1024) {
                    setNanoError('Each reference image must be 6 MB or smaller.');
                    return;
                }
                const dataUrl = await blobToDataUrl(file);
                const [, data = ''] = dataUrl.split(',');
                nextImages.push({
                    id: `${file.name || 'reference'}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                    dataUrl,
                    mimeType: file.type || 'image/png',
                    data,
                    name: file.name || 'Reference image',
                });
            }
            setNanoReferenceImages(prev => [...prev, ...nextImages].slice(0, 6));
            setNanoError(null);
        }
        catch {
            setNanoError('Could not read one of the uploaded images.');
        }
    }
    function handleNanoPromptPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
        const imageItem = Array.from(e.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
        const file = imageItem?.getAsFile();
        if (!file)
            return;
        e.preventDefault();
        void handleNanoReferenceUpload(file);
    }
    function removeNanoReferenceImage(id: string) {
        setNanoReferenceImages(prev => prev.filter(image => image.id !== id));
    }
    function setCoverBuilderValue<K extends keyof CoverBuilderState>(key: K, value: CoverBuilderState[K]) {
        const clearsAiGradient = key === 'bgType'
            || key === 'bgColor'
            || key === 'gradFrom'
            || key === 'gradTo'
            || key === 'gradAngle'
            || key === 'gradFromStop'
            || key === 'gradToStop'
            || key === 'bgImage';
        const clearsGeneratedBackground = key === 'bgType'
            || key === 'bgColor'
            || key === 'gradFrom'
            || key === 'gradTo'
            || key === 'gradAngle'
            || key === 'gradFromStop'
            || key === 'gradToStop'
            || key === 'bgImage';
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            [key]: value,
            ...(clearsAiGradient ? { aiGradientCss: '' } : {}),
            ...(clearsGeneratedBackground ? { aiGeneratedBg: false } : {}),
        }));
    }
    function commitCoverBuilderLogoText(nextText = coverBuilderLogoTextDraftRef.current) {
        if (coverBuilderLogoTextCommitTimerRef.current !== null) {
            window.clearTimeout(coverBuilderLogoTextCommitTimerRef.current);
            coverBuilderLogoTextCommitTimerRef.current = null;
        }
        if (coverBuilderLogoTextCommittedRef.current === nextText)
            return;
        coverBuilderLogoTextCommittedRef.current = nextText;
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            logoText: nextText,
        }));
    }
    function previewCoverBuilderLogoText(nextText: string) {
        const logoTextEl = coverBuilderPreviewRef.current?.querySelector<HTMLElement>('.lv-cb-logo-slot .lv-cb-logo-text');
        if (!logoTextEl)
            return;
        const trimmedText = nextText.trim();
        logoTextEl.textContent = trimmedText || (coverBuilder.logo ? '' : 'Logo');
        logoTextEl.classList.toggle('lv-cb-logo-text--empty', !trimmedText && !!coverBuilder.logo);
    }
    function handleCoverBuilderLogoTextChange(nextText: string) {
        coverBuilderLogoTextDraftRef.current = nextText;
        setCoverBuilderLogoTextDraft(nextText);
        previewCoverBuilderLogoText(nextText);
        if (coverBuilderLogoTextCommitTimerRef.current !== null)
            window.clearTimeout(coverBuilderLogoTextCommitTimerRef.current);
        coverBuilderLogoTextCommitTimerRef.current = window.setTimeout(() => commitCoverBuilderLogoText(nextText), 300);
    }
    function selectCoverBuilderItem(key: CoverBuilderItemKey, additive = false) {
        setCoverBuilderSelected(key);
        setCoverBuilderFloatingToolbarHidden(false);
        if (key !== 'dealTag')
            setCoverBuilderDealTagLibraryOpen(false);
        if (key !== 'basket')
            setCoverBuilderBasketLibraryOpen(false);
        setCoverBuilderBackgroundLibraryOpen(false);
        setCoverBuilderToolbarOpenGroup(null);
        setCoverBuilderSelectedItems(prev => {
            if (!additive)
                return [key];
            return prev.includes(key) ? prev : [...prev, key];
        });
    }
    function clearCoverBuilderSelection(target: CoverBuilderItemKey | 'background' | null = null) {
        setCoverBuilderSelected(target);
        setCoverBuilderFloatingToolbarHidden(false);
        if (target !== 'dealTag')
            setCoverBuilderDealTagLibraryOpen(false);
        if (target !== 'basket')
            setCoverBuilderBasketLibraryOpen(false);
        if (target !== 'background')
            setCoverBuilderBackgroundLibraryOpen(false);
        setCoverBuilderToolbarOpenGroup(null);
        setCoverBuilderSelectedItems([]);
    }
    function cloneCoverTemplateStyles(styles: Record<string, unknown> | Record<CoverBuilderItemKey, CoverBuilderElementStyle>) {
        return JSON.parse(JSON.stringify(styles || {})) as Record<string, Record<string, unknown>>;
    }
    function cloneCoverTemplateElements(elements: unknown) {
        return JSON.parse(JSON.stringify(elements || {})) as Record<string, Record<string, unknown>>;
    }
    function cloneCoverBuilderState(state: CoverBuilderState) {
        const cloned = typeof structuredClone === 'function'
            ? structuredClone(state)
            : JSON.parse(JSON.stringify(state)) as CoverBuilderState;
        return normalizeCoverBuilder(cloned);
    }
    function coverBuilderTemplateStateKey(template: { id: string; templateKey: string; isStored: boolean }) {
        return `${template.isStored ? 'stored' : 'builtin'}:${template.isStored ? template.id : template.templateKey}`;
    }
    function coverBuilderStateToTemplateState(templateId: string, state: CoverBuilderState): CoverBuilderTemplateState {
        const config = cloneCoverBuilderState(state);
        return {
            templateId,
            elements: buildCoverTemplateElements(config),
            config,
        };
    }
    function setCoverBuilderTemplateLayout(templateId: string, templateState: CoverBuilderTemplateState, options: { deferState?: boolean } = {}) {
        const refTemplateState: CoverBuilderTemplateState = {
            templateId,
            elements: cloneCoverTemplateElements(templateState.elements),
            config: cloneCoverBuilderState(templateState.config),
        };
        coverBuilderTemplatesStateRef.current = {
            ...coverBuilderTemplatesStateRef.current,
            [templateId]: refTemplateState,
        };
        const syncState = () => {
            const stateTemplateState: CoverBuilderTemplateState = {
                templateId,
                elements: cloneCoverTemplateElements(refTemplateState.elements),
                config: cloneCoverBuilderState(refTemplateState.config),
            };
            setCoverBuilderTemplateLayouts(prev => ({
                ...prev,
                [templateId]: stateTemplateState,
            }));
        };
        if (!options.deferState) {
            if (coverBuilderTemplateLayoutSyncTimerRef.current !== null) {
                window.clearTimeout(coverBuilderTemplateLayoutSyncTimerRef.current);
                coverBuilderTemplateLayoutSyncTimerRef.current = null;
            }
            syncState();
            return;
        }
        if (coverBuilderTemplateLayoutSyncTimerRef.current !== null)
            window.clearTimeout(coverBuilderTemplateLayoutSyncTimerRef.current);
        coverBuilderTemplateLayoutSyncTimerRef.current = window.setTimeout(() => {
            coverBuilderTemplateLayoutSyncTimerRef.current = null;
            setCoverBuilderTemplateLayouts({ ...coverBuilderTemplatesStateRef.current });
        }, 350);
    }
    function rememberCoverBuilderTemplateState(template: { id: string; templateKey: string; isStored: boolean } | null, state = coverBuilder) {
        if (!template)
            return;
        const stateKey = coverBuilderTemplateStateKey(template);
        const existing = coverBuilderTemplatesStateRef.current[stateKey];
        coverBuilderTemplatesStateRef.current = {
            ...coverBuilderTemplatesStateRef.current,
            [stateKey]: {
                templateId: stateKey,
                elements: existing?.elements ?? {},
                config: cloneCoverBuilderState(state),
            },
        };
        if (coverBuilderTemplateLayoutSyncTimerRef.current !== null)
            window.clearTimeout(coverBuilderTemplateLayoutSyncTimerRef.current);
        coverBuilderTemplateLayoutSyncTimerRef.current = window.setTimeout(() => {
            coverBuilderTemplateLayoutSyncTimerRef.current = null;
            setCoverBuilderTemplateLayouts({ ...coverBuilderTemplatesStateRef.current });
        }, 350);
    }
    function syncCoverBuilderHistoryCounts() {
        setCoverBuilderHistoryCounts({
            past: coverBuilderHistoryRef.current.past.length,
            future: coverBuilderHistoryRef.current.future.length,
        });
    }
    function pushCoverBuilderHistorySnapshot(state: CoverBuilderState) {
        if (coverBuilderHistoryApplyingRef.current)
            return;
        const past = [...coverBuilderHistoryRef.current.past, cloneCoverBuilderState(state)].slice(-60);
        coverBuilderHistoryRef.current = { past, future: [] };
        syncCoverBuilderHistoryCounts();
    }
    function clearCoverBuilderRuntimeElementStyles(key?: CoverBuilderItemKey) {
        const root = coverBuilderPreviewRef.current;
        if (!root)
            return;
        const selector = key ? `[data-element-id="${key}"]` : '[data-element-id]';
        root.querySelectorAll<HTMLElement>(selector).forEach(element => {
            element.style.removeProperty('left');
            element.style.removeProperty('top');
            element.style.removeProperty('width');
            element.style.removeProperty('height');
            element.style.removeProperty('transform');
            element.style.removeProperty('opacity');
            element.style.removeProperty('font-size');
            element.style.removeProperty('background');
            element.style.removeProperty('border');
            element.style.removeProperty('border-radius');
        });
    }
    function undoCoverBuilderChange() {
        const previous = coverBuilderHistoryRef.current.past.at(-1);
        if (!previous)
            return;
        clearCoverBuilderRuntimeElementStyles();
        coverBuilderHistoryApplyingRef.current = true;
        setCoverBuilder(current => {
            const nextPast = coverBuilderHistoryRef.current.past.slice(0, -1);
            coverBuilderHistoryRef.current = {
                past: nextPast,
                future: [cloneCoverBuilderState(current), ...coverBuilderHistoryRef.current.future].slice(0, 60),
            };
            const restored = cloneCoverBuilderState(previous);
            rememberCoverBuilderTemplateState(selectedCoverTemplateRef.current, restored);
            return restored;
        });
        coverBuilderHistoryApplyingRef.current = false;
        syncCoverBuilderHistoryCounts();
        setCoverBuilderSaveTick(t => t + 1);
    }
    function redoCoverBuilderChange() {
        const next = coverBuilderHistoryRef.current.future[0];
        if (!next)
            return;
        clearCoverBuilderRuntimeElementStyles();
        coverBuilderHistoryApplyingRef.current = true;
        setCoverBuilder(current => {
            coverBuilderHistoryRef.current = {
                past: [...coverBuilderHistoryRef.current.past, cloneCoverBuilderState(current)].slice(-60),
                future: coverBuilderHistoryRef.current.future.slice(1),
            };
            const restored = cloneCoverBuilderState(next);
            rememberCoverBuilderTemplateState(selectedCoverTemplateRef.current, restored);
            return restored;
        });
        coverBuilderHistoryApplyingRef.current = false;
        syncCoverBuilderHistoryCounts();
        setCoverBuilderSaveTick(t => t + 1);
    }
    function updateCoverBuilderForSelectedTemplate(updater: CoverBuilderState | ((prev: CoverBuilderState) => CoverBuilderState), options: { skipHistory?: boolean } = {}) {
        setCoverBuilder(prev => {
            const current = cloneCoverBuilderState(prev);
            const next = typeof updater === 'function'
                ? (updater as (prev: CoverBuilderState) => CoverBuilderState)(current)
                : updater;
            const clonedNext = cloneCoverBuilderState(next);
            if (!options.skipHistory)
                pushCoverBuilderHistorySnapshot(prev);
            rememberCoverBuilderTemplateState(selectedCoverTemplateRef.current, clonedNext);
            return clonedNext;
        });
    }
    function cloneCoverTemplate(template: CoverLayoutTemplate): CoverLayoutTemplate {
        return {
            ...template,
            styles: template.styles ? cloneCoverTemplateStyles(template.styles as Record<string, unknown>) : undefined,
            elements: template.elements ? cloneCoverTemplateElements(template.elements) : undefined,
        };
    }
    function buildCoverTemplateElements(builder = coverBuilder) {
        const elementState = (key: CoverBuilderItemKey, extra: Record<string, unknown> = {}) => ({
            visible: builder.visibleItems[key],
            style: cloneCoverTemplateStyles({ [key]: builder.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key] })[key],
            ...extra,
        });
        return cloneCoverTemplateElements({
            background: {
                bgType: builder.bgType,
                bgColor: builder.bgColor,
                gradFrom: builder.gradFrom,
                gradTo: builder.gradTo,
                gradAngle: builder.gradAngle,
                gradFromStop: builder.gradFromStop,
                gradToStop: builder.gradToStop,
                aiGradientCss: builder.aiGradientCss,
                bgImage: builder.bgImage,
            },
            logo: elementState('logo', {
                image: builder.logo,
                text: builder.logoText,
                aiStyle: builder.logoAiStyle,
            }),
            headline: elementState('headline', {
                text: builder.headline,
                aiStyle: builder.headlineAiStyle,
                accentColor: builder.headlineAccentColor,
            }),
            subline: elementState('subline', { text: builder.subline }),
            contact: elementState('contact', {
                text: builder.contact,
                aiStyle: builder.contactAiStyle,
                accentColor: builder.contactAccentColor,
            }),
            products: elementState('products', {
                selectedProductIds: builder.selectedProductIds,
                productCardLayout: builder.productCardLayout,
                productCardTemplateName: builder.productCardTemplateName,
            }),
            dealTag: elementState('dealTag', { image: builder.dealTagUrl }),
            basket: elementState('basket', {
                image: builder.basketUrl,
                fit: builder.basketFit,
                cropX: builder.basketCropX,
                cropY: builder.basketCropY,
                cropZoom: builder.basketCropZoom,
            }),
        });
    }
    function applyCoverTemplateElements(state: CoverBuilderState, elements: unknown): CoverBuilderState {
        const source = elements && typeof elements === 'object' ? cloneCoverTemplateElements(elements) : {};
        const next = normalizeCoverBuilder(state);
        const read = (key: string) => source[key] && typeof source[key] === 'object' ? source[key] : undefined;
        const applyItem = (key: CoverBuilderItemKey) => {
            const item = read(key);
            if (!item)
                return;
            if (typeof item.visible === 'boolean')
                next.visibleItems[key] = item.visible;
            if (item.style && typeof item.style === 'object')
                next.itemStyles[key] = { ...(next.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key]), ...(item.style as Partial<CoverBuilderElementStyle>) };
        };
        const background = read('background');
        if (background) {
            if (background.bgType === 'solid' || background.bgType === 'gradient' || background.bgType === 'image')
                next.bgType = background.bgType;
            if (typeof background.bgColor === 'string')
                next.bgColor = background.bgColor;
            if (typeof background.gradFrom === 'string')
                next.gradFrom = background.gradFrom;
            if (typeof background.gradTo === 'string')
                next.gradTo = background.gradTo;
            if (typeof background.gradAngle === 'number')
                next.gradAngle = background.gradAngle;
            if (typeof background.gradFromStop === 'number')
                next.gradFromStop = background.gradFromStop;
            if (typeof background.gradToStop === 'number')
                next.gradToStop = background.gradToStop;
            if (typeof background.aiGradientCss === 'string')
                next.aiGradientCss = background.aiGradientCss;
            if (typeof background.bgImage === 'string')
                next.bgImage = background.bgImage;
        }
        (Object.keys(DEFAULT_COVER_BUILDER_ITEM_STYLES) as CoverBuilderItemKey[]).forEach(applyItem);
        const logo = read('logo');
        if (typeof logo?.image === 'string')
            next.logo = logo.image;
        if (typeof logo?.text === 'string')
            next.logoText = logo.text;
        if (typeof logo?.aiStyle === 'string')
            next.logoAiStyle = logo.aiStyle;
        const headline = read('headline');
        if (typeof headline?.text === 'string')
            next.headline = headline.text;
        if (typeof headline?.aiStyle === 'string')
            next.headlineAiStyle = headline.aiStyle;
        if (typeof headline?.accentColor === 'string')
            next.headlineAccentColor = headline.accentColor;
        const subline = read('subline');
        if (typeof subline?.text === 'string')
            next.subline = subline.text;
        const contact = read('contact');
        if (typeof contact?.text === 'string')
            next.contact = contact.text;
        if (typeof contact?.aiStyle === 'string')
            next.contactAiStyle = contact.aiStyle;
        if (typeof contact?.accentColor === 'string')
            next.contactAccentColor = contact.accentColor;
        const productsElement = read('products');
        if (Array.isArray(productsElement?.selectedProductIds))
            next.selectedProductIds = productsElement.selectedProductIds.map(Number).filter(Number.isFinite).slice(0, 12);
        if (productsElement?.productCardLayout && typeof productsElement.productCardLayout === 'object')
            next.productCardLayout = productsElement.productCardLayout as CardLayout;
        if (typeof productsElement?.productCardTemplateName === 'string')
            next.productCardTemplateName = productsElement.productCardTemplateName;
        const dealTag = read('dealTag');
        if (typeof dealTag?.image === 'string')
            next.dealTagUrl = dealTag.image;
        const basket = read('basket');
        if (typeof basket?.image === 'string')
            next.basketUrl = basket.image;
        if (basket?.fit === 'cover' || basket?.fit === 'contain')
            next.basketFit = basket.fit;
        if (typeof basket?.cropX === 'number')
            next.basketCropX = basket.cropX;
        if (typeof basket?.cropY === 'number')
            next.basketCropY = basket.cropY;
        if (typeof basket?.cropZoom === 'number')
            next.basketCropZoom = basket.cropZoom;
        return next;
    }
    function buildCoverTemplateBody(name: string, layoutId = 'hero-left', builder = coverBuilder, templateKey = layoutId): Omit<CoverLayoutTemplate, 'id' | 'created_at' | 'can_delete' | 'owner_id' | 'owner_role' | 'is_platform'> {
        return {
            name,
            layout_id: layoutId,
            template_key: templateKey,
            headline_lines: Math.max(1, Math.min(3, builder.headline.split(/\n+/).filter(line => line.trim()).length || 2)) as 1 | 2 | 3,
            headline_ai_style: builder.headlineAiStyle || undefined,
            contact_ai_style: builder.contactAiStyle || undefined,
            headline_accent_color: builder.headlineAccentColor,
            contact_accent_color: builder.contactAccentColor,
            styles: cloneCoverTemplateStyles(builder.itemStyles),
            elements: buildCoverTemplateElements(builder),
        };
    }
    function formatHeadlineForAiStyle(text: string, lineCount: 1 | 2 | 3) {
        const trimmed = text.trim() || 'Weekly Fresh Offers';
        const words = trimmed.replace(/\s*\n\s*/g, ' ').split(/\s+/).filter(Boolean);
        if (lineCount === 1 || words.length <= 1)
            return words.join(' ').toUpperCase();
        if (lineCount === 2) {
            const splitAt = Math.max(1, Math.ceil(words.length / 2));
            return [
                words.slice(0, splitAt).join(' '),
                words.slice(splitAt).join(' '),
            ].filter(Boolean).join('\n').toUpperCase();
        }
        if (words.length >= 3) {
            return [
                words[0],
                words.slice(1, -1).join(' '),
                words[words.length - 1],
            ].join('\n').toUpperCase();
        }
        return trimmed.toUpperCase();
    }
    type ContactInfoType = 'website' | 'phone' | 'whatsapp' | 'location';
    function parseContactInfo(text: string): Array<{
        type: ContactInfoType;
        value: string;
    }> {
        const parts = text
            .split(/\s*(?:\||,|,|\n)\s*/g)
            .map(part => part.trim())
            .filter(Boolean);
        const fallback = parts.length ? parts : [text.trim()].filter(Boolean);
        return fallback.map(part => {
            const lower = part.toLowerCase();
            const phoneLike = /(?:\+|00)?\d[\d\s().-]{5,}/.test(part);
            if (lower.includes('whatsapp') || lower.includes('wa.me'))
                return { type: 'whatsapp', value: part.replace(/whatsapp[:\s-]*/i, '').trim() || part };
            if (lower.includes('www.') || lower.includes('http') || lower.includes('.com') || lower.includes('.ai'))
                return { type: 'website', value: part };
            if (lower.includes('street') || lower.includes('road') || lower.includes('avenue') || lower.includes('dubai') || lower.includes('location') || lower.includes('address'))
                return { type: 'location', value: part.replace(/location[:\s-]*/i, '').trim() || part };
            if (phoneLike)
                return { type: 'phone', value: part };
            return { type: 'location', value: part };
        });
    }
    function toggleCoverBuilderItem(key: CoverBuilderItemKey) {
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            visibleItems: { ...prev.visibleItems, [key]: !prev.visibleItems[key] },
        }));
    }
    function addCoverBuilderElement(key: CoverBuilderItemKey) {
        updateCoverBuilderForSelectedTemplate(prev => {
            const next: CoverBuilderState = {
                ...prev,
                visibleItems: { ...prev.visibleItems, [key]: true },
            };
            if (key === 'products' && next.selectedProductIds.length === 0 && products.length > 0) {
                next.selectedProductIds = products.slice(0, 6).map(p => p.id);
            }
            if (key === 'dealTag' && !next.dealTagUrl) {
                next.dealTagUrl = defaultCoverDealTag.url;
            }
            if (key === 'basket' && !next.basketUrl) {
                next.basketUrl = COVER_BASKETS[0].url;
            }
            return next;
        });
        setCoverBuilderSelected(key);
    }
    function updateCoverBuilderItemStyle(key: CoverBuilderItemKey, patch: Partial<CoverBuilderElementStyle>, options: { skipHistory?: boolean } = {}) {
        setCoverBuilder(prev => {
            const next: CoverBuilderState = {
                ...prev,
                itemStyles: {
                    ...prev.itemStyles,
                    [key]: { ...(prev.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key]), ...patch },
                },
            };
            if (!options.skipHistory)
                pushCoverBuilderHistorySnapshot(prev);
            rememberCoverBuilderTemplateState(selectedCoverTemplateRef.current, next);
            return next;
        });
    }
    function startCoverBuilderToolbarLiveEdit(key: CoverBuilderItemKey) {
        const active = coverBuilderToolbarLiveEditRef.current;
        if (active?.key === key)
            return;
        if (active)
            finishCoverBuilderToolbarLiveEdit(active.key);
        coverBuilderToolbarLiveEditRef.current = {
            key,
            startState: cloneCoverBuilderState(coverBuilder),
            pendingPatch: {},
            frame: null,
        };
        coverBuilderEditingLiveRef.current = true;
    }
    function applyCoverBuilderToolbarRuntimeStyle(key: CoverBuilderItemKey, patch: Partial<CoverBuilderElementStyle>) {
        const element = coverBuilderPreviewRef.current?.querySelector<HTMLElement>(`[data-element-id="${key}"]`);
        const active = coverBuilderToolbarLiveEditRef.current;
        if (!element || !active)
            return;
        const style = {
            ...(active.startState.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key]),
            ...active.pendingPatch,
            ...patch,
        };
        if (typeof patch.opacity === 'number')
            element.style.opacity = String(patch.opacity / 100);
        if (typeof patch.fontSize === 'number')
            element.style.fontSize = `${patch.fontSize}px`;
        if (typeof patch.radius === 'number')
            element.style.borderRadius = `${patch.radius}px`;
        if (typeof patch.borderWidth === 'number')
            element.style.border = patch.borderWidth > 0 ? `${patch.borderWidth}px ${style.borderStyle ?? 'solid'} ${style.borderColor}` : 'none';
        if (typeof patch.bgOpacity === 'number') {
            element.style.background = style.bg === 'transparent' || patch.bgOpacity <= 0
                ? 'transparent'
                : /^#[0-9a-fA-F]{6}$/.test(style.bg)
                    ? hexToRgba(style.bg, patch.bgOpacity / 100)
                    : style.bg;
        }
    }
    function updateCoverBuilderToolbarLiveStyle(key: CoverBuilderItemKey, patch: Partial<CoverBuilderElementStyle>) {
        const active = coverBuilderToolbarLiveEditRef.current;
        if (!active || active.key !== key) {
            updateCoverBuilderItemStyle(key, patch);
            return;
        }
        active.pendingPatch = { ...active.pendingPatch, ...patch };
        if (active.frame !== null)
            return;
        active.frame = window.requestAnimationFrame(() => {
            const currentEdit = coverBuilderToolbarLiveEditRef.current;
            if (!currentEdit || currentEdit.key !== key)
                return;
            currentEdit.frame = null;
            applyCoverBuilderToolbarRuntimeStyle(key, currentEdit.pendingPatch);
        });
    }
    function finishCoverBuilderToolbarLiveEdit(key: CoverBuilderItemKey) {
        const active = coverBuilderToolbarLiveEditRef.current;
        if (!active || active.key !== key)
            return;
        coverBuilderToolbarLiveEditRef.current = null;
        if (active.frame !== null)
            window.cancelAnimationFrame(active.frame);
        coverBuilderEditingLiveRef.current = false;
        if (Object.keys(active.pendingPatch).length === 0)
            return;
        commitCoverBuilderElementStyleFromSnapshot(key, active.pendingPatch, active.startState);
        window.requestAnimationFrame(() => clearCoverBuilderRuntimeElementStyles(key));
        setCoverBuilderSaveTick(t => t + 1);
    }
    function commitCoverBuilderElementStyleFromSnapshot(key: CoverBuilderItemKey, patch: Partial<CoverBuilderElementStyle>, snapshot: CoverBuilderState) {
        const before = cloneCoverBuilderState(snapshot);
        const next = cloneCoverBuilderState(snapshot);
        next.itemStyles = {
            ...next.itemStyles,
            [key]: { ...(next.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key]), ...patch },
        };
        pushCoverBuilderHistorySnapshot(before);
        rememberCoverBuilderTemplateState(selectedCoverTemplateRef.current, next);
        setCoverBuilder(next);
    }
    function nudgeCoverBuilderItemStyle(key: CoverBuilderItemKey, field: 'z' | 'opacity' | 'fontSize' | 'radius' | 'borderWidth', delta: number, min: number, max: number) {
        updateCoverBuilderForSelectedTemplate(prev => {
            const current = prev.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
            return {
                ...prev,
                itemStyles: {
                    ...prev.itemStyles,
                    [key]: { ...current, [field]: Math.max(min, Math.min(max, current[field] + delta)) },
                },
            };
        });
    }
    function stopCoverBuilderNudge() {
        if (coverBuilderNudgeRef.current !== null) {
            window.clearInterval(coverBuilderNudgeRef.current);
            coverBuilderNudgeRef.current = null;
        }
        if (coverBuilderEditingLiveRef.current) {
            coverBuilderEditingLiveRef.current = false;
            setCoverBuilderSaveTick(t => t + 1);
        }
    }
    function startCoverBuilderNudge(action: () => void) {
        stopCoverBuilderNudge();
        coverBuilderEditingLiveRef.current = true;
        action();
        coverBuilderNudgeRef.current = window.setInterval(action, 70);
    }
    function coverBuilderElementStyle(key: CoverBuilderItemKey, state: CoverBuilderState = coverBuilder): React.CSSProperties {
        const s = state.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
        const hasCornerRadius = [s.radiusTL, s.radiusTR, s.radiusBR, s.radiusBL].some(v => typeof v === 'number');
        const bgOpacity = s.bgOpacity ?? 100;
        const isTextElement = key === 'headline' || key === 'subline' || key === 'contact';
        const horizontalFlex = s.align === 'right' ? 'flex-end' : s.align === 'center' ? 'center' : 'flex-start';
        const verticalFlex = s.valign === 'bottom' ? 'flex-end' : s.valign === 'middle' ? 'center' : 'flex-start';
        const objectX = s.align === 'right' ? '100%' : s.align === 'center' ? '50%' : '0%';
        const objectY = s.valign === 'bottom' ? '100%' : s.valign === 'middle' ? '50%' : '0%';
        const background = s.bg === 'transparent' || bgOpacity <= 0
            ? 'transparent'
            : /^#[0-9a-fA-F]{6}$/.test(s.bg)
                ? hexToRgba(s.bg, bgOpacity / 100)
                : s.bg;
        return {
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.w}%`,
            height: `${s.h}%`,
            transform: `rotate(${s.rotation ?? 0}deg)`,
            transformOrigin: 'center center',
            zIndex: s.z,
            color: s.color,
            background,
            opacity: s.opacity / 100,
            fontSize: s.fontSize,
            fontWeight: s.bold ? 900 : 500,
            fontStyle: s.italic ? 'italic' : 'normal',
            borderRadius: hasCornerRadius ? `${s.radiusTL ?? s.radius}px ${s.radiusTR ?? s.radius}px ${s.radiusBR ?? s.radius}px ${s.radiusBL ?? s.radius}px` : s.radius,
            border: s.borderWidth > 0 ? `${s.borderWidth}px ${s.borderStyle ?? 'solid'} ${s.borderColor}` : undefined,
            textAlign: s.align,
            ...({
                '--lv-cb-align-x': objectX,
                '--lv-cb-align-y': objectY,
            } as React.CSSProperties),
            ...(key === 'products' ? {} : {
                display: 'flex',
                justifyContent: isTextElement ? verticalFlex : horizontalFlex,
                alignItems: isTextElement ? horizontalFlex : verticalFlex,
                ...(isTextElement ? { flexDirection: 'column' } : {}),
            }),
            ...(key === 'headline' ? {
                '--headline-accent': state.headlineAccentColor,
                '--headline-font-family': s.fontFamily || 'Impact, Haettenschweiler, "Arial Black", sans-serif',
            } as React.CSSProperties : {}),
            ...(key === 'logo' ? {
                '--logo-image-size': `${s.imageScale ?? 82}%`,
                fontFamily: s.fontFamily,
            } as React.CSSProperties : {}),
            ...(key === 'contact' ? {
                '--contact-accent': state.contactAccentColor,
            } as React.CSSProperties : {}),
        };
    }
    function startCoverBuilderCanvasDrag(e: React.PointerEvent<HTMLElement>, key: CoverBuilderItemKey, mode: 'move' | 'resize' | 'rotate') {
        e.preventDefault();
        e.stopPropagation();
        const canvas = coverBuilderPreviewRef.current;
        if (!canvas)
            return;
        setCoverBuilderSelected(key);
        const startStyle = coverBuilder.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
        const element = (e.currentTarget.closest('.lv-cb-logo-slot, .lv-cb-text-el, .lv-cb-products, .lv-cb-contact, .lv-cb-deal-tag, .lv-cb-basket') as HTMLElement | null) ?? e.currentTarget;
        const elementRect = element.getBoundingClientRect();
        const centerX = elementRect.left + elementRect.width / 2;
        const centerY = elementRect.top + elementRect.height / 2;
        coverBuilderCanvasDragRef.current = {
            key,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI,
            startState: cloneCoverBuilderState(coverBuilder),
            startStyle: { ...startStyle },
            canvasRect: canvas.getBoundingClientRect(),
            elementRect,
            element,
            captureTarget: e.currentTarget,
            pointerId: e.pointerId,
            pendingStyle: {},
            constrainedAxis: null,
        };
        coverBuilderEditingLiveRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        coverBuilderNativeDragCleanupRef.current?.();
        const handleNativeMove = (event: PointerEvent) => moveCoverBuilderCanvasDrag(event);
        const handleNativeStop = (event: PointerEvent) => stopCoverBuilderCanvasDrag(event);
        window.addEventListener('pointermove', handleNativeMove);
        window.addEventListener('pointerup', handleNativeStop, { once: true });
        window.addEventListener('pointercancel', handleNativeStop, { once: true });
        coverBuilderNativeDragCleanupRef.current = () => {
            window.removeEventListener('pointermove', handleNativeMove);
            window.removeEventListener('pointerup', handleNativeStop);
            window.removeEventListener('pointercancel', handleNativeStop);
            coverBuilderNativeDragCleanupRef.current = null;
        };
    }
    function moveCoverBuilderCanvasDrag(e: React.PointerEvent<HTMLElement> | PointerEvent) {
        const drag = coverBuilderCanvasDragRef.current;
        if (!drag)
            return;
        e.preventDefault();
        const rawDx = ((e.clientX - drag.startX) / drag.canvasRect.width) * 100;
        const rawDy = ((e.clientY - drag.startY) / drag.canvasRect.height) * 100;
        if (drag.mode === 'rotate') {
            const rect = drag.elementRect ?? drag.element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            const startRotation = drag.startStyle.rotation ?? 0;
            const deltaAngle = currentAngle - (drag.startAngle ?? currentAngle);
            const rotation = Math.round(startRotation + deltaAngle);
            drag.pendingStyle = { rotation };
            drag.element.style.transform = `rotate(${rotation}deg)`;
            return;
        }
        if (drag.mode === 'move' && e.shiftKey) {
            const movementThreshold = 0.15;
            if (!drag.constrainedAxis && Math.max(Math.abs(rawDx), Math.abs(rawDy)) >= movementThreshold)
                drag.constrainedAxis = Math.abs(rawDx) >= Math.abs(rawDy) ? 'x' : 'y';
        }
        else {
            drag.constrainedAxis = null;
        }
        const dx = drag.constrainedAxis === 'y' ? 0 : rawDx;
        const dy = drag.constrainedAxis === 'x' ? 0 : rawDy;
        if (drag.mode === 'move') {
            const minX = drag.key === 'basket' ? -drag.startStyle.w : 0;
            const maxX = drag.key === 'basket' ? 100 : 100 - drag.startStyle.w;
            const minY = drag.key === 'basket' ? -drag.startStyle.h : 0;
            const maxY = drag.key === 'basket' ? 100 : 100 - drag.startStyle.h;
            const x = Math.max(minX, Math.min(maxX, drag.startStyle.x + dx));
            const y = Math.max(minY, Math.min(maxY, drag.startStyle.y + dy));
            drag.pendingStyle = { x, y };
            drag.element.style.left = `${x}%`;
            drag.element.style.top = `${y}%`;
        }
        else {
            const w = Math.max(4, Math.min(100 - drag.startStyle.x, drag.startStyle.w + dx));
            const h = Math.max(3, Math.min(100 - drag.startStyle.y, drag.startStyle.h + dy));
            drag.pendingStyle = { w, h };
            drag.element.style.width = `${w}%`;
            drag.element.style.height = `${h}%`;
        }
    }
    function stopCoverBuilderCanvasDrag(_e: React.PointerEvent<HTMLElement> | PointerEvent) {
        const drag = coverBuilderCanvasDragRef.current;
        if (!drag)
            return;
        coverBuilderNativeDragCleanupRef.current?.();
        coverBuilderCanvasDragRef.current = null;
        coverBuilderEditingLiveRef.current = false;
        if (Object.keys(drag.pendingStyle).length > 0) {
            commitCoverBuilderElementStyleFromSnapshot(drag.key, drag.pendingStyle, drag.startState);
            const committedKey = drag.key;
            window.requestAnimationFrame(() => clearCoverBuilderRuntimeElementStyles(committedKey));
        }
        try {
            if (drag.captureTarget.hasPointerCapture(drag.pointerId))
                drag.captureTarget.releasePointerCapture(drag.pointerId);
        }
        catch { }
        setCoverBuilderSaveTick(t => t + 1);
    }
    function coverBuilderDragHandlers(key: CoverBuilderItemKey) {
        return {
            onPointerDown: (e: React.PointerEvent<HTMLElement>) => startCoverBuilderCanvasDrag(e, key, 'move'),
        };
    }
    function coverBuilderRenderTemplateId() {
        return selectedCoverTemplateId || 'unselected-template';
    }
    function coverBuilderElementRenderKey(elementId: CoverBuilderItemKey | 'surface', scope = '') {
        return `${coverBuilderRenderTemplateId()}-${scope ? `${scope}-` : ''}${elementId}`;
    }
    function CoverBuilderDeleteButton({ itemKey }: {
        itemKey: CoverBuilderItemKey;
    }) {
        return (<button type="button" className="lv-cb-element-delete" aria-label={`Delete ${itemKey}`} onPointerDown={e => e.stopPropagation()} onClick={e => {
                e.stopPropagation();
                toggleCoverBuilderItem(itemKey);
                clearCoverBuilderSelection(null);
            }}>
        x
      </button>);
    }
    function renderCoverBuilderFloatingToolbar(itemKey: CoverBuilderItemKey, toolbarStyle?: React.CSSProperties, toolbarClassName = '') {
        const style = coverBuilder.itemStyles[itemKey] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[itemKey];
        const isText = itemKey === 'headline' || itemKey === 'subline' || itemKey === 'contact';
        const isProducts = itemKey === 'products';
        const button = (label: string, title: string, onClick: () => void, active = false) => (<button type="button" className={active ? 'active' : ''} title={title} aria-label={title} onPointerDown={e => e.stopPropagation()} onClick={e => {
                e.stopPropagation();
                onClick();
            }}>
        {label}
      </button>);
        const miniRange = (field: keyof CoverBuilderElementStyle, label: string, min: number, max: number, step = 1, unit = '') => {
            const raw = style[field];
            const value = typeof raw === 'number' ? raw : 0;
            return (<label className="lv-cb-toolbar-field lv-cb-toolbar-field--range">
          <span>{label}</span>
          <input type="range" min={min} max={max} step={step} value={value} onPointerDown={() => startCoverBuilderToolbarLiveEdit(itemKey)} onChange={e => {
                    const nextValue = Number(e.target.value);
                    const output = e.currentTarget.nextElementSibling;
                    if (output)
                        output.textContent = `${Number(nextValue.toFixed(1))}${unit}`;
                    updateCoverBuilderToolbarLiveStyle(itemKey, { [field]: nextValue } as Partial<CoverBuilderElementStyle>);
                }} onPointerUp={() => finishCoverBuilderToolbarLiveEdit(itemKey)} onPointerCancel={() => finishCoverBuilderToolbarLiveEdit(itemKey)} onLostPointerCapture={() => finishCoverBuilderToolbarLiveEdit(itemKey)} onBlur={() => finishCoverBuilderToolbarLiveEdit(itemKey)}/>
          <em>{Number(value.toFixed(1))}{unit}</em>
        </label>);
        };
        const miniColor = (field: 'color' | 'bg' | 'borderColor', label: string, fallback = '#ffffff') => (<div className="lv-cb-toolbar-field lv-cb-toolbar-field--color">
        <span>{label}</span>
        <ColorSwatch value={field === 'bg' && style.bg === 'transparent' ? fallback : String(style[field] || fallback)} onChange={v => updateCoverBuilderItemStyle(itemKey, { [field]: v } as Partial<CoverBuilderElementStyle>)}/>
      </div>);
        const miniSegment = <T extends string>(label: string, current: T | undefined, options: { value: T; icon: string; title: string }[], onPick: (value: T) => void) => (<div className="lv-cb-toolbar-field">
        <span>{label}</span>
        <div className="lv-cb-toolbar-segment">
          {options.map(option => (<button key={option.value} type="button" className={current === option.value ? 'active' : ''} title={option.title} aria-label={option.title} onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    onPick(option.value);
                }}>{option.icon}</button>))}
        </div>
      </div>);
        const group = (groupKey: string, label: string, icon: string, children: React.ReactNode, className = '') => {
            const openKey = `${itemKey}:${groupKey}`;
            const open = coverBuilderToolbarOpenGroup === openKey;
            const menuPosition = coverBuilderToolbarMenuPosition?.openKey === openKey ? coverBuilderToolbarMenuPosition : null;
            const portalMenu = open && typeof document !== 'undefined' ? ReactDOM.createPortal(<div
              className={cx('lv-cb-toolbar-menu', 'lv-cb-toolbar-menu--portal', className.includes('lv-cb-toolbar-group--panel') ? 'lv-cb-toolbar-menu--panel' : '', className.includes('lv-cb-toolbar-group--wide-menu') ? 'lv-cb-toolbar-menu--wide' : '', menuPosition?.placement === 'left' ? 'lv-cb-toolbar-menu--left' : 'lv-cb-toolbar-menu--right')}
              data-toolbar-menu-key={openKey}
              role="menu"
              aria-label={label}
              style={{
                    position: 'fixed',
                    left: menuPosition?.left ?? 0,
                    top: menuPosition?.top ?? 0,
                    maxHeight: menuPosition?.maxHeight ?? 460,
                    visibility: menuPosition?.ready ? 'visible' : 'hidden',
                    '--lv-cb-menu-arrow-top': `${menuPosition?.arrowTop ?? 20}px`,
                } as React.CSSProperties}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}>
              <div className="lv-cb-toolbar-menu-title">{label}</div>
              {children}
            </div>, document.body) : null;
            return (<div className={`lv-cb-toolbar-group ${className}${open ? ' open' : ''}`} aria-label={label}>
          <button type="button" className="lv-cb-toolbar-group-trigger" data-toolbar-group-key={openKey} title={label} aria-label={label} aria-expanded={open} onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    setCoverBuilderToolbarOpenGroup(open ? null : openKey);
                }}>
            <span className="material-symbol" aria-hidden="true">{icon}</span>
            <span className="lv-cb-toolbar-group-caret material-symbol" aria-hidden="true">expand_more</span>
          </button>
          {portalMenu}
        </div>);
        };
        const runAndClose = (action: () => void) => {
            action();
            setCoverBuilderToolbarOpenGroup(null);
        };
        const applyTextCase = (mode: 'upper' | 'lower' | 'capitalized' | 'sentence') => {
            if (!isText)
                return;
            const textKey = itemKey as 'headline' | 'subline' | 'contact';
            const toCapitalized = (text: string) => text.toLowerCase().replace(/\b([\p{L}\p{N}])/gu, letter => letter.toUpperCase());
            const toSentence = (text: string) => text
                .toLowerCase()
                .replace(/(^|[.!?]\s+)([\p{L}\p{N}])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
            updateCoverBuilderForSelectedTemplate(prev => {
                const currentText = String(prev[textKey] || '');
                const nextText = mode === 'upper'
                    ? currentText.toUpperCase()
                    : mode === 'lower'
                        ? currentText.toLowerCase()
                        : mode === 'capitalized'
                            ? toCapitalized(currentText)
                            : toSentence(currentText);
                return { ...prev, [textKey]: nextText };
            });
        };
        return (<div className={cx("lv-cb-floating-toolbar", toolbarClassName)} style={toolbarStyle} role="toolbar" aria-label={`${itemKey} quick tools`} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button type="button" className={cx("lv-cb-toolbar-history-btn", coverBuilderHistoryCounts.past === 0 ? 'is-inactive' : '')} title="Undo" aria-label="Undo" aria-disabled={coverBuilderHistoryCounts.past === 0} onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    undoCoverBuilderChange();
                }}>
          undo
        </button>
        <button type="button" className={cx("lv-cb-toolbar-history-btn", coverBuilderHistoryCounts.future === 0 ? 'is-inactive' : '')} title="Redo" aria-label="Redo" aria-disabled={coverBuilderHistoryCounts.future === 0} onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    redoCoverBuilderChange();
                }}>
          redo
        </button>
        {group('layer', 'Layer', 'layers', <>
          {button('arrow_upward', 'Bring forward', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { z: Math.min(20, style.z + 1) })))}
          {button('arrow_downward', 'Send backward', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { z: Math.max(1, style.z - 1) })))}
        </>)}
        {group('opacity', 'Opacity', 'opacity', <div className="lv-cb-toolbar-panel-stack">
          {miniRange('opacity', 'Opacity', 0, 100, 1, '%')}
        </div>, 'lv-cb-toolbar-group--panel')}
        {(isText || isProducts) && group('align', 'Horizontal alignment', 'format_align_center', <>
          {button('format_align_left', 'Align left', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { align: 'left' })), style.align === 'left')}
          {button('format_align_center', 'Align center', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { align: 'center' })), style.align === 'center')}
          {button('format_align_right', 'Align right', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { align: 'right' })), style.align === 'right')}
        </>, 'lv-cb-toolbar-group--wide-menu')}
        {itemKey === 'headline' && (<>
          <button type="button" className="lv-cb-toolbar-symbol-action" title="AI headline style" aria-label="AI headline style" onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    generateCoverAiHeadlineStyle();
                }}>
            auto_awesome
          </button>
          {coverBuilder.headlineAiStyle && (<button type="button" className="lv-cb-toolbar-symbol-action" title="Clear style" aria-label="Clear style" onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    updateCoverBuilderForSelectedTemplate(prev => ({ ...prev, headlineAiStyle: '' }));
                }}>
            format_clear
          </button>)}
        </>)}
        {itemKey === 'contact' && (<>
          <button type="button" className="lv-cb-toolbar-symbol-action" title="AI contact style" aria-label="AI contact style" onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    generateCoverAiContactStyle();
                }}>
            auto_awesome
          </button>
          {coverBuilder.contactAiStyle && (<button type="button" className="lv-cb-toolbar-symbol-action" title="Clear contact style" aria-label="Clear contact style" onPointerDown={e => e.stopPropagation()} onClick={e => {
                    e.stopPropagation();
                    updateCoverBuilderForSelectedTemplate(prev => ({ ...prev, contactAiStyle: '' }));
                }}>
            format_clear
          </button>)}
        </>)}
        {(isText || isProducts) && group('valign', 'Vertical alignment', 'vertical_align_center', <>
          {button('vertical_align_top', 'Vertical align top', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { valign: 'top' })), (style.valign ?? 'top') === 'top')}
          {button('vertical_align_center', 'Vertical align middle', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { valign: 'middle' })), style.valign === 'middle')}
          {button('vertical_align_bottom', 'Vertical align bottom', () => runAndClose(() => updateCoverBuilderItemStyle(itemKey, { valign: 'bottom' })), style.valign === 'bottom')}
        </>, 'lv-cb-toolbar-group--wide-menu')}
        {isText && group('typography-panel', 'Typography', 'text_fields', <div className="lv-cb-toolbar-panel-stack">
          {miniRange('fontSize', 'Font size', 8, 120, 1, 'px')}
          <div className="lv-cb-toolbar-segment lv-cb-toolbar-style-segment">
            {button('format_bold', 'Bold', () => updateCoverBuilderItemStyle(itemKey, { bold: !style.bold }), style.bold)}
            {button('format_italic', 'Italic', () => updateCoverBuilderItemStyle(itemKey, { italic: !style.italic }), style.italic)}
          </div>
          <div className="lv-cb-toolbar-segment lv-cb-toolbar-case-segment" aria-label="Text case">
            {button('text_fields', 'Upper case', () => applyTextCase('upper'))}
            {button('match_case', 'Lower case', () => applyTextCase('lower'))}
            {button('title', 'Capitalized case', () => applyTextCase('capitalized'))}
            {button('notes', 'Sentence case', () => applyTextCase('sentence'))}
          </div>
          {miniSegment('Align', style.align, [
                    { value: 'left', icon: 'format_align_left', title: 'Align left' },
                    { value: 'center', icon: 'format_align_center', title: 'Align center' },
                    { value: 'right', icon: 'format_align_right', title: 'Align right' },
                ], value => updateCoverBuilderItemStyle(itemKey, { align: value }))}
          {miniSegment('Vertical', style.valign ?? 'top', [
                    { value: 'top', icon: 'vertical_align_top', title: 'Align top' },
                    { value: 'middle', icon: 'vertical_align_center', title: 'Align middle' },
                    { value: 'bottom', icon: 'vertical_align_bottom', title: 'Align bottom' },
                ], value => updateCoverBuilderItemStyle(itemKey, { valign: value }))}
          {miniColor('color', 'Text color', '#ffffff')}
        </div>, 'lv-cb-toolbar-group--panel')}
        {group('background-panel', 'Background', 'format_color_fill', <div className="lv-cb-toolbar-panel-stack">
          {miniColor('bg', 'Color', '#ffffff')}
          {miniRange('bgOpacity', 'Opacity', 0, 100, 1, '%')}
          <button type="button" className="lv-cb-toolbar-text-btn" onClick={e => {
                    e.stopPropagation();
                    updateCoverBuilderItemStyle(itemKey, { bg: 'transparent', bgOpacity: 0 });
                }}>Transparent</button>
        </div>, 'lv-cb-toolbar-group--panel')}
        {group('border-panel', 'Border', 'border_outer', <div className="lv-cb-toolbar-panel-stack">
          {miniRange('borderWidth', 'Width', 0, 12, 1, 'px')}
          {miniSegment('Style', style.borderStyle ?? 'solid', [
                    { value: 'solid', icon: 'horizontal_rule', title: 'Solid' },
                    { value: 'dashed', icon: 'more_horiz', title: 'Dashed' },
                    { value: 'dotted', icon: 'blur_linear', title: 'Dotted' },
                    { value: 'double', icon: 'drag_handle', title: 'Double' },
                ], value => updateCoverBuilderItemStyle(itemKey, { borderStyle: value }))}
          {miniColor('borderColor', 'Color', '#ffffff')}
          {miniRange('radius', 'Radius', 0, 80, 1, 'px')}
        </div>, 'lv-cb-toolbar-group--panel')}
        {itemKey === 'logo' && group('content-panel', 'Logo', 'image', <div className="lv-cb-toolbar-panel-stack">
          <>
            <label className="lv-cb-toolbar-text-btn">
              Upload logo
              <input type="file" accept="image/*" className={cssClass({ display: 'none' })} onChange={e => void readCoverBuilderImage(e.target.files?.[0] || null, 'logo')}/>
            </label>
            {coverBuilder.logo && <button type="button" className="lv-cb-toolbar-text-btn" onClick={e => {
                        e.stopPropagation();
                        setCoverBuilderValue('logo', '');
                    }}>Remove logo</button>}
          </>
        </div>, 'lv-cb-toolbar-group--panel')}
        <button type="button" className="lv-cb-toolbar-delete" title={`Delete ${itemKey}`} aria-label={`Delete ${itemKey}`} onPointerDown={e => e.stopPropagation()} onClick={e => {
                e.stopPropagation();
                toggleCoverBuilderItem(itemKey);
                clearCoverBuilderSelection(null);
                setCoverBuilderToolbarOpenGroup(null);
            }}>delete</button>
      </div>);
    }
    function toggleCoverBuilderSection(sectionId: string) {
        setCoverBuilderCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    }
    function renderCoverBuilderSection(sectionId: string, title: string, children: React.ReactNode, className = '') {
        const collapsed = !!coverBuilderCollapsedSections[sectionId];
        return (<div className={`lv-cb-tool-section ${className}${collapsed ? ' collapsed' : ''}`}>
        <button type="button" className="lv-cb-section-head" onClick={() => toggleCoverBuilderSection(sectionId)} aria-expanded={!collapsed}>
          <h3>{title}</h3>
          <span className="material-symbol" aria-hidden="true">expand_more</span>
        </button>
        {!collapsed && <div className="lv-cb-section-body">{children}</div>}
      </div>);
    }
    function renderCoverBuilderAddElementButton(key: CoverBuilderItemKey) {
        const visible = coverBuilder.visibleItems[key];
        const label = key === 'products' ? 'Products' : key === 'dealTag' ? 'Deal tag' : key.charAt(0).toUpperCase() + key.slice(1);
        const toggleVisibility = (e: React.MouseEvent<HTMLSpanElement> | React.KeyboardEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            toggleCoverBuilderItem(key);
        };
        return (<button key={key} type="button" className={`lv-cb-tool-btn lv-cb-add-element-btn${!visible ? ' hidden-elem' : ''}`} onClick={() => addCoverBuilderElement(key)}>
          <span className="lc-epi-label">{label}</span>
          <span role="button" tabIndex={0} className={`lc-epi-eye${visible ? ' vis' : ' invis'}`} title={visible ? 'Hide element' : 'Show element'} onClick={toggleVisibility} onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleVisibility(e);
                }
            }}>
            {visible ? <CoverEyeOn /> : <CoverEyeOff />}
          </span>
        </button>);
    }
    function renderCoverProductLayoutControls() {
        const coverLayoutNumberTabs = [1, 2, 3, 4, 5, 6];
        return (<>
        <div className="lv-cb-layout-field">
          <label>Cards per row</label>
          <div className="lv-cb-segmented">
            {coverLayoutNumberTabs.map(n => (<button key={n} type="button" className={colsPerPage === n ? 'active' : ''} onClick={() => setColsPerPage(n)}>{n}</button>))}
          </div>
        </div>
        <div className="lv-cb-layout-field">
          <label>Cards per column</label>
          <div className="lv-cb-segmented">
            {coverLayoutNumberTabs.map(n => (<button key={n} type="button" className={rowsPerPage === n ? 'active' : ''} onClick={() => setRowsPerPage(n)}>{n}</button>))}
          </div>
        </div>
        <div className="lv-cb-layout-field">
          <label>Horizontal space</label>
          <div className="lv-cb-layout-slider">
            <input type="range" min={0} max={48} value={pageSettings.colGap} onChange={e => setPg('colGap', +e.target.value)}/>
            <span>{pageSettings.colGap}px</span>
          </div>
        </div>
        <div className="lv-cb-layout-field">
          <label>Vertical space</label>
          <div className="lv-cb-layout-slider">
            <input type="range" min={0} max={48} value={pageSettings.rowGap} onChange={e => setPg('rowGap', +e.target.value)}/>
            <span>{pageSettings.rowGap}px</span>
          </div>
        </div>
        <div className="lv-cb-layout-field">
          <label>Orientation</label>
          <div className="lv-cb-segmented lv-cb-orientation-tabs">
            <button type="button" className={pageSettings.orientation === 'portrait' ? 'active' : ''} onClick={() => setPageOrientation('portrait')}>Portrait</button>
            <button type="button" className={pageSettings.orientation === 'landscape' ? 'active' : ''} onClick={() => setPageOrientation('landscape')}>Landscape</button>
          </div>
        </div>
        <div className="lv-cb-layout-field">
          <label>Grid width</label>
          <div className="lv-cb-layout-slider">
            <input type="range" min={10} max={100} value={pageSettings.gridWidthPct} onChange={e => setPg('gridWidthPct', +e.target.value)}/>
            <span>{pageSettings.gridWidthPct}%</span>
          </div>
        </div>
      </>);
    }
    async function readCoverBuilderImage(file: File | null, key: 'logo' | 'bgImage') {
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            setNanoError('Import an image file.');
            return;
        }
        const dataUrl = await blobToDataUrl(file);
        if (key === 'logo') {
            updateCoverBuilderForSelectedTemplate(prev => ({
                ...prev,
                logo: dataUrl,
                visibleItems: { ...prev.visibleItems, logo: true },
            }));
            setCoverBuilderSelected('logo');
            setNanoError(null);
            return;
        }
        setCoverBuilderValue(key, dataUrl);
        setCoverBuilderValue('bgType', 'image');
        setNanoError(null);
    }
    async function readCoverBuilderAssetImage(file: File | null, key: 'dealTagUrl' | 'basketUrl') {
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            setNanoError('Import an image file.');
            return;
        }
        const dataUrl = await blobToDataUrl(file);
        const itemKey: CoverBuilderItemKey = key === 'dealTagUrl' ? 'dealTag' : 'basket';
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            [key]: dataUrl,
            visibleItems: { ...prev.visibleItems, [itemKey]: true },
        }));
        setCoverBuilderSelected(itemKey);
        setNanoError(null);
    }
    function handleCoverBuilderAssetDrop(e: React.DragEvent<HTMLElement>, key: 'dealTagUrl' | 'basketUrl') {
        e.preventDefault();
        void readCoverBuilderAssetImage(e.dataTransfer.files?.[0] || null, key);
    }
    function handleCoverBuilderAssetPaste(e: React.ClipboardEvent<HTMLElement>, key: 'dealTagUrl' | 'basketUrl') {
        const imageItem = Array.from(e.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
        const file = imageItem?.getAsFile();
        if (!file)
            return;
        e.preventDefault();
        void readCoverBuilderAssetImage(file, key);
    }
    function selectCoverBuilderDealTag(url: string) {
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            dealTagUrl: url,
            visibleItems: { ...prev.visibleItems, dealTag: true },
        }));
        setCoverBuilderDealTagUsage(previous => {
            const next = { ...previous, [url]: (previous[url] || 0) + 1 };
            localStorage.setItem(DEAL_TAG_USAGE_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }
    function selectCoverBuilderBasket(url: string) {
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            basketUrl: url,
            visibleItems: { ...prev.visibleItems, basket: true },
        }));
        setCoverBuilderBasketUsage(previous => {
            const next = { ...previous, [url]: (previous[url] || 0) + 1 };
            localStorage.setItem(BASKET_USAGE_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }
    function selectCoverBuilderBackground(url: string, aiGenerated = false) {
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            bgType: 'image',
            bgImage: url,
            aiGeneratedBg: aiGenerated,
            aiGradientCss: '',
        }));
        setCoverBuilderBackgroundUsage(previous => {
            const next = { ...previous, [url]: (previous[url] || 0) + 1 };
            localStorage.setItem(BACKGROUND_USAGE_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }
    async function confirmDeleteCoverBuilderDealTag() {
        const tag = coverDealTagDeleteTarget;
        if (!coverBuilderOnly || deletingCoverDealTagKey || !tag)
            return;
        setDeletingCoverDealTagKey(tag.key);
        setNanoError(null);
        try {
            const result = await deleteAdminDealTag(tag.key);
            setDeletedCoverDealTagKeys(result.deleted_deal_tags || []);
            setCoverDealTagDeleteTarget(null);
            setCoverBuilderDealTagUsage(previous => {
                const next = { ...previous };
                delete next[tag.url];
                localStorage.setItem(DEAL_TAG_USAGE_STORAGE_KEY, JSON.stringify(next));
                return next;
            });
        }
        catch (error) {
            setNanoError(error instanceof Error ? error.message : 'Could not delete the deal tag.');
        }
        finally {
            setDeletingCoverDealTagKey(null);
        }
    }
    function handleCoverBuilderLogoDrop(e: React.DragEvent<HTMLElement>) {
        e.preventDefault();
        e.stopPropagation();
        void readCoverBuilderImage(Array.from(e.dataTransfer.files || []).find(file => file.type.startsWith('image/')) || null, 'logo');
    }
    function handleCoverBuilderLogoPaste(e: React.ClipboardEvent<HTMLElement>) {
        const file = Array.from(e.clipboardData?.files || []).find(item => item.type.startsWith('image/'))
            || Array.from(e.clipboardData?.items || [])
                .find(item => item.type.startsWith('image/'))
                ?.getAsFile();
        if (!file)
            return;
        e.preventDefault();
        e.stopPropagation();
        void readCoverBuilderImage(file, 'logo');
    }
    function handleCoverBuilderBgDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        void readCoverBuilderImage(e.dataTransfer.files?.[0] || null, 'bgImage');
    }
    async function useCoverBuilderCover() {
        setNanoError(null);
        const savedBuilder = cloneCoverBuilderState(coverBuilder);
        if (coverBuilderTarget === 'back') {
            setBackCoverBuilder(savedBuilder);
            setBackPage({ image: '', show: true, builder: true });
            setCurrentPage(pages.length);
        }
        else {
            setFrontCoverBuilder(savedBuilder);
            setCoverPage({ image: '', show: true, builder: true });
            setCurrentPage(-1);
        }
        setCoverBuilderOpen(false);
    }
    function openCoverBuilderForTarget(target: 'front' | 'back') {
        setCoverBuilderTarget(target);
        setCoverBuilder(cloneCoverBuilderState(target === 'back' ? backCoverBuilder : frontCoverBuilder));
        clearCoverBuilderSelection('background');
        setCoverBuilderOpen(true);
    }
    function resetCoverBuilderToDefault() {
        updateCoverBuilderForSelectedTemplate(DEFAULT_COVER_BUILDER);
        clearCoverBuilderSelection(null);
        setCoverBuilderNotice('Cover reset to default.');
        window.setTimeout(() => setCoverBuilderNotice(null), 1800);
    }
    function saveCoverBuilderAsTemplate() {
        void addCoverBuilderTemplate();
    }
    function renderCoverBuilderFooter() {
        const templateLabel = coverBuilderAddingTemplate ? 'Saving...' : 'Save as template';
        return (<div className="lc-footer lv-cb-footer">
          {nanoError && <span className="lc-save-err">warning {nanoError}</span>}
          <button type="button" className="btn ghost lc-reset-btn" onClick={resetCoverBuilderToDefault}>Reset all to default</button>
          <button type="button" className="btn ghost lv-cb-footer-template-btn" onClick={saveCoverBuilderAsTemplate} disabled={coverBuilderAddingTemplate}>
            {templateLabel}
          </button>
          <button type="button" className="btn ghost" onClick={() => setCoverBuilderOpen(false)}>Cancel</button>
          <button type="button" className="btn primary" onClick={() => void useCoverBuilderCover()}>Save changes</button>
        </div>);
    }
    function renderCoverBuilderProperties() {
        const trendingDealTags = [...availableCoverDealTags]
            .sort((first, second) => (coverBuilderDealTagUsage[second.url] || 0) - (coverBuilderDealTagUsage[first.url] || 0))
            .slice(0, 4);
        const trendingBaskets = [...COVER_BASKETS]
            .sort((first, second) => (coverBuilderBasketUsage[second.url] || 0) - (coverBuilderBasketUsage[first.url] || 0))
            .slice(0, 4);
        const allCoverBackgrounds = [...generatedCoverBackgrounds, ...COVER_BACKGROUNDS.map(background => ({ ...background, generated: false as const, prompt: '' }))];
        const trendingBackgrounds = [...allCoverBackgrounds]
            .sort((first, second) => (coverBuilderBackgroundUsage[second.url] || 0) - (coverBuilderBackgroundUsage[first.url] || 0))
            .slice(0, 4);
        const librarySearch = coverBuilderLibrarySearch.trim().toLowerCase();
        const matchesLibrarySearch = (item: { key: string; name: string }) => !librarySearch
            || item.name.toLowerCase().includes(librarySearch)
            || item.key.toLowerCase().includes(librarySearch);
        const filteredDealTags = availableCoverDealTags.filter(matchesLibrarySearch);
        const filteredBaskets = COVER_BASKETS.filter(matchesLibrarySearch);
        const filteredBackgrounds = allCoverBackgrounds.filter(matchesLibrarySearch);
        if (coverBuilderSelected === 'dealTag' && coverBuilderDealTagLibraryOpen) {
            return (<div className="lv-cb-deal-tag-library-view" id="lv-cb-deal-tag-library">
              <div className="lv-cb-deal-tag-library-copy">
                <strong>Choose a deal tag</strong>
                <span>Select images to preview them. Click the back arrow above when you are finished.</span>
              </div>
              <label className="lv-cb-library-search">
                <span className="material-symbol" aria-hidden="true">search</span>
                <input value={coverBuilderLibrarySearch} onChange={e => setCoverBuilderLibrarySearch(e.target.value)} placeholder="Search deal tags" aria-label="Search deal tags"/>
              </label>
              <div className="lv-cb-deal-tag-grid lv-cb-deal-tag-grid--library">
                {filteredDealTags.map(tag => (<div key={tag.key} className="lv-cb-deal-tag-library-card">
                  <button type="button" className={coverBuilder.dealTagUrl === tag.url ? 'active' : ''} onClick={() => selectCoverBuilderDealTag(tag.url)} title={tag.name} aria-label={`Use ${tag.name}`}>
                    <img src={tag.url} alt={tag.name}/>
                    <span>{tag.name}</span>
                  </button>
                  {coverBuilderOnly && (<button type="button" className="lv-cb-deal-tag-delete material-symbol" onClick={() => setCoverDealTagDeleteTarget(tag)} disabled={deletingCoverDealTagKey === tag.key} title={`Delete ${tag.name}`} aria-label={`Delete ${tag.name}`}>
                    {deletingCoverDealTagKey === tag.key ? 'hourglass_top' : 'delete'}
                  </button>)}
                </div>))}
                {availableCoverDealTags.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No deal tags are available.</div>)}
                {availableCoverDealTags.length > 0 && filteredDealTags.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No deal tags match your search.</div>)}
              </div>
            </div>);
        }
        if (coverBuilderSelected === 'basket' && coverBuilderBasketLibraryOpen) {
            return (<div className="lv-cb-deal-tag-library-view" id="lv-cb-basket-library">
              <div className="lv-cb-deal-tag-library-copy">
                <strong>Choose a basket</strong>
                <span>Select images to preview them. Click the back arrow above when you are finished.</span>
              </div>
              <label className="lv-cb-library-search">
                <span className="material-symbol" aria-hidden="true">search</span>
                <input value={coverBuilderLibrarySearch} onChange={e => setCoverBuilderLibrarySearch(e.target.value)} placeholder="Search baskets" aria-label="Search baskets"/>
              </label>
              <div className="lv-cb-deal-tag-grid lv-cb-deal-tag-grid--library lv-cb-basket-grid--library">
                {filteredBaskets.map(basket => (<div key={basket.key} className="lv-cb-deal-tag-library-card lv-cb-basket-library-card">
                  <button type="button" className={coverBuilder.basketUrl === basket.url ? 'active' : ''} onClick={() => selectCoverBuilderBasket(basket.url)} title={basket.name} aria-label={`Use ${basket.name}`}>
                    <img src={basket.url} alt={basket.name}/>
                    <span>{basket.name}</span>
                  </button>
                </div>))}
                {COVER_BASKETS.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No baskets are available.</div>)}
                {COVER_BASKETS.length > 0 && filteredBaskets.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No baskets match your search.</div>)}
              </div>
            </div>);
        }
        if (coverBuilderSelected === 'background' && coverBuilderBackgroundLibraryOpen) {
            return (<div className="lv-cb-deal-tag-library-view" id="lv-cb-background-library">
              <div className="lv-cb-deal-tag-library-copy">
                <strong>Choose a background</strong>
                <span>Select images to preview them. Click the back arrow above when you are finished.</span>
              </div>
              <label className="lv-cb-library-search">
                <span className="material-symbol" aria-hidden="true">search</span>
                <input value={coverBuilderLibrarySearch} onChange={e => setCoverBuilderLibrarySearch(e.target.value)} placeholder="Search backgrounds" aria-label="Search backgrounds"/>
              </label>
              <div className="lv-cb-deal-tag-grid lv-cb-deal-tag-grid--library lv-cb-background-grid--library">
                {filteredBackgrounds.map(background => (<div key={background.key} className="lv-cb-deal-tag-library-card lv-cb-background-library-card">
                  <button type="button" className={coverBuilder.bgType === 'image' && coverBuilder.bgImage === background.url ? 'active' : ''} onClick={() => selectCoverBuilderBackground(background.url, background.generated)} title={background.name} aria-label={`Use ${background.name}`}>
                    <img src={background.url} alt={background.name}/>
                    <span>{background.name}</span>
                  </button>
                  {background.generated && (<button type="button" className="lv-cb-deal-tag-delete material-symbol" onClick={() => deleteGeneratedCoverBackground(background.key)} title={`Delete ${background.name}`} aria-label={`Delete ${background.name}`}>
                    delete
                  </button>)}
                </div>))}
                {allCoverBackgrounds.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No backgrounds are available.</div>)}
                {allCoverBackgrounds.length > 0 && filteredBackgrounds.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No backgrounds match your search.</div>)}
              </div>
            </div>);
        }
        if (!coverBuilderSelected) {
            return (<div className="lv-cb-empty-properties">
          <strong>Select an element on the canvas</strong>
          <p>Click the logo, headline, subline, basket, deal tag, products, contact info, or background to edit its properties.</p>
        </div>);
        }
        if (coverBuilderSelected === 'background') {
            return (<div className="lv-cb-section-body lv-cb-section-body--background">
            <div className="lv-cb-bg-editor">
            <div className="lv-cb-properties-tabs lv-cb-properties-tabs--background" role="tablist" aria-label="Background properties">
              <button type="button" role="tab" aria-selected={coverBuilderBackgroundTab === 'aiImage'} className={coverBuilderBackgroundTab === 'aiImage' ? 'active' : ''} onClick={() => setCoverBuilderBackgroundTab('aiImage')}>
                <span className="material-symbol" aria-hidden="true">auto_awesome</span>
                <strong>AI image</strong>
              </button>
              <button type="button" role="tab" aria-selected={coverBuilderBackgroundTab === 'aiColor'} className={coverBuilderBackgroundTab === 'aiColor' ? 'active' : ''} onClick={() => setCoverBuilderBackgroundTab('aiColor')}>
                <span className="material-symbol" aria-hidden="true">palette</span>
                <strong>AI color</strong>
              </button>
              <button type="button" role="tab" aria-selected={coverBuilderBackgroundTab === 'library'} className={coverBuilderBackgroundTab === 'library' ? 'active' : ''} onClick={() => setCoverBuilderBackgroundTab('library')}>
                <span className="material-symbol" aria-hidden="true">wallpaper</span>
                <strong>Library</strong>
              </button>
            </div>
            {coverBuilderBackgroundTab === 'aiImage' && (<div className="lv-cb-bg-tab-panel lv-cb-bg-tab-panel--ai-image" role="tabpanel">
              {nanoA4Enabled && (<div className="lv-nano-a4 lv-nano-a4--background">
                <div className="lv-nano-chat-tools">
                  <button type="button" className="lv-nano-tool-btn" onClick={startNewNanoChat} aria-label="New chat" title="New chat">
                    <span className="material-symbol" aria-hidden="true">edit_square</span>
                  </button>
                  <button type="button" className={nanoRecentChatsOpen ? 'lv-nano-tool-btn active' : 'lv-nano-tool-btn'} onClick={() => {
                        setNanoRecentChatsOpen(open => !open);
                        setNanoSettingsOpen(false);
                    }} aria-label="Recent chats" title="Recent chats">
                    <span className="material-symbol" aria-hidden="true">history</span>
                  </button>
                  <button type="button" className={nanoSettingsOpen ? 'lv-nano-tool-btn active' : 'lv-nano-tool-btn'} onClick={() => {
                        setNanoSettingsOpen(open => !open);
                        setNanoRecentChatsOpen(false);
                    }} aria-label="Settings" title="Settings">
                    <span className="material-symbol" aria-hidden="true">settings</span>
                  </button>
                </div>
                {nanoRecentChatsOpen && (<div className="lv-nano-popover lv-nano-recent-chats">
                  {generatedCoverBackgrounds.length > 0 ? generatedCoverBackgrounds.slice(0, 8).map(background => (<button key={background.key} type="button" onClick={() => openRecentNanoChat(background)}>
                    <span className="material-symbol" aria-hidden="true">chat_bubble</span>
                    <strong>{background.prompt || background.name}</strong>
                  </button>)) : (<span>No recent chats yet</span>)}
                </div>)}
                {nanoSettingsOpen && (<div className="lv-nano-popover">
                  <div className="lv-nano-resolution" role="group" aria-label="AI background A4 size">
                    <button type="button" className={pageSettings.orientation === 'portrait' ? 'active' : ''} onClick={() => setPageOrientation('portrait')}>
                      <span className="material-symbol" aria-hidden="true">crop_portrait</span>
                      <span>A4 Portrait</span>
                    </button>
                    <button type="button" className={pageSettings.orientation === 'landscape' ? 'active' : ''} onClick={() => setPageOrientation('landscape')}>
                      <span className="material-symbol" aria-hidden="true">crop_landscape</span>
                      <span>A4 Landscape</span>
                    </button>
                  </div>
                </div>)}
                {nanoConversation.length === 0 && (<div className="lv-nano-templates">
                  {A4_NANO_TEMPLATE_PROMPTS.map(template => (<button key={template.label} type="button" onClick={() => setNanoPrompt(template.prompt)}>
                    {template.label}
                  </button>))}
                </div>)}
                {nanoConversation.length > 0 && (<div className="lv-nano-conversation" aria-live="polite">
                  {nanoConversation.map(message => (<div key={message.id} className={cx("lv-nano-message-row", message.role === 'user' ? 'lv-nano-message-row--user' : 'lv-nano-message-row--ai')}>
                    {message.role === 'ai' && (<span className="lv-nano-message-avatar material-symbol" aria-hidden="true">auto_awesome</span>)}
                    <div className={cx("lv-nano-message", `lv-nano-message--${message.role}`, message.status === 'loading' ? 'lv-nano-message--loading' : '', message.status === 'error' ? 'lv-nano-message--error' : '')}>
                      <span>{message.text}</span>
                    </div>
                  </div>))}
                  <div ref={nanoConversationBottomRef}/>
                </div>)}
                <div className="lv-nano-prompt-wrap">
                  <textarea className="lv-nano-prompt" value={nanoPrompt} onChange={e => setNanoPrompt(e.target.value.slice(0, 4000))} onPaste={handleNanoPromptPaste} rows={4} placeholder="Describe the background style, colors, product mood, and empty areas. Do not ask for text."/>
                  <input ref={nanoReferenceInputRef} className="lv-nano-reference-input" type="file" accept="image/*" multiple onChange={e => void handleNanoReferenceUpload(e.target.files)}/>
                  <div className="lv-nano-chatbot-actions">
                    <button type="button" className="lv-nano-reference-add" onClick={() => nanoReferenceInputRef.current?.click()} disabled={nanoGenerating} aria-label="Reference image" title="Reference image">
                      <span className="material-symbol" aria-hidden="true">add_photo_alternate</span>
                    </button>
                    <button type="button" className="lv-nano-voice-btn" onClick={toggleNanoVoicePrompt} disabled={nanoGenerating} aria-pressed={nanoListening} aria-label={nanoListening ? 'Stop voice input' : 'Voice input'} title={nanoListening ? 'Listening' : 'Voice input'}>
                      <span className="material-symbol" aria-hidden="true">{nanoListening ? 'mic' : 'keyboard_voice'}</span>
                    </button>
                    <button type="button" className="lv-nano-generate" onClick={() => void generateNanoCover()} disabled={nanoGenerating} aria-label={nanoGenerating ? 'Generating background' : 'Generate background'} title={nanoGenerating ? 'Generating background' : 'Generate background'}>
                      <span className="material-symbol" aria-hidden="true">{nanoGenerating ? 'progress_activity' : 'arrow_forward'}</span>
                    </button>
                  </div>
                </div>
                {nanoReferenceImages.length > 0 && (<div className="lv-nano-reference-list">
                  {nanoReferenceImages.map(image => (<div key={image.id} className="lv-nano-reference-chip">
                    <img src={image.dataUrl} alt="Reference"/>
                    <span>{image.name}</span>
                    <button type="button" onClick={() => removeNanoReferenceImage(image.id)} aria-label={`Remove ${image.name}`}>
                      close
                    </button>
                  </div>))}
                </div>)}
              </div>)}
            </div>)}
            {coverBuilderBackgroundTab === 'library' && (<div className="lv-cb-bg-tab-panel" role="tabpanel">
              <label className="lv-cb-library-search lv-cb-library-search--panel">
                <span className="material-symbol" aria-hidden="true">search</span>
                <input value={coverBuilderLibrarySearch} onChange={e => setCoverBuilderLibrarySearch(e.target.value)} placeholder="Search backgrounds" aria-label="Search backgrounds"/>
              </label>
              <div className="lv-cb-deal-tag-grid lv-cb-deal-tag-grid--library lv-cb-background-grid--library lv-cb-background-grid--panel">
                {filteredBackgrounds.map(background => (<div key={background.key} className="lv-cb-deal-tag-library-card lv-cb-background-library-card">
                  <button type="button" className={coverBuilder.bgType === 'image' && coverBuilder.bgImage === background.url ? 'active' : ''} onClick={() => selectCoverBuilderBackground(background.url, background.generated)} title={background.name} aria-label={`Use ${background.name}`}>
                    <img src={background.url} alt={background.name}/>
                    <span>{background.name}</span>
                  </button>
                  {background.generated && (<button type="button" className="lv-cb-deal-tag-delete material-symbol" onClick={() => deleteGeneratedCoverBackground(background.key)} title={`Delete ${background.name}`} aria-label={`Delete ${background.name}`}>
                    delete
                  </button>)}
                </div>))}
                {allCoverBackgrounds.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No backgrounds are available.</div>)}
                {allCoverBackgrounds.length > 0 && filteredBackgrounds.length === 0 && (<div className="lv-cb-deal-tag-library-empty">No backgrounds match your search.</div>)}
              </div>
              <label className="lv-cb-file-drop lv-cb-bg-editor-drop">
                <span className="lv-cb-bg-editor-drop-icon" aria-hidden="true">
                  add_photo_alternate
                </span>
                <strong>Click or drop background image</strong>
                <small>PNG, JPG, or WebP</small>
                <input type="file" accept="image/*" onChange={e => void readCoverBuilderImage(e.target.files?.[0] || null, 'bgImage')}/>
              </label>
              <div className="lv-cb-trending-deal-tags lv-cb-trending-backgrounds">
                <strong>Trending Backgrounds</strong>
                <div className="lv-cb-trending-deal-tags-grid">
                  {trendingBackgrounds.map(background => (<button key={background.url} type="button" className={coverBuilder.bgType === 'image' && coverBuilder.bgImage === background.url ? 'active' : ''} onClick={() => selectCoverBuilderBackground(background.url, background.generated)} title={background.name} aria-label={`Use trending background ${background.name}`}>
                    <img src={background.url} alt={background.name}/>
                  </button>))}
                </div>
              </div>
            </div>)}
            {coverBuilderBackgroundTab === 'aiColor' && (<div className="lv-cb-bg-tab-panel" role="tabpanel">
              <button type="button" className="lv-cb-ai-gradient-btn" onClick={() => void generateCoverAiGradient()}>
                AI color
              </button>
              <div className="lv-cb-bg-type-grid lv-cb-bg-type-grid--color">
                {(['solid', 'gradient'] as CoverBuilderBgType[]).map(bg => (<button key={bg} type="button" className={coverBuilder.bgType === bg ? 'active' : ''} onClick={() => setCoverBuilderValue('bgType', bg)}>
                    <span aria-hidden="true">
                      {bg === 'solid' ? 'format_color_fill' : 'gradient'}
                    </span>
                    <strong>{bg}</strong>
                  </button>))}
              </div>
              {coverBuilder.bgType === 'solid' && (<div className="lv-cb-bg-editor-card">
                <div className="lv-cb-bg-picker-row lv-cb-bg-editor-color-row">
                  <label>Solid color</label>
                  <ColorSwatch value={coverBuilder.bgColor} onChange={v => setCoverBuilderValue('bgColor', v)}/>
                  <span>{coverBuilder.bgColor}</span>
                </div>
              </div>)}
              {coverBuilder.bgType === 'gradient' && (<div className="lv-cb-bg-editor-card">
                <div className="lv-cb-bg-picker-grid lv-cb-bg-editor-grid">
                  <div className="lv-cb-bg-picker-row lv-cb-bg-editor-color-row">
                    <label>From</label>
                    <ColorSwatch value={coverBuilder.gradFrom} onChange={v => setCoverBuilderValue('gradFrom', v)}/>
                    <span>{coverBuilder.gradFrom}</span>
                  </div>
                  <div className="lv-cb-bg-picker-row lv-cb-bg-editor-color-row">
                    <label>To</label>
                    <ColorSwatch value={coverBuilder.gradTo} onChange={v => setCoverBuilderValue('gradTo', v)}/>
                    <span>{coverBuilder.gradTo}</span>
                  </div>
                  <div className="lv-cb-bg-angle-row lv-cb-bg-editor-slider">
                    <label>Angle</label>
                    <input className={cssClass({ '--range-pct': `${coverBuilder.gradAngle / 360 * 100}%` } as React.CSSProperties)} type="range" min={0} max={360} value={coverBuilder.gradAngle} onChange={e => setCoverBuilderValue('gradAngle', +e.target.value)}/>
                    <span>{coverBuilder.gradAngle}deg</span>
                  </div>
                  <div className="lv-cb-bg-angle-row lv-cb-bg-editor-slider">
                    <label>From stop</label>
                    <input className={cssClass({ '--range-pct': `${coverBuilder.gradFromStop}%` } as React.CSSProperties)} type="range" min={0} max={100} value={coverBuilder.gradFromStop} onChange={e => setCoverBuilderValue('gradFromStop', Math.min(+e.target.value, coverBuilder.gradToStop))}/>
                    <span>{coverBuilder.gradFromStop}%</span>
                  </div>
                  <div className="lv-cb-bg-angle-row lv-cb-bg-editor-slider">
                    <label>To stop</label>
                    <input className={cssClass({ '--range-pct': `${coverBuilder.gradToStop}%` } as React.CSSProperties)} type="range" min={0} max={100} value={coverBuilder.gradToStop} onChange={e => setCoverBuilderValue('gradToStop', Math.max(+e.target.value, coverBuilder.gradFromStop))}/>
                    <span>{coverBuilder.gradToStop}%</span>
                  </div>
                </div>
              </div>)}
            </div>)}
          </div>
        </div>);
        }
        if (coverBuilderSelected === 'logo') {
            const logoStyle = coverBuilder.itemStyles.logo ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.logo;
            const logoImageScale = logoStyle.imageScale ?? 82;
            const previewLogoImageScale = (value: number, target: EventTarget & HTMLInputElement) => {
                const nextValue = Math.max(10, Math.min(160, value));
                const output = target.closest('.lv-cb-logo-size-slider')?.querySelector('strong');
                if (output)
                    output.textContent = `${nextValue}%`;
                coverBuilderPreviewRef.current?.querySelector<HTMLElement>('.lv-cb-logo-slot')?.style.setProperty('--logo-image-size', `${nextValue}%`);
            };
            const commitLogoImageScale = (target: EventTarget & HTMLInputElement) => {
                updateCoverBuilderItemStyle('logo', { imageScale: Number(target.value) });
            };
            return (<div className="lv-cb-section-body">
          {CoverBuilderInspectorControls({ itemKey: 'logo' })}
          <div className="lv-cb-headline-ai-control lv-cb-logo-ai-control">
            <button type="button" className="lv-cb-ai-gradient-btn" onClick={generateCoverAiLogoStyle}>
              AI logo style
            </button>
            {coverBuilder.logoAiStyle && (<button type="button" className="lv-cb-headline-clear-style" onClick={() => updateCoverBuilderForSelectedTemplate(prev => ({ ...prev, logoAiStyle: '' }))}>
              Clear style
            </button>)}
          </div>
          {renderCoverBuilderSection('right-logo-text', 'Logo text', (<div className="lv-cb-field lv-cb-logo-text-control">
              <label>Logo text</label>
              <input value={coverBuilderLogoTextDraft} onChange={e => handleCoverBuilderLogoTextChange(e.target.value)} onBlur={() => commitCoverBuilderLogoText()} onKeyDown={e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commitCoverBuilderLogoText(e.currentTarget.value);
                        e.currentTarget.blur();
                    }
                }} placeholder="Logo"/>
              <div className="lv-cb-logo-color-grid">
                <div className="lv-cb-subline-color-row">
                  <label>Text Color</label>
                  <ColorSwatch value={logoStyle.color} onChange={v => updateCoverBuilderItemStyle('logo', { color: v })}/>
                  <span>{logoStyle.color}</span>
                </div>
                <div className="lv-cb-subline-color-row">
                  <label>Background</label>
                  <ColorSwatch value={logoStyle.bg === 'transparent' ? '#ffffff' : logoStyle.bg} onChange={v => updateCoverBuilderItemStyle('logo', { bg: v, bgOpacity: logoStyle.bgOpacity && logoStyle.bgOpacity > 0 ? logoStyle.bgOpacity : 100 })}/>
                  <span>{logoStyle.bg === 'transparent' ? '#ffffff' : logoStyle.bg}</span>
                </div>
              </div>
            </div>), 'lv-cb-property-section')}
          {renderCoverBuilderSection('right-logo-image-size', 'Logo image size', (<div className="lv-cb-logo-image-size">
              <label className="lv-cb-logo-size-slider">
                <span>Size</span>
                <input type="range" min={10} max={160} step={1} defaultValue={logoImageScale} onInput={e => previewLogoImageScale(Number(e.currentTarget.value), e.currentTarget)} onPointerUp={e => commitLogoImageScale(e.currentTarget)} onKeyUp={e => commitLogoImageScale(e.currentTarget)} onBlur={e => commitLogoImageScale(e.currentTarget)}/>
                <strong>{logoImageScale}%</strong>
              </label>
            </div>), 'lv-cb-property-section')}
          {renderCoverBuilderSection('right-logo-content', 'Logo image', (<div className="lv-cb-field lv-cb-logo-upload-control">
              <label>Supermarket logo</label>
              <label
                className="lv-cb-asset-import lv-cb-logo-import"
                tabIndex={0}
                onDragEnter={e => e.preventDefault()}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={handleCoverBuilderLogoDrop}
                onPaste={handleCoverBuilderLogoPaste}
                onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== ' ')
                        return;
                    e.preventDefault();
                    e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]')?.click();
                }}
              >
                <strong>Import logo</strong>
                <span>Click, drag and drop, or paste an image</span>
                <input type="file" accept="image/*" onChange={e => void readCoverBuilderImage(e.target.files?.[0] || null, 'logo')}/>
              </label>
              <button type="button" className="lv-cb-logo-delete" onClick={() => toggleCoverBuilderItem('logo')}>{coverBuilder.visibleItems.logo ? 'Delete' : 'Restore'}</button>
            </div>), 'lv-cb-property-section')}
        </div>);
        }
        if (coverBuilderSelected === 'headline' || coverBuilderSelected === 'subline' || coverBuilderSelected === 'contact') {
            const labels = { headline: 'Headline', subline: 'Subline', contact: 'Contact info' } as const;
            return (<div className="lv-cb-section-body">
          {coverBuilderSelected === 'subline' || coverBuilderSelected === 'headline' || coverBuilderSelected === 'contact'
                    ? CoverBuilderInspectorControls({ itemKey: coverBuilderSelected })
                    : renderCoverBuilderSection(`right-${coverBuilderSelected}-layout`, `${labels[coverBuilderSelected]} layout`, CoverBuilderInspectorControls({ itemKey: coverBuilderSelected }), 'lv-cb-property-section')}
          {coverBuilderSelected === 'subline' ? (<button type="button" className="lv-cb-subline-delete-only" onClick={() => toggleCoverBuilderItem(coverBuilderSelected)}>
              {coverBuilder.visibleItems[coverBuilderSelected] ? `Delete ${labels[coverBuilderSelected].toLowerCase()}` : `Restore ${labels[coverBuilderSelected].toLowerCase()}`}
            </button>) : coverBuilderSelected === 'headline' ? (<button type="button" className="lv-cb-delete-icon-only material-symbol" onClick={() => toggleCoverBuilderItem(coverBuilderSelected)} aria-label={coverBuilder.visibleItems[coverBuilderSelected] ? `Delete ${labels[coverBuilderSelected].toLowerCase()}` : `Restore ${labels[coverBuilderSelected].toLowerCase()}`} title={coverBuilder.visibleItems[coverBuilderSelected] ? `Delete ${labels[coverBuilderSelected].toLowerCase()}` : `Restore ${labels[coverBuilderSelected].toLowerCase()}`}>
              {coverBuilder.visibleItems[coverBuilderSelected] ? 'delete' : 'restore_from_trash'}
            </button>) : (<button type="button" className="lv-cb-subline-delete-only" onClick={() => toggleCoverBuilderItem(coverBuilderSelected)}>
              {coverBuilder.visibleItems[coverBuilderSelected] ? `Delete ${labels[coverBuilderSelected].toLowerCase()}` : `Restore ${labels[coverBuilderSelected].toLowerCase()}`}
            </button>)}
        </div>);
        }
        if (coverBuilderSelected === 'dealTag') {
            return (<div className="lv-cb-section-body">
        {CoverBuilderInspectorControls({ itemKey: 'dealTag' })}
        {renderCoverBuilderSection('right-deal-tag-image', 'Deal tag', (<div className="lv-cb-deal-tag-control">
            <div className="lv-cb-row">
              <span>Deal tag</span>
              <div className="lv-cb-deal-tag-actions">
                <button type="button" className="lv-cb-deal-tag-library-button" onClick={() => {
                        setCoverBuilderLibrarySearch('');
                        setCoverBuilderDealTagLibraryOpen(true);
                    }} aria-haspopup="dialog" aria-controls="lv-cb-deal-tag-library">
                  <span className="lv-cb-deal-tag-library-button-icon material-symbol" aria-hidden="true">collections</span>
                  <span className="lv-cb-deal-tag-library-button-copy">
                    <strong>Library</strong>
                    <small>Browse all deal tags</small>
                  </span>
                  <span className="lv-cb-deal-tag-library-button-arrow material-symbol" aria-hidden="true">arrow_forward</span>
                </button>
              </div>
            </div>
            <label className="lv-cb-asset-import" tabIndex={0} onDragOver={e => e.preventDefault()} onDrop={e => handleCoverBuilderAssetDrop(e, 'dealTagUrl')} onPaste={e => handleCoverBuilderAssetPaste(e, 'dealTagUrl')}>
              <strong>Import deal tag</strong>
              <span>Click, drop image, or paste</span>
              <input type="file" accept="image/*" onChange={e => void readCoverBuilderAssetImage(e.target.files?.[0] || null, 'dealTagUrl')}/>
            </label>
            <div className="lv-cb-trending-deal-tags">
              <strong>Trending Deal Tags</strong>
              <div className="lv-cb-trending-deal-tags-grid">
                {trendingDealTags.map(tag => (<button key={tag.url} type="button" className={coverBuilder.dealTagUrl === tag.url ? 'active' : ''} onClick={() => selectCoverBuilderDealTag(tag.url)} title={tag.name} aria-label={`Use trending deal tag ${tag.name}`}>
                  <img src={tag.url} alt={tag.name}/>
                </button>))}
              </div>
            </div>
          </div>), 'lv-cb-property-section')}
      </div>);
        }
        if (coverBuilderSelected === 'basket') {
            return (<div className="lv-cb-section-body">
        {CoverBuilderInspectorControls({ itemKey: 'basket' })}
        <div className="lv-cb-inspector lv-cb-inspector--subline lv-cb-inspector--subline-compact lv-cb-asset-panel">
          <div className="lv-cb-subline-title">
            <span className="lv-cb-subline-title-icon" aria-hidden="true">shopping_basket</span>
            <strong>Basket</strong>
          </div>
          <section className="lv-cb-subline-group">
            <div className="lv-cb-subline-group-title">
              <span className="lv-cb-subline-group-icon" aria-hidden="true">add_photo_alternate</span>
              <strong>Basket image</strong>
            </div>
            <div className="lv-cb-deal-tag-control lv-cb-deal-tag-control--compact">
              <div className="lv-cb-row">
                <div className="lv-cb-deal-tag-actions">
                  <button type="button" className="lv-cb-deal-tag-library-button" onClick={() => {
                            setCoverBuilderLibrarySearch('');
                            setCoverBuilderBasketLibraryOpen(true);
                        }} aria-haspopup="dialog" aria-controls="lv-cb-basket-library">
                    <span className="lv-cb-deal-tag-library-button-icon material-symbol" aria-hidden="true">shopping_basket</span>
                    <span className="lv-cb-deal-tag-library-button-copy">
                      <strong>Library</strong>
                      <small>Browse all baskets</small>
                    </span>
                    <span className="lv-cb-deal-tag-library-button-arrow material-symbol" aria-hidden="true">arrow_forward</span>
                  </button>
                </div>
              </div>
              <label className="lv-cb-asset-import" tabIndex={0} onDragOver={e => e.preventDefault()} onDrop={e => handleCoverBuilderAssetDrop(e, 'basketUrl')} onPaste={e => handleCoverBuilderAssetPaste(e, 'basketUrl')}>
                <strong>Import basket</strong>
                <span>Click, drop image, or paste</span>
                <input type="file" accept="image/*" onChange={e => void readCoverBuilderAssetImage(e.target.files?.[0] || null, 'basketUrl')}/>
              </label>
              <div className="lv-cb-trending-deal-tags lv-cb-trending-baskets">
                <strong>Trending Baskets</strong>
                <div className="lv-cb-trending-deal-tags-grid">
                  {trendingBaskets.map(basket => (<button key={basket.url} type="button" className={coverBuilder.basketUrl === basket.url ? 'active' : ''} onClick={() => selectCoverBuilderBasket(basket.url)} title={basket.name} aria-label={`Use trending basket ${basket.name}`}>
                    <img src={basket.url} alt={basket.name}/>
                  </button>))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>);
        }
        return (<div className="lv-cb-section-body">
        {CoverBuilderInspectorControls({ itemKey: 'products' })}
        <div className="lv-cb-inspector lv-cb-inspector--subline lv-cb-inspector--subline-compact lv-cb-asset-panel lv-cb-products-panel">
          <div className="lv-cb-subline-title">
            <span className="lv-cb-subline-title-icon" aria-hidden="true">inventory_2</span>
            <strong>Cover products</strong>
          </div>
          <section className="lv-cb-subline-group">
            <div className="lv-cb-subline-group-title">
              <span className="lv-cb-subline-group-icon" aria-hidden="true">checklist</span>
              <strong>Products</strong>
            </div>
            <div className="lv-cb-products-control lv-cb-products-control--compact">
              <div className="lv-cb-row">
                <span>Cover products</span>
                <button type="button" onClick={() => toggleCoverBuilderItem('products')}>{coverBuilder.visibleItems.products ? 'Delete' : 'Restore'}</button>
              </div>
              <div className="lv-cb-product-list">
                {products.length === 0 && (<div className="lv-cb-products-empty">No imported products yet. Upload Excel or CSV products first.</div>)}
                {products.map(p => (<label key={p.id}>
                    <input type="checkbox" checked={coverProductIds.has(p.id)} onChange={e => {
                            updateCoverBuilderForSelectedTemplate(prev => ({
                                ...prev,
                                selectedProductIds: e.target.checked
                                    ? [...prev.selectedProductIds, p.id].slice(0, 12)
                                    : prev.selectedProductIds.filter(pid => pid !== p.id),
                            }));
                        }}/>
                    {p.product_img_url
                            ? <img className="lv-cb-product-option-img" src={toCanvasSafeImageUrl(p.product_img_url) || p.product_img_url} alt=""/>
                            : <span className="lv-cb-product-option-img lv-cb-product-option-empty" aria-hidden="true"/>}
                    <span>{p.product_name_lan1}</span>
                  </label>))}
              </div>
              <small>Selected products appear on the cover and are removed from the normal leaflet pages.</small>
            </div>
          </section>
        </div>
        <div className="lv-cb-inspector lv-cb-inspector--subline lv-cb-inspector--subline-compact lv-cb-asset-panel lv-cb-products-panel">
          <div className="lv-cb-subline-title">
            <span className="lv-cb-subline-title-icon" aria-hidden="true">dashboard_customize</span>
            <strong>Product card layout</strong>
          </div>
          <section className="lv-cb-subline-group">
            <div className="lv-cb-subline-group-title">
              <span className="lv-cb-subline-group-icon" aria-hidden="true">view_quilt</span>
              <strong>Card layout</strong>
            </div>
            <div className="lv-cb-product-layout-properties">
              {renderCoverProductLayoutControls()}
            </div>
          </section>
        </div>
        <div className="lv-cb-inspector lv-cb-inspector--subline lv-cb-inspector--subline-compact lv-cb-asset-panel lv-cb-products-panel">
          <div className="lv-cb-subline-title">
            <span className="lv-cb-subline-title-icon" aria-hidden="true">view_carousel</span>
            <strong>Card template</strong>
          </div>
          <section className="lv-cb-subline-group">
            <div className="lv-cb-subline-group-title">
              <span className="lv-cb-subline-group-icon" aria-hidden="true">auto_awesome</span>
              <strong>Template style</strong>
            </div>
            <div className="lv-cb-template-picker lv-cb-template-picker--compact">
              <div className="lv-cb-row">
                <span>Card template</span>
                <button type="button" onClick={loadSidebarTemplates}>Refresh</button>
              </div>
              <button type="button" className="lv-cb-ai-gradient-btn" onClick={generateCoverAiProductCardStyle}>
                AI product card style
              </button>
              {coverBuilder.productCardTemplateName && (<small>Applied: {coverBuilder.productCardTemplateName}</small>)}
              {sidebarTemplatesLoading && <small>Loading templates...</small>}
              {!sidebarTemplatesLoading && sidebarTemplatesErr && <small>{sidebarTemplatesErr}</small>}
              <div className="lv-cb-template-list">
                {[...sidebarVisibleTemplates, ...sidebarSavedTemplates].map((template, index) => {
                        const layout = template.layout;
                        const name = template.is_default ? `Template ${index + 1}` : template.name;
                        return (<button key={template.id} type="button" className={coverBuilder.productCardTemplateName === name ? 'active' : ''} onClick={() => updateCoverBuilderForSelectedTemplate(prev => ({
                                ...prev,
                                productCardLayout: layout,
                                productCardTemplateName: name,
                            }))}>
                      <LayoutThumbnail layout={layout}/>
                      <span>{name}</span>
                    </button>);
                    })}
              </div>
              {coverBuilder.productCardLayout && (<button type="button" onClick={() => updateCoverBuilderForSelectedTemplate(prev => ({ ...prev, productCardLayout: null, productCardTemplateName: '' }))}>
                  Use current leaflet card layout
                </button>)}
            </div>
          </section>
        </div>
      </div>);
    }
    function CoverBuilderInspectorControls({ itemKey }: {
        itemKey: CoverBuilderItemKey;
    }) {
        const s = coverBuilder.itemStyles[itemKey] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[itemKey];
        const isText = itemKey === 'headline' || itemKey === 'subline' || itemKey === 'contact';
        function rangeControl(field: 'z' | 'opacity' | 'fontSize' | 'radius' | 'borderWidth', label: string, min: number, max: number, step = 1) {
            const value = s[field];
            const setValue = (next: number) => updateCoverBuilderItemStyle(itemKey, { [field]: Math.max(min, Math.min(max, next)) } as Partial<CoverBuilderElementStyle>);
            const pct = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
            const setFromPointer = (target: HTMLElement, clientX: number) => {
                const rect = target.getBoundingClientRect();
                const rawPct = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
                const clampedPct = Math.max(0, Math.min(1, rawPct));
                const rawValue = min + clampedPct * (max - min);
                const stepped = min + Math.round((rawValue - min) / step) * step;
                setValue(stepped);
            };
            const stopDrag = (target: HTMLElement, pointerId: number) => {
                coverBuilderSliderDragRef.current = false;
                coverBuilderEditingLiveRef.current = false;
                try {
                    if (target.hasPointerCapture(pointerId))
                        target.releasePointerCapture(pointerId);
                }
                catch { }
                setCoverBuilderSaveTick(t => t + 1);
            };
            return (<div className="lv-cb-field">
          <label>{label}</label>
          <div className="lv-cb-range-control">
            <button type="button" onPointerDown={() => startCoverBuilderNudge(() => nudgeCoverBuilderItemStyle(itemKey, field, -step, min, max))} onPointerUp={stopCoverBuilderNudge} onPointerLeave={stopCoverBuilderNudge} onPointerCancel={stopCoverBuilderNudge}>
              -
            </button>
            <div className="lv-cb-slider-track" role="slider" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} tabIndex={0} onPointerDown={e => {
                    e.preventDefault();
                    coverBuilderSliderDragRef.current = true;
                    coverBuilderEditingLiveRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFromPointer(e.currentTarget, e.clientX);
                }} onPointerMove={e => {
                    if (!coverBuilderSliderDragRef.current)
                        return;
                    e.preventDefault();
                    setFromPointer(e.currentTarget, e.clientX);
                }} onPointerUp={e => stopDrag(e.currentTarget, e.pointerId)} onPointerCancel={e => stopDrag(e.currentTarget, e.pointerId)} onKeyDown={e => {
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setValue(value - step);
                        setCoverBuilderSaveTick(t => t + 1);
                    }
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setValue(value + step);
                        setCoverBuilderSaveTick(t => t + 1);
                    }
                }}>
              <span className={cx("lv-cb-slider-fill", cssClass({ width: `${pct * 100}%` }))}/>
              <span className={cx("lv-cb-slider-thumb", cssClass({ left: `${pct * 100}%` }))}/>
            </div>
            <button type="button" onPointerDown={() => startCoverBuilderNudge(() => nudgeCoverBuilderItemStyle(itemKey, field, step, min, max))} onPointerUp={stopCoverBuilderNudge} onPointerLeave={stopCoverBuilderNudge} onPointerCancel={stopCoverBuilderNudge}>
              +
            </button>
            <span>{value}</span>
          </div>
        </div>);
        }
        const setItemStyle = (patch: Partial<CoverBuilderElementStyle>) => updateCoverBuilderItemStyle(itemKey, patch);
        const alignElementToCanvas = (align: CoverBuilderElementStyle['align']) => {
            const x = align === 'right' ? Math.max(0, 100 - s.w) : align === 'center' ? Math.max(0, (100 - s.w) / 2) : 0;
            updateCoverBuilderItemStyle(itemKey, { align, x });
        };
        const valignElementToCanvas = (valign: CoverBuilderElementStyle['valign']) => {
            const y = valign === 'bottom' ? Math.max(0, 100 - s.h) : valign === 'middle' ? Math.max(0, (100 - s.h) / 2) : 0;
            updateCoverBuilderItemStyle(itemKey, { valign, y });
        };
        const selectedElementGroup = Array.from(new Set([
            ...coverBuilderSelectedItems,
            itemKey,
        ])).filter(key => coverBuilder.visibleItems[key]);
        const activeSelectionGroup = selectedElementGroup.filter(key => key !== itemKey);
        const hasMultiSelection = selectedElementGroup.length > 1 && activeSelectionGroup.length > 0;
        const clampItemX = (key: CoverBuilderItemKey, x: number) => Math.max(key === 'basket' ? -100 : 0, Math.min(100, x));
        const clampItemY = (key: CoverBuilderItemKey, y: number) => Math.max(key === 'basket' ? -100 : 0, Math.min(100, y));
        const alignElementToSibling = (align: CoverBuilderElementStyle['align']) => {
            if (!hasMultiSelection)
                return;
            const targetAnchor = align === 'right' ? s.x + s.w : align === 'center' ? s.x + s.w / 2 : s.x;
            updateCoverBuilderForSelectedTemplate(prev => ({
                ...prev,
                itemStyles: {
                    ...prev.itemStyles,
                    ...activeSelectionGroup.reduce((acc, key) => {
                        const item = prev.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
                        const x = align === 'right' ? targetAnchor - item.w : align === 'center' ? targetAnchor - item.w / 2 : targetAnchor;
                        acc[key] = { ...item, align, x: clampItemX(key, x) };
                        return acc;
                    }, {} as Partial<Record<CoverBuilderItemKey, CoverBuilderElementStyle>>),
                },
            }));
            setCoverBuilderSaveTick(t => t + 1);
        };
        const valignElementToSibling = (valign: CoverBuilderElementStyle['valign']) => {
            if (!hasMultiSelection)
                return;
            const targetAnchor = valign === 'bottom' ? s.y + s.h : valign === 'middle' ? s.y + s.h / 2 : s.y;
            updateCoverBuilderForSelectedTemplate(prev => ({
                ...prev,
                itemStyles: {
                    ...prev.itemStyles,
                    ...activeSelectionGroup.reduce((acc, key) => {
                        const item = prev.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
                        const y = valign === 'bottom' ? targetAnchor - item.h : valign === 'middle' ? targetAnchor - item.h / 2 : targetAnchor;
                        acc[key] = { ...item, valign, y: clampItemY(key, y) };
                        return acc;
                    }, {} as Partial<Record<CoverBuilderItemKey, CoverBuilderElementStyle>>),
                },
            }));
            setCoverBuilderSaveTick(t => t + 1);
        };
        const matchSelectedElementSize = (dimension: 'w' | 'h') => {
            if (!hasMultiSelection)
                return;
            updateCoverBuilderForSelectedTemplate(prev => ({
                ...prev,
                itemStyles: {
                    ...prev.itemStyles,
                    ...activeSelectionGroup.reduce((acc, key) => {
                        const item = prev.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
                        acc[key] = { ...item, [dimension]: s[dimension] };
                        return acc;
                    }, {} as Partial<Record<CoverBuilderItemKey, CoverBuilderElementStyle>>),
                },
            }));
            setCoverBuilderSaveTick(t => t + 1);
        };
        const alignElement = (align: CoverBuilderElementStyle['align']) => {
            if (hasMultiSelection)
                alignElementToSibling(align);
            else
                alignElementToCanvas(align);
        };
        const valignElement = (valign: CoverBuilderElementStyle['valign']) => {
            if (hasMultiSelection)
                valignElementToSibling(valign);
            else
                valignElementToCanvas(valign);
        };
        const alignToElementsButtons = (<div className="lc-align-btns lc-align-main-btns">
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align left edges" : "Align left to canvas"} onClick={() => alignElement('left')} aria-label={hasMultiSelection ? "Align left edges" : "Align left to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="1" height="13"/><rect x="3" y="2" width="7" height="3" rx="1"/><rect x="3" y="9" width="10" height="3" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align horizontal centers" : "Align horizontal center to canvas"} onClick={() => alignElement('center')} aria-label={hasMultiSelection ? "Align horizontal centers" : "Align horizontal center to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="7" y="1" width="1" height="13"/><rect x="2.5" y="2" width="10" height="3" rx="1"/><rect x="0.5" y="9" width="14" height="3" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align right edges" : "Align right to canvas"} onClick={() => alignElement('right')} aria-label={hasMultiSelection ? "Align right edges" : "Align right to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="13" y="1" width="1" height="13"/><rect x="5" y="2" width="7" height="3" rx="1"/><rect x="2" y="9" width="10" height="3" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align top edges" : "Align top to canvas"} onClick={() => valignElement('top')} aria-label={hasMultiSelection ? "Align top edges" : "Align top to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="1" width="13" height="1"/><rect x="2" y="3" width="3" height="7" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align vertical centers" : "Align vertical center to canvas"} onClick={() => valignElement('middle')} aria-label={hasMultiSelection ? "Align vertical centers" : "Align vertical center to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="7" width="13" height="1"/><rect x="2" y="2" width="3" height="11" rx="1"/><rect x="9" y="4" width="3" height="7" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title={hasMultiSelection ? "Align bottom edges" : "Align bottom to canvas"} onClick={() => valignElement('bottom')} aria-label={hasMultiSelection ? "Align bottom edges" : "Align bottom to canvas"}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="13" width="13" height="1"/><rect x="2" y="5" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title="Match width" onClick={() => matchSelectedElementSize('w')} disabled={!hasMultiSelection} aria-label="Match width">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="1" y="4.5" width="13" height="2" rx="1"/><rect x="1" y="8.5" width="13" height="2" rx="1"/><rect x="1" y="2" width="1" height="11"/><rect x="13" y="2" width="1" height="11"/></svg>
          </button>
          <button type="button" className="lc-align-btn" title="Match height" onClick={() => matchSelectedElementSize('h')} disabled={!hasMultiSelection} aria-label="Match height">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="4.5" y="1" width="2" height="13" rx="1"/><rect x="8.5" y="1" width="2" height="13" rx="1"/><rect x="2" y="1" width="11" height="1"/><rect x="2" y="13" width="11" height="1"/></svg>
          </button>
        </div>);
        function sublineGroup(icon: string, title: string, children: React.ReactNode, separated = false) {
            const sectionId = `${itemKey}-${title.toLowerCase().replace(/\s+/g, '-')}`;
            const collapsed = !!coverBuilderCollapsedSections[sectionId];
            return (<section className={`lv-cb-subline-group${separated ? ' lv-cb-subline-group--separated' : ''}${collapsed ? ' collapsed' : ''}`}>
              <div className="lv-cb-subline-group-title">
                <span className="lv-cb-subline-group-icon" aria-hidden="true">{icon}</span>
                <strong>{title}</strong>
                <button type="button" className="lv-cb-subline-collapse" onClick={() => toggleCoverBuilderSection(sectionId)} aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}>
                  <span aria-hidden="true"/>
                </button>
              </div>
              {!collapsed && children}
            </section>);
        }
        if ((['logo', 'headline', 'subline', 'contact', 'products', 'dealTag', 'basket'] as CoverBuilderItemKey[]).includes(itemKey)) {
            const compactMeta: Record<CoverBuilderItemKey, { title: string; icon: string }> = {
                logo: { title: 'Logo layout', icon: 'image' },
                headline: { title: 'Headline layout', icon: 'title' },
                subline: { title: 'Subline layout', icon: 'layers' },
                contact: { title: 'Contact info layout', icon: 'contact_phone' },
                products: { title: 'Products layout', icon: 'inventory_2' },
                dealTag: { title: 'Deal tag layout', icon: 'local_offer' },
                basket: { title: 'Basket layout', icon: 'shopping_basket' },
            };
            const compactTitle = compactMeta[itemKey].title;
            const compactIcon = compactMeta[itemKey].icon;
            const sublineLayoutSectionId = `${itemKey}-layout`;
            const sublineLayoutCollapsed = !!coverBuilderCollapsedSections[sublineLayoutSectionId];
            const siblingAlignmentRows = (<>
                <div className="lv-cb-subline-control-row">
                  {alignToElementsButtons}
                </div>
              </>);
            return (<div className={`lv-cb-inspector lv-cb-inspector--subline lv-cb-inspector--subline-compact${sublineLayoutCollapsed ? ' collapsed' : ''}`}>
              <div className="lv-cb-subline-title">
                <span className="lv-cb-subline-title-icon" aria-hidden="true">{compactIcon}</span>
                <strong>{compactTitle}</strong>
                <button type="button" className="lv-cb-subline-title-toggle" onClick={() => toggleCoverBuilderSection(sublineLayoutSectionId)} aria-expanded={!sublineLayoutCollapsed} aria-label={`${sublineLayoutCollapsed ? 'Expand' : 'Collapse'} ${compactTitle}`}>
                  <span aria-hidden="true"/>
                </button>
              </div>
              {!sublineLayoutCollapsed && (<>
              {sublineGroup('format_align_center', 'Align to elements', siblingAlignmentRows)}
              </>)}
            </div>);
            return (<div className="lv-cb-inspector lv-cb-inspector--subline">
              <div className="lv-cb-subline-title">
                <span className="lv-cb-subline-title-icon" aria-hidden="true">layers</span>
                <strong>Subline layout</strong>
                <button type="button" className="lv-cb-subline-title-toggle" onClick={() => toggleCoverBuilderSection(sublineLayoutSectionId)} aria-expanded={!sublineLayoutCollapsed} aria-label={`${sublineLayoutCollapsed ? 'Expand' : 'Collapse'} Subline layout`}>
                  <span aria-hidden="true"/>
                </button>
              </div>
              {sublineGroup('format_align_center', 'Align to elements', siblingAlignmentRows)}
            </div>);
        }
        return (<div className="lv-cb-inspector">
        <div className="lv-cb-inspector-title">{itemKey === 'products' ? 'Products' : itemKey === 'dealTag' ? 'Deal tag' : itemKey === 'basket' ? 'Basket' : itemKey.charAt(0).toUpperCase() + itemKey.slice(1)} layout</div>
        <div className="lv-cb-num-grid">
          {([
                ['x', 'X', 0, 100],
                ['y', 'Y', 0, 100],
                ['w', 'W', 1, 100],
                ['h', 'H', 1, 100],
            ] as const).map(([key, label, min, max]) => {
                const controlMin = itemKey === 'basket' && (key === 'x' || key === 'y') ? -100 : min;
                const controlMax = itemKey === 'basket' && (key === 'x' || key === 'y') ? 100 : max;
                return (<label key={key}>
              <span>{label}</span>
              <NumericInput size="sm" min={controlMin} max={controlMax} step={0.5} value={Number(s[key].toFixed(1))} onChange={v => updateCoverBuilderItemStyle(itemKey, { [key]: v } as Partial<CoverBuilderElementStyle>)}/>
            </label>);
            })}
        </div>
        {rangeControl('z', 'Layer', 1, 20)}
        {rangeControl('opacity', 'Opacity', 10, 100)}
        <div className="lv-cb-field">
          <label>Align</label>
            <div className="lv-cb-style-row">
            {(['left', 'center', 'right'] as const).map(align => (<button key={align} type="button" className={s.align === align ? 'active' : ''} onClick={() => alignElementToCanvas(align)} aria-label={`${align} align ${itemKey}`}>
                {align}
              </button>))}
          </div>
        </div>
        <div className="lv-cb-field">
          <label>Vertical align</label>
          <div className="lv-cb-style-row">
            {(['top', 'middle', 'bottom'] as const).map(valign => (<button key={valign} type="button" className={(s.valign ?? 'top') === valign ? 'active' : ''} onClick={() => valignElementToCanvas(valign)} aria-label={`${valign} vertical align ${itemKey}`}>
                {valign}
              </button>))}
          </div>
        </div>
        <div className="lv-cb-field">
          <label>Align to elements</label>
          {alignToElementsButtons}
        </div>
        <div className="lv-cb-bg-picker-row">
          <label>Text color</label>
          <ColorSwatch value={s.color} onChange={v => updateCoverBuilderItemStyle(itemKey, { color: v })}/>
          <span>{s.color}</span>
        </div>
        <div className="lv-cb-bg-picker-row">
          <label>Background</label>
          <ColorSwatch value={s.bg === 'transparent' ? '#000000' : s.bg} onChange={v => updateCoverBuilderItemStyle(itemKey, { bg: v })}/>
          <span>{s.bg === 'transparent' ? 'transparent' : s.bg}</span>
          <button type="button" onClick={() => updateCoverBuilderItemStyle(itemKey, { bg: 'transparent' })}>Clear</button>
        </div>
        {isText && (<>
            {rangeControl('fontSize', 'Font size', 8, 72)}
            <div className="lv-cb-style-row">
              <button type="button" className={s.bold ? 'active' : ''} onClick={() => updateCoverBuilderItemStyle(itemKey, { bold: !s.bold })}>B</button>
              <button type="button" className={s.italic ? 'active' : ''} onClick={() => updateCoverBuilderItemStyle(itemKey, { italic: !s.italic })}>I</button>
            </div>
          </>)}
        {rangeControl('radius', 'Radius', 0, 40)}
        {rangeControl('borderWidth', 'Border width', 0, 12)}
        {s.borderWidth > 0 && (<div className="lv-cb-bg-picker-row">
            <label>Border color</label>
            <ColorSwatch value={s.borderColor} onChange={v => updateCoverBuilderItemStyle(itemKey, { borderColor: v })}/>
            <span>{s.borderColor}</span>
          </div>)}
      </div>);
    }
    async function generateCoverAiGradient() {
        const context = `${coverBuilder.headline}|${coverBuilder.subline}|${coverBuilderProducts.map(p => p.product_name_lan1).join('|')}|${Date.now()}`;
        const hash = Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
        const gradients = await loadUiGradients().catch(() => UI_GRADIENT_FALLBACK);
        const selectedGradient = gradients[Math.abs(hash) % gradients.length] ?? UI_GRADIENT_FALLBACK[0];
        const selectedColors = selectedGradient.colors.filter(Boolean);
        const gradFrom = selectedColors[0] ?? UI_GRADIENT_FALLBACK[0].colors[0];
        const gradTo = selectedColors[selectedColors.length - 1] ?? UI_GRADIENT_FALLBACK[0].colors[1];
        const midColor = selectedColors[Math.floor(selectedColors.length / 2)] ?? gradTo;
        const shadow = uiGradientHexToRgba(gradFrom, 0.38);
        const arc = uiGradientHexToRgba(midColor, 0.34);
        const glow = uiGradientHexToRgba(gradTo, 0.56);
        const gradAngle = 120 + (Math.abs(hash) % 31);
        const gradFromStop = 0;
        const gradToStop = 100;
        let seed = Math.abs(hash) || 1;
        const rand = (min: number, max: number) => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return Math.round(min + (seed / 4294967295) * (max - min));
        };
        const shapeTemplates = [
            () => [
                `radial-gradient(${rand(120, 165)}% ${rand(82, 112)}% at ${rand(-28, -8)}% ${rand(-18, 8)}%, ${shadow} 0%, ${shadow} ${rand(38, 50)}%, transparent ${rand(51, 58)}%)`,
                `radial-gradient(${rand(96, 132)}% ${rand(68, 94)}% at ${rand(92, 116)}% ${rand(36, 64)}%, transparent 0%, transparent ${rand(48, 59)}%, ${arc} ${rand(60, 64)}%, ${arc} ${rand(70, 78)}%, transparent ${rand(79, 84)}%)`,
                `radial-gradient(${rand(76, 104)}% ${rand(48, 72)}% at ${rand(62, 92)}% ${rand(68, 94)}%, ${glow} 0%, transparent ${rand(58, 74)}%)`,
            ],
            () => [
                `radial-gradient(${rand(130, 176)}% ${rand(70, 98)}% at ${rand(54, 86)}% ${rand(-24, -6)}%, ${shadow} 0%, ${shadow} ${rand(30, 44)}%, transparent ${rand(45, 54)}%)`,
                `radial-gradient(${rand(118, 158)}% ${rand(88, 118)}% at ${rand(-18, 10)}% ${rand(52, 82)}%, transparent 0%, transparent ${rand(44, 54)}%, ${arc} ${rand(55, 62)}%, ${arc} ${rand(68, 80)}%, transparent ${rand(81, 88)}%)`,
                `radial-gradient(${rand(70, 98)}% ${rand(54, 78)}% at ${rand(74, 106)}% ${rand(72, 102)}%, ${glow} 0%, transparent ${rand(54, 70)}%)`,
            ],
            () => [
                `radial-gradient(${rand(92, 128)}% ${rand(92, 130)}% at ${rand(-24, 8)}% ${rand(-18, 16)}%, ${shadow} 0%, ${shadow} ${rand(34, 48)}%, transparent ${rand(49, 58)}%)`,
                `radial-gradient(${rand(96, 126)}% ${rand(96, 130)}% at ${rand(88, 114)}% ${rand(-12, 24)}%, ${arc} 0%, transparent ${rand(45, 62)}%)`,
                `radial-gradient(${rand(124, 172)}% ${rand(62, 92)}% at ${rand(36, 74)}% ${rand(92, 118)}%, transparent 0%, transparent ${rand(36, 48)}%, ${glow} ${rand(49, 58)}%, transparent ${rand(72, 86)}%)`,
            ],
            () => [
                `radial-gradient(${rand(86, 118)}% ${rand(52, 74)}% at ${rand(2, 30)}% ${rand(4, 26)}%, ${glow} 0%, transparent ${rand(54, 72)}%)`,
                `radial-gradient(${rand(142, 190)}% ${rand(96, 132)}% at ${rand(82, 116)}% ${rand(72, 110)}%, ${shadow} 0%, ${shadow} ${rand(34, 48)}%, transparent ${rand(49, 60)}%)`,
                `radial-gradient(${rand(108, 148)}% ${rand(68, 98)}% at ${rand(-18, 12)}% ${rand(54, 88)}%, transparent 0%, transparent ${rand(48, 58)}%, ${arc} ${rand(59, 66)}%, transparent ${rand(78, 88)}%)`,
            ],
        ];
        const shapeLayers = shapeTemplates[rand(0, shapeTemplates.length - 1)]();
        const colorStops = selectedColors.map((color, idx) => {
            const stop = selectedColors.length === 1 ? 100 : Math.round((idx / (selectedColors.length - 1)) * 100);
            return `${color} ${stop}%`;
        }).join(', ');
        const aiGradientCss = [
            ...shapeLayers,
            `linear-gradient(${gradAngle + rand(-8, 8)}deg, ${colorStops})`,
        ].join(', ');
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            bgType: 'gradient',
            gradFrom,
            gradTo,
            gradAngle,
            gradFromStop,
            gradToStop,
            aiGradientCss,
        }));
        setCoverBuilderSelected('background');
    }
    function generateCoverAiHeadlineStyle() {
        const fontFamilies = [
            'Impact, Haettenschweiler, "Arial Black", sans-serif',
            '"Arial Black", Arial, sans-serif',
            '"Trebuchet MS", Arial, sans-serif',
            'Montserrat, Arial, sans-serif',
            'Poppins, Arial, sans-serif',
            'Oswald, Arial, sans-serif',
            'Inter, Arial, sans-serif',
            'Georgia, "Times New Roman", serif',
        ];
        const styles = [
            {
                id: 'fresh-blue',
                color: '#ffffff',
                accent: '#ff3f8f',
                fontSize: 54,
                lineCounts: [2, 3] as const,
                patch: { x: 5, y: 15, w: 86, h: 34, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'left' as const },
            },
            {
                id: 'electric-sale',
                color: '#f8fafc',
                accent: '#22d3ee',
                fontSize: 50,
                lineCounts: [1, 2] as const,
                patch: { x: 6, y: 18, w: 84, h: 24, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'left' as const },
            },
            {
                id: 'hot-promo',
                color: '#fff7ed',
                accent: '#fb2c74',
                fontSize: 52,
                lineCounts: [1, 2, 3] as const,
                patch: { x: 6, y: 16, w: 84, h: 34, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'left' as const },
            },
            {
                id: 'ice-outline',
                color: '#eff6ff',
                accent: '#60a5fa',
                fontSize: 48,
                lineCounts: [2, 3] as const,
                patch: { x: 5, y: 17, w: 88, h: 34, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'center' as const },
            },
            {
                id: 'wide-white',
                color: '#ffffff',
                accent: '#facc15',
                fontSize: 44,
                lineCounts: [1] as const,
                patch: { x: 5, y: 20, w: 90, h: 18, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'center' as const },
            },
            {
                id: 'split-gradient',
                color: '#ffffff',
                accent: '#34d399',
                fontSize: 50,
                lineCounts: [2] as const,
                patch: { x: 6, y: 17, w: 84, h: 28, bold: true, italic: false, bg: 'transparent', opacity: 100, align: 'left' as const },
            },
        ];
        const context = `${coverBuilder.headline}|${Date.now()}`;
        const hash = Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
        let seed = Math.abs(hash) || 1;
        const rand = (min: number, max: number) => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return Math.round(min + (seed / 4294967295) * (max - min));
        };
        const style = styles[Math.abs(hash) % styles.length];
        const lineCount = (style.lineCounts[rand(0, style.lineCounts.length - 1)] ?? style.lineCounts[0]) as 1 | 2 | 3;
        const fontFamily = fontFamilies[rand(0, fontFamilies.length - 1)];
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            headline: formatHeadlineForAiStyle(prev.headline, lineCount),
            headlineAiStyle: style.id,
            headlineAccentColor: style.accent,
            itemStyles: {
                ...prev.itemStyles,
                headline: {
                    ...(prev.itemStyles.headline ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.headline),
                    ...style.patch,
                    color: style.color,
                    fontSize: style.fontSize,
                    fontFamily,
                },
            },
        }));
        setCoverBuilderSelected('headline');
    }
    function generateCoverAiLogoStyle() {
        const styles = [
            {
                id: 'mint-badge',
                text: '#042f2e',
                bg: '#ccfbf1',
                fontFamily: 'Poppins, Arial, sans-serif',
                patch: { x: 5, y: 4, w: 24, h: 8, radius: 999, fontSize: 16, bold: true, italic: false, align: 'center' as const, valign: 'middle' as const, opacity: 98 },
            },
            {
                id: 'navy-premium',
                text: '#ffffff',
                bg: '#0f172a',
                fontFamily: 'Montserrat, Arial, sans-serif',
                patch: { x: 5, y: 4, w: 24, h: 8, radius: 10, fontSize: 15, bold: true, italic: false, align: 'center' as const, valign: 'middle' as const, opacity: 98 },
            },
            {
                id: 'fresh-white',
                text: '#14532d',
                bg: '#ffffff',
                fontFamily: 'Inter, Arial, sans-serif',
                patch: { x: 6, y: 5, w: 22, h: 8, radius: 8, fontSize: 14, bold: true, italic: false, align: 'center' as const, valign: 'middle' as const, opacity: 100 },
            },
            {
                id: 'hot-pink',
                text: '#ffffff',
                bg: '#db2777',
                fontFamily: '"Arial Black", Arial, sans-serif',
                patch: { x: 5, y: 4, w: 25, h: 8, radius: 12, fontSize: 15, bold: true, italic: false, align: 'center' as const, valign: 'middle' as const, opacity: 96 },
            },
        ];
        const context = `${coverBuilder.logoText}|${Date.now()}`;
        const hash = Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
        const style = styles[Math.abs(hash) % styles.length];
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            logoText: prev.logoText?.trim() || 'LeafletAI',
            logoAiStyle: style.id,
            itemStyles: {
                ...prev.itemStyles,
                logo: {
                    ...(prev.itemStyles.logo ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.logo),
                    ...style.patch,
                    color: style.text,
                    bg: style.bg,
                    bgOpacity: 100,
                    borderWidth: 0,
                    fontFamily: style.fontFamily,
                },
            },
        }));
        setCoverBuilderSelected('logo');
    }
    function generateCoverAiContactStyle() {
        const styles = [
            {
                id: 'blue-pill',
                bg: 'linear-gradient(135deg, rgba(30,64,175,.96), rgba(29,78,216,.92))',
                accent: '#dbeafe',
                color: '#ffffff',
                patch: { x: 4, y: 91, w: 92, h: 5.8, radius: 22, fontSize: 13, bold: true, bg: 'linear-gradient(135deg, rgba(30,64,175,.96), rgba(29,78,216,.92))', opacity: 100, align: 'center' as const },
            },
            {
                id: 'dark-glass',
                bg: 'linear-gradient(135deg, rgba(15,23,42,.86), rgba(30,64,175,.68))',
                accent: '#67e8f9',
                color: '#f8fafc',
                patch: { x: 5, y: 90.8, w: 90, h: 6.2, radius: 18, fontSize: 12, bold: true, bg: 'linear-gradient(135deg, rgba(15,23,42,.86), rgba(30,64,175,.68))', opacity: 100, align: 'center' as const },
            },
            {
                id: 'white-strip',
                bg: '#ffffff',
                accent: '#2563eb',
                color: '#164e9e',
                patch: { x: 5, y: 90.8, w: 90, h: 6.2, radius: 18, fontSize: 12, bold: true, bg: '#ffffff', opacity: 92, align: 'center' as const },
            },
            {
                id: 'green-whatsapp',
                bg: 'linear-gradient(135deg, rgba(5,150,105,.94), rgba(20,83,45,.88))',
                accent: '#bbf7d0',
                color: '#ffffff',
                patch: { x: 4, y: 91, w: 92, h: 5.8, radius: 22, fontSize: 12, bold: true, bg: 'linear-gradient(135deg, rgba(5,150,105,.94), rgba(20,83,45,.88))', opacity: 100, align: 'center' as const },
            },
        ];
        const context = `${coverBuilder.contact}|${Date.now()}`;
        const hash = Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
        const style = styles[Math.abs(hash) % styles.length];
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            contactAiStyle: style.id,
            contactAccentColor: style.accent,
            itemStyles: {
                ...prev.itemStyles,
                contact: {
                    ...(prev.itemStyles.contact ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.contact),
                    ...style.patch,
                    color: style.color,
                },
            },
        }));
        setCoverBuilderSelected('contact');
    }
    function generateCoverAiProductCardStyle() {
        const themes = [
            {
                name: 'AI Fresh Glass',
                patch: {
                    card_background: 'linear-gradient(145deg, rgba(236,253,245,.96), rgba(209,250,229,.92))',
                    card_bg_type: 'gradient' as const,
                    card_bg_color2: '#d1fae5',
                    card_bg_gradient_angle: 145,
                    card_border_radius: 18,
                    card_shadow: true,
                    card_border_width: 1,
                    card_border_color: '#34d399',
                    accent_color: '#059669',
                    name_lan1_color: '#064e3b',
                    name_lan2_color: '#047857',
                    origin_color: '#0f766e',
                    origin_lan1_color: '#0f766e',
                    origin_lan2_color: '#0f766e',
                    price_color: '#059669',
                    old_price_color: '#64748b',
                    url_color: '#0f766e',
                    badge_color: '#ef4444',
                    badge_text_color: '#ffffff',
                    image_radius: 14,
                    image_border_width: 1,
                    image_border_color: '#a7f3d0',
                    font_family: 'Poppins',
                },
            },
            {
                name: 'AI Midnight Deal',
                patch: {
                    card_background: 'linear-gradient(145deg, #0f172a, #1e1b4b)',
                    card_bg_type: 'gradient' as const,
                    card_bg_color2: '#1e1b4b',
                    card_bg_gradient_angle: 145,
                    card_border_radius: 20,
                    card_shadow: true,
                    card_border_width: 1,
                    card_border_color: '#818cf8',
                    accent_color: '#a5b4fc',
                    name_lan1_color: '#f8fafc',
                    name_lan2_color: '#c7d2fe',
                    origin_color: '#94a3b8',
                    origin_lan1_color: '#94a3b8',
                    origin_lan2_color: '#94a3b8',
                    price_color: '#facc15',
                    old_price_color: '#94a3b8',
                    url_color: '#93c5fd',
                    badge_color: '#f97316',
                    badge_text_color: '#111827',
                    image_radius: 16,
                    image_border_width: 1,
                    image_border_color: '#312e81',
                    font_family: 'Montserrat',
                },
            },
            {
                name: 'AI Clean Retail',
                patch: {
                    card_background: '#ffffff',
                    card_bg_type: 'solid' as const,
                    card_border_radius: 12,
                    card_shadow: true,
                    card_border_width: 1,
                    card_border_color: '#e2e8f0',
                    accent_color: '#2563eb',
                    name_lan1_color: '#0f172a',
                    name_lan2_color: '#475569',
                    origin_color: '#64748b',
                    origin_lan1_color: '#64748b',
                    origin_lan2_color: '#64748b',
                    price_color: '#dc2626',
                    old_price_color: '#94a3b8',
                    url_color: '#2563eb',
                    badge_color: '#dc2626',
                    badge_text_color: '#ffffff',
                    image_radius: 10,
                    image_border_width: 1,
                    image_border_color: '#f1f5f9',
                    font_family: 'Inter',
                },
            },
            {
                name: 'AI Candy Promo',
                patch: {
                    card_background: 'linear-gradient(145deg, #fff1f2, #fdf2f8)',
                    card_bg_type: 'gradient' as const,
                    card_bg_color2: '#fdf2f8',
                    card_bg_gradient_angle: 145,
                    card_border_radius: 24,
                    card_shadow: true,
                    card_border_width: 1,
                    card_border_color: '#f9a8d4',
                    accent_color: '#db2777',
                    name_lan1_color: '#831843',
                    name_lan2_color: '#be185d',
                    origin_color: '#9f1239',
                    origin_lan1_color: '#9f1239',
                    origin_lan2_color: '#9f1239',
                    price_color: '#db2777',
                    old_price_color: '#9ca3af',
                    url_color: '#be185d',
                    badge_color: '#7c3aed',
                    badge_text_color: '#ffffff',
                    image_radius: 18,
                    image_border_width: 0,
                    image_border_color: '#f9a8d4',
                    font_family: 'Trebuchet MS',
                },
            },
            {
                name: 'AI Luxury Gold',
                patch: {
                    card_background: 'linear-gradient(145deg, #111827, #3f2f12)',
                    card_bg_type: 'gradient' as const,
                    card_bg_color2: '#3f2f12',
                    card_bg_gradient_angle: 145,
                    card_border_radius: 14,
                    card_shadow: true,
                    card_border_width: 1,
                    card_border_color: '#fbbf24',
                    accent_color: '#f59e0b',
                    name_lan1_color: '#fffbeb',
                    name_lan2_color: '#fde68a',
                    origin_color: '#d6d3d1',
                    origin_lan1_color: '#d6d3d1',
                    origin_lan2_color: '#d6d3d1',
                    price_color: '#fbbf24',
                    old_price_color: '#a8a29e',
                    url_color: '#fde68a',
                    badge_color: '#fbbf24',
                    badge_text_color: '#111827',
                    image_radius: 10,
                    image_border_width: 1,
                    image_border_color: '#92400e',
                    font_family: 'Georgia',
                },
            },
        ];
        const context = `${coverBuilderProducts.map(p => p.product_name_lan1).join('|')}|${Date.now()}`;
        const hash = Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
        const theme = themes[Math.abs(hash) % themes.length];
        const layoutVariants = [
            {
                name: 'Catalog split',
                positions: {
                    image: { x: 6, y: 8, w: 39, h: 54, z: 20 },
                    name_lan1: { x: 50, y: 10, w: 43, h: 13, z: 30 },
                    name_lan2: { x: 50, y: 25, w: 42, h: 8, z: 30 },
                    origin_lan1_flag: { x: 50, y: 39, w: 6, h: 6, z: 30 },
                    origin_lan1: { x: 58, y: 39, w: 34, h: 6, z: 30 },
                    origin_lan2_flag: { x: 50, y: 48, w: 6, h: 6, z: 30 },
                    origin_lan2: { x: 58, y: 48, w: 34, h: 6, z: 30 },
                    old_price: { x: 8, y: 70, w: 24, h: 7, z: 35 },
                    current_price: { x: 35, y: 67, w: 39, h: 14, z: 35 },
                    product_url: { x: 8, y: 86, w: 52, h: 7, z: 35 },
                    discount_badge: { x: 70, y: 84, w: 22, h: 9, z: 40 },
                },
                shapes: (accent: string, badge: string) => [
                    { id: `ai-card-shape-${Date.now()}-a`, type: 'rectangle' as const, x: 47, y: 6, w: 49, h: 57, fill: '#ffffff', stroke: accent, strokeWidth: 1, opacity: 0.16, radius: 16, z: 5 },
                    { id: `ai-card-shape-${Date.now()}-b`, type: 'rectangle' as const, x: 5, y: 65, w: 72, h: 19, fill: accent, stroke: accent, strokeWidth: 0, opacity: 0.12, radius: 14, z: 6 },
                    { id: `ai-card-shape-${Date.now()}-c`, type: 'ellipse' as const, x: 66, y: 78, w: 28, h: 21, fill: badge, stroke: badge, strokeWidth: 0, opacity: 0.14, z: 7 },
                    { id: `ai-card-shape-${Date.now()}-d`, type: 'line' as const, x: 48, y: 35, w: 45, h: 1, stroke: accent, strokeWidth: 2, opacity: 0.22, z: 8 },
                ],
            },
            {
                name: 'Premium stack',
                positions: {
                    image: { x: 7, y: 6, w: 86, h: 40, z: 20 },
                    name_lan1: { x: 7, y: 50, w: 62, h: 10, z: 30 },
                    name_lan2: { x: 7, y: 62, w: 60, h: 7, z: 30 },
                    origin_lan1_flag: { x: 7, y: 72, w: 6, h: 6, z: 30 },
                    origin_lan1: { x: 14, y: 72, w: 27, h: 6, z: 30 },
                    origin_lan2_flag: { x: 44, y: 72, w: 6, h: 6, z: 30 },
                    origin_lan2: { x: 51, y: 72, w: 27, h: 6, z: 30 },
                    old_price: { x: 8, y: 85, w: 25, h: 7, z: 35 },
                    current_price: { x: 58, y: 79, w: 34, h: 14, z: 35 },
                    product_url: { x: 8, y: 93, w: 43, h: 6, z: 35 },
                    discount_badge: { x: 71, y: 49, w: 22, h: 10, z: 40 },
                },
                shapes: (accent: string, badge: string) => [
                    { id: `ai-card-shape-${Date.now()}-e`, type: 'rectangle' as const, x: 4, y: 47, w: 92, h: 50, fill: '#ffffff', stroke: accent, strokeWidth: 1, opacity: 0.14, radius: 18, z: 5 },
                    { id: `ai-card-shape-${Date.now()}-f`, type: 'line' as const, x: 8, y: 47, w: 84, h: 1, stroke: accent, strokeWidth: 3, opacity: 0.45, z: 8 },
                    { id: `ai-card-shape-${Date.now()}-g`, type: 'star' as const, x: 70, y: 47, w: 23, h: 20, fill: badge, stroke: badge, strokeWidth: 0, opacity: 0.16, points: 8, rotation: 12, z: 7 },
                    { id: `ai-card-shape-${Date.now()}-h`, type: 'ellipse' as const, x: 74, y: -7, w: 35, h: 26, fill: accent, stroke: accent, strokeWidth: 0, opacity: 0.12, z: 4 },
                ],
            },
            {
                name: 'Offer label',
                positions: {
                    image: { x: 53, y: 9, w: 40, h: 43, z: 20 },
                    name_lan1: { x: 7, y: 10, w: 42, h: 15, z: 30 },
                    name_lan2: { x: 7, y: 27, w: 41, h: 8, z: 30 },
                    origin_lan1_flag: { x: 7, y: 43, w: 6, h: 6, z: 30 },
                    origin_lan1: { x: 15, y: 43, w: 30, h: 6, z: 30 },
                    origin_lan2_flag: { x: 7, y: 52, w: 6, h: 6, z: 30 },
                    origin_lan2: { x: 15, y: 52, w: 30, h: 6, z: 30 },
                    old_price: { x: 8, y: 71, w: 24, h: 7, z: 35 },
                    current_price: { x: 8, y: 78, w: 43, h: 15, z: 35 },
                    product_url: { x: 55, y: 83, w: 36, h: 8, z: 35 },
                    discount_badge: { x: 65, y: 58, w: 27, h: 10, z: 40 },
                },
                shapes: (accent: string, badge: string) => [
                    { id: `ai-card-shape-${Date.now()}-i`, type: 'rectangle' as const, x: 4, y: 6, w: 48, h: 55, fill: accent, stroke: accent, strokeWidth: 0, opacity: 0.10, radius: 16, z: 5 },
                    { id: `ai-card-shape-${Date.now()}-j`, type: 'rectangle' as const, x: 5, y: 68, w: 48, h: 28, fillType: 'gradient' as const, fill: accent, fillColor2: badge, fillGradientAngle: 135, stroke: accent, strokeWidth: 0, opacity: 0.16, radius: 18, z: 6 },
                    { id: `ai-card-shape-${Date.now()}-k`, type: 'triangle' as const, x: 76, y: 52, w: 20, h: 18, fill: badge, stroke: badge, strokeWidth: 0, opacity: 0.18, rotation: 18, z: 7 },
                    { id: `ai-card-shape-${Date.now()}-l`, type: 'line' as const, x: 56, y: 77, w: 34, h: 1, stroke: accent, strokeWidth: 2, opacity: 0.32, z: 8 },
                ],
            },
            {
                name: 'Editorial grid',
                positions: {
                    image: { x: 7, y: 7, w: 44, h: 44, z: 20 },
                    name_lan1: { x: 56, y: 9, w: 37, h: 14, z: 30 },
                    name_lan2: { x: 56, y: 25, w: 36, h: 8, z: 30 },
                    origin_lan1_flag: { x: 56, y: 39, w: 6, h: 6, z: 30 },
                    origin_lan1: { x: 63, y: 39, w: 28, h: 6, z: 30 },
                    origin_lan2_flag: { x: 56, y: 48, w: 6, h: 6, z: 30 },
                    origin_lan2: { x: 63, y: 48, w: 28, h: 6, z: 30 },
                    old_price: { x: 8, y: 71, w: 22, h: 7, z: 35 },
                    current_price: { x: 32, y: 66, w: 34, h: 15, z: 35 },
                    product_url: { x: 8, y: 87, w: 44, h: 7, z: 35 },
                    discount_badge: { x: 70, y: 67, w: 22, h: 10, z: 40 },
                },
                shapes: (accent: string, badge: string) => [
                    { id: `ai-card-shape-${Date.now()}-m`, type: 'rectangle' as const, x: 4, y: 4, w: 50, h: 50, fill: '#ffffff', stroke: accent, strokeWidth: 1, opacity: 0.14, radius: 16, z: 5 },
                    { id: `ai-card-shape-${Date.now()}-n`, type: 'rectangle' as const, x: 54, y: 6, w: 42, h: 53, fill: accent, stroke: accent, strokeWidth: 0, opacity: 0.10, radius: 14, z: 5 },
                    { id: `ai-card-shape-${Date.now()}-o`, type: 'rectangle' as const, x: 5, y: 64, w: 90, h: 31, fill: '#ffffff', stroke: accent, strokeWidth: 1, opacity: 0.15, radius: 18, z: 6 },
                    { id: `ai-card-shape-${Date.now()}-p`, type: 'ellipse' as const, x: 66, y: 62, w: 29, h: 22, fill: badge, stroke: badge, strokeWidth: 0, opacity: 0.13, z: 7 },
                ],
            },
        ];
        const baseLayout = coverBuilder.productCardLayout || cardLayout;
        if (!baseLayout)
            return;
        const variant = layoutVariants[Math.abs(hash >> 3) % layoutVariants.length];
        const accentColor = theme.patch.accent_color;
        const badgeColor = theme.patch.badge_color ?? accentColor;
        const nextLayout: CardLayout = {
            ...baseLayout,
            ...theme.patch,
            show_discount_badge: true,
            badge_show_bg: true,
            badge_radius: 999,
            name_lan1_size: 13,
            name_lan2_size: 10,
            origin_lan1_size: 8,
            origin_lan2_size: 8,
            price_size: 18,
            old_price_size: 9,
            url_size: 9,
            badge_font_size: 9,
            card_radius_mode: 'all',
            image_radius_mode: 'all',
            positions: { ...DEFAULT_POSITIONS, ...variant.positions },
            shapes: variant.shapes(accentColor, badgeColor),
            element_styles: {
                ...(baseLayout.element_styles ?? {}),
                name_lan1: {
                    ...(baseLayout.element_styles?.name_lan1 ?? {}),
                    bold: true,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'left',
                    valign: 'middle',
                    padding: 3,
                    radius: 8,
                    bg: '',
                    bg_opacity: 0,
                } as TextElementStyle,
                name_lan2: {
                    ...(baseLayout.element_styles?.name_lan2 ?? {}),
                    bold: false,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'left',
                    valign: 'middle',
                    padding: 3,
                    radius: 8,
                    bg: '',
                    bg_opacity: 0,
                } as TextElementStyle,
                origin_lan1: {
                    ...(baseLayout.element_styles?.origin_lan1 ?? {}),
                    bold: false,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'left',
                    valign: 'middle',
                    padding: 2,
                    radius: 999,
                    bg: theme.patch.accent_color,
                    bg_opacity: 0.08,
                } as TextElementStyle,
                origin_lan2: {
                    ...(baseLayout.element_styles?.origin_lan2 ?? {}),
                    bold: false,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'left',
                    valign: 'middle',
                    padding: 2,
                    radius: 999,
                    bg: theme.patch.accent_color,
                    bg_opacity: 0.08,
                } as TextElementStyle,
                old_price: {
                    ...(baseLayout.element_styles?.old_price ?? {}),
                    bold: false,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'center',
                    valign: 'middle',
                    padding: 2,
                    radius: 999,
                    bg: theme.patch.accent_color,
                    bg_opacity: 0.08,
                } as TextElementStyle,
                current_price: {
                    ...(baseLayout.element_styles?.current_price ?? {}),
                    bold: true,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'center',
                    valign: 'middle',
                    padding: 3,
                    radius: 999,
                    bg: theme.patch.accent_color,
                    bg_opacity: 0.16,
                    shadow: true,
                } as TextElementStyle,
                discount_badge: {
                    ...(baseLayout.element_styles?.discount_badge ?? {}),
                    bold: true,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'center',
                    valign: 'middle',
                    padding: 4,
                    radius: 999,
                    bg: theme.patch.badge_color ?? '#ef4444',
                    bg_opacity: 1,
                    shadow: true,
                } as TextElementStyle,
                product_url: {
                    ...(baseLayout.element_styles?.product_url ?? {}),
                    bold: true,
                    italic: false,
                    transform: 'none',
                    script: 'none',
                    align: 'center',
                    valign: 'middle',
                    padding: 3,
                    radius: 999,
                    bg: theme.patch.accent_color,
                    bg_opacity: 0.12,
                } as TextElementStyle,
            },
        };
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            productCardLayout: nextLayout,
            productCardTemplateName: `${theme.name} - ${variant.name}`,
            visibleItems: { ...prev.visibleItems, products: true },
        }));
        setCoverBuilderSelected('background');
    }
    function applyCoverTemplateLayout(templateId: string, templatePalette?: { from: string; to: string; glow: string }, templateMeta?: { label: string; layoutId: string; templateKey: string; isStored: boolean; canUpdate: boolean }) {
        const productStripHeight = Number((((flushFullBleedFooter && footerShowFor(safePage) ? cardH : cardHFor(safePage)) / A4_H) * 100).toFixed(2));
        const productStrip = (y: number, radius: number): Partial<CoverBuilderElementStyle> => ({ x: 0, y, w: 100, h: productStripHeight, z: 7, radius });
        const templates: Record<string, {
            headlineLines: 1 | 2 | 3;
            headlineAiStyle: string;
            contactAiStyle: string;
            headlineAccentColor: string;
            contactAccentColor: string;
            styles: Partial<Record<CoverBuilderItemKey, Partial<CoverBuilderElementStyle>>>;
        }> = {
            'hero-left': {
                headlineLines: 2,
                headlineAiStyle: 'fresh-blue',
                contactAiStyle: 'blue-pill',
                headlineAccentColor: '#fb3f83',
                contactAccentColor: '#dbeafe',
                styles: {
                    logo: { x: 5, y: 4, w: 20, h: 8, z: 9, radius: 12, bg: '#ffffff', opacity: 96, imageScale: 84 },
                    headline: { x: 6, y: 16, w: 56, h: 24, z: 8, fontSize: 48, align: 'left', bg: 'transparent', radius: 0 },
                    subline: { x: 6, y: 42, w: 50, h: 7, z: 8, fontSize: 14, align: 'left', bg: '#0f172a', bgOpacity: 18, radius: 999 },
                    basket: { x: 58, y: 37, w: 38, h: 34, z: 5, opacity: 100 },
                    dealTag: { x: 68, y: 12, w: 23, h: 18, z: 10, opacity: 100 },
                    products: productStrip(58, 12),
                    contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
            'hero-right': {
                headlineLines: 3,
                headlineAiStyle: 'hot-promo',
                contactAiStyle: 'dark-glass',
                headlineAccentColor: '#fde047',
                contactAccentColor: '#67e8f9',
                styles: {
                    logo: { x: 72, y: 4, w: 22, h: 8, z: 9, radius: 12, bg: '#ffffff', opacity: 96, imageScale: 84 },
                    headline: { x: 35, y: 15, w: 58, h: 30, z: 8, fontSize: 44, align: 'right', bg: 'transparent', radius: 0 },
                    subline: { x: 41, y: 47, w: 52, h: 7, z: 8, fontSize: 13, align: 'right', bg: '#ffffff', bgOpacity: 14, radius: 999 },
                    basket: { x: 4, y: 36, w: 42, h: 38, z: 5, opacity: 100 },
                    dealTag: { x: 8, y: 12, w: 24, h: 18, z: 10, opacity: 100 },
                    products: productStrip(61, 14),
                    contact: { x: 6, y: 91, w: 88, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
            centered: {
                headlineLines: 2,
                headlineAiStyle: 'ice-outline',
                contactAiStyle: 'white-strip',
                headlineAccentColor: '#60a5fa',
                contactAccentColor: '#2563eb',
                styles: {
                    logo: { x: 39, y: 4, w: 22, h: 8, z: 9, radius: 999, bg: '#ffffff', opacity: 96, imageScale: 88 },
                    headline: { x: 8, y: 16, w: 84, h: 24, z: 8, fontSize: 46, align: 'center', bg: 'transparent', radius: 0 },
                    subline: { x: 16, y: 42, w: 68, h: 7, z: 8, fontSize: 13, align: 'center', bg: '#0f172a', bgOpacity: 16, radius: 999 },
                    basket: { x: 56, y: 46, w: 34, h: 32, z: 5, opacity: 96 },
                    dealTag: { x: 39, y: 50, w: 23, h: 18, z: 10, opacity: 100 },
                    products: productStrip(64, 16),
                    contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
            strip: {
                headlineLines: 1,
                headlineAiStyle: 'wide-white',
                contactAiStyle: 'blue-pill',
                headlineAccentColor: '#facc15',
                contactAccentColor: '#dbeafe',
                styles: {
                    logo: { x: 5, y: 4, w: 19, h: 7, z: 9, radius: 10, bg: '#ffffff', opacity: 96, imageScale: 86 },
                    headline: { x: 6, y: 13, w: 88, h: 15, z: 8, fontSize: 40, align: 'center', bg: 'transparent', radius: 0 },
                    subline: { x: 14, y: 31, w: 72, h: 7, z: 8, fontSize: 13, align: 'center', bg: '#ffffff', bgOpacity: 18, radius: 999 },
                    basket: { x: 7, y: 41, w: 33, h: 31, z: 5, opacity: 96 },
                    dealTag: { x: 72, y: 38, w: 23, h: 18, z: 10, opacity: 100 },
                    products: productStrip(58, 12),
                    contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
            badge: {
                headlineLines: 2,
                headlineAiStyle: 'electric-sale',
                contactAiStyle: 'green-whatsapp',
                headlineAccentColor: '#22d3ee',
                contactAccentColor: '#bbf7d0',
                styles: {
                    logo: { x: 5, y: 5, w: 22, h: 8, z: 9, radius: 12, bg: '#ffffff', opacity: 96, imageScale: 84 },
                    headline: { x: 7, y: 17, w: 78, h: 24, z: 8, fontSize: 46, align: 'left', bg: 'transparent', radius: 0 },
                    subline: { x: 7, y: 44, w: 56, h: 7, z: 8, fontSize: 13, align: 'left', bg: '#ffffff', bgOpacity: 15, radius: 999 },
                    basket: { x: 50, y: 42, w: 40, h: 36, z: 5, opacity: 96 },
                    dealTag: { x: 65, y: 18, w: 26, h: 20, z: 10, opacity: 100 },
                    products: productStrip(63, 14),
                    contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
            compact: {
                headlineLines: 3,
                headlineAiStyle: 'split-gradient',
                contactAiStyle: 'white-strip',
                headlineAccentColor: '#34d399',
                contactAccentColor: '#2563eb',
                styles: {
                    logo: { x: 6, y: 4, w: 18, h: 7, z: 9, radius: 10, bg: '#ffffff', opacity: 96, imageScale: 82 },
                    headline: { x: 8, y: 12, w: 58, h: 30, z: 8, fontSize: 40, align: 'left', bg: 'transparent', radius: 0 },
                    subline: { x: 8, y: 44, w: 48, h: 7, z: 8, fontSize: 12, align: 'left', bg: '#0f172a', bgOpacity: 14, radius: 999 },
                    basket: { x: 60, y: 32, w: 36, h: 34, z: 5, opacity: 96 },
                    dealTag: { x: 66, y: 67, w: 24, h: 18, z: 10, opacity: 100 },
                    products: productStrip(60, 12),
                    contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
                },
            },
        };
        const layoutId = templateMeta?.layoutId || templateId;
        const templateKey = templateMeta?.templateKey || templateId;
        const previousSelectedTemplate = selectedCoverTemplateRef.current;
        const platformTemplateSource = templateMeta?.isStored
            ? platformCoverTemplates.find(template => template.id === templateId)
            : platformCoverTemplates.find(template => {
                const isPlatformTemplate = template.is_platform === true || template.owner_role === 'admin';
                return isPlatformTemplate && (template.template_key === templateKey || (!template.template_key && template.layout_id === layoutId));
            });
        const platformTemplate = platformTemplateSource ? cloneCoverTemplate(platformTemplateSource) : undefined;
        const baseTemplate = templates[platformTemplate?.layout_id || layoutId] ?? templates['hero-left'];
        const platformTemplateStyles = platformTemplate?.elements ? {} : (platformTemplate?.styles || {});
        const template = platformTemplate
            ? {
                ...baseTemplate,
                headlineLines: platformTemplate.headline_lines || baseTemplate.headlineLines,
                headlineAiStyle: platformTemplate.headline_ai_style || baseTemplate.headlineAiStyle,
                contactAiStyle: platformTemplate.contact_ai_style || baseTemplate.contactAiStyle,
                headlineAccentColor: platformTemplate.headline_accent_color || baseTemplate.headlineAccentColor,
                contactAccentColor: platformTemplate.contact_accent_color || baseTemplate.contactAccentColor,
                styles: {
                    ...baseTemplate.styles,
                    ...platformTemplateStyles,
                } as Partial<Record<CoverBuilderItemKey, Partial<CoverBuilderElementStyle>>>,
            }
            : baseTemplate;
        const selectedProducts = products.slice(0, COVER_AI_TEMPLATE_PRODUCT_LIMIT).map(p => p.id);
        const nextSelectedTemplate = {
            id: platformTemplate?.id || templateId,
            templateKey: platformTemplate?.template_key || templateKey,
            label: templateMeta?.label || platformTemplate?.name || templateId,
            layoutId: platformTemplate?.layout_id || layoutId,
            isStored: !!platformTemplate || (templateMeta?.isStored ?? false),
            canUpdate: templateMeta?.canUpdate ?? (coverBuilderOnly || platformTemplate?.can_delete === true || !platformTemplate),
        };
        const stateKey = coverBuilderTemplateStateKey(nextSelectedTemplate);
        const savedTemplateState = coverBuilderTemplateLayouts[stateKey] || coverBuilderTemplatesStateRef.current[stateKey];
        selectedCoverTemplateRef.current = nextSelectedTemplate;
        coverBuilderTemplateSwitchingRef.current = true;
        coverBuilderCanvasDragRef.current = null;
        coverBuilderEditingLiveRef.current = false;
        coverBuilderHistoryRef.current = { past: [], future: [] };
        syncCoverBuilderHistoryCounts();
        setCoverBuilderSelected(null);
        setCoverBuilderSelectedItems([]);
        setSelectedCoverTemplateId(stateKey);
        setCoverBuilder(prev => {
            rememberCoverBuilderTemplateState(previousSelectedTemplate, prev);
            const baseState = normalizeCoverBuilder({
                ...(templatePalette ? {
                bgType: 'gradient' as CoverBuilderBgType,
                bgImage: '',
                aiGeneratedBg: false,
                bgColor: templatePalette.from,
                gradFrom: templatePalette.from,
                gradTo: templatePalette.to,
                gradAngle: 145,
                gradFromStop: 0,
                gradToStop: 100,
                aiGradientCss: `radial-gradient(110% 70% at 10% 5%, ${templatePalette.glow}66, transparent 60%), radial-gradient(90% 60% at 86% 12%, ${templatePalette.to}66, transparent 62%), linear-gradient(145deg, ${templatePalette.from}, ${templatePalette.to})`,
                } : {}),
                headline: formatHeadlineForAiStyle(DEFAULT_COVER_BUILDER.headline, template.headlineLines),
                subline: DEFAULT_COVER_BUILDER.subline,
                contact: DEFAULT_COVER_BUILDER.contact,
                logo: DEFAULT_COVER_BUILDER.logo,
                headlineAiStyle: template.headlineAiStyle,
                headlineAccentColor: template.headlineAccentColor,
                contactAiStyle: template.contactAiStyle,
                contactAccentColor: template.contactAccentColor,
                selectedProductIds: selectedProducts,
                visibleItems: {
                    ...DEFAULT_COVER_BUILDER.visibleItems,
                    logo: true,
                    headline: true,
                    subline: true,
                    contact: true,
                    products: selectedProducts.length > 0,
                    dealTag: true,
                    basket: true,
                },
                itemStyles: (Object.keys(DEFAULT_COVER_BUILDER_ITEM_STYLES) as CoverBuilderItemKey[]).reduce((acc, key) => {
                    acc[key] = {
                        ...DEFAULT_COVER_BUILDER_ITEM_STYLES[key],
                        ...(template.styles[key] ?? {}),
                        ...(key === 'products' ? { bg: 'transparent', borderWidth: 0, opacity: 100 } : {}),
                        ...(key === 'dealTag' || key === 'basket' ? { bg: 'transparent', borderWidth: 0 } : {}),
                    };
                    return acc;
                }, {} as Record<CoverBuilderItemKey, CoverBuilderElementStyle>),
            });
            const templateState = platformTemplate?.elements
                ? applyCoverTemplateElements(baseState, platformTemplate.elements)
                : baseState;
            if (!coverBuilderTemplateOriginalsRef.current[stateKey]) {
                coverBuilderTemplateOriginalsRef.current = {
                    ...coverBuilderTemplateOriginalsRef.current,
                    [stateKey]: coverBuilderStateToTemplateState(stateKey, templateState),
                };
            }
            return savedTemplateState
                ? cloneCoverBuilderState(savedTemplateState.config)
                : cloneCoverBuilderState(coverBuilderTemplateOriginalsRef.current[stateKey]?.config || templateState);
        });
        setSelectedCoverTemplate(nextSelectedTemplate);
        setCoverBuilderSelected('products');
    }
    function requestDeleteCoverTemplateCard(templateId: string, label: string, isPlatformTemplate: boolean, canDelete = true) {
        const template = platformCoverTemplates.find(item => item.id === templateId);
        const adminOwned = template?.is_platform === true || template?.owner_role === 'admin';
        const userCanDelete = coverBuilderOnly || (!adminOwned && canDelete);
        setCoverTemplateDeleteTarget({ id: templateId, label, isPlatformTemplate, hideOnly: !userCanDelete });
    }
    async function confirmDeleteCoverTemplateCard() {
        const target = coverTemplateDeleteTarget;
        if (!target)
            return;
        const template = platformCoverTemplates.find(item => item.id === target.id);
        if (target.isPlatformTemplate && !template) {
            setCoverTemplateDeleteTarget(null);
            return;
        }
        const adminOwned = template?.is_platform === true || template?.owner_role === 'admin';
        if (!target.isPlatformTemplate || target.hideOnly || (!coverBuilderOnly && adminOwned)) {
            setHiddenCoverTemplateIds(prev => prev.includes(target.id) ? prev : [...prev, target.id]);
            setCoverTemplateDeleteTarget(null);
            return;
        }
        try {
            const deleteTemplate = coverBuilderOnly ? deleteAdminCoverLayoutTemplate : deleteCoverLayoutTemplate;
            const result = await deleteTemplate(target.id);
            setPlatformCoverTemplates(Array.isArray(result.templates) ? result.templates : platformCoverTemplates.filter(item => item.id !== target.id));
            setCoverTemplateDeleteTarget(null);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to delete template.';
            setNanoError(message.includes('404') ? 'Template delete endpoint is not available. Restart the backend server and try again.' : message);
        }
    }
    async function addCoverBuilderTemplate() {
        setCoverBuilderAddingTemplate(true);
        setNanoError(null);
        try {
            const stamp = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const templateKey = `custom-${Date.now()}`;
            const saveTemplate = coverBuilderOnly ? createAdminCoverLayoutTemplate : createCoverLayoutTemplate;
            const layoutId = selectedCoverTemplate?.layoutId || 'hero-left';
            const result = await saveTemplate(buildCoverTemplateBody(`Custom cover ${stamp}`, layoutId, coverBuilder, templateKey));
            setPlatformCoverTemplates(prev => {
                if (!result.template)
                    return prev;
                const createdTemplate = cloneCoverTemplate({ ...result.template, can_delete: result.template.can_delete ?? true });
                return [createdTemplate, ...prev.filter(template => template.id !== createdTemplate.id)];
            });
            setCoverBuilderNotice('Template added.');
            window.setTimeout(() => setCoverBuilderNotice(null), 2200);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to add template.';
            setNanoError(message.includes('404') ? 'Template endpoint is not available. Restart the backend server and try Add template again.' : message);
        }
        finally {
            setCoverBuilderAddingTemplate(false);
        }
    }
    async function saveSelectedCoverBuilderTemplate(options: { silent?: boolean; reason?: 'manual' | 'autosave' } = {}) {
        if (!coverBuilderOnly || !selectedCoverTemplate)
            return;
        if (coverBuilderTemplateAutosaveBusyRef.current) {
            if (options.reason === 'autosave')
                coverBuilderTemplateAutosaveQueuedRef.current = true;
            return;
        }
        coverBuilderTemplateAutosaveBusyRef.current = true;
        setCoverBuilderSavingTemplate(true);
        if (!options.silent)
            setNanoError(null);
        try {
            const body = buildCoverTemplateBody(selectedCoverTemplate.label, selectedCoverTemplate.layoutId, coverBuilder, selectedCoverTemplate.templateKey);
            const result = selectedCoverTemplate.isStored
                ? await updateAdminCoverLayoutTemplate(selectedCoverTemplate.id, body)
                : await createAdminCoverLayoutTemplate(body);
            if (result.template) {
                const savedTemplate = cloneCoverTemplate({ ...result.template, can_delete: true });
                setPlatformCoverTemplates(prev => {
                    const withoutSaved = prev.filter(template => template.id !== savedTemplate.id);
                    return prev.some(template => template.id === savedTemplate.id)
                        ? prev.map(template => template.id === savedTemplate.id ? savedTemplate : template)
                        : [savedTemplate, ...withoutSaved];
                });
                const savedSelection = {
                    id: savedTemplate.id,
                    templateKey: savedTemplate.template_key || selectedCoverTemplate.templateKey,
                    label: savedTemplate.name || selectedCoverTemplate.label,
                    layoutId: savedTemplate.layout_id || selectedCoverTemplate.layoutId,
                    isStored: true,
                    canUpdate: true,
                };
                const savedStateKey = coverBuilderTemplateStateKey(savedSelection);
                const savedTemplateState = coverBuilderStateToTemplateState(savedStateKey, coverBuilder);
                setCoverBuilderTemplateLayout(savedStateKey, savedTemplateState);
                coverBuilderTemplateOriginalsRef.current = {
                    ...coverBuilderTemplateOriginalsRef.current,
                    [savedStateKey]: savedTemplateState,
                };
                selectedCoverTemplateRef.current = savedSelection;
                coverBuilderTemplateSwitchingRef.current = true;
                setSelectedCoverTemplateId(savedStateKey);
                setSelectedCoverTemplate(savedSelection);
            }
            if (!options.silent) {
                setCoverBuilderNotice('Template changes saved.');
                window.setTimeout(() => setCoverBuilderNotice(null), 2200);
            }
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to save template changes.';
            setNanoError(message.includes('404') ? 'Template update endpoint is not available. Restart the backend server and try Save template again.' : message);
        }
        finally {
            coverBuilderTemplateAutosaveBusyRef.current = false;
            setCoverBuilderSavingTemplate(false);
            if (coverBuilderTemplateAutosaveQueuedRef.current) {
                coverBuilderTemplateAutosaveQueuedRef.current = false;
                window.setTimeout(() => void saveSelectedCoverBuilderTemplate({ silent: true, reason: 'autosave' }), 250);
            }
        }
    }
    function generateCoverAiTemplate() {
        const now = Date.now();
        const context = `${leaflet?.title || ''}|${products.length}|${coverBuilder.headline}|${now}`;
        let seed = Math.abs(Array.from(context).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)) || 1;
        const rand = (min: number, max: number) => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return Math.round(min + (seed / 4294967295) * (max - min));
        };
        const pick = <T,>(items: readonly T[]): T => items[Math.max(0, Math.min(items.length - 1, rand(0, items.length - 1)))]!;
        const palettes = [
            { name: 'Fresh Market', from: '#00b09b', to: '#96c93d', accent: '#facc15', text: '#ffffff', soft: '#dcfce7', dark: '#064e3b', contact: 'green-whatsapp' },
            { name: 'Electric Blue', from: '#021b79', to: '#0575e6', accent: '#fb3f83', text: '#ffffff', soft: '#dbeafe', dark: '#0f172a', contact: 'blue-pill' },
            { name: 'Hot Sale', from: '#ff512f', to: '#dd2476', accent: '#fde047', text: '#fff7ed', soft: '#ffe4e6', dark: '#7f1d1d', contact: 'white-strip' },
            { name: 'Luxury Night', from: '#141e30', to: '#f2a65a', accent: '#fbbf24', text: '#fff7ed', soft: '#fef3c7', dark: '#111827', contact: 'dark-glass' },
            { name: 'Clean Promo', from: '#0ea5e9', to: '#22c55e', accent: '#f43f5e', text: '#ffffff', soft: '#eff6ff', dark: '#0f172a', contact: 'blue-pill' },
        ] as const;
        const fonts = [
            '"Arial Black", Arial, sans-serif',
            'Impact, Haettenschweiler, "Arial Black", sans-serif',
            'Poppins, Arial, sans-serif',
            'Montserrat, Arial, sans-serif',
            'Oswald, Arial, sans-serif',
            'Inter, Arial, sans-serif',
            '"Trebuchet MS", Arial, sans-serif',
        ];
        const headlineStyles = ['fresh-blue', 'electric-sale', 'hot-promo', 'ice-outline', 'wide-white', 'split-gradient'];
        const contactStyles = ['blue-pill', 'dark-glass', 'white-strip', 'green-whatsapp'];
        const palette = pick(palettes);
        const fontFamily = pick(fonts);
        const headlineStyle = pick(headlineStyles);
        const contactStyle = contactStyles.includes(palette.contact) ? palette.contact : pick(contactStyles);
        const selectedProducts = [...products]
            .sort((a, b) => {
            const discountA = a.old_price !== null && a.current_price !== null && a.old_price > a.current_price
                ? (a.old_price - a.current_price) / a.old_price
                : -1;
            const discountB = b.old_price !== null && b.current_price !== null && b.old_price > b.current_price
                ? (b.old_price - b.current_price) / b.old_price
                : -1;
            if (discountB !== discountA)
                return discountB - discountA;
            return (a.current_price ?? Infinity) - (b.current_price ?? Infinity);
        })
            .slice(0, COVER_AI_TEMPLATE_PRODUCT_LIMIT)
            .map(product => product.id);
        const productStripHeight = Number((((flushFullBleedFooter && footerShowFor(safePage) ? cardH : cardHFor(safePage)) / A4_H) * 100).toFixed(2));
        const productStrip = (y: number, z: number, radius: number) => ({ x: 0, y, w: 100, h: productStripHeight, z, radius });
        const layouts = [
            {
                name: 'hero-left',
                headlineLines: 2 as const,
                logo: { x: 5, y: 4, w: 20, h: 8, z: 9, radius: 12, bg: '#ffffff', opacity: 96, imageScale: rand(72, 92) },
                headline: { x: 6, y: 16, w: 56, h: 24, z: 8, fontSize: rand(42, 52), align: 'left' as const, bg: 'transparent', radius: 0 },
                subline: { x: 6, y: 42, w: 50, h: 7, z: 8, fontSize: rand(12, 16), align: 'left' as const, bg: palette.dark, bgOpacity: 18, radius: 999 },
                basket: { x: 58, y: 37, w: rand(34, 42), h: rand(28, 38), z: 5, opacity: 100 },
                dealTag: { x: 67, y: 12, w: rand(19, 25), h: rand(14, 20), z: 10, opacity: 100 },
                products: productStrip(58, 7, 12),
                contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
            },
            {
                name: 'hero-right',
                headlineLines: 3 as const,
                logo: { x: 72, y: 4, w: 22, h: 8, z: 9, radius: 12, bg: '#ffffff', opacity: 96, imageScale: rand(72, 92) },
                headline: { x: 35, y: 15, w: 58, h: 30, z: 8, fontSize: rand(38, 48), align: 'right' as const, bg: 'transparent', radius: 0 },
                subline: { x: 41, y: 47, w: 52, h: 7, z: 8, fontSize: rand(12, 15), align: 'right' as const, bg: '#ffffff', bgOpacity: 14, radius: 999 },
                basket: { x: 4, y: 36, w: rand(36, 46), h: rand(32, 42), z: 5, opacity: 100 },
                dealTag: { x: 8, y: 12, w: rand(19, 26), h: rand(14, 20), z: 10, opacity: 100 },
                products: productStrip(61, 7, 14),
                contact: { x: 6, y: 91, w: 88, h: 5.8, z: 9, fontSize: 12, radius: 22 },
            },
            {
                name: 'center-badge',
                headlineLines: 2 as const,
                logo: { x: 39, y: 4, w: 22, h: 8, z: 9, radius: 999, bg: '#ffffff', opacity: 96, imageScale: rand(74, 94) },
                headline: { x: 8, y: 16, w: 84, h: 24, z: 8, fontSize: rand(40, 50), align: 'center' as const, bg: 'transparent', radius: 0 },
                subline: { x: 16, y: 42, w: 68, h: 7, z: 8, fontSize: rand(12, 15), align: 'center' as const, bg: palette.dark, bgOpacity: 16, radius: 999 },
                basket: { x: 56, y: 46, w: rand(30, 38), h: rand(28, 35), z: 5, opacity: 96 },
                dealTag: { x: 39, y: 50, w: rand(19, 25), h: rand(14, 20), z: 10, opacity: 100 },
                products: productStrip(64, 7, 16),
                contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
            },
            {
                name: 'retail-strip',
                headlineLines: 1 as const,
                logo: { x: 5, y: 4, w: 19, h: 7, z: 9, radius: 10, bg: '#ffffff', opacity: 96, imageScale: rand(74, 94) },
                headline: { x: 6, y: 13, w: 88, h: 15, z: 8, fontSize: rand(36, 44), align: 'center' as const, bg: 'transparent', radius: 0 },
                subline: { x: 14, y: 31, w: 72, h: 7, z: 8, fontSize: rand(12, 15), align: 'center' as const, bg: '#ffffff', bgOpacity: 18, radius: 999 },
                basket: { x: 7, y: 41, w: rand(28, 36), h: rand(26, 34), z: 5, opacity: 96 },
                dealTag: { x: 72, y: 38, w: rand(19, 25), h: rand(14, 20), z: 10, opacity: 100 },
                products: productStrip(58, 7, 12),
                contact: { x: 5, y: 91, w: 90, h: 5.8, z: 9, fontSize: 12, radius: 22 },
            },
        ];
        const layout = pick(layouts);
        const selectedGradientAngle = rand(118, 148);
        const aiGradientCss = [
            `radial-gradient(${rand(78, 116)}% ${rand(52, 76)}% at ${rand(-16, 18)}% ${rand(-10, 24)}%, ${hexToRgba(palette.accent, 0.36)} 0%, transparent ${rand(56, 72)}%)`,
            `radial-gradient(${rand(92, 138)}% ${rand(72, 108)}% at ${rand(78, 112)}% ${rand(48, 88)}%, ${hexToRgba(palette.soft, 0.28)} 0%, transparent ${rand(58, 76)}%)`,
            `radial-gradient(${rand(120, 172)}% ${rand(74, 106)}% at ${rand(20, 72)}% ${rand(84, 112)}%, ${hexToRgba(palette.dark, 0.22)} 0%, transparent ${rand(62, 80)}%)`,
            `linear-gradient(${selectedGradientAngle}deg, ${palette.from} 0%, ${palette.to} 100%)`,
        ].join(', ');
        const baseProductLayout = coverBuilder.productCardLayout || cardLayout;
        const generatedProductCardLayout = baseProductLayout
            ? ({
                ...baseProductLayout,
                card_background: '#ffffff',
                card_bg_type: 'solid',
                card_border_radius: 14,
                card_shadow: true,
                card_border_width: 1,
                card_border_color: hexToRgba(palette.accent, 0.5),
                accent_color: palette.accent,
                name_lan1_color: palette.dark,
                name_lan2_color: '#334155',
                origin_color: '#64748b',
                origin_lan1_color: '#64748b',
                origin_lan2_color: '#64748b',
                price_color: palette.accent,
                old_price_color: '#94a3b8',
                badge_color: palette.accent,
                badge_text_color: palette.dark,
                image_radius: 12,
                image_border_width: 0,
                font_family: fontFamily.split(',')[0].replace(/"/g, ''),
                show_discount_badge: true,
            } as CardLayout)
            : coverBuilder.productCardLayout;
        const nextStyles: Record<CoverBuilderItemKey, CoverBuilderElementStyle> = {
            ...coverBuilder.itemStyles,
            logo: { ...(coverBuilder.itemStyles.logo ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.logo), ...layout.logo, color: palette.dark, borderWidth: 0, align: 'center' },
            headline: {
                ...(coverBuilder.itemStyles.headline ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.headline),
                ...layout.headline,
                color: palette.text,
                bold: true,
                italic: false,
                opacity: 100,
                borderWidth: 0,
                fontFamily,
            },
            subline: {
                ...(coverBuilder.itemStyles.subline ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.subline),
                ...layout.subline,
                color: palette.text,
                bold: true,
                italic: false,
                opacity: 100,
                borderWidth: 0,
                fontFamily: 'Inter, Arial, sans-serif',
            },
            basket: { ...(coverBuilder.itemStyles.basket ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.basket), ...layout.basket, bg: 'transparent', borderWidth: 0, align: 'center' },
            dealTag: { ...(coverBuilder.itemStyles.dealTag ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.dealTag), ...layout.dealTag, bg: 'transparent', borderWidth: 0, align: 'center' },
            products: { ...(coverBuilder.itemStyles.products ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.products), ...layout.products, bg: 'transparent', borderWidth: 0, opacity: 100 },
            contact: {
                ...(coverBuilder.itemStyles.contact ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.contact),
                ...layout.contact,
                color: contactStyle === 'white-strip' ? palette.dark : '#ffffff',
                bg: contactStyle === 'white-strip'
                    ? '#ffffff'
                    : contactStyle === 'green-whatsapp'
                        ? 'linear-gradient(135deg, rgba(5,150,105,.94), rgba(20,83,45,.88))'
                        : contactStyle === 'dark-glass'
                            ? 'linear-gradient(135deg, rgba(15,23,42,.86), rgba(30,64,175,.68))'
                            : 'linear-gradient(135deg, rgba(30,64,175,.96), rgba(29,78,216,.92))',
                bold: true,
                opacity: 100,
                borderWidth: 0,
                align: 'center',
                fontFamily: 'Inter, Arial, sans-serif',
            },
        };
        updateCoverBuilderForSelectedTemplate(prev => ({
            ...prev,
            bgType: 'gradient',
            bgColor: palette.from,
            gradFrom: palette.from,
            gradTo: palette.to,
            gradAngle: selectedGradientAngle,
            gradFromStop: 0,
            gradToStop: 100,
            aiGradientCss,
            headline: formatHeadlineForAiStyle(prev.headline || 'Weekly Fresh Offers', layout.headlineLines),
            headlineAiStyle: headlineStyle,
            headlineAccentColor: palette.accent,
            contactAiStyle: contactStyle,
            contactAccentColor: palette.soft,
            dealTagUrl: pick(availableCoverDealTags.length > 0 ? availableCoverDealTags : COVER_DEAL_TAGS).url,
            basketUrl: pick(COVER_BASKETS).url,
            basketFit: 'contain',
            basketCropX: 50,
            basketCropY: 50,
            basketCropZoom: 100,
            selectedProductIds: selectedProducts.length > 0 ? selectedProducts : prev.selectedProductIds.slice(0, COVER_AI_TEMPLATE_PRODUCT_LIMIT),
            visibleItems: {
                logo: true,
                headline: true,
                subline: true,
                contact: true,
                products: selectedProducts.length > 0 || prev.visibleItems.products,
                dealTag: true,
                basket: true,
            },
            itemStyles: nextStyles,
            productCardLayout: generatedProductCardLayout,
            productCardTemplateName: `${palette.name} ${layout.name}`,
        }));
        setCoverBuilderSelected('background');
        setNanoError(null);
    }
    function ContactInfoIcon({ type }: {
        type: ContactInfoType;
    }) {
        const paths: Record<ContactInfoType, string> = {
            website: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 0c2.4 2.7 3.6 6 3.6 10S14.4 19.3 12 22m0-20C9.6 4.7 8.4 8 8.4 12s1.2 7.3 3.6 10M2.8 9h18.4M2.8 15h18.4',
            phone: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.4 19.4 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.4 2.1L8.1 10a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.6 2.9.7a2 2 0 011.6 1.9z',
            whatsapp: 'M20.5 11.8a8.5 8.5 0 01-12.6 7.4L3 20.5l1.3-4.7a8.5 8.5 0 1116.2-4zm-8.2-6a6 6 0 00-5.1 9.2l.3.5-.7 2.4 2.5-.7.5.3a6 6 0 008.7-5.4 6.1 6.1 0 00-6.2-6.3zm3.5 8.5c-.2.5-1 1-1.4 1.1-.4.1-.9.1-1.5-.1-.3-.1-.8-.3-1.4-.6a8 8 0 01-2.9-2.6c-.2-.3-.7-1-.7-1.9 0-.9.5-1.3.6-1.5.2-.2.4-.2.6-.2h.4c.1 0 .3 0 .4.3l.6 1.4c.1.2.1.3 0 .5l-.3.4-.2.3c-.1.1-.2.3-.1.5.1.2.5.9 1.1 1.4.7.7 1.3.9 1.5 1 .2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.4.7c.2.1.4.2.4.3z',
            location: 'M12 21s7-5.2 7-12a7 7 0 10-14 0c0 6.8 7 12 7 12zm0-9a3 3 0 110-6 3 3 0 010 6z',
        };
        return (<svg className="lv-cb-contact-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d={paths[type]}/>
      </svg>);
    }
    function renderCoverBuilderTextElement(itemKey: 'headline' | 'subline' | 'contact') {
        const isActive = coverBuilderSelected === itemKey;
        const isSelected = isActive || coverBuilderSelectedItems.includes(itemKey);
        const Tag = itemKey === 'headline' ? 'h2' : itemKey === 'subline' ? 'p' : 'div';
        const className = [
            itemKey === 'contact' ? 'lv-cb-contact' : 'lv-cb-text-el',
            isSelected ? 'selected' : '',
            itemKey === 'headline' && coverBuilder.headlineAiStyle ? `lv-cb-headline-ai lv-cb-headline-ai--${coverBuilder.headlineAiStyle}` : '',
            itemKey === 'contact' && coverBuilder.contactAiStyle ? `lv-cb-contact-ai lv-cb-contact-ai--${coverBuilder.contactAiStyle}` : '',
        ].filter(Boolean).join(' ');
        const headlineLines = itemKey === 'headline'
            ? coverBuilder.headline.split('\n').map(line => line.trim()).filter(Boolean)
            : [];
        const contactItems = itemKey === 'contact' && coverBuilder.contactAiStyle
            ? parseContactInfo(coverBuilder.contact)
            : [];
        return (<Tag key={coverBuilderElementRenderKey(itemKey, 'editable')} data-template-id={coverBuilderRenderTemplateId()} data-element-id={itemKey} className={cx(className, cssClass(coverBuilderElementStyle(itemKey)))} data-accent={coverBuilder.headlineAccentColor} {...coverBuilderDragHandlers(itemKey)} onClick={e => { e.stopPropagation(); selectCoverBuilderItem(itemKey, e.shiftKey); }}>
        {itemKey === 'contact' && coverBuilder.contactAiStyle ? (<span className="lv-cb-contact-items" onClick={e => { e.stopPropagation(); selectCoverBuilderItem(itemKey, e.shiftKey); }}>
            {contactItems.map((item, idx) => (<span key={`${item.type}-${item.value}-${idx}`} className="lv-cb-contact-item">
                <ContactInfoIcon type={item.type}/>
                <span>{item.value}</span>
              </span>))}
          </span>) : (<span className="lv-cb-editable-text" contentEditable suppressContentEditableWarning spellCheck={false} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); selectCoverBuilderItem(itemKey, e.shiftKey); }} onInput={e => setCoverBuilderValue(itemKey, itemKey === 'headline' ? e.currentTarget.innerText || '' : e.currentTarget.textContent || '')} onBlur={() => setCoverBuilderSaveTick(t => t + 1)} onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        if (itemKey !== 'headline') {
                            e.preventDefault();
                            e.currentTarget.blur();
                        }
                    }
                }}>
            {itemKey === 'headline' && coverBuilder.headlineAiStyle && headlineLines.length > 0
                    ? headlineLines.map((line, idx) => (<span key={`${line}-${idx}`} className={`lv-cb-headline-line lv-cb-headline-line--${idx + 1}`}>{line}</span>))
                    : coverBuilder[itemKey]}
          </span>)}
        {isActive && <CoverBuilderDeleteButton itemKey={itemKey}/>}
        {isActive && <span className="lv-cb-move-handle" title="Move" aria-label={`Move ${itemKey}`} onPointerDown={e => startCoverBuilderCanvasDrag(e, itemKey, 'move')}>Move</span>}
        {isActive && <span className="lv-cb-rotate-handle material-symbol" title="Rotate" aria-label={`Rotate ${itemKey}`} onPointerDown={e => startCoverBuilderCanvasDrag(e, itemKey, 'rotate')}>rotate_right</span>}
        {isActive && <span className="lv-cb-resize-handle" onPointerDown={e => startCoverBuilderCanvasDrag(e, itemKey, 'resize')}/>}
      </Tag>);
    }
    function renderCoverBuilderSurface(options: { interactive?: boolean; scale?: number; applied?: boolean; builder?: CoverBuilderState; editableProducts?: boolean } = {}) {
        const interactive = !!options.interactive;
        const canEditProducts = !!options.editableProducts;
        const builder = options.builder || coverBuilder;
        const builderProducts = products.filter(p => new Set(builder.selectedProductIds).has(p.id));
        const builderProductCardLayout = builder.productCardLayout || cardLayout;
        const builderBg = builder.bgType === 'image' && builder.bgImage
            ? `url(${builder.bgImage}) center/cover no-repeat`
            : builder.bgType === 'solid'
                ? builder.bgColor
                : builder.aiGradientCss
                    || `linear-gradient(${builder.gradAngle}deg, ${builder.gradFrom} ${builder.gradFromStop}%, ${builder.gradTo} ${builder.gradToStop}%)`;
        const builderElementStyle = (key: CoverBuilderItemKey) => interactive
            ? coverBuilderElementStyle(key)
            : coverBuilderElementStyle(key, builder);
        const coverProductCount = Math.min(builderProducts.length, 6);
        const coverProductCols = Math.min(colsPerPage, coverProductCount || 1);
        const coverProductCardW = cardW;
        const coverProductCardH = flushFullBleedFooter && footerShowFor(safePage) ? cardH : cardHFor(safePage);
        const productAreaStyle = builder.itemStyles.products ?? DEFAULT_COVER_BUILDER_ITEM_STYLES.products;
        const productGridJustify = productAreaStyle.align === 'right' ? 'end' : productAreaStyle.align === 'center' ? 'center' : 'start';
        const productGridAlign = productAreaStyle.valign === 'bottom' ? 'end' : productAreaStyle.valign === 'middle' ? 'center' : 'start';
        const elementObjectPosition = (key: CoverBuilderItemKey) => {
            const s = builder.itemStyles[key] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[key];
            const x = s.align === 'right' ? '100%' : s.align === 'center' ? '50%' : '0%';
            const y = s.valign === 'bottom' ? '100%' : s.valign === 'middle' ? '50%' : '0%';
            return `${x} ${y}`;
        };
        const surfaceClass = cx("lv-cover-builder-preview", options.applied ? 'lv-cover-builder-preview--applied' : '', builder.bgType === 'image' && builder.bgImage && builder.aiGeneratedBg ? 'lv-cover-builder-preview--generated-bg' : '', cssClass({
            background: builderBg,
            width: A4_W,
            height: A4_H,
            transform: options.scale ? `scale(${options.scale})` : undefined,
        }));
        const surfaceEvents = interactive
            ? {
                ref: coverBuilderPreviewRef,
                onClick: () => clearCoverBuilderSelection('background'),
                onDragOver: (e: React.DragEvent<HTMLDivElement>) => e.preventDefault(),
                onDrop: handleCoverBuilderBgDrop,
            }
            : {};
        const renderStaticTextElement = (itemKey: 'headline' | 'subline' | 'contact') => {
            const Tag = itemKey === 'headline' ? 'h1' : itemKey === 'subline' ? 'p' : 'div';
            const className = itemKey === 'headline'
                ? `lv-cb-text-el lv-cb-headline-ai ${builder.headlineAiStyle ? `lv-cb-headline-ai--${builder.headlineAiStyle}` : ''}`
                : itemKey === 'subline'
                    ? 'lv-cb-text-el'
                    : `lv-cb-contact ${builder.contactAiStyle ? `lv-cb-contact-ai lv-cb-contact-ai--${builder.contactAiStyle}` : ''}`;
            const headlineLines = builder.headline.split(/\n+/).map(line => line.trim()).filter(Boolean);
            const contactItems = itemKey === 'contact' && builder.contactAiStyle
                ? parseContactInfo(builder.contact)
                : [];
            return (<Tag key={coverBuilderElementRenderKey(itemKey, 'static-text')} data-template-id={coverBuilderRenderTemplateId()} data-element-id={itemKey} className={cx(className, cssClass(builderElementStyle(itemKey)))} data-accent={builder.headlineAccentColor}>
              {itemKey === 'contact' && builder.contactAiStyle ? (<span className="lv-cb-contact-items">
                  {contactItems.map((item, idx) => (<span key={`${item.type}-${item.value}-${idx}`} className="lv-cb-contact-item">
                      <ContactInfoIcon type={item.type}/>
                      <span>{item.value}</span>
                    </span>))}
                </span>) : (<span className="lv-cb-editable-text">
                  {itemKey === 'headline' && builder.headlineAiStyle && headlineLines.length > 0
                    ? headlineLines.map((line, idx) => (<span key={`${line}-${idx}`} className={`lv-cb-headline-line lv-cb-headline-line--${idx + 1}`}>{line}</span>))
                    : builder[itemKey]}
                </span>)}
            </Tag>);
        };
        return (<div key={coverBuilderElementRenderKey('surface', interactive ? 'interactive' : options.applied ? 'applied' : 'static')} data-template-id={coverBuilderRenderTemplateId()} className={surfaceClass} {...surfaceEvents}>
          {builder.visibleItems.logo && (<div key={coverBuilderElementRenderKey('logo', interactive ? 'editable' : 'static')} data-template-id={coverBuilderRenderTemplateId()} data-element-id="logo" className={cx(`lv-cb-logo-slot${builder.logoAiStyle ? ` lv-cb-logo-ai lv-cb-logo-ai--${builder.logoAiStyle}` : ''}${interactive && (coverBuilderSelected === 'logo' || coverBuilderSelectedItems.includes('logo')) ? ' selected' : ''}`, cssClass(builderElementStyle('logo')))} {...(interactive ? coverBuilderDragHandlers('logo') : {})} onClick={interactive ? e => { e.stopPropagation(); selectCoverBuilderItem('logo', e.shiftKey); } : undefined}>
              {builder.logo && <img src={builder.logo} alt="" className={cssClass({ objectPosition: elementObjectPosition('logo') })}/>}
              <span className={cx('lv-cb-logo-text', !builder.logoText.trim() && builder.logo ? 'lv-cb-logo-text--empty' : '')}>
                {builder.logoText.trim() || (builder.logo ? '' : 'Logo')}
              </span>
              {interactive && coverBuilderSelected === 'logo' && <CoverBuilderDeleteButton itemKey="logo"/>}
              {interactive && coverBuilderSelected === 'logo' && <span className="lv-cb-rotate-handle material-symbol" title="Rotate" aria-label="Rotate logo" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'logo', 'rotate')}>rotate_right</span>}
              {interactive && coverBuilderSelected === 'logo' && <span className="lv-cb-resize-handle" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'logo', 'resize')}/>}
            </div>)}
          {builder.visibleItems.headline && (interactive ? renderCoverBuilderTextElement('headline') : renderStaticTextElement('headline'))}
          {builder.visibleItems.subline && (interactive ? renderCoverBuilderTextElement('subline') : renderStaticTextElement('subline'))}
          {builder.visibleItems.dealTag && (<div key={coverBuilderElementRenderKey('dealTag', interactive ? 'editable' : 'static')} data-template-id={coverBuilderRenderTemplateId()} data-element-id="dealTag" className={cx(`lv-cb-deal-tag${interactive && (coverBuilderSelected === 'dealTag' || coverBuilderSelectedItems.includes('dealTag')) ? ' selected' : ''}`, cssClass(builderElementStyle('dealTag')))} {...(interactive ? coverBuilderDragHandlers('dealTag') : {})} onClick={interactive ? e => { e.stopPropagation(); selectCoverBuilderItem('dealTag', e.shiftKey); } : undefined}>
              <img src={builder.dealTagUrl || defaultCoverDealTag.url} alt="Deal tag" className={cssClass({ objectPosition: elementObjectPosition('dealTag') })}/>
              {interactive && coverBuilderSelected === 'dealTag' && <CoverBuilderDeleteButton itemKey="dealTag"/>}
              {interactive && coverBuilderSelected === 'dealTag' && <span className="lv-cb-rotate-handle material-symbol" title="Rotate" aria-label="Rotate deal tag" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'dealTag', 'rotate')}>rotate_right</span>}
              {interactive && coverBuilderSelected === 'dealTag' && <span className="lv-cb-resize-handle" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'dealTag', 'resize')}/>}
            </div>)}
          {builder.visibleItems.basket && (<div key={coverBuilderElementRenderKey('basket', interactive ? 'editable' : 'static')} data-template-id={coverBuilderRenderTemplateId()} data-element-id="basket" className={cx(`lv-cb-basket${interactive && (coverBuilderSelected === 'basket' || coverBuilderSelectedItems.includes('basket')) ? ' selected' : ''}`, cssClass(builderElementStyle('basket')))} {...(interactive ? coverBuilderDragHandlers('basket') : {})} onClick={interactive ? e => { e.stopPropagation(); selectCoverBuilderItem('basket', e.shiftKey); } : undefined}>
              <img src={builder.basketUrl || COVER_BASKETS[0].url} alt="Basket" className={cssClass({
                    objectFit: builder.basketFit,
                    objectPosition: builder.basketFit === 'cover' ? `${builder.basketCropX}% ${builder.basketCropY}%` : elementObjectPosition('basket'),
                    transform: `scale(${builder.basketFit === 'cover' ? builder.basketCropZoom / 100 : 1})`,
                    transformOrigin: `${builder.basketCropX}% ${builder.basketCropY}%`,
                })}/>
              {interactive && coverBuilderSelected === 'basket' && <CoverBuilderDeleteButton itemKey="basket"/>}
              {interactive && coverBuilderSelected === 'basket' && <span className="lv-cb-rotate-handle material-symbol" title="Rotate" aria-label="Rotate basket" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'basket', 'rotate')}>rotate_right</span>}
              {interactive && coverBuilderSelected === 'basket' && <span className="lv-cb-resize-handle" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'basket', 'resize')}/>}
            </div>)}
          {builder.visibleItems.products && (<div key={coverBuilderElementRenderKey('products', interactive ? 'editable' : 'static')} data-template-id={coverBuilderRenderTemplateId()} data-element-id="products" className={cx(`lv-cb-products${interactive && (coverBuilderSelected === 'products' || coverBuilderSelectedItems.includes('products')) ? ' selected' : ''}`, cssClass({
                ...builderElementStyle('products'),
                gridTemplateColumns: `repeat(${coverProductCols}, ${coverProductCardW}px)`,
                gridAutoRows: `${coverProductCardH}px`,
                justifyContent: productGridJustify,
                alignContent: productGridAlign,
            }))} {...(interactive ? coverBuilderDragHandlers('products') : {})} onClick={interactive ? e => { e.stopPropagation(); selectCoverBuilderItem('products', e.shiftKey); } : undefined}>
              {builderProducts.length === 0
                ? <div className="lv-cb-products-placeholder">{products.length === 0 ? 'Upload products first' : 'Select cover products'}</div>
                : builderProductCardLayout
                    ? builderProducts.slice(0, 6).map(p => (<div key={`${coverBuilderRenderTemplateId()}-${p.id}`} className={cx("lv-cb-product-card", canEditProducts ? 'lv-cb-product-card--editable' : '', cssClass({ width: coverProductCardW, height: coverProductCardH }))}>
                        <ProductCard p={p} isTwoLang={isTwoLang} leafletId={id ?? ''} onUpdate={handleProductUpdate} onDelete={handleProductDelete} cardLayout={builderProductCardLayout} cardWidth={coverProductCardW} cardHeight={coverProductCardH} overlays={[]} showShapes imageLoading="eager" captureSafeImages showActions={false}/>
                        {canEditProducts && <button type="button" className="lv-cb-product-edit-btn lv-cb-product-edit-btn--overlay" onPointerDown={e => e.stopPropagation()} onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCoverBuilderEditingProduct(p);
                        }} aria-label={`Edit ${p.product_name_lan1}`} title="Edit product">Edit</button>}
                      </div>))
                    : builderProducts.slice(0, 6).map(p => (<div key={`${coverBuilderRenderTemplateId()}-${p.id}`} className="lv-cb-product">
                        {p.product_img_url && <img src={toCanvasSafeImageUrl(p.product_img_url) || p.product_img_url} alt=""/>}
                        <span>{p.product_name_lan1}</span>
                        {p.current_price !== null && <strong>{p.current_price}</strong>}
                        {canEditProducts && <button type="button" className="lv-cb-product-edit-btn" onPointerDown={e => e.stopPropagation()} onClick={e => {
                            e.stopPropagation();
                            setCoverBuilderEditingProduct(p);
                        }} aria-label={`Edit ${p.product_name_lan1}`} title="Edit product">Edit</button>}
                      </div>))}
              {interactive && coverBuilderSelected === 'products' && <CoverBuilderDeleteButton itemKey="products"/>}
              {interactive && coverBuilderSelected === 'products' && <span className="lv-cb-rotate-handle material-symbol" title="Rotate" aria-label="Rotate products" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'products', 'rotate')}>rotate_right</span>}
              {interactive && coverBuilderSelected === 'products' && <span className="lv-cb-resize-handle" onPointerDown={e => startCoverBuilderCanvasDrag(e, 'products', 'resize')}/>}
            </div>)}
          {builder.visibleItems.contact && (interactive ? renderCoverBuilderTextElement('contact') : renderStaticTextElement('contact'))}
        </div>);
    }
    function getCoverBuilderTemplateCards() {
        const builtinCoverTemplates = [
            { templateId: 'hero-left', label: 'Hero left', thumbId: 'hero-left', templateKey: 'hero-left', isPlatformTemplate: false, canDelete: false },
            { templateId: 'hero-right', label: 'Hero right', thumbId: 'hero-right', templateKey: 'hero-right', isPlatformTemplate: false, canDelete: false },
            { templateId: 'centered', label: 'Centered', thumbId: 'centered', templateKey: 'centered', isPlatformTemplate: false, canDelete: false },
            { templateId: 'strip', label: 'Retail strip', thumbId: 'strip', templateKey: 'strip', isPlatformTemplate: false, canDelete: false },
            { templateId: 'badge', label: 'Badge hero', thumbId: 'badge', templateKey: 'badge', isPlatformTemplate: false, canDelete: false },
            { templateId: 'compact', label: 'Compact', thumbId: 'compact', templateKey: 'compact', isPlatformTemplate: false, canDelete: false },
        ];
        const builtinCoverTemplateKeys = new Set(builtinCoverTemplates.map(template => template.templateKey));
        const coverTemplateCards = [
            ...builtinCoverTemplates.filter(template => !hiddenCoverTemplateIds.includes(template.templateId)),
            ...platformCoverTemplates
                .filter(template => !hiddenCoverTemplateIds.includes(template.id))
                .filter(template => coverBuilderOnly || !(template.is_platform === true && builtinCoverTemplateKeys.has(template.template_key || template.layout_id || '')))
                .map(template => {
                const adminOwned = template.is_platform === true || template.owner_role === 'admin';
                return {
                    templateId: template.id,
                    label: template.name,
                    thumbId: template.layout_id || 'hero-left',
                    templateKey: template.template_key || template.id,
                    isPlatformTemplate: true,
                    canDelete: coverBuilderOnly || (!adminOwned && template.can_delete === true),
                };
            }),
        ];
        return coverTemplateCards;
    }
    function coverBuilderTemplatePalette(templateIndex: number) {
        const templateThumbPalettes = [
            ['#0f172a', '#2563eb', '#f43f5e'],
            ['#064e3b', '#22c55e', '#facc15'],
            ['#581c87', '#ec4899', '#38bdf8'],
            ['#7f1d1d', '#f97316', '#fde047'],
            ['#0c4a6e', '#06b6d4', '#a3e635'],
            ['#312e81', '#8b5cf6', '#fb7185'],
            ['#111827', '#f59e0b', '#14b8a6'],
            ['#164e63', '#67e8f9', '#f472b6'],
            ['#3f6212', '#84cc16', '#0ea5e9'],
            ['#701a75', '#d946ef', '#fbbf24'],
        ] as const;
        return templateThumbPalettes[templateIndex % templateThumbPalettes.length]!;
    }
    function renderCoverTemplateGrid(options: { showDelete?: boolean; className?: string } = {}) {
        const coverTemplateCards = getCoverBuilderTemplateCards();
        return (<div className={cx("lv-cb-template-grid", options.className || '')}>
          {coverTemplateCards.map(({ templateId, label, thumbId, templateKey, isPlatformTemplate, canDelete }, templateIndex) => {
                const [from, to, glow] = coverBuilderTemplatePalette(templateIndex);
                const templateThumbStyle = {
                    '--template-from': from,
                    '--template-to': to,
                    '--template-glow': glow,
                    background: `radial-gradient(110% 70% at 10% 5%, ${glow}66, transparent 60%), radial-gradient(90% 60% at 86% 12%, ${to}66, transparent 62%), linear-gradient(145deg, ${from}, ${to})`,
                } as React.CSSProperties;
                const templateStateKey = coverBuilderTemplateStateKey({ id: templateId, templateKey, isStored: isPlatformTemplate });
                const isSelectedTemplate = selectedCoverTemplateId === templateStateKey || selectedCoverTemplate?.id === templateId || (!selectedCoverTemplate?.isStored && selectedCoverTemplate?.templateKey === templateKey);
                return (<div key={templateId} className="lv-cb-template-card">
              <button type="button" className={`lv-cb-template-thumb lv-cb-template-thumb--${thumbId}${isSelectedTemplate ? ' selected' : ''}`} style={templateThumbStyle} onClick={() => {
                        applyCoverTemplateLayout(templateId, { from, to, glow }, { label, layoutId: thumbId, templateKey, isStored: isPlatformTemplate, canUpdate: canDelete });
                    }} title={`${label} layout template`}>
                <span className="lv-cb-template-mini-logo"/>
                <span className="lv-cb-template-mini-title"/>
                <span className="lv-cb-template-mini-sub"/>
                <span className="lv-cb-template-mini-basket"/>
                <span className="lv-cb-template-mini-tag"/>
                <span className="lv-cb-template-mini-products"/>
                <span className="lv-cb-template-mini-contact"/>
                <strong>{label}</strong>
              </button>
              {options.showDelete && canDelete && <button type="button" className="lv-cb-template-delete" onClick={e => {
                        e.stopPropagation();
                        requestDeleteCoverTemplateCard(templateId, label, isPlatformTemplate, canDelete);
                    }} aria-label={`Delete ${label} template`} title={`Delete ${label} template`}>
                <span aria-hidden="true">delete</span>
              </button>}
            </div>);
            })}
        </div>);
    }
    function renderCoverBuilder() {
        return (<div className="lv-cover-builder">
        <aside className="lv-cb-tools-panel">
          <div className="lv-cb-panel-title">
            <span className="material-symbol" aria-hidden="true">dashboard_customize</span>
            <strong>Leaflet Builder</strong>
          </div>

          {renderCoverBuilderSection('left-templates', 'Templates', (<>
              <button type="button" className="lv-cb-ai-template-btn" onClick={generateCoverAiTemplate}>
                <span className="material-symbol" aria-hidden="true">auto_awesome</span>
                AI template generator
              </button>
              {renderCoverTemplateGrid({ showDelete: true })}
            </>))}

          {renderCoverBuilderSection('left-add-elements', 'Add elements', (<>
            {(['logo', 'headline', 'subline', 'products', 'contact'] as CoverBuilderItemKey[]).map(renderCoverBuilderAddElementButton)}
              <div className="lv-cb-add-subsection lv-cb-add-subsection--plain">
                {(['dealTag', 'basket'] as CoverBuilderItemKey[]).map(renderCoverBuilderAddElementButton)}
              </div>
            </>))}

        </aside>

        <main className="lv-cb-canvas-area">
          <div className="lv-cb-canvas-toolbar">
            <div className="lv-cb-zoom-control">
              <span>Zoom</span>
              <input type="range" min={25} max={120} step={5} value={coverBuilderZoom} onChange={e => setCoverBuilderZoom(+e.target.value)} aria-label="Cover canvas zoom"/>
              <strong>{coverBuilderZoom}%</strong>
            </div>
          </div>
          {coverBuilderNotice && <div className="lv-cb-notice">{coverBuilderNotice}</div>}
          {nanoError && <div className="lv-cb-error">{nanoError}</div>}
          {(() => {
            const selectedToolbarKey = coverBuilderSelected && coverBuilderSelected !== 'background' && coverBuilder.visibleItems[coverBuilderSelected]
                ? coverBuilderSelected
                : null;
            const selectedToolbarPlacement = selectedToolbarKey
                ? (() => {
                    const selectedStyle = coverBuilder.itemStyles[selectedToolbarKey] ?? DEFAULT_COVER_BUILDER_ITEM_STYLES[selectedToolbarKey];
                    const stageRect = coverBuilderStageRef.current?.getBoundingClientRect();
                    if (!stageRect || typeof window === 'undefined') {
                        return {
                            className: '',
                            style: {
                                left: `clamp(18px, ${selectedStyle.x + selectedStyle.w / 2}%, calc(100% - 18px))`,
                                top: `${selectedStyle.y}%`,
                                zIndex: Math.max(1200, selectedStyle.z + 1000),
                            } as React.CSSProperties,
                        };
                    }
                    const toolbarWidth = Math.min(420, Math.max(260, window.innerWidth - 48));
                    const anchorX = stageRect.left + ((selectedStyle.x + selectedStyle.w / 2) / 100) * stageRect.width;
                    const anchorY = stageRect.top + (selectedStyle.y / 100) * stageRect.height;
                    const clampedX = Math.min(Math.max(anchorX, toolbarWidth / 2 + 16), window.innerWidth - toolbarWidth / 2 - 16);
                    const placeBelow = anchorY < 132;
                    const clampedY = placeBelow
                        ? Math.min(anchorY + 12, window.innerHeight - 20)
                        : Math.max(anchorY, 132);
                    return {
                        className: `lv-cb-floating-toolbar--fixed${placeBelow ? ' lv-cb-floating-toolbar--below' : ''}`,
                        style: {
                            left: clampedX,
                            top: clampedY,
                            zIndex: Math.max(1200, selectedStyle.z + 1000),
                        } as React.CSSProperties,
                    };
                })()
                : undefined;
            return (<div key={`${coverBuilderRenderTemplateId()}-canvas-stage`} ref={coverBuilderStageRef} data-template-id={coverBuilderRenderTemplateId()} className={cx("lv-cb-canvas-stage", coverBuilderSelected === 'background' ? 'selected' : '', cssClass({ width: A4_W * (coverBuilderZoom / 100), height: A4_H * (coverBuilderZoom / 100), background: coverBuilderBg }))} tabIndex={0} role="group" aria-label="Selected cover canvas" onFocus={e => {
                    if (e.currentTarget === e.target)
                        clearCoverBuilderSelection('background');
                }}>
                {renderCoverBuilderSurface({ interactive: true, scale: coverBuilderZoom / 100 })}
                {nanoGenerating && (<div className="lv-cb-image-generating-overlay" role="status" aria-live="polite">
                  <div className="lv-cb-image-generating-card">
                    <span className="lv-cb-image-generating-spark material-symbol" aria-hidden="true">auto_awesome</span>
                    <span>Creating background</span>
                    <span className="lv-cb-image-generating-dots" aria-hidden="true"><i/><i/><i/></span>
                  </div>
                </div>)}
                {selectedToolbarKey && !coverBuilderFloatingToolbarHidden && renderCoverBuilderFloatingToolbar(selectedToolbarKey, selectedToolbarPlacement?.style, selectedToolbarPlacement?.className)}
              </div>);
        })()}
        </main>

        <aside className={cx("lv-cb-properties-panel", coverBuilderSelected === 'background' ? 'lv-cb-properties-panel--background' : '')}>
          {(coverBuilderSelected === 'dealTag' && coverBuilderDealTagLibraryOpen) || (coverBuilderSelected === 'basket' && coverBuilderBasketLibraryOpen) || coverBuilderSelected === 'background' ? (<div className={cx("lv-cb-panel-title", coverBuilderSelected === 'background' && !coverBuilderBackgroundLibraryOpen ? 'lv-cb-bg-editor-head' : '')}>
            {coverBuilderSelected === 'dealTag' && coverBuilderDealTagLibraryOpen ? (<>
              <button type="button" className="lv-cb-properties-back material-symbol" onClick={() => setCoverBuilderDealTagLibraryOpen(false)} aria-label="Back to Deal tag properties" title="Back to Deal tag properties">arrow_back</button>
              <strong>Deal tag library</strong>
            </>) : coverBuilderSelected === 'basket' && coverBuilderBasketLibraryOpen ? (<>
              <button type="button" className="lv-cb-properties-back material-symbol" onClick={() => setCoverBuilderBasketLibraryOpen(false)} aria-label="Back to Basket properties" title="Back to Basket properties">arrow_back</button>
              <strong>Basket library</strong>
            </>) : coverBuilderSelected === 'background' && coverBuilderBackgroundLibraryOpen ? (<>
              <button type="button" className="lv-cb-properties-back material-symbol" onClick={() => setCoverBuilderBackgroundLibraryOpen(false)} aria-label="Back to Background properties" title="Back to Background properties">arrow_back</button>
              <strong>Background library</strong>
            </>) : coverBuilderSelected === 'background' ? (<>
              <span className="lv-cb-bg-editor-icon" aria-hidden="true">
                wallpaper
              </span>
              <div>
                <strong>Background</strong>
                <small>Canvas fill style</small>
              </div>
            </>) : null}
          </div>) : null}
          {renderCoverBuilderProperties()}
        </aside>
      </div>);
    }
    function renderCoverBuilderModal() {
        return (<div className={cx("lv-cover-builder-modal", coverBuilderOnly ? 'lv-cover-builder-modal--embedded' : '')} role="dialog" aria-modal="true" aria-label="Create cover page">
        <div className="lv-cover-builder-modal-head">
          <div>
            <span>{coverBuilderTarget === 'back' ? 'Back Cover' : 'Cover Page'}</span>
            <strong>{coverBuilderTarget === 'back' ? 'Create back cover' : 'Create cover page'}</strong>
          </div>
          {!coverBuilderOnly && <button type="button" onClick={() => setCoverBuilderOpen(false)} aria-label="Close cover builder">x</button>}
        </div>
        {renderCoverBuilder()}
        {renderCoverBuilderFooter()}
        {coverTemplateDeleteTarget && (<div className="lv-cb-template-delete-backdrop" role="presentation" onMouseDown={e => {
                    if (e.target === e.currentTarget)
                        setCoverTemplateDeleteTarget(null);
                }}>
          <div className="lv-cb-template-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete template">
            <div className="lv-cb-template-delete-dialog-head">
              <span className="material-symbol" aria-hidden="true">delete</span>
              <div>
                <small>Template</small>
                <strong>Delete template</strong>
              </div>
            </div>
            <p>Remove <strong>{coverTemplateDeleteTarget.label}</strong> from the template grid?</p>
            <div className="lv-cb-template-delete-actions">
              <button type="button" onClick={() => setCoverTemplateDeleteTarget(null)}>Cancel</button>
              <button type="button" className="danger" onClick={() => void confirmDeleteCoverTemplateCard()}>Delete</button>
            </div>
          </div>
        </div>)}
        {coverDealTagDeleteTarget && (<div className="lv-cb-template-delete-backdrop" role="presentation" onMouseDown={e => {
                    if (e.target === e.currentTarget && !deletingCoverDealTagKey)
                        setCoverDealTagDeleteTarget(null);
                }}>
          <div className="lv-cb-template-delete-dialog lv-cb-deal-tag-delete-dialog" role="dialog" aria-modal="true" aria-label="Delete deal tag">
            <div className="lv-cb-template-delete-dialog-head">
              <span className="material-symbol" aria-hidden="true">delete</span>
              <div>
                <small>Deal Tag Library</small>
                <strong>Delete deal tag</strong>
              </div>
            </div>
            <div className="lv-cb-deal-tag-delete-preview">
              <img src={coverDealTagDeleteTarget.url} alt=""/>
            </div>
            <p>Remove <strong>{coverDealTagDeleteTarget.name}</strong> from the Deal Tag Library? It will no longer appear for users.</p>
            <div className="lv-cb-template-delete-actions">
              <button type="button" onClick={() => setCoverDealTagDeleteTarget(null)} disabled={!!deletingCoverDealTagKey}>Cancel</button>
              <button type="button" className="danger" onClick={() => void confirmDeleteCoverBuilderDealTag()} disabled={!!deletingCoverDealTagKey}>
                {deletingCoverDealTagKey ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>)}
      </div>);
    }
    function toggleNanoVoicePrompt() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setNanoError('Voice input is not supported in this browser. Try Chrome or Edge.');
            return;
        }
        if (nanoListening) {
            nanoSpeechManualStopRef.current = true;
            nanoSpeechRef.current?.stop?.();
            setNanoListening(false);
            return;
        }
        const recognition = new SpeechRecognition();
        nanoSpeechRef.current = recognition;
        nanoSpeechBasePromptRef.current = nanoPrompt.trim();
        nanoSpeechFinalRef.current = '';
        nanoSpeechManualStopRef.current = false;
        recognition.lang = navigator.language || 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onstart = () => {
            setNanoListening(true);
            setNanoError(null);
        };
        recognition.onresult = (event: any) => {
            const finalParts: string[] = [];
            const interimParts: string[] = [];
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const transcript = String(event.results[i]?.[0]?.transcript || '').trim();
                if (!transcript)
                    continue;
                if (event.results[i]?.isFinal)
                    finalParts.push(transcript);
                else
                    interimParts.push(transcript);
            }
            if (finalParts.length > 0)
                nanoSpeechFinalRef.current = [nanoSpeechFinalRef.current, ...finalParts].filter(Boolean).join(' ').trim();
            const spoken = [nanoSpeechFinalRef.current, ...interimParts].filter(Boolean).join(' ').trim();
            if (!spoken)
                return;
            const base = nanoSpeechBasePromptRef.current;
            const next = base ? `${base} ${spoken}` : spoken;
            setNanoPrompt(next.slice(0, 4000));
        };
        recognition.onerror = (event: any) => {
            setNanoListening(false);
            const error = String(event?.error || '');
            if (nanoSpeechManualStopRef.current || error === 'aborted')
                return;
            if (error === 'not-allowed' || error === 'service-not-allowed') {
                setNanoError('Microphone permission is blocked. Allow microphone access in your browser and try again.');
                return;
            }
            if (error === 'no-speech') {
                setNanoError('No speech was detected. Try again and speak after the microphone turns on.');
                return;
            }
            if (error === 'audio-capture') {
                setNanoError('No microphone was found. Check your microphone connection and browser input settings.');
                return;
            }
            setNanoError('Voice input stopped unexpectedly. Try again in Chrome or Edge.');
        };
        recognition.onend = () => {
            setNanoListening(false);
            nanoSpeechRef.current = null;
        };
        try {
            recognition.start();
        }
        catch {
            nanoSpeechRef.current = null;
            setNanoListening(false);
            setNanoError('Voice input could not start. Close other microphone sessions and try again.');
        }
    }
    const isPaidPlan = exportQuota ? exportQuota.plan !== 'free' : false;
    const freePdfLimit = exportQuota?.free_pdf_limit ?? 1;
    const canExportPdf = isPaidPlan || (exportQuota ? exportQuota.free_pdf_used < freePdfLimit : true);
    const freePdfLimitMessage = `Free plan: ${freePdfLimit} PDF ${freePdfLimit === 1 ? 'export' : 'exports'} allowed. Upgrade for unlimited exports.`;
    const canExportBook = isPaidPlan || (exportQuota ? exportQuota.free_book_used < 1 : true);
    const A4_PAD = 24;
    const hs = headerSettings;
    const fs = footerSettings;
    const headerH = hs.show ? hs.height + 4 + hs.marginTop : 0;
    const footerH = fs.show ? fs.height + 4 + fs.marginBottom : 0;
    const colGap = pageSettings.colGap;
    const rowGap = pageSettings.rowGap;
    const availH = A4_H - headerH - footerH - (hs.show ? (hs.marginBottom as number) : 0) - (fs.show ? (fs.marginTop as number) : 0);
    const gridW = Math.round(A4_W * pageSettings.gridWidthPct / 100);
    const gridH = Math.round(availH * pageSettings.gridHeightPct / 100);
    // Per-page grid height: expands to fill space when header/footer hidden on that page
    function gridHFor(pageIdx: number) {
        const showH = headerShowFor(pageIdx);
        const showF = footerShowFor(pageIdx);
        const pageHeaderH = showH ? hs.height + 4 + (hs.marginTop as number) + (hs.marginBottom as number) : 0;
        const pageFooterH = showF ? fs.height + 4 + (fs.marginBottom as number) + (fs.marginTop as number) : 0;
        const pageAvailH = A4_H - pageHeaderH - pageFooterH;
        return Math.round(pageAvailH * pageSettings.gridHeightPct / 100);
    }
    const cardW = (gridW - (colsPerPage - 1) * colGap) / colsPerPage;
    const cardH = (gridH - (rowsPerPage - 1) * rowGap) / rowsPerPage;
    function cardHFor(pageIdx: number) {
        return (gridHFor(pageIdx) - (rowsPerPage - 1) * rowGap) / rowsPerPage;
    }
    const cardsPerPg = colsPerPage * rowsPerPage;
    const pageBg = makeBg(pageSettings as unknown as BarState);
    const headerMarginTop = hs.marginTop as number;
    const headerMarginBottom = hs.marginBottom as number;
    const footerMarginTop = fs.marginTop as number;
    const footerMarginBottom = fs.marginBottom as number;
    const zeroGridSpacing = colGap === 0 && rowGap === 0;
    const flushFullBleedFooter = zeroGridSpacing && fs.widthMode === 'full';
    function makeBarBorder(s: BarState) {
        const borderWidth = Number(s.borderWidth ?? 0);
        if (borderWidth <= 0 && !(s.perSide))
            return {};
        const bst = String(s.borderStyle ?? 'solid');
        const bc = String(s.borderColor ?? '#000000');
        if (s.perSide) {
            return {
                borderTopWidth: `${s.borderTop ?? 0}px`,
                borderRightWidth: `${s.borderRight ?? 0}px`,
                borderBottomWidth: `${s.borderBottom ?? 0}px`,
                borderLeftWidth: `${s.borderLeft ?? 0}px`,
                borderStyle: bst, borderColor: bc,
            };
        }
        return { border: `${borderWidth}px ${bst} ${bc}` };
    }
    function makeBarRadius(s: BarState) {
        if (s.radiusMode === 'each') {
            return { borderRadius: `${s.radiusTL ?? 0}px ${s.radiusTR ?? 0}px ${s.radiusBR ?? 0}px ${s.radiusBL ?? 0}px` };
        }
        return { borderRadius: `${s.radius ?? 0}px` };
    }
    function makeBarAlign(s: BarState) {
        const pct = (s.widthPct as number) ?? 100;
        const al = (s.blockAlign as string) ?? 'center';
        if (pct >= 100)
            return { width: '100%', alignSelf: 'stretch' as const };
        const ml = al === 'left' ? 0 : 'auto';
        const mr = al === 'right' ? 0 : 'auto';
        return { width: `${pct}%`, marginLeft: ml, marginRight: mr, alignSelf: 'center' as const };
    }
    const headerWidthPct = Number(hs.widthPct ?? 100);
    const headerBarState = { ...hs, widthPct: headerWidthPct, widthMode: headerWidthPct >= 100 ? hs.widthMode : 'grid' } as unknown as BarState;
    const headerIsFullBleed = headerBarState.widthMode === 'full' && headerWidthPct >= 100;
    const footerBarState = fs as unknown as BarState;
    const headerStyle = { ...makeBarStyle(headerBarState, 0), ...makeBarBorder(headerBarState), ...makeBarRadius(headerBarState), ...makeBarAlign(headerBarState), marginTop: headerMarginTop, marginBottom: headerMarginBottom };
    const footerStyle = { ...makeBarStyle(footerBarState, 0), ...makeBarBorder(footerBarState), ...makeBarRadius(footerBarState), ...makeBarAlign(footerBarState), marginTop: flushFullBleedFooter ? 0 : fs.widthMode === 'full' ? 0 : footerMarginTop, marginBottom: footerMarginBottom };
    function headerToolbarButton(icon: string, title: string, onClick: () => void, active = false) {
        return (<button type="button" title={title} className={active ? 'active' : ''} onClick={onClick}>
          <span className="material-symbol" aria-hidden="true">{icon}</span>
        </button>);
    }
    function headerToolbarPanelButton(panel: typeof headerToolbarPanel, icon: string, title: string) {
        return headerToolbarButton(icon, title, () => setHeaderToolbarPanel(prev => prev === panel ? null : panel), headerToolbarPanel === panel);
    }
    function footerToolbarPanelButton(panel: typeof footerToolbarPanel, icon: string, title: string) {
        return headerToolbarButton(icon, title, () => setFooterToolbarPanel(prev => prev === panel ? null : panel), footerToolbarPanel === panel);
    }
    function renderHeaderToolbarPanel() {
        if (!headerToolbarPanel)
            return null;
        if (headerToolbarPanel === 'content') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Header content</div>
              <div className="lv-header-toolbar-row">
                <span>Apply to all pages</span>
                <button type="button" className="lv-header-toolbar-secondary" onClick={applyHeaderToAll}>
                  <span className="material-symbol" aria-hidden="true">select_all</span>
                  <span>Apply</span>
                </button>
              </div>
              <label className="lv-header-toolbar-toggle">
                <span>Show header</span>
                <input type="checkbox" checked={headerShowFor(safePage)} onChange={() => toggleHeaderForPage(safePage)}/>
              </label>
              <label className="lv-header-toolbar-toggle">
                <span>Show text</span>
                <input type="checkbox" checked={hs.showText} onChange={e => setH('showText', e.target.checked)}/>
              </label>
              <div className="lv-header-toolbar-logo">
                <span className="lv-header-toolbar-label">Logo</span>
                <HeaderLogoUploader currentUrl={String(hs.logoUrl ?? '')} onUploaded={url => setHeaderSettings(prev => ({ ...prev, logoUrl: url, logoWidth: undefined, logoX: undefined, logoY: undefined }))} onRemove={() => setHeaderSettings(prev => ({ ...prev, logoUrl: '', logoWidth: undefined, logoX: undefined, logoY: undefined }))}/>
              </div>
              {hs.logoUrl && (<label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Logo</span>
                <input type="range" min={18} max={90} value={Number(hs.logoHeight ?? 44)} onChange={e => setH('logoHeight', +e.target.value)}/>
                <em>{Number(hs.logoHeight ?? 44)}px</em>
              </label>)}
            </div>);
        }
        if (headerToolbarPanel === 'layout') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Header layout</div>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Height</span>
                <input type="range" min={24} max={120} value={hs.height} onChange={e => setH('height', +e.target.value)}/>
                <em>{hs.height}px</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Width</span>
                <input type="range" min={20} max={100} value={headerWidthPct} onChange={e => setHeaderWidthPct(+e.target.value)}/>
                <em>{headerWidthPct}%</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Top</span>
                <input type="range" min={0} max={100} value={hs.marginTop} onChange={e => setH('marginTop', +e.target.value)}/>
                <em>{hs.marginTop}px</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Bottom</span>
                <input type="range" min={0} max={100} value={hs.marginBottom} onChange={e => setH('marginBottom', +e.target.value)}/>
                <em>{hs.marginBottom}px</em>
              </label>
            </div>);
        }
        if (headerToolbarPanel === 'text') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Header text</div>
              <div className="lv-header-toolbar-segment">
                {(['left', 'center', 'right'] as const).map(align => (<button key={align} type="button" className={hs.textAlign === align ? 'active' : ''} title={`Align ${align}`} onClick={() => setH('textAlign', align)}>
                    <span className="material-symbol" aria-hidden="true">{align === 'left' ? 'format_align_left' : align === 'center' ? 'format_align_center' : 'format_align_right'}</span>
                  </button>))}
              </div>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Size</span>
                <input type="range" min={8} max={48} value={hs.fontSize} onChange={e => setH('fontSize', +e.target.value)}/>
                <em>{hs.fontSize}px</em>
              </label>
              <label className="lc-toolbar-field">
                <span>Color</span>
                <ColorSwatch value={hs.fontColor} onChange={v => setH('fontColor', v)}/>
              </label>
            </div>);
        }
        if (headerToolbarPanel === 'background') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Header background</div>
              <div className="lv-header-toolbar-segment">
                {(['solid', 'gradient'] as const).map(type => (<button key={type} type="button" className={hs.bgType === type ? 'active' : ''} onClick={() => setH('bgType', type)}>
                    <span className="material-symbol" aria-hidden="true">{type === 'solid' ? 'format_color_fill' : 'gradient'}</span>
                  </button>))}
              </div>
              {hs.bgType === 'gradient' ? (<>
                <label className="lc-toolbar-field"><span>From</span><ColorSwatch value={hs.gradFrom} onChange={v => setH('gradFrom', v)}/></label>
                <label className="lc-toolbar-field"><span>To</span><ColorSwatch value={hs.gradTo} onChange={v => setH('gradTo', v)}/></label>
                <label className="lc-toolbar-field lc-toolbar-field--range">
                  <span>Angle</span>
                  <input type="range" min={0} max={360} value={hs.gradAngle} onChange={e => setH('gradAngle', +e.target.value)}/>
                  <em>{hs.gradAngle}deg</em>
                </label>
              </>) : (<label className="lc-toolbar-field"><span>Color</span><ColorSwatch value={hs.bgColor} onChange={v => setH('bgColor', v)}/></label>)}
            </div>);
        }
        return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
          <div className="lc-toolbar-menu-title">Header border</div>
          <label className="lc-toolbar-field lc-toolbar-field--range">
            <span>Width</span>
            <input type="range" min={0} max={20} value={hs.borderWidth} onChange={e => setH('borderWidth', +e.target.value)}/>
            <em>{hs.borderWidth}px</em>
          </label>
          <label className="lc-toolbar-field"><span>Color</span><ColorSwatch value={hs.borderColor} onChange={v => setH('borderColor', v)}/></label>
          <label className="lc-toolbar-field lc-toolbar-field--range">
            <span>Radius</span>
            <input type="range" min={0} max={64} value={hs.radius} onChange={e => setH('radius', +e.target.value)}/>
            <em>{hs.radius}px</em>
          </label>
        </div>);
    }
    function renderHeaderFloatingToolbar() {
        if (typeof document === 'undefined' || !headerSelected || !headerToolbarPos)
            return null;
        return ReactDOM.createPortal(<div className={`lc-floating-toolbar lc-floating-toolbar--fixed lv-header-floating-toolbar${headerToolbarPos.placeBelow ? ' lc-floating-toolbar--below' : ''}`} style={{ left: headerToolbarPos.left, top: headerToolbarPos.top } as React.CSSProperties} role="toolbar" aria-label="Header quick tools" onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          {headerToolbarButton(headerShowFor(safePage) ? 'visibility' : 'visibility_off', 'Show header on this page', () => toggleHeaderForPage(safePage), headerShowFor(safePage))}
          {headerToolbarPanelButton('content', 'widgets', 'Header content')}
          {headerToolbarPanelButton('layout', 'aspect_ratio', 'Header layout')}
          {headerToolbarPanelButton('text', 'text_fields', 'Header text')}
          {headerToolbarPanelButton('background', 'format_color_fill', 'Header background')}
          {headerToolbarPanelButton('border', 'border_outer', 'Header border')}
          {headerToolbarButton('format_bold', 'Bold', () => setH('fontWeight', hs.fontWeight === 'bold' ? 'normal' : 'bold'), hs.fontWeight === 'bold')}
          {headerToolbarButton('format_italic', 'Italic', () => setH('fontItalic', !hs.fontItalic), Boolean(hs.fontItalic))}
          {headerToolbarButton('settings', 'Open header settings', () => setOpenSbSection('header'))}
          {headerToolbarButton('close', 'Deselect header', () => {
                setHeaderSelected(false);
                setHeaderToolbarPanel(null);
            })}
          {renderHeaderToolbarPanel()}
        </div>, document.body);
    }
    function renderFooterToolbarPanel() {
        if (!footerToolbarPanel)
            return null;
        if (footerToolbarPanel === 'content') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Footer content</div>
              <div className="lv-header-toolbar-row">
                <span>Apply to all pages</span>
                <button type="button" className="lv-header-toolbar-secondary" onClick={applyFooterToAll}>
                  <span className="material-symbol" aria-hidden="true">select_all</span>
                  <span>Apply</span>
                </button>
              </div>
              <label className="lv-header-toolbar-toggle">
                <span>Show footer</span>
                <input type="checkbox" checked={footerShowFor(safePage)} onChange={() => toggleFooterForPage(safePage)}/>
              </label>
              <label className="lv-header-toolbar-toggle">
                <span>Show text</span>
                <input type="checkbox" checked={fs.showText} onChange={e => setF('showText', e.target.checked)}/>
              </label>
              <label className="lv-header-toolbar-toggle">
                <span>Page number</span>
                <input type="checkbox" checked={fs.showPageNum ?? true} onChange={e => setF('showPageNum', e.target.checked)}/>
              </label>
              <div className="lv-header-toolbar-logo">
                <span className="lv-header-toolbar-label">Logo</span>
                <HeaderLogoUploader currentUrl={String(fs.logoUrl ?? '')} onUploaded={url => setFooterSettings(prev => ({ ...prev, logoUrl: url, logoWidth: undefined, logoX: undefined, logoY: undefined }))} onRemove={() => setFooterSettings(prev => ({ ...prev, logoUrl: '', logoWidth: undefined, logoX: undefined, logoY: undefined }))}/>
              </div>
              {fs.logoUrl && (<label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Logo</span>
                <input type="range" min={14} max={72} value={Number(fs.logoHeight ?? 28)} onChange={e => setF('logoHeight', +e.target.value)}/>
                <em>{Number(fs.logoHeight ?? 28)}px</em>
              </label>)}
            </div>);
        }
        if (footerToolbarPanel === 'layout') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Footer layout</div>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Height</span>
                <input type="range" min={24} max={120} value={fs.height} onChange={e => setF('height', +e.target.value)}/>
                <em>{fs.height}px</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Width</span>
                <input type="range" min={20} max={100} value={fs.widthPct} onChange={e => setFooterWidthPct(+e.target.value)}/>
                <em>{fs.widthPct}%</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Top</span>
                <input type="range" min={0} max={100} value={fs.marginTop} onChange={e => setF('marginTop', +e.target.value)}/>
                <em>{fs.marginTop}px</em>
              </label>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Bottom</span>
                <input type="range" min={0} max={100} value={fs.marginBottom} onChange={e => setF('marginBottom', +e.target.value)}/>
                <em>{fs.marginBottom}px</em>
              </label>
            </div>);
        }
        if (footerToolbarPanel === 'text') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Footer text</div>
              <div className="lv-header-toolbar-segment">
                {(['left', 'center', 'right'] as const).map(align => (<button key={align} type="button" className={fs.textAlign === align ? 'active' : ''} title={`Align ${align}`} onClick={() => setF('textAlign', align)}>
                    <span className="material-symbol" aria-hidden="true">{align === 'left' ? 'format_align_left' : align === 'center' ? 'format_align_center' : 'format_align_right'}</span>
                  </button>))}
              </div>
              <label className="lc-toolbar-field lc-toolbar-field--range">
                <span>Size</span>
                <input type="range" min={8} max={48} value={fs.fontSize} onChange={e => setF('fontSize', +e.target.value)}/>
                <em>{fs.fontSize}px</em>
              </label>
              <label className="lc-toolbar-field"><span>Color</span><ColorSwatch value={fs.fontColor} onChange={v => setF('fontColor', v)}/></label>
            </div>);
        }
        if (footerToolbarPanel === 'background') {
            return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
              <div className="lc-toolbar-menu-title">Footer background</div>
              <div className="lv-header-toolbar-segment">
                {(['solid', 'gradient'] as const).map(type => (<button key={type} type="button" className={fs.bgType === type ? 'active' : ''} onClick={() => setF('bgType', type)}>
                    <span className="material-symbol" aria-hidden="true">{type === 'solid' ? 'format_color_fill' : 'gradient'}</span>
                  </button>))}
              </div>
              {fs.bgType === 'gradient' ? (<>
                <label className="lc-toolbar-field"><span>From</span><ColorSwatch value={fs.gradFrom} onChange={v => setF('gradFrom', v)}/></label>
                <label className="lc-toolbar-field"><span>To</span><ColorSwatch value={fs.gradTo} onChange={v => setF('gradTo', v)}/></label>
                <label className="lc-toolbar-field lc-toolbar-field--range">
                  <span>Angle</span>
                  <input type="range" min={0} max={360} value={fs.gradAngle} onChange={e => setF('gradAngle', +e.target.value)}/>
                  <em>{fs.gradAngle}deg</em>
                </label>
              </>) : (<label className="lc-toolbar-field"><span>Color</span><ColorSwatch value={fs.bgColor} onChange={v => setF('bgColor', v)}/></label>)}
            </div>);
        }
        return (<div className="lv-header-toolbar-menu lc-toolbar-menu lc-toolbar-menu--panel">
          <div className="lc-toolbar-menu-title">Footer border</div>
          <label className="lc-toolbar-field lc-toolbar-field--range">
            <span>Width</span>
            <input type="range" min={0} max={20} value={fs.borderWidth} onChange={e => setF('borderWidth', +e.target.value)}/>
            <em>{fs.borderWidth}px</em>
          </label>
          <label className="lc-toolbar-field"><span>Color</span><ColorSwatch value={fs.borderColor} onChange={v => setF('borderColor', v)}/></label>
          <label className="lc-toolbar-field lc-toolbar-field--range">
            <span>Radius</span>
            <input type="range" min={0} max={64} value={fs.radius} onChange={e => setF('radius', +e.target.value)}/>
            <em>{fs.radius}px</em>
          </label>
        </div>);
    }
    function renderFooterFloatingToolbar() {
        if (typeof document === 'undefined' || !footerSelected || !footerToolbarPos)
            return null;
        return ReactDOM.createPortal(<div className={`lc-floating-toolbar lc-floating-toolbar--fixed lv-header-floating-toolbar lv-footer-floating-toolbar${footerToolbarPos.placeBelow ? ' lc-floating-toolbar--below' : ''}`} style={{ left: footerToolbarPos.left, top: footerToolbarPos.top } as React.CSSProperties} role="toolbar" aria-label="Footer quick tools" onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          {headerToolbarButton(footerShowFor(safePage) ? 'visibility' : 'visibility_off', 'Show footer on this page', () => toggleFooterForPage(safePage), footerShowFor(safePage))}
          {footerToolbarPanelButton('content', 'widgets', 'Footer content')}
          {footerToolbarPanelButton('layout', 'aspect_ratio', 'Footer layout')}
          {footerToolbarPanelButton('text', 'text_fields', 'Footer text')}
          {footerToolbarPanelButton('background', 'format_color_fill', 'Footer background')}
          {footerToolbarPanelButton('border', 'border_outer', 'Footer border')}
          {headerToolbarButton('format_bold', 'Bold', () => setF('fontWeight', fs.fontWeight === 'bold' ? 'normal' : 'bold'), fs.fontWeight === 'bold')}
          {headerToolbarButton('format_italic', 'Italic', () => setF('fontItalic', !fs.fontItalic), Boolean(fs.fontItalic))}
          {headerToolbarButton('settings', 'Open footer settings', () => setOpenSbSection('footer'))}
          {headerToolbarButton('close', 'Deselect footer', () => {
                setFooterSelected(false);
                setFooterToolbarPanel(null);
            })}
          {renderFooterToolbarPanel()}
        </div>, document.body);
    }
    const pages: typeof visible[] = [];
    for (let i = 0; i < visible.length; i += cardsPerPg) {
        pages.push(visible.slice(i, i + cardsPerPg));
    }
    if (pages.length === 0)
        pages.push([]);
    const safePage = Math.max(0, Math.min(currentPage, pages.length - 1));
    const coverBuilderProducts = products.filter(p => coverProductIds.has(p.id));
    const coverBuilderBg = coverBuilder.bgType === 'image' && coverBuilder.bgImage
        ? `url(${coverBuilder.bgImage}) center/cover no-repeat`
        : coverBuilder.bgType === 'solid'
            ? coverBuilder.bgColor
            : coverBuilder.aiGradientCss
                || `linear-gradient(${coverBuilder.gradAngle}deg, ${coverBuilder.gradFrom} ${coverBuilder.gradFromStop}%, ${coverBuilder.gradTo} ${coverBuilder.gradToStop}%)`;
    // -- Overlay helpers --------
    function addOverlay(productId: number, src: string, label: string) {
        const ov: CardOverlay = { id: `ov-${Date.now()}-${Math.random()}`, src, label, x: 2, y: 2, w: 28, h: 28 };
        setOverlays(prev => ({ ...prev, [productId]: [...(prev[productId] ?? []), ov] }));
    }
    function updateOverlay(productId: number, ovId: string, patch: Partial<CardOverlay>) {
        setOverlays(prev => ({
            ...prev,
            [productId]: (prev[productId] ?? []).map(o => o.id === ovId ? { ...o, ...patch } : o),
        }));
    }
    function removeOverlay(productId: number, ovId: string) {
        setOverlays(prev => ({ ...prev, [productId]: (prev[productId] ?? []).filter(o => o.id !== ovId) }));
    }
    /* -- Export via browser Print -> Save as PDF -------- */
    async function consumeExport(type: 'pdf' | 'book'): Promise<boolean> {
        const token = readAuthToken();
        if (!token)
            return false;
        const r = await fetch('/api/user/consume-export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type }),
        });
        if (r.status === 403)
            return false; // limit reached
        if (!r.ok)
            return false;
        await fetchExportQuota(); // refresh quota state
        return true;
    }
    function promptProForPdfExport() {
        setUpgradeFeature('pdf');
        setUpgradeError(null);
        setUpgradePdfModal(true);
    }
    function promptProForBookExport() {
        setUpgradeFeature('book');
        setUpgradeError(null);
        setUpgradePdfModal(true);
    }
    async function subscribeToPro() {
        setUpgradeLoading(true);
        setUpgradeError(null);
        try {
            const url = await createCheckoutSession('pro', 'monthly');
            window.location.href = url;
        }
        catch (e) {
            setUpgradeError(e instanceof Error ? e.message : 'Unable to start Pro checkout. Please try again.');
            setUpgradeLoading(false);
        }
    }
    async function waitForPrintAssets() {
        const container = pdfContainerRef.current;
        if (container) {
            const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
            await Promise.all(imgs.map(img => {
                if (img.complete && img.naturalWidth > 0)
                    return Promise.resolve();
                return loadImageElement(img, 5000).catch(() => undefined);
            }));
        }
        // Wait for fonts to finish loading
        try {
            await document.fonts.ready;
        }
        catch { /* ignore */ }
    }
    async function preparePrintImagesForCanvas(container: HTMLElement) {
        const restored: Array<() => void> = [];
        const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
        const restoreAll = () => {
            for (const restore of restored.reverse())
                restore();
        };
        try {
            await Promise.all(imgs.map(async (img) => {
                const originalSrc = img.getAttribute('src');
                const originalSrcSet = img.getAttribute('srcset');
                const originalStyle = img.getAttribute('style');
                let restoreQueued = false;
                const queueRestore = () => {
                    if (restoreQueued)
                        return;
                    restoreQueued = true;
                    restored.push(() => {
                        if (originalSrc === null)
                            img.removeAttribute('src');
                        else
                            img.setAttribute('src', originalSrc);
                        if (originalSrcSet === null)
                            img.removeAttribute('srcset');
                        else
                            img.setAttribute('srcset', originalSrcSet);
                        if (originalStyle === null)
                            img.removeAttribute('style');
                        else
                            img.setAttribute('style', originalStyle);
                    });
                };
                const rawSrc = img.currentSrc || originalSrc;
                if (!rawSrc)
                    return;
                const canvasSrc = await getCanvasImageSource(rawSrc);
                if (canvasSrc && canvasSrc !== originalSrc) {
                    queueRestore();
                    img.setAttribute('src', canvasSrc);
                    img.removeAttribute('srcset');
                }
                await loadImageElement(img, 10000);
                if (img.classList.contains('lv-card-img')) {
                    const fittedSrc = createFittedImageDataUrl(img);
                    if (fittedSrc) {
                        queueRestore();
                        img.setAttribute('src', fittedSrc);
                        img.style.objectFit = 'fill';
                    }
                }
            }));
            return restoreAll;
        }
        catch (err) {
            restoreAll();
            throw err;
        }
    }
    async function createPdfBlob(): Promise<Blob> {
        const container = pdfContainerRef.current;
        if (!container)
            throw new Error('PDF layout is not ready yet.');
        await waitForPrintAssets();
        const restorePrintImages = await preparePrintImagesForCanvas(container);
        const exportEls = Array.from(container.querySelectorAll<HTMLElement>('.lv-a4-scale-wrap'));
        if (!exportEls.length) {
            restorePrintImages();
            throw new Error('No pages found to export.');
        }
        const pdf = new jsPDF({
            orientation: isLandscape ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });
        const pageW = isLandscape ? 297 : 210;
        const pageH = isLandscape ? 210 : 297;
        exportEls.forEach((_, idx) => {
            if (idx > 0)
                pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageW, pageH, 'F');
        });
        try {
            for (let idx = 0; idx < exportEls.length; idx += 1) {
                const exportEl = exportEls[idx];
                const canvas = await html2canvas(exportEl, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    windowWidth: exportEl.scrollWidth,
                    windowHeight: exportEl.scrollHeight,
                    onclone: prepareHtml2CanvasClone,
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                pdf.setPage(idx + 1);
                pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
                addEditableTextLayer(pdf, exportEl, pageW, pageH);
                addLinkAnnotations(pdf, exportEl, pageW, pageH);
            }
        }
        finally {
            restorePrintImages();
        }
        return pdf.output('blob');
    }
    function addLinkAnnotations(pdf: jsPDF, exportEl: HTMLElement, pageW: number, pageH: number) {
        const pageEl = exportEl.querySelector<HTMLElement>('.lv-a4-page') ?? exportEl;
        const pageRect = pageEl.getBoundingClientRect();
        if (!pageRect.width || !pageRect.height)
            return;
        const anchors = Array.from(pageEl.querySelectorAll<HTMLAnchorElement>('a[href]'));
        for (const anchor of anchors) {
            const rawHref = anchor.getAttribute('href')?.trim();
            if (!rawHref || rawHref === '#')
                continue;
            const url = /^https?:\/\//i.test(rawHref) ? rawHref : anchor.href;
            if (!/^https?:\/\//i.test(url))
                continue;
            const rects = Array.from(anchor.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
            for (const rect of rects) {
                const left = Math.max(rect.left, pageRect.left);
                const top = Math.max(rect.top, pageRect.top);
                const right = Math.min(rect.right, pageRect.right);
                const bottom = Math.min(rect.bottom, pageRect.bottom);
                if (right <= left || bottom <= top)
                    continue;
                const x = ((left - pageRect.left) / pageRect.width) * pageW;
                const y = ((top - pageRect.top) / pageRect.height) * pageH;
                const w = ((right - left) / pageRect.width) * pageW;
                const h = ((bottom - top) / pageRect.height) * pageH;
                pdf.link(x, y, w, h, { url });
            }
        }
    }
    function addEditableTextLayer(pdf: jsPDF, exportEl: HTMLElement, pageW: number, pageH: number) {
        const pageEl = exportEl.querySelector<HTMLElement>('.lv-a4-page') ?? exportEl;
        const pageRect = pageEl.getBoundingClientRect();
        if (!pageRect.width || !pageRect.height)
            return;
        const textNodes: Text[] = [];
        const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
                if (!text)
                    return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent)
                    return NodeFilter.FILTER_REJECT;
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        while (walker.nextNode())
            textNodes.push(walker.currentNode as Text);
        const pdfAny = pdf as any;
        const GState = (jsPDF as any).GState ?? pdfAny.GState;
        const transparentState = typeof GState === 'function'
            ? new GState({ opacity: 0.01 })
            : null;
        if (transparentState && typeof pdfAny.setGState === 'function') {
            pdfAny.setGState(transparentState);
        }
        pdf.setTextColor(0, 0, 0);
        for (const node of textNodes) {
            const parent = node.parentElement;
            if (!parent)
                continue;
            const text = node.textContent?.replace(/\s+/g, ' ').trim();
            if (!text)
                continue;
            const style = window.getComputedStyle(parent);
            const fontPx = Number.parseFloat(style.fontSize || '12') || 12;
            const fontPt = Math.max(4, fontPx * 0.75);
            const fontStyle = style.fontStyle === 'italic' ? 'italic' : style.fontWeight >= '600' ? 'bold' : 'normal';
            pdf.setFont('helvetica', fontStyle);
            pdf.setFontSize(fontPt);
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
            range.detach();
            for (const rect of rects) {
                const x = ((rect.left - pageRect.left) / pageRect.width) * pageW;
                const y = ((rect.top - pageRect.top) / pageRect.height) * pageH + fontPt * 0.3528;
                if (x < -2 || y < -2 || x > pageW + 2 || y > pageH + 2)
                    continue;
                pdf.text(text, x, y, { baseline: 'alphabetic' });
            }
        }
        if (transparentState && typeof pdfAny.setGState === 'function') {
            pdfAny.setGState(new GState({ opacity: 1 }));
        }
    }
    function pdfFileBaseName() {
        return String(leaflet?.title || 'leaflet').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'leaflet';
    }
    async function exportEditablePdf() {
        await waitForPrintAssets();
        document.getElementById('lv-page-orientation')?.remove();
        const style = document.createElement('style');
        style.id = 'lv-page-orientation';
        style.textContent = isLandscape
            ? '@page { size: A4 landscape; margin: 0; }'
            : '@page { size: A4 portrait; margin: 0; }';
        document.head.appendChild(style);
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        window.print();
        setTimeout(() => { document.getElementById('lv-page-orientation')?.remove(); }, 2000);
    }
    async function saveExportedPdf() {
        if (!id)
            throw new Error('Leaflet is not ready yet.');
        setSavingPdf(true);
        setSavedPdfUrl(null);
        setSavedPdfFile(null);
        setSavePdfError(null);
        setSharePdfNotice(null);
        setSharePdfMenuOpen(true);
        try {
            const blob = await createPdfBlob();
            const fileName = `${pdfFileBaseName()}.pdf`;
            const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
            const form = new FormData();
            form.append('pdf', pdfFile);
            form.append('allow_edit', allowSharedPdfEdit ? '1' : '0');
            const token = readAuthToken();
            if (!token)
                throw new Error('Please log in again before saving the exported PDF.');
            const res = await fetch(`/api/leaflets/${id}/exported-pdfs`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const text = await res.text();
            let payload: any = {};
            try {
                payload = text ? JSON.parse(text) : {};
            }
            catch { }
            if (!res.ok) {
                const serverMessage = payload.error || payload.message || text.trim();
                throw new Error(serverMessage || `Unable to save exported PDF. Server returned ${res.status}.`);
            }
            const shareUrl = payload.export?.share_url
                ? new URL(payload.export.share_url, window.location.origin).toString()
                : null;
            if (!shareUrl)
                throw new Error('The PDF was saved, but the server did not return a share link.');
            setSavedPdfUrl(shareUrl);
            setSavedPdfFile(pdfFile);
            setSharePdfNotice(`Share link ready${allowSharedPdfEdit ? ' with edit permission' : ''}.`);
            setSharePdfMenuOpen(true);
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'Unable to save exported PDF.';
            setSavePdfError(message);
            throw e;
        }
        finally {
            setSavingPdf(false);
        }
    }
    async function copySavedPdfLink() {
        if (!savedPdfUrl)
            return;
        await navigator.clipboard?.writeText(savedPdfUrl);
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(false);
        setSharePdfNotice('Share link copied.');
    }
    async function shareSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        const title = leaflet?.title || 'Leaflet PDF';
        const text = `${title} PDF${allowSharedPdfEdit ? ' (editable permission enabled)' : ''}`;
        if (navigator.share) {
            await navigator.share({ title, text, url: savedPdfUrl });
            setSharePdfMenuOpen(false);
            return;
        }
        await copySavedPdfLink();
    }
    async function shareSavedPdfCopy() {
        if (!savedPdfFile)
            return;
        const title = leaflet?.title || 'Leaflet PDF';
        const nav = navigator as Navigator & {
            canShare?: (data: ShareData) => boolean;
            share?: (data: ShareData) => Promise<void>;
        };
        const shareData: ShareData = {
            title,
            text: `${title} PDF`,
            files: [savedPdfFile],
        };
        if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
            try {
                await nav.share(shareData);
                setSharePdfMenuOpen(false);
                return;
            }
            catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError')
                    return;
            }
        }
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(true);
    }
    function downloadSavedPdfCopy() {
        if (!savedPdfFile)
            return;
        const url = URL.createObjectURL(savedPdfFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = savedPdfFile.name;
        a.click();
        URL.revokeObjectURL(url);
        setSharePdfFallbackOpen(false);
        setSharePdfNotice('PDF copy downloaded.');
    }
    function emailSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        const subject = encodeURIComponent(`${leaflet?.title || 'Leaflet'} PDF`);
        const body = encodeURIComponent(`Here is the PDF link:\n${savedPdfUrl}\n\nPermission: ${allowSharedPdfEdit ? 'Recipients may edit if their PDF app supports editing.' : 'View/download only.'}`);
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(false);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
    function whatsappSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        const text = encodeURIComponent(`${leaflet?.title || 'Leaflet'} PDF: ${savedPdfUrl}`);
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(false);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    }
    function telegramSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        const text = encodeURIComponent(`${leaflet?.title || 'Leaflet'} PDF`);
        const url = encodeURIComponent(savedPdfUrl);
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(false);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank', 'noopener,noreferrer');
    }
    function smsSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        const body = encodeURIComponent(`${leaflet?.title || 'Leaflet'} PDF: ${savedPdfUrl}`);
        setSharePdfMenuOpen(false);
        setSharePdfFallbackOpen(false);
        window.location.href = `sms:?&body=${body}`;
    }
    function openSavedPdfLink() {
        if (!savedPdfUrl)
            return;
        setSharePdfMenuOpen(false);
        window.open(savedPdfUrl, '_blank', 'noopener,noreferrer');
    }
    function renderSidebarTemplateCard(t: LayoutTemplate, keyPrefix: 'tpl' | 'saved', displayName: string) {
        const layout = t.layout as CardLayout;
        const key = `${keyPrefix}-${t.id}`;
        const isDeleting = sidebarTemplateDeleteId === t.id;
        return (<div key={t.id} className="lv-sb-template-card">
        <div className="lv-sb-template-preview">
          <LayoutThumbnail layout={layout}/>
        </div>
        <div className="lv-sb-template-meta">
          <div>
            <span className="lv-sb-template-name" title={displayName}>{displayName}</span>
            <span className="lv-sb-template-date">{new Date(t.created_at).toLocaleDateString()}</span>
          </div>
          <div className="lv-sb-template-actions">
            <button type="button" className="lv-sb-template-apply" disabled={!!sidebarTemplateApplying} onClick={() => applySidebarTemplate(layout, key, displayName)}>
              {sidebarTemplateApplying === key ? 'Applying...' : 'Apply'}
            </button>
            {t.can_delete !== false && (<button type="button" className="lv-sb-template-delete" onClick={() => setSidebarTemplateDeleteId(isDeleting ? null : t.id)} aria-label={`Delete ${displayName}`}>
                Delete
              </button>)}
          </div>
          {isDeleting && (<div className="lv-sb-template-confirm">
              <span>Delete this template?</span>
              <button type="button" onClick={() => setSidebarTemplateDeleteId(null)}>Cancel</button>
              <button type="button" onClick={() => confirmSidebarTemplateDelete(t.id)}>Delete</button>
            </div>)}
        </div>
      </div>);
    }
    if (coverBuilderOnly) {
        return renderCoverBuilderModal();
    }
    if (coverBuilderOpen) {
        return renderCoverBuilderModal();
    }
    return (<>
    <div className="lv-page">
      <div className="lv-layout">

        {/* -- Left sidebar -- */}
        <aside className={`lv-sidebar${openSbSection ? ' lv-sidebar--open' : ''}${openSbSection === 'typography' ? ' lv-sidebar--typography' : ''}`}>

          {/* -- Nav strip (left column) -- */}
          <div className="lv-sb-nav-strip">
            {([
            { id: 'header', ic: '\u2630', lbl: 'Header' },
            { id: 'templates', ic: '\u{1F5C2}', lbl: 'Template' },
            { id: 'page', ic: '\u229E', lbl: 'Layout' },
            { id: 'footer', ic: '\u2261', lbl: 'Footer' },
            { id: 'icons', ic: '\u2726', lbl: 'Icons' },
            { id: 'firstpage', ic: '\u25A3', lbl: 'Cover' },
            { id: 'lastpage', ic: '\u25C8', lbl: 'Back' },
            { id: 'typography', ic: 'Aa', lbl: 'Type' },
            { id: 'currency', ic: '\u00A4', lbl: 'Price' },
        ] as const).map(item => (<button key={item.id} className={`lv-sb-nav-btn${openSbSection === item.id ? ' active' : ''}`} onClick={() => setOpenSbSection(p => p === item.id ? null : item.id)} title={item.lbl}>
                <span className="lv-sb-nav-ic">
                  {item.id === 'templates'
                ? <span className="lv-sb-nav-template-svg material-symbol" aria-hidden="true">dashboard_customize</span>
                : item.ic}
                </span>
                <span className="lv-sb-nav-lbl">{item.lbl}</span>
              </button>))}
          </div>

          {/* -- Content panel (right column) -- */}
          <div className="lv-sb-cpanel">
            {openSbSection && (<div className="lv-sb-cpanel-head">
                <span className="lv-sb-cpanel-title">
                  {openSbSection === 'header' ? 'Header'
                : openSbSection === 'templates' ? 'Card Template'
                    : openSbSection === 'page' ? 'Page Layout'
                        : openSbSection === 'footer' ? 'Footer'
                            : openSbSection === 'icons' ? 'Icons'
                                : openSbSection === 'firstpage' ? 'Cover Page'
                                    : openSbSection === 'lastpage' ? 'Back Cover'
                                        : openSbSection === 'typography' ? 'Typography'
                                            : openSbSection === 'currency' ? 'Price'
                                                : 'Typography'}
                </span>
                <button className="lv-sb-cpanel-close" onClick={() => setOpenSbSection(null)}>x</button>
              </div>)}
            <div className="lv-sb-cpanel-body">

          <SbSection id="templates" open={openSbSection === 'templates'} onToggle={() => { }} title="Card Template" tooltip={SB_TOOLTIPS.templates}>
            <div className="lv-sb-template-panel">
              <div className="lv-sb-template-toolbar">
                <button type="button" className="lv-sb-template-action" onClick={loadSidebarTemplates}>
                  Refresh
                </button>
                <button type="button" className="lv-sb-template-action" onClick={() => setTemplateOpen(true)}>
                  Full library
                </button>
              </div>

              {sidebarTemplatesLoading && <p className="lv-sb-template-state">Loading templates...</p>}
              {!sidebarTemplatesLoading && sidebarTemplatesErr && <p className="lv-sb-template-state err">{sidebarTemplatesErr}</p>}

              <div className="lv-sb-template-group">
                <div className="lv-sb-template-group-head">
                  <span>Templates</span>
                  <small>{sidebarVisibleTemplates.length}</small>
                </div>
                {!sidebarTemplatesLoading && !sidebarTemplatesErr && sidebarVisibleTemplates.length === 0 && (<div className="lv-sb-template-empty">No platform templates yet.</div>)}
                <div className="lv-sb-template-list">
                  {sidebarVisibleTemplates.map((t, index) => renderSidebarTemplateCard(t, 'tpl', t.is_default ? `Template ${index + 1}` : t.name))}
                </div>
              </div>

              <div className="lv-sb-template-group">
                <div className="lv-sb-template-group-head">
                  <span>Saved Templates</span>
                  <small>{sidebarSavedTemplates.length}</small>
                </div>
                {!sidebarTemplatesLoading && !sidebarTemplatesErr && sidebarSavedTemplates.length === 0 && (<div className="lv-sb-template-empty">No saved templates yet.</div>)}
                <div className="lv-sb-template-list">
                  {sidebarSavedTemplates.map(t => renderSidebarTemplateCard(t, 'saved', t.name))}
                </div>
              </div>
            </div>
          </SbSection>

          <SbSection id="header" open={openSbSection === 'header'} onToggle={() => { }} title="Header" tooltip={SB_TOOLTIPS.header}>
            <div className="lv-sb-row lv-sb-row--inline">
              <span className="lv-sb-label">Show <InfoTooltip text={SB_TOOLTIPS['header.show']}/></span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={headerShowFor(safePage)} onChange={() => toggleHeaderForPage(safePage)}/>
                <span className="lv-sb-switch-track"/>
              </label>
              {pageOverrides[safePage]?.header !== undefined && (<span className="lv-sb-page-badge">pg {safePage + 1}</span>)}
            </div>
            {headerShowFor(safePage) && (<>
              {headerWidthPct < 100 && (<div className="lv-sb-row">
                  <span className="lv-sb-label">Position <InfoTooltip text={SB_TOOLTIPS['header.position']}/></span>
                  <div className="lv-sb-tabs">
                    {(['left', 'center', 'right'] as const).map(a => (<button key={a} className={`lv-sb-tab${hs.blockAlign === a ? ' active' : ''}`} onClick={() => setH('blockAlign', a)}>
                        {a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}
                      </button>))}
                  </div>
                </div>)}
            </>)}
          </SbSection>

          <SbSection id="page" open={openSbSection === 'page'} onToggle={() => { }} title="Page Layout" tooltip={SB_TOOLTIPS.page}>
            <div className="lv-sb-tabs">
              <button className={`lv-sb-tab${pageSettings.bgType === 'solid' ? ' active' : ''}`} onClick={() => setPg('bgType', 'solid')}>Solid</button>
              <button className={`lv-sb-tab${pageSettings.bgType === 'gradient' ? ' active' : ''}`} onClick={() => setPg('bgType', 'gradient')}>Gradient</button>
            </div>
            {pageSettings.bgType === 'solid' && (<div className="lv-sb-row">
                <span className="lv-sb-label">Color <InfoTooltip text={SB_TOOLTIPS['page.bgColor']}/></span>
                <div className="lv-sb-color-wrap">
                  <ColorSwatch value={pageSettings.bgColor} onChange={v => setPg('bgColor', v)}/>
                  <span className="lv-sb-val">{pageSettings.bgColor}</span>
                </div>
              </div>)}
            {pageSettings.bgType === 'gradient' && (<>
              <div className="lv-sb-row">
                <span className="lv-sb-label">From <InfoTooltip text={SB_TOOLTIPS['page.gradFrom']}/></span>
                <div className="lv-sb-color-wrap">
                  <ColorSwatch value={pageSettings.gradFrom} onChange={v => setPg('gradFrom', v)}/>
                  <span className="lv-sb-val">{pageSettings.gradFrom}</span>
                </div>
              </div>
              <div className="lv-sb-row">
                <span className="lv-sb-label">To <InfoTooltip text={SB_TOOLTIPS['page.gradTo']}/></span>
                <div className="lv-sb-color-wrap">
                  <ColorSwatch value={pageSettings.gradTo} onChange={v => setPg('gradTo', v)}/>
                  <span className="lv-sb-val">{pageSettings.gradTo}</span>
                </div>
              </div>
              <div className="lv-sb-row">
                <span className="lv-sb-label">Angle <InfoTooltip text={SB_TOOLTIPS['page.gradAngle']}/></span>
                <div className="lv-sb-slider-wrap">
                  <input type="range" min={0} max={360} value={pageSettings.gradAngle} onChange={e => setPg('gradAngle', +e.target.value)}/>
                  <span className="lv-sb-val">{pageSettings.gradAngle}deg</span>
                </div>
              </div>
              <div className={cx("lv-sb-preview", cssClass({ background: pageBg }))}/>
            </>)}
            <div className="lv-sb-row">
              <span className="lv-sb-label">Cards per Row <InfoTooltip text={SB_TOOLTIPS['page.colsPerPage']}/></span>
              <div className="lv-sb-tabs">
                {[1, 2, 3, 4, 5, 6].map(n => (<button key={n} className={`lv-sb-tab${colsPerPage === n ? ' active' : ''}`} onClick={() => setColsPerPage(n)} aria-label={`${n} columns`}>{n}</button>))}
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Cards per Column <InfoTooltip text={SB_TOOLTIPS['page.rowsPerPage']}/></span>
              <div className="lv-sb-tabs">
                {[1, 2, 3, 4, 5, 6].map(n => (<button key={n} className={`lv-sb-tab${rowsPerPage === n ? ' active' : ''}`} onClick={() => setRowsPerPage(n)} aria-label={`${n} rows`}>{n}</button>))}
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Horizontal <InfoTooltip text={SB_TOOLTIPS['page.horizontal']}/></span>
              <div className="lv-sb-slider-wrap">
                <input type="range" min={0} max={48} value={pageSettings.colGap} onChange={e => setPg('colGap', +e.target.value)}/>
                <span className="lv-sb-val">{pageSettings.colGap}px</span>
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Vertical <InfoTooltip text={SB_TOOLTIPS['page.vertical']}/></span>
              <div className="lv-sb-slider-wrap">
                <input type="range" min={0} max={48} value={pageSettings.rowGap} onChange={e => setPg('rowGap', +e.target.value)}/>
                <span className="lv-sb-val">{pageSettings.rowGap}px</span>
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Orientation <InfoTooltip text={SB_TOOLTIPS['page.orientation']}/></span>
              <div className="lv-sb-tabs">
                <button className={`lv-sb-tab${pageSettings.orientation === 'portrait' ? ' active' : ''}`} onClick={() => setPageOrientation('portrait')} title="Portrait">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2"/>
                  </svg>
                  Portrait
                </button>
                <button className={`lv-sb-tab${pageSettings.orientation === 'landscape' ? ' active' : ''}`} onClick={() => setPageOrientation('landscape')} title="Landscape">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                  </svg>
                  Landscape
                </button>
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Grid Width <InfoTooltip text={SB_TOOLTIPS['page.gridWidth']}/></span>
              <div className="lv-sb-slider-wrap">
                <input type="range" min={10} max={100} value={pageSettings.gridWidthPct} onChange={e => setPg('gridWidthPct', +e.target.value)}/>
                <span className="lv-sb-val">{pageSettings.gridWidthPct}%</span>
              </div>
            </div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Grid Height <InfoTooltip text={SB_TOOLTIPS['page.gridHeight']}/></span>
              <div className="lv-sb-slider-wrap">
                <input type="range" min={10} max={100} value={pageSettings.gridHeightPct} onChange={e => setPg('gridHeightPct', +e.target.value)}/>
                <span className="lv-sb-val">{pageSettings.gridHeightPct}%</span>
              </div>
            </div>
          </SbSection>

          <SbSection id="footer" open={openSbSection === 'footer'} onToggle={() => { }} title="Footer" tooltip={SB_TOOLTIPS.footer}>
            <div className="lv-sb-row lv-sb-row--inline">
              <span className="lv-sb-label">Show <InfoTooltip text={SB_TOOLTIPS['footer.show']}/></span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={footerShowFor(safePage)} onChange={() => toggleFooterForPage(safePage)}/>
                <span className="lv-sb-switch-track"/>
              </label>
              {pageOverrides[safePage]?.footer !== undefined && (<span className="lv-sb-page-badge">pg {safePage + 1}</span>)}
            </div>
            {footerShowFor(safePage) && (<>
              {fs.widthPct < 100 && (<div className="lv-sb-row">
                  <span className="lv-sb-label">Position <InfoTooltip text={SB_TOOLTIPS['footer.position']}/></span>
                  <div className="lv-sb-tabs">
                    {(['left', 'center', 'right'] as const).map(a => (<button key={a} className={`lv-sb-tab${fs.blockAlign === a ? ' active' : ''}`} onClick={() => setF('blockAlign', a)}>
                        {a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}
                      </button>))}
                  </div>
                </div>)}
            </>)}
          </SbSection>

          {/* -- Icons -- */}
          <SbSection id="icons" open={openSbSection === 'icons'} onToggle={() => { }} title="Icons" tooltip={SB_TOOLTIPS.icons}>
            <div className="lv-sb-icons-grid">
              {[...presetIcons, ...adminIcons, ...customIcons].map(ic => (<div key={ic.url} className="lv-sb-icon-item" draggable title={ic.label} onDragStart={e => {
                _dragIconSrc = ic.url;
                _dragIconLabel = ic.label;
                e.dataTransfer.setData('text/plain', ic.url);
                e.dataTransfer.effectAllowed = 'copy';
                document.body.classList.add('dragging-icon');
            }} onDragEnd={() => {
                _dragIconSrc = '';
                _dragIconLabel = '';
                document.body.classList.remove('dragging-icon');
            }}>
                  <img src={ic.url} alt={ic.label} className="lv-sb-icon-img"/>
                  <span className="lv-sb-icon-label">{ic.label}</span>
                </div>))}
            </div>
            <label className="lv-sb-icon-upload">
              <span>+ Upload icon</span>
              <input type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = ev => {
                const url = ev.target?.result as string;
                if (url)
                    setCustomIcons(prev => [...prev, { label: file.name.replace(/\.[^.]+$/, ''), url }]);
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }} className={cssClass({ display: 'none' })}/>
            </label>
          </SbSection>

          {/* -- Cover Page -- */}
          <SbSection id="firstpage" open={openSbSection === 'firstpage'} onToggle={() => { }} title="Cover Page" tooltip={SB_TOOLTIPS.firstpage}>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Show</span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={coverPage.show} onChange={e => setCoverPage(p => ({ ...p, show: e.target.checked }))}/>
                <span className="lv-sb-switch-track"/>
              </label>
            </div>
            <div className="lv-sb-cover-upload">
              {coverPage.image
            ? <img src={coverPage.image} alt="First page cover" className="lv-sb-cover-preview"/>
            : <span className="lv-sb-cover-empty">No image</span>}
              <label className={cx("lv-sb-icon-upload", cssClass({ marginTop: 6 }))}>
                <span>{coverPage.image ? 'Change image' : '+ Upload image'}</span>
                <input type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = ev => {
                const url = ev.target?.result as string;
                if (url)
                    setCoverPage(p => ({ ...p, image: url, show: true, builder: false }));
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }} className={cssClass({ display: 'none' })}/>
              </label>
              {coverPage.image && (<button className="lv-sb-cover-remove" onClick={() => setCoverPage({ image: '', show: false, builder: false })}>Remove</button>)}
            </div>
            <button type="button" className="lv-cover-builder-launch" onClick={() => openCoverBuilderForTarget('front')}>
              Create Cover Page
            </button>
          </SbSection>

          {/* -- Last Page -- */}
          <SbSection id="lastpage" open={openSbSection === 'lastpage'} onToggle={() => { }} title="Back Cover" tooltip={SB_TOOLTIPS.lastpage}>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Show</span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={backPage.show} onChange={e => setBackPage(p => ({ ...p, show: e.target.checked }))}/>
                <span className="lv-sb-switch-track"/>
              </label>
            </div>
            <div className="lv-sb-cover-upload">
              {backPage.image
            ? <img src={backPage.image} alt="Last page cover" className="lv-sb-cover-preview"/>
            : <span className="lv-sb-cover-empty">No image</span>}
              <label className={cx("lv-sb-icon-upload", cssClass({ marginTop: 6 }))}>
                <span>{backPage.image ? 'Change image' : '+ Upload image'}</span>
                <input type="file" accept="image/*" onChange={e => {
            const file = e.target.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = ev => {
                const url = ev.target?.result as string;
                if (url)
                    setBackPage(p => ({ ...p, image: url, show: true, builder: false }));
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }} className={cssClass({ display: 'none' })}/>
              </label>
              {backPage.image && (<button className="lv-sb-cover-remove" onClick={() => setBackPage({ image: '', show: false, builder: false })}>Remove</button>)}
            </div>
            <button type="button" className="lv-cover-builder-launch" onClick={() => openCoverBuilderForTarget('back')}>
              Create Back Cover
            </button>
          </SbSection>

          <SbSection id="typography" open={openSbSection === 'typography'} onToggle={() => { }} title="Typography" tooltip={SB_TOOLTIPS.typography}>
            <FontPickerSection layout={cardLayout ?? {}} set={(key, value) => {
            setCardLayout(prev => {
                if (!prev)
                    return prev;
                const next = { ...prev, [key]: value };
                saveLeafletLayout(id!, next).catch(() => { });
                return next;
            });
        }}/>
          </SbSection>

          <SbSection id="currency" open={openSbSection === 'currency'} onToggle={() => { }} title="Price" tooltip={SB_TOOLTIPS.currency}>
            {/* -- Show / Hide prices -- */}
            <div className="lv-sb-sub-title">Show Currency Symbol</div>
            <div className="lv-sb-row lv-sb-row--inline">
              <span className="lv-sb-label">Current Price <InfoTooltip text={SB_TOOLTIPS['price.showCurrCurrent']}/></span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={cardLayout?.show_currency_current !== false} onChange={e => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, show_currency_current: e.target.checked };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}/>
                <span className="lv-sb-switch-track"/>
              </label>
            </div>
            <div className="lv-sb-row lv-sb-row--inline">
              <span className="lv-sb-label">Old Price <InfoTooltip text={SB_TOOLTIPS['price.showCurrOld']}/></span>
              <label className="lv-sb-switch">
                <input type="checkbox" checked={cardLayout?.show_currency_old !== false} onChange={e => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, show_currency_old: e.target.checked };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}/>
                <span className="lv-sb-switch-track"/>
              </label>
            </div>

            {/* -- Currency Symbol -- */}
            <div className="lv-sb-sub-title">Currency Symbol</div>
            <input type="text" placeholder="e.g. Saudi Arabia" className="lv-sb-text-input lv-sb-currency-search" value={currencySearch} onChange={e => setCurrencySearch(e.target.value)}/>
            <div className="lv-sb-currency-list">
              {/* None option */}
              <div className={`lv-sb-currency-item${!(cardLayout?.currency_symbol) ? ' active' : ''}`} onClick={() => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, currency_symbol: '', currency_code: '' };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}>
                <span className="lv-sb-currency-sym">-</span>
                <span className="lv-sb-currency-name">None</span>
              </div>
              {WORLD_CURRENCIES.filter(c => {
            const q = currencySearch.toLowerCase().trim();
            return !q
                || c.name.toLowerCase().includes(q)
                || c.code.toLowerCase().includes(q)
                || c.symbol.toLowerCase().includes(q)
                || (c.altSymbol?.toLowerCase().includes(q) ?? false);
        }).map(c => {
            const isActive = cardLayout?.currency_code
                ? cardLayout.currency_code === c.code
                : cardLayout?.currency_symbol === c.symbol ||
                    cardLayout?.currency_symbol === c.altSymbol;
            return (<div key={c.code} className={`lv-sb-currency-item${isActive ? ' active' : ''}`} onClick={() => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol: c.symbol, currency_code: c.code };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}>
                    <span className="lv-sb-currency-sym">{c.symbol}</span>
                    <span className="lv-sb-currency-code">{c.code}</span>
                    <span className="lv-sb-currency-name">{c.name}</span>
                  </div>);
        })}
            </div>

            {/* -- Variant toggle: original vs. Latin/English -- */}
            {(() => {
            const selected = WORLD_CURRENCIES.find(c => c.symbol === cardLayout?.currency_symbol ||
                c.altSymbol === cardLayout?.currency_symbol);
            if (!selected?.altSymbol || !isNonLatin(selected.symbol))
                return null;
            const isAlt = cardLayout?.currency_symbol === selected.altSymbol;
            const pick = (sym: string) => setCardLayout(prev => {
                if (!prev)
                    return prev;
                const next = { ...prev, currency_symbol: sym };
                saveLeafletLayout(id!, next).catch(() => { });
                return next;
            });
            return (<div className={cx("lv-sb-row lv-sb-row--inline", cssClass({ marginTop: 6 }))}>
                  <span className="lv-sb-label">Symbol style</span>
                  <div className="lv-sb-seg-btns">
                    <button type="button" className={`lv-sb-seg-btn${!isAlt ? ' active' : ''}`} title="Original script" onClick={() => pick(selected.symbol)}>
                      {selected.symbol}
                    </button>
                    <button type="button" className={`lv-sb-seg-btn${isAlt ? ' active' : ''}`} title="Latin / English" onClick={() => pick(selected.altSymbol!)}>
                      {selected.altSymbol}
                    </button>
                  </div>
                </div>);
        })()}

            {/* -- Symbol sub-controls (second row under Currency Symbol title) -- */}
            <div className="lv-sb-symbol-sub">
              {(cardLayout?.currency_symbol ?? '') !== '' && (<>
                <div className="lv-sb-stacked-ctrl">
                  <span className="lv-sb-label">Position (old) <InfoTooltip text={SB_TOOLTIPS['price.posOld']}/></span>
                  <div className="lv-sb-seg-btns">
                    {(['before', 'after'] as const).map(p => (<button key={p} type="button" className={`lv-sb-seg-btn${(cardLayout?.currency_symbol_position ?? 'after') === p ? ' active' : ''}`} onClick={() => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol_position: p };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}>
                        {p === 'before' ? `${cardLayout?.currency_symbol} 59` : `59 ${cardLayout?.currency_symbol}`}
                      </button>))}
                  </div>
                </div>
                <div className="lv-sb-stacked-ctrl">
                  <span className="lv-sb-label">Position (current) <InfoTooltip text={SB_TOOLTIPS['price.posCurrent']}/></span>
                  <div className="lv-sb-seg-btns">
                    {(['top', 'left', 'right', 'bottom'] as const).map(p => (<button key={p} type="button" className={`lv-sb-seg-btn${(cardLayout?.currency_symbol_position_current ?? cardLayout?.currency_symbol_position ?? 'after') === p ? ' active' : ''}`} onClick={() => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol_position_current: p };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}>
                        {p === 'top' ? 'up' : p === 'bottom' ? 'down' : p === 'left' ? '<- sym' : 'sym ->'}
                      </button>))}
                  </div>
                </div>
              </>)}

              <div className="lv-sb-stacked-ctrl">
                <span className="lv-sb-label">Font size (current) <InfoTooltip text={SB_TOOLTIPS['price.sizeCurrent']}/></span>
                <div className="lv-sb-slider-row">
                  <input type="range" min={8} max={40} step={1} className="lv-sb-slider" value={cardLayout?.currency_symbol_size_current ?? cardLayout?.currency_symbol_size ?? 14} onChange={e => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, currency_symbol_size_current: +e.target.value };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}/>
                  <span className="lv-sb-val">{cardLayout?.currency_symbol_size_current ?? cardLayout?.currency_symbol_size ?? 14}px</span>
                </div>
              </div>

              <div className="lv-sb-stacked-ctrl">
                <span className="lv-sb-label">Font size (old) <InfoTooltip text={SB_TOOLTIPS['price.sizeOld']}/></span>
                <div className="lv-sb-slider-row">
                  <input type="range" min={8} max={40} step={1} className="lv-sb-slider" value={cardLayout?.currency_symbol_size_old ?? cardLayout?.currency_symbol_size ?? 14} onChange={e => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, currency_symbol_size_old: +e.target.value };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}/>
                  <span className="lv-sb-val">{cardLayout?.currency_symbol_size_old ?? cardLayout?.currency_symbol_size ?? 14}px</span>
                </div>
              </div>

              <div className="lv-sb-stacked-ctrl">
                <span className="lv-sb-label">Spacing <InfoTooltip text={SB_TOOLTIPS['price.spacing']}/></span>
                <div className="lv-sb-slider-row">
                  <input type="range" min={0} max={24} step={1} className="lv-sb-slider" value={cardLayout?.currency_symbol_gap ?? 2} onChange={e => setCardLayout(prev => {
            if (!prev)
                return prev;
            const next = { ...prev, currency_symbol_gap: +e.target.value };
            saveLeafletLayout(id!, next).catch(() => { });
            return next;
        })}/>
                  <span className="lv-sb-val">{cardLayout?.currency_symbol_gap ?? 2}px</span>
                </div>
              </div>
            </div>

            {/* -- Currency Icon -- */}
            <div className="lv-sb-sub-title">Currency Icon</div>
            <div className="lv-sb-row">
              <span className="lv-sb-label">Icon</span>
              <div className="lv-sb-currency-icon-row">
                {cardLayout?.currency_symbol_icon ? (<>
                    <img src={cardLayout.currency_symbol_icon} alt="currency icon" className="lv-sb-currency-icon-preview"/>
                    <button type="button" className="lv-sb-currency-icon-remove" title="Remove icon" onClick={() => setCardLayout(prev => {
                if (!prev)
                    return prev;
                const next = { ...prev, currency_symbol_icon: '' };
                saveLeafletLayout(id!, next).catch(() => { });
                return next;
            })}>x</button>
                  </>) : (<label className="lv-sb-icon-upload lv-sb-currency-icon-upload">
                    <span>+ Upload icon</span>
                    <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (!file)
                    return;
                const reader = new FileReader();
                reader.onload = ev => {
                    const url = ev.target?.result as string;
                    if (!url)
                        return;
                    setCardLayout(prev => {
                        if (!prev)
                            return prev;
                        const next = { ...prev, currency_symbol_icon: url };
                        saveLeafletLayout(id!, next).catch(() => { });
                        return next;
                    });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            }} className={cssClass({ display: 'none' })}/>
                  </label>)}
              </div>
            </div>
            {cardLayout?.currency_symbol_icon && (<>
                {/* Color pickers - only for SVG icons */}
                {isSvgDataUrl(cardLayout.currency_symbol_icon) && (<>
                    <div className="lv-sb-row lv-sb-row--inline">
                      <span className="lv-sb-label">Icon color (current)</span>
                      <div className="lv-sb-currency-icon-color-row">
                        <ColorSwatch value={cardLayout.currency_symbol_icon_color_current || cardLayout.currency_symbol_icon_color || '#000000'} onChange={v => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol_icon_color_current: v };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}/>
                        <span className="lv-sb-val">{cardLayout.currency_symbol_icon_color_current || cardLayout.currency_symbol_icon_color || '#000000'}</span>
                        {cardLayout.currency_symbol_icon_color_current && (<button type="button" className="lv-sb-currency-icon-remove" title="Reset" onClick={() => setCardLayout(prev => {
                        if (!prev)
                            return prev;
                        const next = { ...prev, currency_symbol_icon_color_current: '' };
                        saveLeafletLayout(id!, next).catch(() => { });
                        return next;
                    })}>x</button>)}
                      </div>
                    </div>
                    <div className="lv-sb-row lv-sb-row--inline">
                      <span className="lv-sb-label">Icon color (old)</span>
                      <div className="lv-sb-currency-icon-color-row">
                        <ColorSwatch value={cardLayout.currency_symbol_icon_color_old || cardLayout.currency_symbol_icon_color || '#000000'} onChange={v => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol_icon_color_old: v };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}/>
                        <span className="lv-sb-val">{cardLayout.currency_symbol_icon_color_old || cardLayout.currency_symbol_icon_color || '#000000'}</span>
                        {cardLayout.currency_symbol_icon_color_old && (<button type="button" className="lv-sb-currency-icon-remove" title="Reset" onClick={() => setCardLayout(prev => {
                        if (!prev)
                            return prev;
                        const next = { ...prev, currency_symbol_icon_color_old: '' };
                        saveLeafletLayout(id!, next).catch(() => { });
                        return next;
                    })}>x</button>)}
                      </div>
                    </div>
                  </>)}
                <div className="lv-sb-row lv-sb-row--inline">
                  <span className="lv-sb-label">Icon size (current)</span>
                  <div className={cssClass({ display: 'flex', alignItems: 'center', gap: 6 })}>
                    <input type="range" min={8} max={64} step={1} className="lv-sb-slider" value={cardLayout.currency_symbol_icon_size_current ?? cardLayout.currency_symbol_icon_size ?? 16} onChange={e => setCardLayout(prev => {
                if (!prev)
                    return prev;
                const next = { ...prev, currency_symbol_icon_size_current: +e.target.value };
                saveLeafletLayout(id!, next).catch(() => { });
                return next;
            })}/>
                    <span className="lv-sb-val">{cardLayout.currency_symbol_icon_size_current ?? cardLayout.currency_symbol_icon_size ?? 16}px</span>
                  </div>
                </div>
                <div className="lv-sb-row lv-sb-row--inline">
                  <span className="lv-sb-label">Icon size (old)</span>
                  <div className={cssClass({ display: 'flex', alignItems: 'center', gap: 6 })}>
                    <input type="range" min={8} max={64} step={1} className="lv-sb-slider" value={cardLayout.currency_symbol_icon_size_old ?? cardLayout.currency_symbol_icon_size ?? 16} onChange={e => setCardLayout(prev => {
                if (!prev)
                    return prev;
                const next = { ...prev, currency_symbol_icon_size_old: +e.target.value };
                saveLeafletLayout(id!, next).catch(() => { });
                return next;
            })}/>
                    <span className="lv-sb-val">{cardLayout.currency_symbol_icon_size_old ?? cardLayout.currency_symbol_icon_size ?? 16}px</span>
                  </div>
                </div>
                <div className="lv-sb-row lv-sb-row--inline">
                  <span className="lv-sb-label">Position</span>
                  <div className="lv-sb-seg-btns">
                    {(['before', 'after'] as const).map(p => (<button key={p} type="button" className={`lv-sb-seg-btn${(cardLayout?.currency_symbol_position ?? 'after') === p ? ' active' : ''}`} onClick={() => setCardLayout(prev => {
                    if (!prev)
                        return prev;
                    const next = { ...prev, currency_symbol_position: p };
                    saveLeafletLayout(id!, next).catch(() => { });
                    return next;
                })}>
                        {p === 'before' ? 'Icon 59' : '59 Icon'}
                      </button>))}
                  </div>
                </div>
              </>)}
          </SbSection>

            </div>{/* /lv-sb-cpanel-body */}
          </div>{/* /lv-sb-cpanel */}

        </aside>

        {/* -- Main content -- */}
        <div className="lv-main">
          <div className="container">

        {/* Breadcrumb */}
        <nav className="lv-breadcrumb" aria-label="breadcrumb">
          <Link to="/my-leaflets">My Leaflets</Link>
          <span className="sep">{'>'}</span>
          <span className="current">{leaflet.title}</span>
        </nav>

        {/* Header */}
        <div className="lv-header">
          <div className="lv-header-left">
            <h1 className="lv-title">{leaflet.title}</h1>
            {leaflet.description && (<p className="lv-desc">{leaflet.description}</p>)}
            <div className="lv-meta-row">
              <span className="lv-meta-chip">
                <span aria-hidden="true">{isTwoLang ? '\u{1F310}' : '\u{1F4DD}'}</span>
                {isTwoLang ? 'Bilingual' : 'Single language'}
              </span>
              <span className="lv-meta-chip"><span aria-hidden="true">{'\u{1F5D3}'}</span>{formatDate(leaflet.created_at)}</span>
              <span className="lv-meta-chip"><span aria-hidden="true">{'\u{1F4E6}'}</span>{products.length} product{products.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="lv-header-right">
            {editorTourSkipped && !editorTourOpen && (<span className="lv-tour-reminder">Editor tour available</span>)}
            <button className="btn ghost lv-tour-replay" onClick={startEditorTour}>Show Tour Again</button>
            <button className="btn ghost" onClick={() => setCustomizerOpen(true)}>{'\u{1F3A8}'} Customize Layout</button>

          </div>
        </div>
        <LeafletEditorTour open={editorTourOpen} stepIndex={editorTourStep} steps={LEAFLET_EDITOR_TOUR_STEPS} onBack={() => setEditorTourStep(s => Math.max(0, s - 1))} onNext={() => setEditorTourStep(s => Math.min(LEAFLET_EDITOR_TOUR_STEPS.length - 1, s + 1))} onSkip={() => closeEditorTour(true)} onDone={() => closeEditorTour(false)}/>

        {/* Toolbar */}
        <div className="lv-toolbar">
          <input type="search" className="lv-search input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search products"/>
          <select className="lv-sort input" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort products">
            <option value="default">Default order</option>
            <option value="price_asc">{'Price: low -> high'}</option>
            <option value="price_desc">{'Price: high -> low'}</option>
            <option value="name">{'Name A -> Z'}</option>
          </select>
          <span className="lv-count">{visible.length} of {products.length}</span>
          <button className={`lv-btn-set-default${isDefault ? ' lv-btn-set-default--active' : ''}`} title={isDefault ? 'This is your default leaflet - click to unset' : 'Set as default leaflet'} onClick={() => setDefaultModal(true)}>
            {isDefault ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>) : (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
            {isDefault ? 'Default' : 'Set as Default'}
          </button>
          <button className="lv-btn-duplicate" title="Duplicate this leaflet" onClick={() => {
            setDupName(`Copy of ${leaflet.title}`);
            setDupModal(true);
        }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Duplicate
          </button>
          <button className="lv-btn-add-product" onClick={() => { setNewProd(EMPTY_LP()); setShowAddModal(true); }} title="Add a new product manually">+ Add Product</button>
        </div>

        {/* -- Controls bar: pagination + zoom -------- */}
        <div className="lv-a4-controls">
          {/* Pagination */}
          <div className="lv-pg-bar">
            {/* <- Prev */}
            <button className="lv-pg-arrow-btn" disabled={currentPage <= (coverPage.show ? -1 : 0)} onClick={() => setCurrentPage(p => Math.max(coverPage.show ? -1 : 0, p - 1))} aria-label="Previous page">{'<'}</button>

            {/* Page numbers (with Cover / Back integrated) */}
            <div className="lv-pg-numbers">
              {(() => {
            const off = coverPage.show ? 1 : 0; // display offset: cover occupies label "1"
            const total = pages.length;
            const lastLabel = total + off + (backPage.show ? 1 : 0);
            const label = (i: number) => i + 1 + off; // regular page display number
            const pageNums = (() => {
                if (total <= 5) {
                    return pages.map((_, i) => (<button key={i} className={`lv-pg-num${i === safePage ? ' active' : ''}`} onClick={() => setCurrentPage(i)}>{label(i)}</button>));
                }
                const items: React.ReactNode[] = [];
                const first = 0, last = total - 1;
                const prev2 = safePage - 1, next2 = safePage + 1;
                items.push(<button key={first} className={`lv-pg-num${first === safePage ? ' active' : ''}`} onClick={() => setCurrentPage(first)}>{label(first)}</button>);
                if (prev2 > 1)
                    items.push(<span key="dots-l" className="lv-pg-dots" aria-hidden="true">...</span>);
                [prev2, safePage, next2].forEach(idx => {
                    if (idx > first && idx < last) {
                        items.push(<button key={idx} className={`lv-pg-num${idx === safePage ? ' active' : ''}`} onClick={() => setCurrentPage(idx)}>{label(idx)}</button>);
                    }
                });
                if (next2 < last - 1)
                    items.push(<span key="dots-r" className="lv-pg-dots" aria-hidden="true">...</span>);
                items.push(<button key={last} className={`lv-pg-num${last === safePage ? ' active' : ''}`} onClick={() => setCurrentPage(last)}>{label(last)}</button>);
                return items;
            })();
            return (<>
                    {coverPage.show && (<button className={`lv-pg-num lv-pg-special${currentPage === -1 ? ' active' : ''}`} onClick={() => setCurrentPage(-1)}>1</button>)}
                    {pageNums}
                    {backPage.show && (<button className={`lv-pg-num lv-pg-special${currentPage === pages.length ? ' active' : ''}`} onClick={() => setCurrentPage(pages.length)}>{lastLabel}</button>)}
                  </>);
        })()}
            </div>

            {/* Next -> */}
            <button className="lv-pg-arrow-btn" disabled={currentPage >= (backPage.show ? pages.length : pages.length - 1)} onClick={() => setCurrentPage(p => Math.min(backPage.show ? pages.length : pages.length - 1, p + 1))} aria-label="Next page">{'>'}</button>

            {/* Go to */}
            <form className="lv-pg-goto" onSubmit={e => {
            e.preventDefault();
            const inp = e.currentTarget.elements.namedItem('gopage') as HTMLInputElement;
            const n = parseInt(inp.value.split('/')[0].trim(), 10);
            if (!isNaN(n) && n >= 1 && n <= pages.length)
                setCurrentPage(n - 1);
            inp.value = '';
            inp.blur();
        }}>
              <span className="lv-pg-goto-label">Go to</span>
              <input name="gopage" type="text" className="lv-pg-goto-input" placeholder={`${safePage + 1}/${pages.length}`} aria-label="Go to page" onFocus={e => e.currentTarget.select()}/>
              <button type="submit" className="lv-pg-goto-btn">Go</button>
            </form>
          </div>

          {/* Zoom */}
          <div className="lv-zoom-bar">
            <button className="lv-zoom-btn" onClick={() => setZoom(z => Math.max(30, z - 10))} aria-label="Zoom out">&#8722;</button>
            <input type="range" min={30} max={150} step={5} value={zoom} onChange={e => setZoom(+e.target.value)} className="lv-zoom-slider" aria-label="Zoom"/>
            <button className="lv-zoom-btn" onClick={() => setZoom(z => Math.min(150, z + 10))} aria-label="Zoom in">&#43;</button>
            <span className="lv-zoom-label">{zoom}%</span>
            <button className="lv-zoom-reset" onClick={() => setZoom(90)} aria-label="Reset zoom">Reset</button>
          </div>
          {/* Export actions group */}
          <div className="lv-export-group">
            <button className="lv-export-editable-pdf-btn" title={!canExportPdf ? freePdfLimitMessage : "Export editable/selectable PDF"} disabled={savingPdf} onClick={async () => {
            if (!canExportPdf) {
                await promptProForPdfExport();
                return;
            }
            const ok = await consumeExport('pdf');
            if (!ok) {
                await promptProForPdfExport();
                return;
            }
            await exportEditablePdf();
            fetchExportQuota();
        }}>
              Export PDF
            </button>
            <button className="lv-save-pdf-btn" title={!canExportPdf ? freePdfLimitMessage : "Save and create a shareable PDF link"} disabled={savingPdf} onClick={async () => {
            if (!canExportPdf) {
                await promptProForPdfExport();
                return;
            }
            const saved = await saveExportedPdf().then(() => true).catch(() => false);
            if (saved) {
                await consumeExport('pdf');
            }
            fetchExportQuota();
        }}>
              {savingPdf ? 'Saving...' : 'Share PDF'}
            </button>
            {sharePdfMenuOpen && (savingPdf || savedPdfUrl || savePdfError) && (<div className="lv-share-pdf-popover" role="dialog" aria-label="Share saved PDF link">
                <div className="lv-share-pdf-popover-head">
                  <span>{savingPdf ? 'Preparing share link' : savePdfError ? 'Share link failed' : 'Share via'}</span>
                  <button type="button" onClick={() => setSharePdfMenuOpen(false)} aria-label="Close share options">x</button>
                </div>
                {savingPdf ? (<div className="lv-share-pdf-loading" aria-live="polite">
                    <span className="lv-share-pdf-spinner" aria-hidden="true"/>
                    <span>Creating editable PDF and share link...</span>
                  </div>) : savePdfError ? (<div className="lv-share-pdf-error" aria-live="polite">{savePdfError}</div>) : (<>
                    <button type="button" className="lv-share-pdf-primary" onClick={shareSavedPdfCopy}>Send PDF copy</button>
                    <button type="button" className="lv-share-pdf-primary" onClick={shareSavedPdfLink}>Share link</button>
                    <button type="button" onClick={openSavedPdfLink}>Open link</button>
                  </>)}
              </div>)}
            {sharePdfFallbackOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
              <div className="lv-share-fallback-backdrop" role="presentation" onMouseDown={e => {
                  if (e.target === e.currentTarget)
                      setSharePdfFallbackOpen(false);
              }}>
                <div className="lv-share-fallback-dialog" role="dialog" aria-modal="true" aria-labelledby="lv-share-fallback-title">
                  <div className="lv-share-fallback-head">
                    <div>
                      <h2 id="lv-share-fallback-title">Send PDF copy</h2>
                      <p>Choose how you want to share this PDF.</p>
                    </div>
                    <button type="button" className="material-symbol" onClick={() => setSharePdfFallbackOpen(false)} aria-label="Close">close</button>
                  </div>
                  <div className="lv-share-fallback-grid">
                    <button type="button" onClick={emailSavedPdfLink}><span className="material-symbol" aria-hidden="true">mail</span>Email</button>
                    <button type="button" onClick={whatsappSavedPdfLink}><span className="material-symbol" aria-hidden="true">chat</span>WhatsApp</button>
                    <button type="button" onClick={telegramSavedPdfLink}><span className="material-symbol" aria-hidden="true">send</span>Telegram</button>
                    <button type="button" onClick={smsSavedPdfLink}><span className="material-symbol" aria-hidden="true">sms</span>SMS</button>
                    <button type="button" onClick={copySavedPdfLink}><span className="material-symbol" aria-hidden="true">link</span>Copy link</button>
                    <button type="button" onClick={downloadSavedPdfCopy}><span className="material-symbol" aria-hidden="true">download</span>Download PDF</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
            <button className="lv-convert-book-btn" title={!canExportBook ? "Free plan: 1 book export allowed. Upgrade for unlimited exports." : "Convert pages to printable book / catalog"} onClick={async () => {
            if (!canExportBook) {
                promptProForBookExport();
                return;
            }
            const ok = await consumeExport('book');
            if (!ok) {
                promptProForBookExport();
                return;
            }
            setBookBuilderOpen(true);
            fetchExportQuota();
        }}>
              {'\u{1F4DA}'} Convert to Book
              {exportQuota?.plan === 'free' && canExportBook && (<span className="lv-free-badge">1 free</span>)}
            </button>
          </div>
        </div>

        {/* A4 page - one at a time */}
        <div className="lv-a4-area">
          <div className={cx("lv-a4-scale-wrap", cssClass({ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }))}>
            {(() => {
            if (currentPage === -1 && coverPage.show) {
                return (<div className={cx("lv-a4-page lv-a4-cover-page", cssClass({ width: A4_W, height: A4_H }))}>
            {coverPage.builder
                    ? renderCoverBuilderSurface({ applied: true, builder: frontCoverBuilder, editableProducts: true })
                    : coverPage.image
                    ? <img src={coverPage.image} alt="First page" className="lv-a4-cover-img"/>
                    : renderCoverBuilderSurface({ applied: true, builder: frontCoverBuilder, editableProducts: true })}
                  </div>);
            }
            if (currentPage === pages.length && backPage.show) {
                return (<div className={cx("lv-a4-page lv-a4-cover-page", cssClass({ width: A4_W, height: A4_H }))}>
            {backPage.builder
                    ? renderCoverBuilderSurface({ applied: true, builder: backCoverBuilder, editableProducts: true })
                    : backPage.image
                    ? <img src={backPage.image} alt="Last page" className="lv-a4-cover-img"/>
                    : renderCoverBuilderSurface({ applied: true, builder: backCoverBuilder, editableProducts: true })}
                  </div>);
            }
            const pageProd = pages[safePage];
            return (<div className={cx("lv-a4-page", cssClass({
                    '--a4-cols': colsPerPage,
                    '--a4-col-gap': `${colGap}px`,
                    '--a4-row-gap': `${rowGap}px`,
                    '--a4-rows': rowsPerPage,
                    background: pageBg,
                    width: A4_W,
                    height: A4_H,
                } as React.CSSProperties))}>
                  {headerShowFor(safePage) && (<div className={cssClass({ display: 'flex', justifyContent: hs.blockAlign === 'right' ? 'flex-end' : hs.blockAlign === 'center' ? 'center' : 'flex-start' })}>
                      <div ref={headerBarRef} data-lv-selectable="header" className={cx(`lv-a4-header lv-a4-header--editable${headerIsFullBleed ? ' full-bleed' : ''}${headerSelected ? ' selected' : ''}`, cssClass({ ...headerStyle, width: `${headerWidthPct}%`, justifyContent: hs.textAlign === 'center' ? 'center' : hs.textAlign === 'right' ? 'flex-end' : 'flex-start' }))} onMouseDown={e => {
                            e.stopPropagation();
                            setHeaderSelected(true);
                            setHeaderToolbarPanel(null);
                            setFooterSelected(false);
                            setFooterToolbarPanel(null);
                            window.requestAnimationFrame(updateHeaderToolbarPosition);
                        }} title="Select header">
                        <HeaderLogoItem settings={hs} editable onUpdate={patch => setHeaderSettings(prev => ({ ...prev, ...patch }))}/>
                        {hs.showText && (<HeaderTextItem settings={hs} text={hs.text || leaflet.title} editable fontFamily={cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined} onUpdate={patch => setHeaderSettings(prev => ({ ...prev, ...patch }))}/>)}
                      </div>
                    </div>)}
                  {pageProd.length > 0 ? (<div className="lv-a4-grid-wrap">
                      <div className={cx("lv-a4-grid", cssClass({ width: gridW, height: flushFullBleedFooter && footerShowFor(safePage) ? '100%' : gridHFor(safePage) }))}>
                        {pageProd.map(p => {
                        const isDragOver = dragOverId === p.id;
                        return (<div key={p.id} className={cx(`lv-card-wrap${isDragOver ? ' lv-card-drag-over' : ''}`, cssClass({ width: cardW, height: flushFullBleedFooter && footerShowFor(safePage) ? '100%' : cardHFor(safePage) }))} draggable onDragStart={e => handleDragStart(e, p.id)} onDragOver={e => handleDragOver(e, p.id)} onDrop={e => handleDrop(e, p.id)} onDragEnd={handleDragEnd}>
                            <ProductCard p={p} isTwoLang={isTwoLang} leafletId={id!} onUpdate={handleProductUpdate} onDelete={handleProductDelete} cardLayout={cardLayout} cardWidth={cardW} cardHeight={flushFullBleedFooter && footerShowFor(safePage) ? undefined : cardHFor(safePage)} overlays={overlays[p.id] ?? []} onAddOverlay={(src, label) => addOverlay(p.id, src, label)} onUpdateOverlay={(oid, patch) => updateOverlay(p.id, oid, patch)} onRemoveOverlay={oid => removeOverlay(p.id, oid)} showShapes={false}/>
                            <CardShapes layout={cardLayout}/>
                          </div>);
                    })}
                      </div>
                    </div>) : (<div className="lv-empty">
                      <span className={cssClass({ fontSize: 40 })}>{'\u{1F50D}'}</span>
                      <p>No products match your filter.</p>
                      <button className="btn ghost" onClick={() => { setSearch(''); setOnlyDiscounted(false); }}>
                        Clear filters
                      </button>
                    </div>)}
                  {footerShowFor(safePage) && (<div ref={footerBarRef} data-lv-selectable="footer" className={cx(`lv-a4-footer lv-a4-footer--editable${fs.widthMode === 'full' ? ' full-bleed' : ''}${footerSelected ? ' selected' : ''}`, cssClass({ ...footerStyle }))} onMouseDown={e => {
                            e.stopPropagation();
                            setHeaderSelected(false);
                            setHeaderToolbarPanel(null);
                            setFooterSelected(true);
                            setFooterToolbarPanel(null);
                        }}>
                      <HeaderLogoItem settings={fs} editable onUpdate={patch => setFooterSettings(prev => ({ ...prev, ...patch }))}/>
                      {fs.showText && <HeaderTextItem settings={fs} text={fs.text || leaflet.title} editable fontFamily={cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined} onUpdate={patch => setFooterSettings(prev => ({ ...prev, ...patch }))}/>}
                      {(fs.showPageNum ?? true) && <span className={cx("lv-a4-footer-pagenum", cssClass({ fontFamily: cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined }))}>Page {safePage + 1} / {pages.length}</span>}
                    </div>)}
                </div>);
        })()}
          </div>
        </div>

          </div>{/* /container */}
        </div>{/* /lv-main */}
      </div>{/* /lv-layout */}
    </div>{/* /lv-page */}

    {renderHeaderFloatingToolbar()}
    {renderFooterFloatingToolbar()}
    {customizerOpen && id && (<LayoutCustomizer initial={cardLayout ?? {} as CardLayout} onClose={() => setCustomizerOpen(false)} cardAspectRatio={cardW / cardH} onSave={async (layout) => {
                const r = await saveLeafletLayout(id, { ...layout, cover_page: coverPage, back_page: backPage, cover_builder: frontCoverBuilder as unknown as Record<string, unknown>, back_cover_builder: backCoverBuilder as unknown as Record<string, unknown> });
                setCardLayout(r.layout);
            }} onReset={async () => {
                const r = await resetLeafletLayout(id);
                setCardLayout(r.layout);
            }}/>)}
    {templateOpen && id && (<CardTemplateModal leafletId={id} onApply={applyCardTemplateToLeafletAndCovers} onClose={() => setTemplateOpen(false)}/>)}
    {bookBuilderOpen && (<BookBuilder leafletTitle={leaflet?.title ?? 'Leaflet'} pages={pages} coverPage={coverPage} backPage={backPage} cardLayout={cardLayout} a4W={A4_W} a4H={A4_H} gridW={gridW} gridH={gridH} cardWidth={cardW} cardHeight={cardH} colsPerPage={colsPerPage} rowsPerPage={rowsPerPage} colGap={colGap} rowGap={rowGap} pageBg={pageBg} isLandscape={isLandscape} headerStyle={headerStyle} footerStyle={footerStyle} headerSettings={{ show: headerSettings.show, text: headerSettings.text, showText: headerSettings.showText, textAlign: headerSettings.textAlign, blockAlign: headerSettings.blockAlign, widthMode: String(headerBarState.widthMode), widthPct: headerWidthPct, height: headerSettings.height, logoUrl: headerSettings.logoUrl, logoHeight: headerSettings.logoHeight, logoWidth: headerSettings.logoWidth, logoX: headerSettings.logoX, logoY: headerSettings.logoY, logoGap: headerSettings.logoGap, textWidth: headerSettings.textWidth, textHeight: headerSettings.textHeight, textX: headerSettings.textX, textY: headerSettings.textY }} footerSettings={{ show: footerSettings.show, text: footerSettings.text, showText: footerSettings.showText, textAlign: footerSettings.textAlign, widthMode: footerSettings.widthMode, height: footerSettings.height }} renderProductCard={(p, opts) => (<ProductCard p={p} isTwoLang={isTwoLang} leafletId={id ?? ''} onUpdate={() => { }} onDelete={() => { }} cardLayout={cardLayout} cardWidth={opts.cardWidth} cardHeight={opts.cardHeight} overlays={overlays[p.id] ?? []}/>)} onClose={() => setBookBuilderOpen(false)}/>)}
    {coverBuilderOpen && renderCoverBuilderModal()}
    {coverBuilderEditingProduct && (<EditModal product={coverBuilderEditingProduct} isTwoLang={isTwoLang} leafletId={id ?? ''} onClose={() => setCoverBuilderEditingProduct(null)} onSave={updated => {
                handleProductUpdate(updated);
                setCoverBuilderEditingProduct(null);
            }}/>)}

    {/* -- Hidden container rendered for PDF export (all pages at true A4 size) -- */}
    {ReactDOM.createPortal(<div id="lv-print-root" ref={pdfContainerRef} aria-hidden="true">
      {/* Cover page */}
      {coverPage.show && (<div className={cx("lv-a4-scale-wrap lv-export-page-wrap", cssClass({ transform: 'none', transformOrigin: 'top center', width: isLandscape ? '297mm' : '210mm' }))}>
          <div className={cx("lv-pdf-page lv-a4-page lv-a4-cover-page", cssClass(isLandscape ? { width: '297mm', height: '210mm', maxHeight: '210mm' } : {}))}>
                    {coverPage.builder
                        ? renderCoverBuilderSurface({ applied: true, builder: frontCoverBuilder })
                        : coverPage.image
                        ? <img src={coverPage.image} alt="First page" className="lv-a4-cover-img"/>
                        : renderCoverBuilderSurface({ applied: true, builder: frontCoverBuilder })}
          </div>
        </div>)}

      {pages.map((pageProd, pageIdx) => (<div key={pageIdx} className={cx("lv-a4-scale-wrap lv-export-page-wrap", cssClass({ transform: 'none', transformOrigin: 'top center', width: isLandscape ? '297mm' : '210mm' }))}>
          <div className={cx("lv-pdf-page lv-a4-page", cssClass({
                    '--a4-cols': colsPerPage,
                    '--a4-rows': rowsPerPage,
                    '--a4-col-gap': `${colGap}px`,
                    '--a4-row-gap': `${rowGap}px`,
                    '--a4-row-height': `${cardH}px`,
                    background: pageBg,
                    ...(isLandscape ? { width: '297mm', height: '210mm', maxHeight: '210mm' } : {}),
                } as React.CSSProperties))}>
            {headerShowFor(pageIdx) && (<div className={cssClass({ display: 'flex', justifyContent: hs.blockAlign === 'right' ? 'flex-end' : hs.blockAlign === 'center' ? 'center' : 'flex-start' })}>
                <div className={cx(`lv-a4-header${headerIsFullBleed ? ' full-bleed' : ''}`, cssClass({ ...headerStyle, width: `${headerWidthPct}%`, justifyContent: hs.textAlign === 'center' ? 'center' : hs.textAlign === 'right' ? 'flex-end' : 'flex-start' }))}>
                  <HeaderLogoItem settings={hs}/>
                  {hs.showText && (<HeaderTextItem settings={hs} text={hs.text || leaflet?.title || ''} fontFamily={cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined}/>)}
                </div>
              </div>)}
            {pageProd.length > 0 && (<div className="lv-a4-grid-wrap">
                <div className={cx("lv-a4-grid", cssClass({ width: gridW, height: flushFullBleedFooter && footerShowFor(pageIdx) ? '100%' : gridHFor(pageIdx) }))}>
                  {pageProd.map(p => (<div key={p.id} className={cx("lv-card-wrap", cssClass({ width: cardW, height: flushFullBleedFooter && footerShowFor(pageIdx) ? '100%' : cardHFor(pageIdx) }))}>
                      <ProductCard p={p} isTwoLang={isTwoLang} leafletId={id!} onUpdate={() => { }} onDelete={() => { }} cardLayout={cardLayout} cardWidth={cardW} cardHeight={flushFullBleedFooter && footerShowFor(pageIdx) ? undefined : cardHFor(pageIdx)} overlays={overlays[p.id] ?? []} showShapes={false} showActions={false} imageLoading="eager"/>
                      <CardShapes layout={cardLayout}/>
                    </div>))}
                </div>
              </div>)}
            {footerShowFor(pageIdx) && (<div className={cx(`lv-a4-footer${fs.widthMode === 'full' ? ' full-bleed' : ''}`, cssClass({ ...footerStyle }))}>
                <HeaderLogoItem settings={fs}/>
                {fs.showText && <HeaderTextItem settings={fs} text={fs.text || leaflet?.title || ''} fontFamily={cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined}/>}
                {(fs.showPageNum ?? true) && <span className={cx("lv-a4-footer-pagenum", cssClass({ fontFamily: cardLayout?.font_family ? `"${cardLayout.font_family}", sans-serif` : undefined }))}>Page {pageIdx + 1} / {pages.length}</span>}
              </div>)}
          </div>
        </div>))}

      {/* Back page */}
      {backPage.show && (<div className={cx("lv-a4-scale-wrap lv-export-page-wrap", cssClass({ transform: 'none', transformOrigin: 'top center', width: isLandscape ? '297mm' : '210mm' }))}>
          <div className={cx("lv-pdf-page lv-a4-page lv-a4-cover-page", cssClass(isLandscape ? { width: '297mm', height: '210mm', maxHeight: '210mm' } : {}))}>
                    {backPage.builder
                        ? renderCoverBuilderSurface({ applied: true, builder: backCoverBuilder })
                        : backPage.image
                        ? <img src={backPage.image} alt="Last page" className="lv-a4-cover-img"/>
                        : renderCoverBuilderSurface({ applied: true, builder: backCoverBuilder })}
          </div>
        </div>)}
    </div>, document.body)}

      {upgradePdfModal && (<div className="lv-modal-backdrop" onClick={e => {
                if (e.target === e.currentTarget && !upgradeLoading)
                    setUpgradePdfModal(false);
            }}>
          <div className="lv-upgrade-modal" role="dialog" aria-modal="true" aria-label="Upgrade to Pro">
            <button type="button" className="lv-modal-close lv-upgrade-close" onClick={() => setUpgradePdfModal(false)} disabled={upgradeLoading} aria-label="Close">
              x
            </button>
            <div className="lv-upgrade-kicker">
              {upgradeFeature === 'book' ? 'Book export limit reached' : 'PDF export limit reached'}
            </div>
            <h2>{upgradeFeature === 'book' ? 'Activate Convert to Book with Pro' : 'Activate PDF export with Pro'}</h2>
            <p>
              {upgradeFeature === 'book'
                ? 'Your free plan includes one book export. Subscribe to Pro to continue converting leaflets to printable books and catalogs.'
                : `Your free plan includes ${freePdfLimit} PDF ${freePdfLimit === 1 ? 'export' : 'exports'}. Subscribe to Pro to continue exporting PDFs and unlock the full export workflow.`}
            </p>
            <div className="lv-upgrade-benefits">
              <span>{upgradeFeature === 'book' ? 'Unlimited book exports' : 'Unlimited PDF exports'}</span>
              <span>{upgradeFeature === 'book' ? 'PDF export included' : 'Printable book export'}</span>
              <span>{upgradeFeature === 'book' ? 'Print-ready catalog formats' : 'Priority export workflow'}</span>
              <span>Professional leaflet tools</span>
            </div>
            {upgradeError && <div className="lv-modal-error">{upgradeError}</div>}
            <div className="lv-upgrade-actions">
              <button type="button" className="btn ghost" onClick={() => setUpgradePdfModal(false)} disabled={upgradeLoading}>
                Not now
              </button>
              <button type="button" className="btn primary" onClick={subscribeToPro} disabled={upgradeLoading}>
                {upgradeLoading ? 'Opening checkout...' : 'Subscribe to Pro'}
              </button>
            </div>
          </div>
        </div>)}

      {/* -- Add Product Modal - same structure as Edit modal -- */}
      {showAddModal && (<div className="lv-modal-backdrop" onClick={e => {
                if (e.target === e.currentTarget) {
                    setShowAddModal(false);
                    setAddProdError(null);
                    setAddPendingImage(null);
                    setAddConfirmedImageMeta(null);
                    setAddImageSearchStatus(null);
                }
            }}>
          <div className="lv-modal" role="dialog" aria-modal="true" aria-label="Add product">
            <div className="lv-modal-head">
              <h3>Add New Product</h3>
              <button className="lv-modal-close" onClick={() => { setShowAddModal(false); setAddProdError(null); setAddPendingImage(null); setAddConfirmedImageMeta(null); setAddImageSearchStatus(null); }}>x</button>
            </div>

            <form className="lv-modal-body" onSubmit={e => { e.preventDefault(); handleAddProduct(); }}>
              <div className="lv-fields">

                {/* Name lan1 */}
                <label className="lv-field lv-field-full">
                  <span className="lv-label">
                    Name {isTwoLang ? '(Language 1)' : ''} <span className={cssClass({ color: '#ef4444' })}>*</span>
                  </span>
                  <input className="input" value={newProd.product_name_lan1} onChange={e => setNewProd(p => ({ ...p, product_name_lan1: e.target.value }))} placeholder={isTwoLang ? 'Product name - language 1' : 'e.g. Organic Milk 1L'} autoFocus/>
                </label>

                {/* Name lan2 (two-lang only) */}
                {isTwoLang && (<label className="lv-field lv-field-full">
                    <span className="lv-label">Name (Language 2)</span>
                    <input className="input" value={newProd.product_name_lan2} onChange={e => setNewProd(p => ({ ...p, product_name_lan2: e.target.value }))} placeholder="e.g. Saudi Arabia"/>
                  </label>)}

                {/* Current price */}
                <label className="lv-field">
                  <span className="lv-label">Current Price</span>
                  <input className="input" value={newProd.current_price} onChange={e => setNewProd(p => ({ ...p, current_price: e.target.value }))} placeholder="e.g. Saudi Arabia" inputMode="decimal"/>
                </label>

                {/* Old / original price */}
                <label className="lv-field">
                  <span className="lv-label">Old Price <span className="lv-label-opt">(optional)</span></span>
                  <input className="input" value={newProd.old_price} onChange={e => setNewProd(p => ({ ...p, old_price: e.target.value }))} placeholder="e.g. Saudi Arabia" inputMode="decimal"/>
                </label>

                {/* Live discount preview */}
                {(() => {
                const op = parseFloat(newProd.old_price);
                const cp = parseFloat(newProd.current_price);
                if (!isNaN(op) && !isNaN(cp) && op > 0 && cp > 0) {
                    if (op > cp) {
                        const pct = Math.round(100 - (cp / op) * 100);
                        const saved = (op - cp).toFixed(2);
                        return (<div className="lv-discount-preview">
                          <span className="lv-discount-preview-badge">-{pct}%</span>
                          <span className="lv-discount-preview-text">Save {saved} - {pct}% discount</span>
                        </div>);
                    }
                    if (cp > op) {
                        return (<div className="lv-discount-preview lv-discount-preview--warn">
                          <span className="lv-discount-preview-text">Warning Current price is higher than old price - no discount badge will show</span>
                        </div>);
                    }
                }
                return null;
            })()}

                {/* Origin lan1 */}
                <OriginInput label={`Origin${isTwoLang ? ' (Language 1)' : ''}`} name={newProd.origin_lan1} iso={newProd.origin_lan1_iso} onNameChange={v => setNewProd(p => ({ ...p, origin_lan1: v }))} onIsoChange={v => setNewProd(p => ({ ...p, origin_lan1_iso: v }))}/>

                {/* Origin lan2 (two-lang only) */}
                {isTwoLang && (<OriginInput label="Origin (Language 2)" name={newProd.origin_lan2} iso={newProd.origin_lan2_iso} onNameChange={v => setNewProd(p => ({ ...p, origin_lan2: v }))} onIsoChange={v => setNewProd(p => ({ ...p, origin_lan2_iso: v }))}/>)}

                {/* Image uploader + URL toggle */}
                <div className="lv-field lv-field-full">
                  <span className="lv-label">Product Image <span className="lv-label-opt">(optional)</span></span>
                  <ImageUploader currentUrl={newProd.product_img_url} onUploaded={url => { setNewProd(p => ({ ...p, product_img_url: url })); setAddShowUrl(false); setAddPendingImage(null); setAddConfirmedImageMeta(null); }}/>
                  {addShowUrl ? (<div className="lv-img-url-row">
                      <input className="input lv-img-url-input" value={newProd.product_img_url} onChange={e => { setNewProd(p => ({ ...p, product_img_url: e.target.value })); setAddPendingImage(null); setAddConfirmedImageMeta(null); }} placeholder="e.g. Saudi Arabia" type="url" autoFocus/>
                      <button type="button" className="lv-img-url-clear" onClick={() => { setNewProd(p => ({ ...p, product_img_url: '' })); setAddShowUrl(false); setAddPendingImage(null); setAddConfirmedImageMeta(null); }} title="Clear URL">x</button>
                    </div>) : (<button type="button" className="lv-img-url-toggle" onClick={() => setAddShowUrl(true)}>
                      or paste an image URL
                    </button>)}
                  {addImageSearchStatus && <p className="lv-image-search-status">{addImageSearchStatus}</p>}
                  {addPendingImage && (<div className="lv-image-suggestion">
                      <img src={addPendingImage.thumb || addPendingImage.url} alt={newProd.product_name_lan1.trim()} className="lv-image-suggestion-preview"/>
                      <div className="lv-image-suggestion-copy">
                        <strong>Suggested reusable image</strong>
                        <span>{addPendingImage.title}</span>
                        <small>{addPendingImage.source} - {addPendingImage.licenseUrl || addPendingImage.license || 'Creative Commons / reusable media'}</small>
                        <div className="lv-image-suggestion-actions">
                          <button type="button" className="btn primary" onClick={() => {
                    setNewProd(p => ({ ...p, product_img_url: addPendingImage.url }));
                    setAddConfirmedImageMeta(addPendingImage);
                    setAddPendingImage(null);
                    setAddShowUrl(false);
                }}>
                            Use this image
                          </button>
                          <button type="button" className="btn ghost" onClick={() => setAddPendingImage(null)}>
                            Choose manually
                          </button>
                        </div>
                      </div>
                    </div>)}
                </div>

                {/* Product URL */}
                <label className="lv-field lv-field-full">
                  <span className="lv-label">Product URL</span>
                  <input className="input" value={newProd.product_url} onChange={e => setNewProd(p => ({ ...p, product_url: e.target.value }))} placeholder="e.g. Saudi Arabia" type="url"/>
                </label>

              </div>

              {addProdError && <p className="lv-modal-error">{addProdError}</p>}

              <div className="lv-modal-actions">
                <button type="button" className="btn ghost" onClick={() => { setShowAddModal(false); setAddProdError(null); setAddPendingImage(null); setAddConfirmedImageMeta(null); setAddImageSearchStatus(null); }} disabled={addingProd}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={addingProd || !newProd.product_name_lan1.trim()}>
                  {addingProd ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* -- Duplicate Leaflet Modal -- */}
      {dupModal && (<div className="lv-dup-overlay" onClick={() => setDupModal(false)}>
          <div className="lv-dup-modal" onClick={e => e.stopPropagation()}>
            <h3 className="lv-dup-title">Duplicate Leaflet</h3>
            <p className="lv-dup-desc">Enter a name for the duplicated leaflet:</p>
            <input className="lv-dup-input" value={dupName} onChange={e => setDupName(e.target.value)} autoFocus onKeyDown={e => {
                if (e.key === 'Enter')
                    handleDuplicate();
            }}/>
            <p className="lv-dup-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cssClass({ flexShrink: 0, marginTop: 1 })}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              The duplicated leaflet will count as one leaflet toward your subscription plan's limit.
            </p>
            <div className="lv-dup-actions">
              <button className="lv-dup-cancel" onClick={() => setDupModal(false)}>Cancel</button>
              <button className="lv-dup-confirm" disabled={dupLoading || !dupName.trim()} onClick={handleDuplicate}>
                {dupLoading ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>)}

      {/* -- Set as Default Modal -- */}
      {defaultModal && (<div className="lv-dup-overlay" onClick={() => setDefaultModal(false)}>
          <div className="lv-dup-modal" onClick={e => e.stopPropagation()}>
            <h3 className="lv-dup-title">
              {isDefault ? 'Remove Default Leaflet' : 'Set as Default Leaflet'}
            </h3>
            {isDefault ? (<p className="lv-dup-desc">
                This leaflet is currently your <strong className={cssClass({ color: '#f1c40f' })}>default template</strong>. Removing it means new leaflets will start blank. Are you sure?
              </p>) : (<p className="lv-dup-desc">
                Setting <strong className={cssClass({ color: '#e2e8f0' })}>{leaflet.title}</strong> as your default means every new leaflet you create will automatically inherit its card layout, design settings, and style as a starting point.
              </p>)}
            <div className="lv-dup-actions">
              <button className="lv-dup-cancel" onClick={() => setDefaultModal(false)}>Cancel</button>
              <button className={cx("lv-dup-confirm", cssClass(isDefault ? { background: '#ef4444' } : {}))} disabled={defaultLoading} onClick={handleSetDefault}>
                {defaultLoading ? 'Saving...' : isDefault ? 'Remove Default' : 'Star Set as Default'}
              </button>
            </div>
          </div>
        </div>)}

    </>);
}

