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
 * Focus is signalled by the fill lifting from tertiary to a solid surface, which
 * is how iOS does it — AND by the focus ring, which this used to suppress.
 *
 * That sentence used to open "No stroke in any state", and the lift was the only
 * cue. It does not carry that alone: `fillTertiary` is `rgba(118,118,128,0.12)`,
 * which over `#FFFFFF` composites to `(239,239,240)`, so the lift to solid white
 * is **1.15:1**. SC 1.4.11 asks 3:1 of a focus indicator. That is not a state
 * change a sighted user will notice; it is barely one a monitor renders. iOS gets
 * away with the identical lift because it pairs it with a blinking caret and a
 * keyboard sliding up the screen. On the web there is no rising keyboard, and a
 * caret is not a focus indicator.
 *
 * So the intent was right and the mechanism was not, and "no stroke in any state"
 * was the sentence that licensed it. It also overreached the design system:
 * `globals.css` says "No element gets a stroke" and then grants `:focus-visible`
 * a 2px ring — the ring IS the one stroke the system permits, and this component
 * turned off the exception rather than honouring the rule.
 *
 * Getting 3:1 from a fill lift alone would need a fill far darker than anything
 * iOS ships, so the ring is not a compromise here; it is the only honest option.
 * The lift stays as the second cue. `docs/ACCESSIBILITY.md` P1-1.
 */
export function SearchField({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  placeholder = "Search",
}: SearchFieldProps) {
  // The ring is on the WRAPPER, not the input, and that is not a style choice:
  // this div is `overflow-hidden` (it clips the fill to the squircle), and an
  // outline paints OUTSIDE the border box at `outline-offset: 2px`. A ring on the
  // input would be drawn exactly where this box clips it — present in the CSS,
  // invisible on screen. `focus-within` puts it on the clipping box, which has room.
  return (
    <div className="relative flex h-9 w-full items-center overflow-hidden bg-fillTertiary squircle-full
                    transition-colors duration-micro focus-within:bg-surface
                    focus-within:outline focus-within:outline-2 focus-within:outline-offset-2
                    focus-within:outline-focusRing">
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
                   placeholder:text-text-tertiary"
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
