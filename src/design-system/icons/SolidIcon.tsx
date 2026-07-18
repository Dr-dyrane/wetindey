import React from "react";

/**
 * WetinDey-authored, web-native glyph geometry.
 *
 * These paths are deliberately small and local: they are not copied from
 * Apple SF Symbols, do not require a remote font or sprite, and introduce no
 * package or runtime request. Use them only where adjacent text or an
 * accessible parent already supplies the meaning.
 */
export type SolidIconName =
  | "building"
  | "check"
  | "chevron-down"
  | "close"
  | "copy"
  | "map-pin"
  | "money"
  | "moon"
  | "navigation"
  | "phone"
  | "refresh"
  | "search"
  | "share"
  | "star"
  | "sun"
  | "warning"
  | "wifi-off";

export type SolidIconSize = 16 | 18 | 24;

const SIZE_STYLES: Record<SolidIconSize, string> = {
  16: "h-icon-compact w-icon-compact",
  18: "h-icon-standard w-icon-standard",
  24: "h-icon-prominent w-icon-prominent",
};

const PATHS: Record<SolidIconName, React.ReactNode> = {
  building: (
    <>
      <path d="M4 20h16v2H4zM6 9h12v10H6zM3 7.2 12 2l9 5.2V9H3z" />
    </>
  ),
  check: <path d="m9.3 17.2-4.5-4.5 2.1-2.1 2.4 2.4 7.8-7.8 2.1 2.1z" />,
  "chevron-down": <path d="m5.4 8.4 6.6 6.6 6.6-6.6 1.8 1.8-8.4 8.4-8.4-8.4z" />,
  close: (
    <path d="m6.2 4.8 5.8 5.8 5.8-5.8 1.4 1.4-5.8 5.8 5.8 5.8-1.4 1.4-5.8-5.8-5.8 5.8-1.4-1.4 5.8-5.8-5.8-5.8z" />
  ),
  copy: (
    <>
      <path d="M8 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <path d="M5 17H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h-2V4H4v11h1z" />
    </>
  ),
  "map-pin": (
    <path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 1 8 8c0 5.3-6.1 10.8-7.3 11.8a1.1 1.1 0 0 1-1.4 0C10.1 20.8 4 15.3 4 10a8 8 0 0 1 8-8zm0 4.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z"
    />
  ),
  money: (
    <path
      fillRule="evenodd"
      d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1 4h-2v1.1c-1.8.3-3 1.4-3 3 0 2 1.7 2.7 3.8 3.2 1.4.3 2.2.6 2.2 1.4 0 .7-.7 1.2-1.9 1.2-1.3 0-2.4-.5-3.3-1.3l-1.2 1.7c.9.8 2 1.3 3.4 1.6V19h2v-1.1c2-.3 3.2-1.6 3.2-3.3 0-2.1-1.8-2.8-4-3.3-1.3-.3-2-.6-2-1.3 0-.6.6-1.1 1.7-1.1 1 0 2 .4 2.8 1l1.1-1.7A6.4 6.4 0 0 0 13 7.1z"
    />
  ),
  moon: <path d="M20.8 15.4A8.8 8.8 0 0 1 8.6 3.2 9.5 9.5 0 1 0 20.8 15.4z" />,
  navigation: (
    <path d="M21.4 3.5 14 21.2a1 1 0 0 1-1.9-.2l-1.2-7.9L3 11.9a1 1 0 0 1-.2-1.9l17.7-7.4a.7.7 0 0 1 .9.9z" />
  ),
  phone: (
    <path d="M6.6 2.8 9.2 8 6.8 9.7a16 16 0 0 0 7.5 7.5l1.7-2.4 5.2 2.6-.7 3.4c-.2.8-.9 1.3-1.7 1.2C9.8 20.9 3.1 14.2 2 5.2c-.1-.8.4-1.5 1.2-1.7z" />
  ),
  refresh: (
    <path d="M19.1 7.2V3.5l-1.8 1.8A9 9 0 1 0 21 12h-2.6a6.4 6.4 0 1 1-2.9-5.4l-2.1 2.1h5.7z" />
  ),
  search: (
    <path
      fillRule="evenodd"
      d="M10.8 3a7.8 7.8 0 1 1-4.9 13.9L2.8 20l1.8 1.8 3.1-3.1A7.8 7.8 0 0 1 10.8 3zm0 2.5a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6z"
    />
  ),
  share: (
    <path d="M18 16a3 3 0 0 0-2.4 1.2l-6.8-3.8a3.5 3.5 0 0 0 0-2.8l6.8-3.8A3 3 0 1 0 15 4c0 .2 0 .4.1.6L8.2 8.4A3 3 0 1 0 8.2 15l6.9 3.8A3 3 0 1 0 18 16z" />
  ),
  star: <path d="m12 2.2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.1-6 3.1 1.2-6.7-4.9-4.7 6.7-1z" />,
  sun: (
    <path
      fillRule="evenodd"
      d="M13.2 1v3h-2.4V1zm0 19v3h-2.4v-3zM4.7 3l2.1 2.1-1.7 1.7L3 4.7zm13.5 13.5 2.1 2.1-1.7 1.7-2.1-2.1zM1 10.8h3v2.4H1zm19 0h3v2.4h-3zM3 19.3l2.1-2.1 1.7 1.7L4.7 21zm13.5-13.5 2.1-2.1 1.7 1.7-2.1 2.1zM12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"
    />
  ),
  warning: (
    <path
      fillRule="evenodd"
      d="M10.2 3.1a2 2 0 0 1 3.6 0l8 15A2 2 0 0 1 20 21H4a2 2 0 0 1-1.8-2.9zM10.8 8v6h2.4V8zm0 8v2.4h2.4V16z"
    />
  ),
  "wifi-off": (
    <path d="m3.5 2 18.5 18.5-1.5 1.5-3.2-3.2L12 23l-4-4a5.7 5.7 0 0 1 5.2-1.6l-2.4-2.4a8.8 8.8 0 0 0-5 2L3.7 15a12 12 0 0 1 4.8-2.3l-2.4-2.4c-1.5.5-3 1.3-4.2 2.3L0 10.6A17 17 0 0 1 3.8 8L2 6.2zm5-2A17 17 0 0 1 24 5.6l-2 2A14.2 14.2 0 0 0 10.8 2.9zm5 6.1a12 12 0 0 1 6.8 3.5l-2 2a9 9 0 0 0-2.5-1.8z" />
  ),
};

export function SolidIcon({
  name,
  size = 18,
}: {
  name: SolidIconName;
  size?: SolidIconSize;
}) {
  return (
    <svg
      aria-hidden="true"
      data-solid-icon={name}
      viewBox="0 0 24 24"
      className={`solid-icon ${SIZE_STYLES[size]}`}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
