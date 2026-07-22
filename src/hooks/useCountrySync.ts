import { useState, useRef, useCallback } from 'react';
import { normalizeCountry, type CountryEntry } from '../utils/countryToFlag';

type SyncStatus = 'idle' | 'matching' | 'translating' | 'matched' | 'nomatch' | 'error';

interface UseCounrySyncResult {
  matched:   CountryEntry | null;
  status:    SyncStatus;
  sync:      (text?: string | null, crossText?: string | null) => void;
}

/* Simple LRU-style translation cache: text → translated English */
const TRANS_CACHE = new Map<string, string>();

function isLikelyEnglish(text: string): boolean {
  /* Heuristic: if every character is in the Latin + common-punctuation range → likely English */
  return /^[\u0000-\u024F\s'-]+$/.test(text);
}

export function useCountrySync(): UseCounrySyncResult {
  const [matched, setMatched]   = useState<CountryEntry | null>(null);
  const [status,  setStatus]    = useState<SyncStatus>('idle');
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText              = useRef('');

  const sync = useCallback((rawText?: string | null, crossText?: string | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const text = String(rawText ?? '').trim().replace(/\s+/g, ' ');
    const cross = String(crossText ?? '').trim().replace(/\s+/g, ' ');
    latestText.current = text;

    if (!text) {
      /* If primary is empty but cross-check has a value, try matching that */
      if (cross) {
        const crossMatch = normalizeCountry(cross);
        if (crossMatch) { setMatched(crossMatch); setStatus('matched'); return; }
      }
      setMatched(null);
      setStatus('idle');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (text !== latestText.current) return;          // stale
      setStatus('matching');

      /* 1 — direct match on primary text (name, alias, ISO) */
      const direct = normalizeCountry(text);
      if (direct) {
        setMatched(direct);
        setStatus('matched');
        return;
      }

      /* 2 — cross-check: try the other language field directly */
      if (cross) {
        const crossMatch = normalizeCountry(cross);
        if (crossMatch) {
          setMatched(crossMatch);
          setStatus('matched');
          return;
        }
      }

      /* 3 — skip translation if already English (and cross-check also failed) */
      if (isLikelyEnglish(text)) {
        setMatched(null);
        setStatus('nomatch');
        return;
      }

      /* 4 — translate via backend */
      const cached = TRANS_CACHE.get(text.toLowerCase());
      const translated: string = cached !== undefined ? cached : await (async () => {
        setStatus('translating');
        try {
          const r = await fetch('/api/translate-country', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const d = await r.json();
          const t: string = d.translated ?? '';
          TRANS_CACHE.set(text.toLowerCase(), t);
          return t;
        } catch {
          return '';
        }
      })();

      if (text !== latestText.current) return;          // stale after await

      if (!translated) { setMatched(null); setStatus('error'); return; }

      const afterTranslation = normalizeCountry(translated);
      if (afterTranslation) {
        setMatched(afterTranslation);
        setStatus('matched');
      } else {
        /* 5 — last resort: translate the cross-check value too */
        if (cross && !isLikelyEnglish(cross)) {
          const crossCached = TRANS_CACHE.get(cross.toLowerCase());
          const crossTranslated: string = crossCached !== undefined ? crossCached : await (async () => {
            try {
              const r = await fetch('/api/translate-country', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cross }),
              });
              const d = await r.json();
              const t: string = d.translated ?? '';
              TRANS_CACHE.set(cross.toLowerCase(), t);
              return t;
            } catch { return ''; }
          })();
          if (text !== latestText.current) return;
          const crossAfterTranslation = crossTranslated ? normalizeCountry(crossTranslated) : null;
          if (crossAfterTranslation) {
            setMatched(crossAfterTranslation);
            setStatus('matched');
            return;
          }
        }
        console.warn('[useCountrySync] no match after translation:', text, '→', translated);
        setMatched(null);
        setStatus('nomatch');
      }
    }, 400);      // 400 ms debounce
  }, []);

  return { matched, status, sync };
}
