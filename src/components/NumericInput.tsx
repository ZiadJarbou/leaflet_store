import { cssClass, cx } from '../utils/styleClass';
import React from 'react';
import './NumericInput.css';
interface NumericInputProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    style?: React.CSSProperties;
    size?: 'default' | 'sm' | 'xs';
    unit?: string;
}
export default function NumericInput({ value, onChange, min = -Infinity, max = Infinity, step = 1, className = '', style, size = 'default', unit, }: NumericInputProps) {
    const clamp = (v: number) => Math.min(max, Math.max(min, v));
    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = parseFloat(e.target.value);
        if (!isNaN(raw))
            onChange(clamp(raw));
    };
    const increment = (e: React.MouseEvent) => {
        e.preventDefault();
        onChange(clamp(parseFloat((value + step).toFixed(10))));
    };
    const decrement = (e: React.MouseEvent) => {
        e.preventDefault();
        onChange(clamp(parseFloat((value - step).toFixed(10))));
    };
    const sizeClass = size === 'sm' ? ' num-ctrl--sm' : size === 'xs' ? ' num-ctrl--xs' : '';
    const unitClass = unit ? ' num-ctrl--unit' : '';
    return (<div className={cx(`num-ctrl${sizeClass}${unitClass}${className ? ` ${className}` : ''}`, cssClass(style))}>
      <input type="number" className="num-ctrl__input" value={value} min={min} max={max} step={step} onChange={handleInput}/>
      {unit && <span className="num-ctrl__unit">{unit}</span>}
      <span className="num-ctrl__divider"/>
      <div className="num-ctrl__arrows">
        <button type="button" className="num-ctrl__btn" onMouseDown={increment} tabIndex={-1}>▲</button>
        <button type="button" className="num-ctrl__btn" onMouseDown={decrement} tabIndex={-1}>▼</button>
      </div>
    </div>);
}
