import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, LocateFixed, Map as MapIcon, MapPin, TriangleAlert } from "lucide-react";

import { ModalSheet } from "@/design-system/components/ModalSheet";
import { NavigationStack } from "@/design-system/components/NavigationStack";
import { ListGroup } from "@/design-system/components/ListRow";
import { Skeleton } from "@/design-system/components/Skeleton";
import { StatusBadge } from "@/design-system/components/StatusBadge";
import { IconOrb } from "@/design-system/components/IconOrb";
import { getAreaTree, getCoverageForPoint } from "@/app/_actions/place-actions";
import type { AreaGroup, AreaSummary, AreaTree } from "@/app/_actions/place-actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import {
  acquireDeviceLocation,
  useFreshDeviceLocation,
  useLocationStore,
} from "@/core/state/locationStore";

export {
  React,
  useCallback,
  useEffect,
  useRef,
  useState,
  Check,
  ChevronRight,
  LocateFixed,
  MapIcon,
  MapPin,
  TriangleAlert,
  ModalSheet,
  NavigationStack,
  ListGroup,
  Skeleton,
  StatusBadge,
  IconOrb,
  getAreaTree,
  getCoverageForPoint,
  getHaversineDistance,
  formatDistance,
  acquireDeviceLocation,
  useFreshDeviceLocation,
  useLocationStore,
};

export type { AreaGroup, AreaSummary, AreaTree };
