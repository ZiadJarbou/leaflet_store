import { useState, useEffect } from 'react';

type PageContent = Record<string, Record<string, string>>;

const cache: Record<string, PageContent> = {};

export function useCmsContent(page: string): PageContent {
  const [content, setContent] = useState<PageContent>(cache[page] ?? {});

  useEffect(() => {
    if (cache[page]) { setContent(cache[page]); return; }
    fetch(`/api/pages/${page}`)
      .then(r => r.ok ? r.json() : {})
      .then((data: PageContent) => { cache[page] = data; setContent(data); })
      .catch(() => {});
  }, [page]);

  return content;
}

/** Helper: get a string field with fallback */
export function cms(content: PageContent, section: string, field: string, fallback: string): string {
  return content?.[section]?.[field] || fallback;
}

/** Helper: check section visibility (defaults to true if not set) */
export function cmsVisible(content: PageContent, section: string): boolean {
  const v = content?.[section]?.['visible'];
  return v === undefined || v === '1' || v === 'true';
}

/** Helper: parse JSON array field with fallback */
export function cmsJson<T>(content: PageContent, section: string, field: string, fallback: T[]): T[] {
  const raw = content?.[section]?.[field];
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
