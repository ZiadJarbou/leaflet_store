import { useEffect, useState } from 'react';

export interface SEOData {
  page_key: string;
  page_name: string;
  page_path: string;
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image: string;
  canonical_url: string;
  robots: string;
}

export interface UseSEOResult {
  title: string;
  description: string;
  og_title: string;
  og_description: string;
  og_image: string;
  canonical_url: string;
  keywords: string;
  robots: string;
  isLoading: boolean;
}

const cache: Record<string, SEOData> = {};

export function useSEO(pageKey: string): UseSEOResult {
  const [seo, setSeo] = useState<SEOData | null>(cache[pageKey] ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!cache[pageKey]);

  useEffect(() => {
    if (cache[pageKey]) {
      setSeo(cache[pageKey]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/seo/${pageKey}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: SEOData | null) => {
        if (data) {
          cache[pageKey] = data;
          setSeo(data);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [pageKey]);

  return {
    title: seo?.title ?? '',
    description: seo?.description ?? '',
    og_title: seo?.og_title ?? '',
    og_description: seo?.og_description ?? '',
    og_image: seo?.og_image ?? '',
    canonical_url: seo?.canonical_url ?? '',
    keywords: seo?.keywords ?? '',
    robots: seo?.robots ?? 'index, follow',
    isLoading,
  };
}
