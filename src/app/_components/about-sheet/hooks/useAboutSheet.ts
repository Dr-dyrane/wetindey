import { useEffect, useState, useT } from "../imports/imports";

export type AboutPage =
  | "terms"
  | "privacy"
  | "support"
  | "how-it-works"
  | "accessibility"
  | "licenses"
  | "attributions";

export interface UseAboutSheetOptions {
  open: boolean;
  initialPage?: AboutPage;
}

export function useAboutSheet({ open, initialPage }: UseAboutSheetOptions) {
  const t = useT();
  const [page, setPage] = useState<AboutPage | null>(null);

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

  return {
    t,
    page,
    setPage,
    detailTitle,
  };
}
