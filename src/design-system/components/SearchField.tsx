"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface SearchFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
}

/**
 * iOS search field.
 *
 * Short and squircled, not a tall rounded box. Apple documents no height for
 * the search bar — the widely-quoted 36pt has no primary source I could find,
 * and the HIG's search page contains no numbers at all — so 36px here is a
 * chosen value matched by eye, not a transcribed one.
 *
 * The clear button keeps a 44px hit area (the documented default control size)
 * while drawing at 17px, so the target is honest even though the glyph is small.
 *
 * No stroke in any state. Focus is signalled by the fill lifting from
 * tertiary to a solid surface, which is how iOS does it.
 */
export function SearchField({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  placeholder = "Search",
}: SearchFieldProps) {
  return (
    <div className="relative flex h-9 w-full items-center overflow-hidden bg-fillTertiary squircle-full
                    transition-colors duration-micro focus-within:bg-surface">
      <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-text-tertiary" strokeWidth={2.5} />
      <input
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="h-full w-full bg-transparent pl-8 pr-9 text-body text-text-primary
                   placeholder:text-text-tertiary focus:outline-none"
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          /* 44px target, 17px glyph — hit area centred on the visual mark. */
          className="absolute right-0 grid h-tap w-tap place-items-center text-text-tertiary
                     active:opacity-50 transition-opacity duration-instant"
        >
          <span className="grid h-[17px] w-[17px] place-items-center rounded-full bg-text-tertiary">
            <X className="h-[11px] w-[11px] text-surface" strokeWidth={3.5} />
          </span>
        </button>
      )}
    </div>
  );
}
