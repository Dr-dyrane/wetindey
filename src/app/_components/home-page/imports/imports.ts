import React, {
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef,
  ReactNode
} from "react";
import { getImageProps } from "next/image";
import { AlertTriangle, MapPin, Navigation, X, Plus, ChevronDown } from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { SearchField } from "@/design-system/components/SearchField";
import { AdaptiveShell } from "@/design-system/components/AdaptiveShell";
import {
  type Detent,
  type MapRetryCapability
} from "@/design-system/components/BottomSheet";
import { useModalPresented } from "@/design-system/components/ModalSheet";
import { AsyncList } from "@/design-system/components/AsyncList";
import { NigeriaLogo } from "@/design-system/components/NigeriaLogo";
import { ItemCard, PhotoCredits, type ItemCardData } from "@/design-system/components/ItemCard";
import {
  PlaceOfferRow,
  PlaceOfferRowSkeleton
} from "@/design-system/components/PlaceOfferRow";
import dynamic from "next/dynamic";
import { Avatar } from "@/app/_components/profile-sheet/views/Avatar";
import { CategorySelectorSheet, type CategoryPillar } from "@/app/_components/category-selector-sheet/CategorySelectorSheet";
import { useLocationIdentity } from "@/app/_hooks/useLocationIdentity";
import type { ExchangeLocationFilter } from "@/app/_components/exchange-panel/ExchangePanel";

// Code-split surfaces: rarely opened, so their chunks load on first render
// (which the view gates behind a once-opened latch, see useEverPresented).
// ssr:false + null loading emits nothing on either side of hydration; the
// closed sheets rendered null before, so nothing visual changes. Avatar is
// imported from its own module above precisely so the always-visible header
// does not drag the profile sheet back into first load.
const SettingsSheet = dynamic(
  () => import("@/app/_components/settings-sheet/SettingsSheet").then((m) => m.SettingsSheet),
  { ssr: false, loading: () => null }
);
const ReportPriceSheet = dynamic(
  () => import("@/app/_components/report-price-sheet/ReportPriceSheet").then((m) => m.ReportPriceSheet),
  { ssr: false, loading: () => null }
);
const ProfileSheet = dynamic(
  () => import("@/app/_components/profile-sheet/ProfileSheet").then((m) => m.ProfileSheet),
  { ssr: false, loading: () => null }
);
const ExchangePanel = dynamic(
  () => import("@/app/_components/exchange-panel/ExchangePanel").then((m) => m.ExchangePanel),
  { ssr: false, loading: () => null }
);
import { CrossCategorySignalRail } from "@/app/_components/cross-category-signal-rail/CrossCategorySignalRail";
import {
  ItemDetailSheet,
  type OfferPresentation,
  type PresentedOffer
} from "@/app/_components/item-detail-sheet/ItemDetailSheet";
import { PresentationHost } from "@/app/_components/presentation-host/PresentationHost";
import { GetItSheet, type GetItTarget } from "@/app/_components/get-it-sheet/GetItSheet";
import {
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  type VisitContext
} from "@/app/_components/confirm-visit-sheet/ConfirmVisitSheet";

import { useTheme } from "@/core/context/ThemeContext";
import { usePresentation } from "@/core/navigation/usePresentation";
import { useGlobalStore } from "@/core/state/globalStore";
import { useLocaleControl, useStrings } from "@/core/i18n";
import { useEventCallback } from "@/lib/perf";
import {
  searchItems,
  getPopularItems,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  getVisitContext,
  getMyProfile,
  type PlaceOffer,
  type NarrowedOffer
} from "@/app/_actions/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import {
  fetchRoute,
  type DisclosedRouteOrigin,
} from "@/lib/directions";
import { MapPresentation } from "@/app/_components/map-presentation/MapPresentation";
import { useMapPresentation } from "@/app/_components/map-presentation/hooks/useMapPresentation";
import type { DeviceLocation } from "@/core/state/locationStore";

export {
  React,
  useState,
  useEffect,
  useTransition,
  useMemo,
  useCallback,
  useRef,
  getImageProps,
  AlertTriangle,
  MapPin,
  Navigation,
  X,
  Plus,
  ChevronDown,
  Button,
  SearchField,
  AdaptiveShell,
  useModalPresented,
  AsyncList,
  NigeriaLogo,
  ItemCard,
  PhotoCredits,
  PlaceOfferRow,
  PlaceOfferRowSkeleton,
  SettingsSheet,
  ReportPriceSheet,
  ProfileSheet,
  Avatar,
  CategorySelectorSheet,
  useLocationIdentity,
  ExchangePanel,
  CrossCategorySignalRail,
  ItemDetailSheet,
  PresentationHost,
  GetItSheet,
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  useTheme,
  usePresentation,
  useGlobalStore,
  useLocaleControl,
  useStrings,
  useEventCallback,
  searchItems,
  getPopularItems,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  getVisitContext,
  getMyProfile,
  getHaversineDistance,
  formatDistance,
  fetchRoute,
  MapPresentation,
  useMapPresentation
};

export type {
  ReactNode,
  ItemCardData,
  ExchangeLocationFilter,
  OfferPresentation,
  PresentedOffer,
  VisitContext,
  PlaceOffer,
  NarrowedOffer,
  DisclosedRouteOrigin,
  Detent,
  MapRetryCapability,
  DeviceLocation,
  CategoryPillar,
  GetItTarget
};
