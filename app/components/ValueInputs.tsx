'use client';

import { useEffect, useRef, useState } from 'react';

function parseNumberLoose(v: string) {
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatIntWithCommas(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

export function formatMoneyInput(n: number) {
  return `$${formatIntWithCommas(n)}`;
}

export function parseMoneyLoose(v: string) {
  return parseNumberLoose(v);
}

export function formatPercentInput(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  // Keep up to 2 decimals if user uses them.
  const body = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return `${body}%`;
}

export function parsePctLoose(v: string) {
  return parseNumberLoose(v);
}

type CommonProps = {
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
  ariaLabel?: string;
};

export function MoneyInput({
  value,
  onValue,
  className,
  inputMode = 'decimal',
  disabled,
  ariaLabel,
}: {
  value: number;
  onValue: (n: number) => void;
} & CommonProps) {
  const [text, setText] = useState<string>(() => formatMoneyInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    // Avoid clobbering user typing mid-edit.
    if (!focusedRef.current) setText(formatMoneyInput(value));
  }, [value]);

  return (
    <input
      className={className}
      inputMode={inputMode}
      disabled={disabled}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
        // Keep the $ visible on focus (user request).
        if (!text.startsWith('$')) setText(formatMoneyInput(parseMoneyLoose(text)));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onValue(parseMoneyLoose(next));
      }}
      onBlur={() => {
        focusedRef.current = false;
        const n = parseMoneyLoose(text);
        setText(formatMoneyInput(n));
      }}
    />
  );
}

export function PercentInput({
  value,
  onValue,
  className,
  inputMode = 'decimal',
  disabled,
  ariaLabel,
}: {
  value: number;
  onValue: (n: number) => void;
} & CommonProps) {
  const [text, setText] = useState<string>(() => formatPercentInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(formatPercentInput(value));
  }, [value]);

  return (
    <input
      className={className}
      inputMode={inputMode}
      disabled={disabled}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
        // Keep % visible on focus.
        if (!text.endsWith('%')) setText(formatPercentInput(parsePctLoose(text)));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onValue(parsePctLoose(next));
      }}
      onBlur={() => {
        focusedRef.current = false;
        const n = parsePctLoose(text);
        setText(formatPercentInput(n));
      }}
    />
  );
}
