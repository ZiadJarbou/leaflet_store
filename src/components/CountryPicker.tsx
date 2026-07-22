import { useState, useRef, useEffect } from 'react';
import { COUNTRY_LIST } from '../utils/countryToFlag';
import './CountryPicker.css';

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CountryPicker({ value, onChange, placeholder = 'e.g. Saudi Arabia', className }: Props) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const wrapRef               = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COUNTRY_LIST.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.iso.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRY_LIST;

  /* close on outside click */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`cp-wrap${open ? ' cp-open' : ''}`} ref={wrapRef}>
      <div className="cp-input-row">
        <input
          className={`input cp-input${className ? ` ${className}` : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setQuery(e.target.value); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
        />
        <button
          type="button"
          className="cp-flag-btn"
          tabIndex={-1}
          title="Pick country"
          onClick={() => { setOpen(o => !o); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }}
        >
          🌍
        </button>
      </div>

      {open && (
        <div className="cp-dropdown">
          <div className="cp-search-wrap">
            <input
              ref={inputRef}
              className="cp-search"
              placeholder="Search country…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="cp-list">
            {filtered.length === 0 && (
              <li className="cp-empty">No results</li>
            )}
            {filtered.map(c => (
              <li key={c.iso} className={`cp-item${value.toLowerCase() === c.name.toLowerCase() ? ' cp-item-active' : ''}`}
                onMouseDown={e => { e.preventDefault(); select(c.name); }}
              >
                <span className="cp-flag">{c.flag}</span>
                <span className="cp-name">{c.name}</span>
                <span className="cp-iso">{c.iso}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
