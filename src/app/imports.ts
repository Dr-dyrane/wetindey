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
import { SettingsSheet } from "@/app/_components/SettingsSheet";
import { ReportPriceSheet } from "@/app/_components/ReportPriceSheet";
import { ProfileSheet, Avatar } from "@/app/_components/ProfileSheet";
import { CategorySelectorSheet, type CategoryPillar } from "@/app/_components/CategorySelectorSheet";
import { useLocationIdentity } from "@/app/_hooks/useLocationIdentity";
import {
  ExchangePanel,
  type ExchangeLocationFilter
} from "@/app/_components/ExchangePanel";
import {
  EXCHANGE_SAMPLE_LOCATIONS,
  type ExchangeSampleLocation
} from "@/app/_data/exchange-sample-locations";
import {
  ItemDetailSheet,
  type OfferPresentation,
  type PresentedOffer
} from "@/app/_components/ItemDetailSheet";
import { PresentationHost } from "@/app/_components/PresentationHost";
import { GetItSheet, type GetItTarget } from "@/app/_components/GetItSheet";
import {
  ConfirmVisitSheet,
  armVisit,
  takeDueVisit,
  type VisitContext
} from "@/app/_components/ConfirmVisitSheet";

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
} from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import {
  fetchRoute,
  type DisclosedRouteOrigin,
} from "@/lib/directions";
import { MapPresentation } from "@/app/_components/map-presentation/MapPresentation";
import { useMapPresentation } from "@/app/_components/map-presentation/useMapPresentation";
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
  EXCHANGE_SAMPLE_LOCATIONS,
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
  ExchangeSampleLocation,
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
