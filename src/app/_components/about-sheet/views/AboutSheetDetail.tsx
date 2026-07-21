import {
  React,
  Info,
  Mail,
  IconOrb,
  ITEM_IMAGES,
} from "../imports/imports";
import { type AboutPage, type useAboutSheet } from "../hooks/useAboutSheet";
import { SUPPORT_EMAIL, THIRD_PARTY_LICENCES } from "../copy/copy";

export interface AboutSheetDetailProps {
  page: AboutPage;
  t: ReturnType<typeof useAboutSheet>["t"];
}

export function AboutSheetDetail({ page, t }: AboutSheetDetailProps) {
  if (page === "terms") return <TermsPage t={t} />;
  if (page === "privacy") return <PrivacyPage t={t} />;
  if (page === "support") return <SupportPage t={t} />;
  if (page === "how-it-works") return <HowItWorksPage t={t} />;
  if (page === "accessibility") return <AccessibilityPage t={t} />;
  if (page === "licenses") return <LicensesPage t={t} />;
  return <AttributionsPage t={t} />;
}

function DraftNotice({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
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

function TermsPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.terms_title")}</PageHeading>
      <DraftNotice t={t} />
      <Paragraph>{t("about.terms_intro")}</Paragraph>
      <Paragraph>{t("about.terms_prices")}</Paragraph>
      <Paragraph>{t("about.terms_fulfilment")}</Paragraph>
      <Paragraph>{t("about.terms_reporting")}</Paragraph>
    </div>
  );
}

function PrivacyPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.privacy_title")}</PageHeading>
      <DraftNotice t={t} />
      <Paragraph>{t("about.privacy_intro")}</Paragraph>
      <Paragraph>{t("about.privacy_collect")}</Paragraph>
      <Paragraph>{t("about.privacy_device")}</Paragraph>
      <Paragraph>{t("about.privacy_third")}</Paragraph>
      <Paragraph>{t("about.privacy_presence")}</Paragraph>
      <Paragraph>{t("about.privacy_ads")}</Paragraph>
      <Paragraph>{t("about.privacy_delete", { email: SUPPORT_EMAIL })}</Paragraph>
    </div>
  );
}

function SupportPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
  return (
    <div className="space-y-4">
      <PageHeading>{t("about.support_title")}</PageHeading>
      <Paragraph>{t("about.support_body")}</Paragraph>
      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="squircle-card flex min-h-tap items-center gap-3 bg-surface px-4 py-3 shadow-card transition-colors duration-instant active:bg-fillTertiary dark:bg-surface-elevated"
      >
        <IconOrb>
          <Mail />
        </IconOrb>
        <span className="min-w-0 flex-1">
          <span className="block text-body text-accent">{t("about.support_cta")}</span>
          <span className="block truncate text-footnote text-text-secondary">{SUPPORT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}

function HowItWorksPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
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

function AccessibilityPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-footnote text-text-secondary">{children}</h3>;
}

function CreditGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="squircle-card overflow-hidden bg-surface shadow-card dark:bg-surface-elevated">
      {children}
    </div>
  );
}

function CreditRow({ name, licence }: { name: string; licence: string }) {
  return (
    <div className="flex min-h-tap w-full items-center gap-3 px-4 py-2">
      <span className="min-w-0 flex-1 text-body text-text-primary">{name}</span>
      <span className="shrink-0 text-footnote text-text-secondary">{licence}</span>
    </div>
  );
}

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

function LicensesPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
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

function AttributionsPage({ t }: { t: ReturnType<typeof useAboutSheet>["t"] }) {
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
