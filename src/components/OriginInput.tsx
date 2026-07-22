import { useEffect, useRef, useState } from 'react';
import { COUNTRY_LIST, type CountryEntry } from '../utils/countryToFlag';
import { useCountrySync } from '../hooks/useCountrySync';
import './CountryPicker.css';

interface Props {
  value?:           string | null;
  onChange:         (val: string) => void;
  onIsoChange?:     (iso: string) => void;
  crossCheckValue?: string;   // the other language's origin field — used as fallback match
  placeholder?:     string;
}

export default function OriginInput({ value, onChange, onIsoChange, crossCheckValue, placeholder = 'e.g. Saudi Arabia' }: Props) {
  const safeValue = value ?? '';
  const { matched, status, sync } = useCountrySync();
  const [manualOpen,   setManualOpen]   = useState(false);
  const [manualPick,   setManualPick]   = useState<CountryEntry | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const wrapRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* effective country = auto-matched OR manually overridden */
  const effective = manualPick ?? matched;

  /* Sync on mount */
  useEffect(() => { sync(safeValue, crossCheckValue); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Re-sync when the cross-check value changes (e.g. user edits the other language field) */
  useEffect(() => {
    if (!manualPick) sync(safeValue, crossCheckValue);
  }, [crossCheckValue]); // eslint-disable-line react-hooks/exhaustive-deps

  /* clear manual pick whenever auto-match succeeds */
  useEffect(() => {
    if (status === 'matched') setManualPick(null);
  }, [status]);

  /* notify parent of ISO change */
  useEffect(() => {
    onIsoChange?.(effective?.iso_code ?? '');
  }, [effective?.iso_code]); // eslint-disable-line react-hooks/exhaustive-deps

  /* close picker on outside click */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setManualOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function handleInput(v: string) {
    onChange(v);
    setManualPick(null);   // reset manual override when user re-types
    sync(v, crossCheckValue);
  }

  function openManual() {
    setManualOpen(true);
    setSearchQuery('');
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function selectManual(c: CountryEntry) {
    setManualPick(c);
    setManualOpen(false);
    setSearchQuery('');
  }

  const filtered = searchQuery.trim()
    ? COUNTRY_LIST.filter(c =>
        c.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.iso_code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : COUNTRY_LIST;

  /* Status icon / button */
  const canManual = status === 'nomatch' || status === 'error' || !!manualPick;
  const statusNode = (() => {
    if (status === 'translating')
      return <span className="oi-status oi-spin" title="Translating…">⟳</span>;
    if (effective)
      return (
        <button type="button" className="oi-status oi-ok oi-flag-btn"
          title={`${effective.name_en} — click to change flag`}
          onClick={openManual}>
          {effective.flag_emoji}
        </button>
      );
    if (canManual)
      return (
        <button type="button" className="oi-status oi-warn oi-flag-btn"
          title="Country not recognized — click to pick flag manually"
          onClick={openManual}>
          🌍
        </button>
      );
    return null;
  })();

  return (
    <div className="oi-wrap" ref={wrapRef}>
      <div className="oi-row">
        <input
          className="input oi-input"
          value={safeValue}
          placeholder={placeholder}
          onChange={e => handleInput(e.target.value)}
          onBlur={e => sync(e.target.value, crossCheckValue)}
        />
        {statusNode}
      </div>

      {/* Hidden native select — reflects effective country for form/data purposes */}
      <select
        name="origin_country_hidden"
        className="oi-hidden-select"
        value={effective?.iso_code ?? ''}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value="">— unmatched —</option>
        {COUNTRY_LIST.map(c => (
          <option key={c.iso_code} value={c.iso_code}>
            {c.flag_emoji} {c.name_en} ({c.iso_code})
          </option>
        ))}
      </select>

      {/* Match hint */}
      {effective && (
        <p className="oi-match-hint">
          {effective.flag_emoji} <strong>{effective.name_en}</strong>
          <span className="oi-iso">{effective.iso_code}</span>
          {manualPick && <span className="oi-translated"> — manually selected</span>}
          {!manualPick && status === 'matched' && safeValue.toLowerCase() !== effective.name_en.toLowerCase() && (
            <span className="oi-translated"> — auto-matched from "{value}"</span>
          )}
          {(status === 'nomatch' || status === 'error') && !manualPick && (
            <button type="button" className="oi-change-flag-btn" onClick={openManual}>
              Change flag
            </button>
          )}
        </p>
      )}
      {!effective && (status === 'nomatch' || status === 'error') && (
        <p className="oi-match-hint oi-no-match">
          <span className="oi-warn-text">Country not recognized.</span>
          <button type="button" className="oi-change-flag-btn" onClick={openManual}>
            Pick flag manually
          </button>
        </p>
      )}

      {/* Manual flag picker dropdown */}
      {manualOpen && (
        <div className="cp-dropdown oi-manual-dropdown">
          <div className="cp-search-wrap">
            <input
              ref={searchRef}
              className="cp-search"
              placeholder="Search country…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="cp-list">
            {filtered.length === 0 && <li className="cp-empty">No results</li>}
            {filtered.map(c => (
              <li key={c.iso_code}
                className={`cp-item${effective?.iso_code === c.iso_code ? ' cp-item-active' : ''}`}
                onMouseDown={e => { e.preventDefault(); selectManual(c); }}
              >
                <span className="cp-flag">{c.flag_emoji}</span>
                <span className="cp-name">{c.name_en}</span>
                <span className="cp-iso">{c.iso_code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
