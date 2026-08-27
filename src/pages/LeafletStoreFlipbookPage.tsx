import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import HTMLFlipBook from 'react-pageflip';
import SEOHelmet from '../components/SEOHelmet';
import './LeafletStoreFlipbookPage.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface StoreFlipbookPageImage {
  page: number;
  src: string;
  width: number;
  height: number;
}

const StoreFlipbookPage = React.forwardRef<HTMLDivElement, StoreFlipbookPageImage>(({ page, src }, ref) => (
  <div className="sf-page" ref={ref}>
    <img src={src} alt={`Flipbook page ${page}`} />
    <span>{page}</span>
  </div>
));
StoreFlipbookPage.displayName = 'StoreFlipbookPage';

async function renderPdfToImages(pdfUrl: string) {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || payload?.message || 'Unable to load this flipbook.');
  }

  const buffer = await response.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const images: StoreFlipbookPageImage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = Math.min(1200, Math.max(720, baseViewport.width * 1.7));
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare the flipbook page.');

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    images.push({
      page: pageNumber,
      src: canvas.toDataURL('image/jpeg', 0.92),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return images;
}

export default function LeafletStoreFlipbookPage() {
  const { token = '' } = useParams();
  const [pages, setPages] = useState<StoreFlipbookPageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pdfUrl = useMemo(() => token ? `/api/shared-pdfs/${encodeURIComponent(token)}` : '', [token]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setPages([]);

    if (!pdfUrl) {
      setError('Flipbook link is missing.');
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    renderPdfToImages(pdfUrl)
      .then(images => {
        if (alive) setPages(images);
      })
      .catch(err => {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to open this flipbook.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [pdfUrl]);

  const firstPage = pages[0];
  const portrait = !firstPage || firstPage.height >= firstPage.width;
  const bookWidth = portrait ? 460 : 640;
  const bookHeight = portrait ? 650 : 452;

  return (
    <>
      <SEOHelmet pageKey="leaflet_store_flipbook" titleOverride="Flipbook - LeafletAI" descriptionOverride="Open an interactive leaflet flipbook." />
      <main className="sf-viewer">
        <header className="sf-topbar">
          <Link to="/leaflet-store" className="sf-back">
            <span className="material-symbol" aria-hidden="true">arrow_back</span>
            Leaflet Store
          </Link>
          {pdfUrl && <a className="sf-pdf" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>}
        </header>

        {loading ? (
          <div className="sf-state">
            <span className="sf-spinner" aria-hidden="true" />
            <span>Opening flipbook...</span>
          </div>
        ) : error ? (
          <div className="sf-state sf-state--error">
            <span>{error}</span>
            <Link className="sf-back" to="/leaflet-store">Back to Leaflet Store</Link>
          </div>
        ) : (
          <section className="sf-stage" aria-label="Interactive flipbook">
            <HTMLFlipBook
              className="sf-book"
              style={{}}
              startPage={0}
              size="stretch"
              width={bookWidth}
              height={bookHeight}
              minWidth={260}
              maxWidth={bookWidth}
              minHeight={340}
              maxHeight={bookHeight}
              drawShadow={true}
              flippingTime={650}
              usePortrait={true}
              startZIndex={20}
              autoSize={true}
              maxShadowOpacity={0.28}
              showCover={true}
              mobileScrollSupport={true}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={25}
              showPageCorners={true}
              disableFlipByClick={false}
            >
              {pages.map(page => <StoreFlipbookPage key={page.page} {...page} />)}
            </HTMLFlipBook>
          </section>
        )}
      </main>
    </>
  );
}
