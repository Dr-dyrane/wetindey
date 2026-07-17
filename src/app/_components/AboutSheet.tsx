"use client";

import React, { useEffect, useState } from "react";
import {
  ScrollText,
  ShieldCheck,
  LifeBuoy,
  Info,
  Mail,
  ChevronRight,
  BookOpen,
  Accessibility,
  Scale,
  Camera,
} from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { NavigationStack } from "@/design-system/components/NavigationStack";
import { ListGroup } from "@/design-system/components/ListRow";
import { useT } from "@/core/i18n";
import { ITEM_IMAGES } from "@/db/itemImages";

/**
 * The one address the owner supplied, verbatim (support@wetindey.live), and the
 * single source of truth for it. It is a fact only the owner can supply, so it
 * is a constant here rather than a translatable string, and it feeds both the
 * Support surface's mail link and the Privacy surface's deletion line, so the
 * two can never drift.
 */
const SUPPORT_EMAIL = "support@wetindey.live";

/**
 * The surfaces that hang off About, addressable by name.
 *
 * `null` is the hub itself. A string union rather than a boolean per surface so
 * the pushed level is always exactly one thing. Not exported: nothing outside
 * this file selects a surface, the hub does, and it does it through `onSelect`.
 *
 * This union MUST stay identical to the `AboutPage` in usePresentation.ts:
 * PresentationHost passes that controller's `surface.page` straight into this
 * sheet's `initialPage`, so a value one side names and the other omits would fail
 * to typecheck at that seam. Each value is also its own hash (`how-it-works` ->
 * `/#how-it-works`).
 */
type AboutPage =
  "terms" | "privacy" | "support" | "how-it-works" | "accessibility" | "licenses" | "attributions";

interface AboutSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * The sub-page to land on when the sheet opens, for a hash deep-link
   * (`/#privacy`, `/#terms`, `/#support`). `undefined` opens the hub. It SEEDS
   * the level on present and on a change of link; internal navigation after that
   * is the sheet's own, so tapping back to the hub is not overridden.
   */
  initialPage?: AboutPage;
}

/**
 * About, the product's own account of itself, and the three surfaces the App
 * Store and an honest app both need: Terms of service, Privacy, Support.
 *
 * WHY ONE SHEET, NOT FOUR STACKED MODALS. The owner asked for "separate modals",
 * and these ARE separate surfaces, but stacking a modal per surface is the exact
 * pattern this app already paid to undo (task #13). They are levels of one
 * hierarchy (About → a sub-page), which is navigation, so they push on a single
 * `NavigationStack` the way LocationSheet pushes an LGA. One sheet, one backdrop,
 * one back affordance, and the hub stays underneath the whole time.
 *
 * WHY THE LEGAL COPY CARRIES A VISIBLE DRAFT MARKER. Terms and Privacy are drafted
 * from what the code demonstrably does, nothing invented, no warranties, no
 * governing law, because an agent may not write those. `about.draft_notice` says
 * so in the UI, on each drafted surface, because a privacy notice that a user
 * trusts while it misdescribes what is collected is worse than none. The owner
 * must have it reviewed before it is relied on.
 */
export function AboutSheet({ open, onClose, initialPage }: AboutSheetProps) {
  const t = useT();

  /** Which sub-surface is pushed. `null` is the hub. */
  const [page, setPage] = useState<AboutPage | null>(null);

  /**
   * Seed the level from the deep-link on present, and reset to the hub on
   * dismiss. Keyed on `initialPage` too, so a link that changes while the sheet
   * is already open (a `/#terms` → `/#privacy` hashchange) re-seeds. Internal
   * navigation does not touch these deps, so tapping back to the hub afterwards
   * stands. The panel is unmounted while closed, so nothing flickers; this only
   * decides the level the next present starts from.
   */
  useEffect(() => {
    setPage(open ? (initialPage ?? null) : null);
  }, [open, initialPage]);

  const detailTitle: string | undefined = !page
    ? undefined
    : page === "terms"
      ? t("about.terms_title")
      : page === "privacy"
        ? t("about.privacy_title")
        : page === "support"
          ? t("about.support_title")
          : page === "how-it-works"
            ? t("about.how_title")
            : page === "accessibility"
              ? t("about.a11y_title")
              : page === "licenses"
                ? t("about.licenses_title")
                : t("about.attributions_title");

  return (
    <ModalSheet open={open} onClose={onClose} title={t("profile.about")} size="page">
      <NavigationStack
        listNode={<AboutHub onSelect={setPage} />}
        detailNode={page ? <AboutDetail page={page} /> : undefined}
        detailLabel={detailTitle}
        onDetailBack={() => setPage(null)}
        backLabel={t("about.back")}
      />
    </ModalSheet>
  );
}

/**
 * Level 0, what the app is, then the way into each surface.
 *
 * The prose is the honest core of this whole build: WetinDey is a live local
 * information service, with Food price and availability as its current V1
 * capability. It brings its own scroller because
 * NavigationStack's root is a fixed-size, overflow-hidden host and only pads and
 * scrolls level 1.
 */
function AboutHub({ onSelect }: { onSelect: (page: AboutPage) => void }) {
  const t = useT();
  return (
    <div className="h-full space-y-6 overflow-y-auto overscroll-contain py-3">
      <div className="space-y-3 px-4">
        <h2 className="text-title-3 font-semibold text-text-primary">{t("about.title")}</h2>
        <p className="text-body text-text-primary">{t("about.lede")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_what")}</p>
        <p className="text-subhead leading-relaxed text-text-secondary">{t("about.body_prices")}</p>
      </div>

      {/* Three groups, not one list: the way iOS separates unlike things on a
          settings screen. Learn the app, then the legal surfaces, then the
          credits it owes. */}
      <ListGroup>
        <AboutRow
          icon={<BookOpen className="h-4 w-4 text-text-secondary" />}
          label={t("about.how")}
          onClick={() => onSelect("how-it-works")}
        />
        <AboutRow
          icon={<Accessibility className="h-4 w-4 text-text-secondary" />}
          label={t("about.accessibility")}
          onClick={() => onSelect("accessibility")}
        />
      </ListGroup>

      <ListGroup>
        <AboutRow
          icon={<ScrollText className="h-4 w-4 text-text-secondary" />}
          label={t("about.terms")}
          onClick={() => onSelect("terms")}
        />
        <AboutRow
          icon={<ShieldCheck className="h-4 w-4 text-text-secondary" />}
          label={t("about.privacy")}
          onClick={() => onSelect("privacy")}
        />
        <AboutRow
          icon={<LifeBuoy className="h-4 w-4 text-text-secondary" />}
          label={t("about.support")}
          onClick={() => onSelect("support")}
        />
      </ListGroup>

      <ListGroup>
        <AboutRow
          icon={<Scale className="h-4 w-4 text-text-secondary" />}
          label={t("about.licenses")}
          onClick={() => onSelect("licenses")}
        />
        <AboutRow
          icon={<Camera className="h-4 w-4 text-text-secondary" />}
          label={t("about.attributions")}
          onClick={() => onSelect("attributions")}
        />
      </ListGroup>
    </div>
  );
}

/**
 * A hub row. This is `ListRow`'s exact shape, hand-rolled for one reason: these
 * push a level on the SAME sheet, and `ListRow`'s chevron is the right caret for
 * that. It stays a peer of ProfileSheet's own rows, 44pt tap target, fill on
 * press, no divider, no border, so the two sheets read as one system.
 */
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
      <span className="squircle grid h-7 w-7 shrink-0 place-items-center bg-fillTertiary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-text-primary">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
    </button>
  );
}

/** Level 1, the selected surface. NavigationStack already gives this level its
 *  padding, scroller and back row, so it renders prose directly. */
function AboutDetail({ page }: { page: AboutPage }) {
  if (page === "terms") return <TermsPage />;
  if (page === "privacy") return <PrivacyPage />;
  if (page === "support") return <SupportPage />;
  if (page === "how-it-works") return <HowItWorksPage />;
  if (page === "accessibility") return <AccessibilityPage />;
  if (page === "licenses") return <LicensesPage />;
  return <AttributionsPage />;
}

/**
 * The review marker. A caution-tinted callout, so it can never be read as part of
 * the copy it guards. Present on every DRAFTED legal surface (Terms, Privacy) and
 * absent from Support, which invents nothing, it is one real email address.
 */
function DraftNotice() {
  const t = useT();
  return (
    <div className="squircle-card flex gap-2.5 bg-status-caution-bg p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-caution-fg" aria-hidden />
      <p className="text-footnote leading-relaxed text-text-secondary">{t("about.draft_notice")}</p>
    </div>
  );
}

function PageHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-title-3 font-semibold text-text-primary">{children}</h2>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-subhead leading-relaxed text-text-secondary">{children}</p>;
}

function TermsPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.terms_title")}</PageHeading>
      <DraftNotice />
      <Paragraph>{t("about.terms_intro")}</Paragraph>
      <Paragraph>{t("about.terms_prices")}</Paragraph>
      <Paragraph>{t("about.terms_fulfilment")}</Paragraph>
      <Paragraph>{t("about.terms_reporting")}</Paragraph>
    </div>
  );
}

function PrivacyPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.privacy_title")}</PageHeading>
      <DraftNotice />
      <Paragraph>{t("about.privacy_intro")}</Paragraph>
      <Paragraph>{t("about.privacy_collect")}</Paragraph>
      <Paragraph>{t("about.privacy_device")}</Paragraph>
      <Paragraph>{t("about.privacy_third")}</Paragraph>
      <Paragraph>{t("about.privacy_ads")}</Paragraph>
      <Paragraph>{t("about.privacy_delete", { email: SUPPORT_EMAIL })}</Paragraph>
    </div>
  );
}

function SupportPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.support_title")}</PageHeading>
      <Paragraph>{t("about.support_body")}</Paragraph>

      {/* A real mailto, not a button that fakes one: long-press copies it, it
          survives with JS asleep, and it is the honest minimum the owner asked
          for, no phone number, no address, no response-time promise invented
          around it. Its own surface on the elevated rung, so it sits on the sheet
          rather than sinking into it in dark. */}
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="squircle-card flex items-center gap-3 bg-surface px-4 py-3 shadow-card transition-colors duration-instant active:bg-fillTertiary dark:bg-surface-elevated"
      >
        <span className="squircle grid h-7 w-7 shrink-0 place-items-center bg-status-info-bg">
          <Mail className="h-4 w-4 text-status-info-fg" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body text-accent">{t("about.support_cta")}</span>
          <span className="block truncate text-footnote text-text-secondary">{SUPPORT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}

/**
 * How WetinDey works, the product explained to a first-time reader.
 *
 * This explains the current Food flow without treating every result as a
 * human-observed or verified claim. It retains anonymous browsing, optional
 * recognition, and the maps hand-off without fulfilment (ADR-001).
 */
function HowItWorksPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.how_title")}</PageHeading>
      <HowItWorksSection title={t("about.how_area_title")}>
        {t("about.how_area_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_need_title")}>
        {t("about.how_need_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_signal_title")}>
        {t("about.how_signal_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_freshness_title")}>
        {t("about.how_freshness_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_maps_title")}>
        {t("about.how_maps_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_contribute_title")}>
        {t("about.how_contribute_body")}
      </HowItWorksSection>
      <HowItWorksSection title={t("about.how_confirm_title")}>
        {t("about.how_confirm_body")}
      </HowItWorksSection>
    </div>
  );
}

function HowItWorksSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-headline text-text-primary">{title}</h3>
      <Paragraph>{children}</Paragraph>
    </section>
  );
}

/**
 * Accessibility, a plain statement of what the app does, not a conformance
 * claim.
 *
 * Every sentence is grep-backed behaviour: theme + Dynamic Type + word-not-only
 * colour, reduced-motion honoured, dialog focus management + three dismissal
 * paths + preserved pinch-zoom, and 44pt tap targets. The last paragraph is the
 * honest boundary: it describes, it does not certify, and it points at Support.
 */
function AccessibilityPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.a11y_title")}</PageHeading>
      <Paragraph>{t("about.a11y_intro")}</Paragraph>
      <Paragraph>{t("about.a11y_vision")}</Paragraph>
      <Paragraph>{t("about.a11y_motion")}</Paragraph>
      <Paragraph>{t("about.a11y_keyboard")}</Paragraph>
      <Paragraph>{t("about.a11y_targets")}</Paragraph>
      <Paragraph>{t("about.a11y_note")}</Paragraph>
    </div>
  );
}

/**
 * A section label on a level-1 reading surface. Matches ListGroup's header voice
 * (footnote, secondary, sentence case), but sits flush with the prose because a
 * pushed level already carries its own horizontal padding from NavigationStack.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-footnote text-text-secondary">{children}</h3>;
}

/**
 * A grouped card for a level-1 list. The same surface SupportPage's mail card
 * uses (bg-surface on the elevated rung so it sits on the sheet rather than
 * sinking into it in dark), and flush with the prose, not inset like ListGroup
 * (whose mx-4 is for the hub, which pads its own scroller). Rows bring their own
 * padding; the card only rounds and clips them.
 */
function CreditGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="squircle-card overflow-hidden bg-surface shadow-card dark:bg-surface-elevated">
      {children}
    </div>
  );
}

/**
 * An informational credit row: a name on the left, its licence on the right. Not
 * a button and not a link: the licence list points nowhere, it just states what
 * each library is offered under. 44pt tall so it reads as a peer of the app's
 * other rows and grows rather than clips under Dynamic Type.
 */
function CreditRow({ name, licence }: { name: string; licence: string }) {
  return (
    <div className="flex min-h-tap w-full items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 text-body text-text-primary">{name}</span>
      <span className="shrink-0 text-footnote text-text-secondary">{licence}</span>
    </div>
  );
}

/**
 * A credit row whose name links to the work's source. Attribution is a licence
 * obligation for CC BY / CC BY-SA (author, licence, and the source must travel
 * with the image), so the photographer's name is the link to the Commons file
 * page. `rel="noopener noreferrer"` because it opens an external tab.
 */
function CreditLink({ href, name, licence }: { href: string; name: string; licence: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-instant active:bg-fillTertiary"
    >
      <span className="min-w-0 flex-1 truncate text-body text-accent">{name}</span>
      <span className="shrink-0 text-footnote text-text-secondary">{licence}</span>
    </a>
  );
}

/**
 * The runtime dependencies WetinDey ships, with the SPDX licence each is offered
 * under. Read from package.json's `dependencies` and each package's `license`
 * field in node_modules on 2026-07-17, not recalled from memory: a guessed
 * licence is a legal misstatement, so a field that cannot be read is omitted
 * rather than invented. Names are the recognisable product names; the npm package
 * is what package.json lists. Versions are left off on purpose, they change on
 * every install while the licence does not.
 *
 * Mapbox and OpenStreetMap are NOT here: the map is reached over a token, not an
 * npm package, so their attribution lives on the Attributions surface instead.
 */
const THIRD_PARTY_LICENCES: ReadonlyArray<{ name: string; licence: string }> = [
  { name: "Next.js", licence: "MIT" },
  { name: "React", licence: "MIT" },
  { name: "React DOM", licence: "MIT" },
  { name: "Neon Auth", licence: "Apache-2.0" },
  { name: "Drizzle ORM", licence: "Apache-2.0" },
  { name: "Lucide", licence: "ISC" },
  { name: "node-postgres", licence: "MIT" },
  { name: "Zod", licence: "MIT" },
  { name: "Zustand", licence: "MIT" },
  { name: "clsx", licence: "MIT" },
  { name: "tailwind-merge", licence: "MIT" },
  { name: "Vercel Analytics", licence: "MIT" },
];

/** Open-source licences: the libraries the app is built on, and their licence. */
function LicensesPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.licenses_title")}</PageHeading>
      <Paragraph>{t("about.licenses_intro")}</Paragraph>
      <CreditGroup>
        {THIRD_PARTY_LICENCES.map((lib) => (
          <CreditRow key={lib.name} name={lib.name} licence={lib.licence} />
        ))}
      </CreditGroup>
    </div>
  );
}

/**
 * Attributions, the photo credits the app already shows, gathered in one place,
 * plus the map data notice.
 *
 * The photo list is DERIVED from ITEM_IMAGES, the single source the seed writes
 * from and PhotoCredits renders per card, so it can never drift from what is
 * actually shown. Each photographer's name links to its Commons file page, which
 * is the source the CC licence requires to travel with the image. The map line
 * is the Mapbox / OpenStreetMap attribution their terms require.
 */
function AttributionsPage() {
  const t = useT();
  const photos = Object.values(ITEM_IMAGES);
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeading>{t("about.attributions_title")}</PageHeading>
        <Paragraph>{t("about.attributions_photos_intro")}</Paragraph>
      </div>

      <div className="space-y-2">
        <SectionLabel>{t("about.attributions_photos_title")}</SectionLabel>
        <CreditGroup>
          {photos.map((p) => (
            <CreditLink
              key={p.sourceUrl}
              href={p.sourceUrl}
              name={p.attribution}
              licence={p.license}
            />
          ))}
        </CreditGroup>
      </div>

      <div className="space-y-2">
        <SectionLabel>{t("about.attributions_map_title")}</SectionLabel>
        <Paragraph>{t("about.attributions_map")}</Paragraph>
      </div>
    </div>
  );
}
