import React, { useMemo, useRef, useState } from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet, useModalSheetNavigation } from "@/design-system/components/ModalSheet";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { transition } from "@/design-system/motion";
import {
  POPULAR_REFERENCE_CURRENCIES,
  SUPPORTED_REFERENCE_CURRENCY_META,
  isSupportedReferenceCurrencyCode,
  type SupportedReferenceCurrencyCode,
} from "@/app/_data/reference-currencies";
import { CurrencyFlag } from "@/app/_components/currency-flag/CurrencyFlag";
import type { ReferenceCurrencyCatalogEntry } from "@/app/_actions/currency-actions";

export {
  React,
  useMemo,
  useRef,
  useState,
  IconOrb,
  ModalSheet,
  useModalSheetNavigation,
  SolidIcon,
  transition,
  POPULAR_REFERENCE_CURRENCIES,
  SUPPORTED_REFERENCE_CURRENCY_META,
  isSupportedReferenceCurrencyCode,
  CurrencyFlag,
};

export type { SupportedReferenceCurrencyCode, ReferenceCurrencyCatalogEntry };
