import { cssClass, cx } from '../utils/styleClass';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import './ColorSwatch.css';
const PRESETS = [
    '#ffffff', '#f8f9fa', '#dee2e6', '#adb5bd', '#6c757d', '#343a40', '#000000',
    '#ffc107', '#fd7e14', '#dc3545', '#e83e8c', '#6f42c1', '#0d6efd', '#20c997', '#198754',
    '#0b1220', '#0e2a5a', '#1a3a5c', '#2d6a4f', '#6a0572', '#3d0000', '#003566',
];
interface Props {
    value: string;
    onChange: (v: string) => void;
    className?: string;
}
export default function ColorSwatch({ value, onChange, className = '' }: Props) {
    const [open, setOpen] = useState(false);
    const [hex, setHex] = useState(value);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const interactingRef = useRef(false);
    const latestColorRef = useRef(value);
    const emitTimerRef = useRef<number | null>(null);
    useEffect(() => {
        latestColorRef.current = value;
        if (!interactingRef.current)
            setHex(value);
    }, [value]);
    useEffect(() => () => {
        if (emitTimerRef.current !== null)
            window.clearTimeout(emitTimerRef.current);
    }, []);
    /* position the portal popover — always above the trigger, fall back below if no space */
    useLayoutEffect(() => {
        if (!open || !triggerRef.current || !popoverRef.current)
            return;
        const r = triggerRef.current.getBoundingClientRect();
        const popH = popoverRef.current.offsetHeight || 300;
        const popW = popoverRef.current.offsetWidth || 228;
        const margin = 6;
        /* prefer above; fall back to below only if not enough room */
        const top = r.top >= popH + margin
            ? r.top - popH - margin
            : r.bottom + margin;
        /* keep within viewport horizontally */
        const left = Math.min(Math.max(0, r.left), window.innerWidth - popW - 4);
        setPos({ top, left });
    }, [open]);
    /* click-outside → close */
    useEffect(() => {
        if (!open)
            return;
        function isInside(e: PointerEvent | MouseEvent) {
            const target = e.target as Node;
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            return (!!(triggerRef.current && (triggerRef.current.contains(target) || path.includes(triggerRef.current))) ||
                !!(popoverRef.current && (popoverRef.current.contains(target) || path.includes(popoverRef.current))));
        }
        function onDown(e: PointerEvent) {
            if (isInside(e) || interactingRef.current)
                return;
            setOpen(false);
        }
        function onUp() {
            interactingRef.current = false;
            emitColor(latestColorRef.current, true);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape')
                setOpen(false);
        }
        document.addEventListener('pointerdown', onDown);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    function emitColor(color: string, immediate = false) {
        latestColorRef.current = color;
        if (immediate) {
            if (emitTimerRef.current !== null) {
                window.clearTimeout(emitTimerRef.current);
                emitTimerRef.current = null;
            }
            onChange(color);
            return;
        }
        if (interactingRef.current)
            return;
        if (emitTimerRef.current !== null)
            return;
        emitTimerRef.current = window.setTimeout(() => {
            emitTimerRef.current = null;
            onChange(latestColorRef.current);
        }, 80);
    }
    function handleHexInput(raw: string) {
        const display = raw.startsWith('#') ? raw : `#${raw}`;
        setHex(display);
        const v = raw.startsWith('#') ? raw : `#${raw}`;
        if (/^#[0-9a-fA-F]{6}$/.test(v))
            emitColor(v, true);
    }
    function handleColorChange(color: string) {
        setHex(color);
        emitColor(color);
    }
    function handlePresetColor(color: string) {
        setHex(color);
        emitColor(color, true);
    }
    return (<div className={cx(`cs-wrap${className ? ` ${className}` : ''}`, cssClass({ background: value }))}>
      <button ref={triggerRef} type="button" className={cx("cs-trigger", cssClass({ background: value }))} onClick={() => setOpen(o => !o)} title={value} aria-label={`Pick colour (current: ${value})`}/>

      {open && createPortal(<div ref={popoverRef} className={cx("cs-popover", cssClass({ position: 'fixed', top: pos.top, left: pos.left }))} onPointerDown={e => {
                interactingRef.current = true;
                e.stopPropagation();
            }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <HexColorPicker color={hex} onChange={handleColorChange}/>
          <div className="cs-hex-row">
            <span className="cs-hex-hash">#</span>
            <input type="text" className="cs-hex-input" maxLength={7} value={hex.replace(/^#/, '')} onChange={e => handleHexInput(e.target.value)} onBlur={e => handleHexInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleHexInput((e.target as HTMLInputElement).value)} spellCheck={false} placeholder="RRGGBB"/>
            <div className={cx("cs-hex-preview", cssClass({ background: value }))}/>
          </div>
          <div className="cs-presets">
            {PRESETS.map(c => (<button key={c} type="button" className={cx(`cs-preset${hex.toLowerCase() === c.toLowerCase() ? ' active' : ''}`, cssClass({ background: c }))} onClick={() => handlePresetColor(c)} title={c}/>))}
          </div>
        </div>, document.body)}
    </div>);
}
