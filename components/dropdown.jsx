'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import '../app/dropdown.css';

// A listbox styled to match the catalog. Options are [value, label, Icon?] or
// plain strings. Arrow keys, Home/End, typing a letter, Enter and Escape work
// the way they do on a native select.
export function Dropdown({ label, value, options, onChange, icon: Icon, className = '' }) {
  const items = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const current = items.find(([v]) => v === value) || items[0];
  const ButtonIcon = Icon || current[2];
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const root = useRef(null),
    button = useRef(null),
    list = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e) => !root.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function show() {
    setActive(Math.max(0, items.indexOf(current)));
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  }
  function pick(i) {
    setOpen(false);
    button.current?.focus();
    if (items[i][0] !== value) onChange(items[i][0]);
  }
  // Keys are handled here on the wrapper, so ones pressed while focus is still
  // on the button reach the open menu too.
  function onKey(e) {
    if (!open) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      return show();
    }
    const last = items.length - 1;
    const moves = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (e.key in moves) setActive(moves[e.key]);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const letter = e.key.toLowerCase();
      const next = items.findIndex(
        ([, l], i) => i > active && String(l).toLowerCase().startsWith(letter),
      );
      const first = items.findIndex(([, l]) => String(l).toLowerCase().startsWith(letter));
      if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first);
      else return;
    } else return;
    e.preventDefault();
  }

  return (
    <div className={`dropdown ${open ? 'is-open' : ''} ${className}`} ref={root} onKeyDown={onKey}>
      <button
        type="button"
        ref={button}
        className="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current[1]}`}
        onClick={() => (open ? setOpen(false) : show())}
      >
        {ButtonIcon && <ButtonIcon size={16} aria-hidden="true" />}
        <span>{current[1]}</span>
        <ChevronDown className="dropdown-chevron" size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          className="dropdown-menu"
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-${active}`}
        >
          {items.map(([v, l, OptionIcon], i) => (
            <li
              key={v}
              id={`${id}-${i}`}
              role="option"
              aria-selected={v === value}
              className={i === active ? 'is-active' : ''}
              onPointerMove={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {OptionIcon && <OptionIcon size={16} aria-hidden="true" />}
              <span>{l}</span>
              {v === value && <Check className="dropdown-check" size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
