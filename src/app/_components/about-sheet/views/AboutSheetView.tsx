import {
  React,
  ScrollText,
  ShieldCheck,
  LifeBuoy,
  ChevronRight,
  BookOpen,
  Accessibility,
  Scale,
  Camera,
  ModalSheet,
  NavigationStack,
  ListGroup,
  IconOrb,
} from "../imports/imports";
import { type AboutPage, type useAboutSheet } from "../hooks/useAboutSheet";
import "../styles/AboutSheet.css";
import { AboutSheetDetail } from "./AboutSheetDetail";

export interface AboutSheetViewProps {
  open: boolean;
  onClose: () => void;
  sheet: ReturnType<typeof useAboutSheet>;
}

export function AboutSheetView({ open, onClose, sheet }: AboutSheetViewProps) {
  const { t, page, setPage, detailTitle } = sheet;

  return (
    <ModalSheet open={open} onClose={onClose} title={t("profile.about")} size="page">
      <NavigationStack
        listNode={<AboutHub onSelect={setPage} t={t} />}
        detailNode={page ? <AboutSheetDetail page={page} t={t} /> : undefined}
        detailLabel={detailTitle}
        onDetailBack={() => setPage(null)}
        backLabel={t("about.back")}
      />
    </ModalSheet>
  );
}

function AboutHub({ onSelect, t }: { onSelect: (page: AboutPage) => void; t: ReturnType<typeof useAboutSheet>["t"] }) {
  return (
    <div className="h-full space-y-6 overflow-y-auto overscroll-contain py-3">
      <div className="space-y-3 px-4">
        <p className="text-body text-text-primary">{t("about.lede")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_what")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_prices")}</p>
      </div>

      <ListGroup>
        <AboutRow
          icon={<BookOpen />}
          label={t("about.how")}
          onClick={() => onSelect("how-it-works")}
        />
        <AboutRow
          icon={<Accessibility />}
          label={t("about.accessibility")}
          onClick={() => onSelect("accessibility")}
        />
      </ListGroup>

      <ListGroup>
        <AboutRow
          icon={<ScrollText />}
          label={t("about.terms")}
          onClick={() => onSelect("terms")}
        />
        <AboutRow
          icon={<ShieldCheck />}
          label={t("about.privacy")}
          onClick={() => onSelect("privacy")}
        />
        <AboutRow
          icon={<LifeBuoy />}
          label={t("about.support")}
          onClick={() => onSelect("support")}
        />
      </ListGroup>

      <ListGroup>
        <AboutRow
          icon={<Scale />}
          label={t("about.licenses")}
          onClick={() => onSelect("licenses")}
        />
        <AboutRow
          icon={<Camera />}
          label={t("about.attributions")}
          onClick={() => onSelect("attributions")}
        />
      </ListGroup>
    </div>
  );
}

function AboutRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-instant active:bg-fillTertiary"
    >
      <IconOrb>{icon}</IconOrb>
      <span className="min-w-0 flex-1 truncate text-body text-text-primary">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
    </button>
  );
}
