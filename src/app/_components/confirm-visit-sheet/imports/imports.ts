import React, { useEffect, useMemo, useState } from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { formatNaira } from "@/lib/money";

/* `useT` used to be re-exported here for the hook. The hook now imports it
   from @/core/i18n directly, the same way the other centralized-copy verticals
   do, and the modularization contract reads that import as the proof that this
   component's copy is central. */
export {
  React,
  useEffect,
  useMemo,
  useState,
  IconOrb,
  ModalSheet,
  Button,
  Input,
  SolidIcon,
  formatNaira,
};
