import type { FormEvent } from "react";
import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { submitProblemReport } from "@/app/_actions/problem-report-actions";
import { Button } from "@/design-system/components/Button";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { useLocaleControl, useT } from "@/core/i18n";

export {
  AlertTriangle,
  Button,
  CheckCircle2,
  IconOrb,
  ModalSheet,
  SheetPicker,
  submitProblemReport,
  useLocaleControl,
  useState,
  useT,
};

export type { FormEvent };
