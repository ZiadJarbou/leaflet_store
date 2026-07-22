import { Helmet } from 'react-helmet-async';
import { useSEO } from '../hooks/useSEO';

interface SEOHelmetProps {
  pageKey: string;
  titleOverride?: string;
  descriptionOverride?: string;
}

export function SEOHelmet({ pageKey, titleOverride, descriptionOverride }: SEOHelmetProps) {
  const seo = useSEO(pageKey);

  if (seo.isLoading && !seo.title) return null;

  const title       = titleOverride       || seo.title       || 'LeafletAI';
  const description = descriptionOverride || seo.description || '';
  const ogTitle     = seo.og_title        || title;
  const ogDesc      = seo.og_description  || description;
  const canonical   = seo.canonical_url   || '';
  const robots      = seo.robots          || 'index, follow';

  return (
    <Helmet>
      <title>{title}</title>
      {description  && <meta name="description"         content={description} />}
      {seo.keywords && <meta name="keywords"            content={seo.keywords} />}
      <meta name="robots" content={robots} />
      {canonical    && <link rel="canonical"            href={canonical} />}
      {/* Open Graph */}
      <meta property="og:title"        content={ogTitle} />
      {ogDesc       && <meta property="og:description"  content={ogDesc} />}
      {seo.og_image && <meta property="og:image"        content={seo.og_image} />}
      <meta property="og:type"         content="website" />
      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={ogTitle} />
      {ogDesc       && <meta name="twitter:description" content={ogDesc} />}
      {seo.og_image && <meta name="twitter:image"       content={seo.og_image} />}
    </Helmet>
  );
}

export default SEOHelmet;
