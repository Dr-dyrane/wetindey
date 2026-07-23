import "../styles/CurrencyFlag.css";
import { React } from "../imports/imports";
import type { CurrencyFlagProps } from "../CurrencyFlag";
import type { useCurrencyFlag } from "../hooks/useCurrencyFlag";

export interface CurrencyFlagViewProps extends CurrencyFlagProps {
  sheet: ReturnType<typeof useCurrencyFlag>;
}

export function CurrencyFlagView({ className = "", sheet }: CurrencyFlagViewProps) {
  const { symbol } = sheet;

  return (
    <span
      aria-hidden="true"
      className={`currency-flag-frame bg-fillTertiary ${className}`}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 24 16"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <use href={`/icons/currency-flags.svg#flag-${symbol}`} />
      </svg>
    </span>
  );
}
