import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import React from 'react';

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

const cache: Record<string, SEOData> = {};

export function useSEO(pageKey: string) {
  const [seo, setSeo] = useState<SEOData | null>(cache[pageKey] ?? null);

  useEffect(() => {
    if (cache[pageKey]) { setSeo(cache[pageKey]); return; }
    fetch(`/api/seo/${pageKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { cache[pageKey] = data; setSeo(data); } })
      .catch(() => {});
  }, [pageKey]);

  return seo;
}

interface SEOHeadProps {
  pageKey: string;
  titleOverride?: string;
  descriptionOverride?: string;
}

export function SEOHead({ pageKey, titleOverride, descriptionOverride }: SEOHeadProps) {
  const seo = useSEO(pageKey);
  if (!seo) return null;

  const title       = titleOverride       || seo.title       || 'LeafletAI';
  const description = descriptionOverride || seo.description || '';
  const ogTitle     = seo.og_title        || title;
  const ogDesc      = seo.og_description  || description;
  const canonical   = seo.canonical_url   || '';
  const robots      = seo.robots          || 'index, follow';

  return (
    <Helmet>
      <title>{title}</title>
      {description  && <meta name="description"        content={description} />}
      {seo.keywords && <meta name="keywords"           content={seo.keywords} />}
      <meta name="robots" content={robots} />
      {canonical    && <link rel="canonical"           href={canonical} />}
      {/* Open Graph */}
      <meta property="og:title"       content={ogTitle} />
      {ogDesc       && <meta property="og:description" content={ogDesc} />}
      {seo.og_image && <meta property="og:image"       content={seo.og_image} />}
      <meta property="og:type"        content="website" />
      {/* Twitter Card */}
      <meta name="twitter:card"       content="summary_large_image" />
      <meta name="twitter:title"      content={ogTitle} />
      {ogDesc       && <meta name="twitter:description" content={ogDesc} />}
      {seo.og_image && <meta name="twitter:image"       content={seo.og_image} />}
    </Helmet>
  );
}
