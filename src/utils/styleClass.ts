import type { CSSProperties } from 'react';

type StyleValue = string | number | undefined | null | boolean;

const cache = new Map<string, string>();
let styleEl: HTMLStyleElement | null = null;

const unitless = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
]);

function hyphenate(prop: string): string {
  if (prop.startsWith('--')) return prop;
  return prop.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function normalizeValue(prop: string, value: StyleValue): string | null {
  if (value === undefined || value === null || value === false || value === '') return null;
  if (typeof value === 'number' && value !== 0 && !unitless.has(prop) && !prop.startsWith('--')) {
    return `${value}px`;
  }
  return String(value);
}

function hash(input: string): string {
  let value = 5381;
  for (let i = 0; i < input.length; i += 1) {
    value = ((value << 5) + value) ^ input.charCodeAt(i);
  }
  return (value >>> 0).toString(36);
}

function ensureSheet(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null;
  if (styleEl?.isConnected) return styleEl;
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-runtime-style-classes', 'true');
  document.head.appendChild(styleEl);
  return styleEl;
}

export function cssClass(style?: CSSProperties | null | false): string {
  if (!style) return '';
  const cssText = Object.entries(style)
    .map(([prop, value]) => {
      const normalized = normalizeValue(prop, value as StyleValue);
      return normalized === null ? '' : `${hyphenate(prop)}:${normalized}`;
    })
    .filter(Boolean)
    .join(';');

  if (!cssText) return '';
  const cached = cache.get(cssText);
  if (cached) return cached;

  const className = `rt-${hash(cssText)}`;
  cache.set(cssText, className);
  const sheet = ensureSheet();
  if (sheet) sheet.appendChild(document.createTextNode(`.${className}{${cssText}}`));
  return className;
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
