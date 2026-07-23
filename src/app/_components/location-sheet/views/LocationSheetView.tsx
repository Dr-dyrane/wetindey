import {
  React,
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
  getHaversineDistance,
  formatDistance,
  type AreaGroup,
  type AreaSummary,
} from "../imports/imports";
import { type useLocationSheet } from "../hooks/useLocationSheet";
import { useStrings } from "@/core/i18n";
import "../styles/LocationSheet.css";

export interface LocationSheetViewProps {
  open: boolean;
  onClose: () => void;
  radiusKm: number;
  sheet: ReturnType<typeof useLocationSheet>;
}

export function LocationSheetView({
  open,
  onClose,
  radiusKm,
  sheet,
}: LocationSheetViewProps) {
  // Zero-wiring module store (see @/core/i18n); replaces the deleted local
  // copy module byte-for-byte in en.
  const t = useStrings();
  const {
    browsingLocation,
    tree,
    treeError,
    locate,
    lgaSlug,
    setLgaSlug,
    loadTree,
    handlePickArea,
    handleUseMyLocation,
    measureFrom,
  } = sheet;

  const locating = locate.kind === "locating";

  const areaRow = (area: AreaSummary, lgaName?: string) => {
    const isSelected = area.slug === browsingLocation.areaSlug;
    const distanceKm = getHaversineDistance(measureFrom.lat, measureFrom.lng, area.lat, area.lng);
    const detail = [
      lgaName === area.name ? null : lgaName,
      area.placeCount === 0
        ? "No places yet"
        : `${area.placeCount} place${area.placeCount === 1 ? "" : "s"}`,
      distanceKm >= 0.05 ? formatDistance(distanceKm) : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        key={area.id}
        type="button"
        onClick={() => handlePickArea(area)}
        aria-current={isSelected}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left
                   active:bg-fillTertiary transition-colors duration-instant"
      >
        <IconOrb>
          <MapPin />
        </IconOrb>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-text-primary">{area.name}</span>
          <span className="mt-0.5 block truncate text-footnote text-text-secondary tabular-nums">
            {detail}
          </span>
        </span>
        {isSelected && browsingLocation.provenance === "manual" && (
          <StatusBadge kind="caution">Area centre</StatusBadge>
        )}
        {isSelected && <Check className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.5} />}
      </button>
    );
  };

  const lgaRow = (group: AreaGroup) => {
    const selected = group.areas.find(
      (a) => a.slug === browsingLocation.areaSlug
    );
    const places = group.areas.reduce((n, a) => n + a.placeCount, 0);
    const detail = [
      selected?.name,
      `${group.areas.length} areas`,
      places === 0 ? "No places yet" : `${places} place${places === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        key={group.lgaSlug}
        type="button"
        onClick={() => setLgaSlug(group.lgaSlug)}
        aria-current={selected !== undefined}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left
                   active:bg-fillTertiary transition-colors duration-instant"
      >
        <IconOrb>
          <MapIcon />
        </IconOrb>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-text-primary">{group.lgaName}</span>
          <span className="mt-0.5 block truncate text-footnote text-text-secondary tabular-nums">
            {detail}
          </span>
        </span>
        {selected && <Check className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.5} />}
        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
      </button>
    );
  };

  const openGroup = tree?.groups.find((g) => g.lgaSlug === lgaSlug);

  const listNode = (
    <div className="h-full overflow-y-auto overscroll-contain space-y-6 py-3">
      <ListGroup footer="Your device fix is kept only for this session. Choosing Use my location also saves that point as your browsing area. Exact route origin leaves WetinDey only after a separate directions disclosure.">
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          aria-busy={locating}
          className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left
                     disabled:opacity-40 active:bg-fillTertiary transition-colors duration-instant"
        >
          <IconOrb>
            <LocateFixed />
          </IconOrb>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body text-text-primary">
              {locating ? t["location.locating"] : t["location.use_my_location"]}
            </span>
          </span>
          {browsingLocation.provenance === "device" && (
            <Check className="h-5 w-5 shrink-0 text-accent" strokeWidth={2.5} />
          )}
        </button>
      </ListGroup>

      {locate.kind === "problem" && (
        <div className="mx-4 squircle-card bg-status-caution-bg p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 text-status-caution-fg" />
            <p className="text-subhead font-semibold text-status-caution-fg">{locate.title}</p>
          </div>
          <p className="text-footnote text-text-secondary">{locate.body}</p>
          {locate.canRetry && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="min-h-tap text-subhead text-accent active:opacity-60"
            >
              {t["location.try_again"]}
            </button>
          )}
        </div>
      )}

      {locate.kind === "outside" && (
        <div className="mx-4 squircle-card bg-status-caution-bg p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-status-caution-fg" />
            <p className="text-subhead font-semibold text-status-caution-fg">
              {t["location.outside_title"]}
            </p>
          </div>
          <p className="text-footnote text-text-secondary">
            {locate.nearest
              ? `Nothing within ${radiusKm} km of you. The nearest we cover is ${locate.nearest.name}${
                  locate.distanceKm !== null
                    ? `, about ${formatDistance(locate.distanceKm).replace(" away", "")} off`
                    : ""
                }.`
              : `Nothing within ${radiusKm} km of you.`}
          </p>
          {locate.nearest && (
            <button
              type="button"
              onClick={() => handlePickArea(locate.nearest!)}
              className="min-h-tap text-subhead text-accent active:opacity-60"
            >
              Use {locate.nearest.name} instead
            </button>
          )}
        </div>
      )}

      {treeError ? (
        <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated shadow-card p-5 text-center space-y-2">
          <p className="text-subhead font-semibold text-text-primary">{treeError}</p>
          <button
            type="button"
            onClick={() => void loadTree()}
            className="min-h-tap text-subhead text-accent active:opacity-60"
          >
            {t["location.try_again"]}
          </button>
        </div>
      ) : tree === null ? (
        <div className="mx-4 space-y-2">
          <Skeleton className="h-tap w-full squircle" />
          <Skeleton className="h-tap w-full squircle" />
          <Skeleton className="h-tap w-full squircle" />
        </div>
      ) : tree.groups.length === 0 ? (
        <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated shadow-card p-5 text-center">
          <p className="text-subhead font-semibold text-text-primary">{t["location.no_areas"]}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="px-4 text-footnote text-text-secondary">
            {tree.countryName} · {tree.stateName}
          </p>

          <ListGroup>
            {tree.groups.map((group) =>
              group.areas.length > 1
                ? lgaRow(group)
                : areaRow(group.areas[0], group.lgaName)
            )}
          </ListGroup>
        </div>
      )}
    </div>
  );

  return (
    <ModalSheet open={open} onClose={onClose} title={t["location.sheet_title"]} size="page">
      <NavigationStack
        listNode={listNode}
        detailNode={
          openGroup && (
            <div className="-mx-6">
              <ListGroup>{openGroup.areas.map((area) => areaRow(area))}</ListGroup>
            </div>
          )
        }
        detailLabel={openGroup?.lgaName}
        onDetailBack={() => setLgaSlug(null)}
        backLabel={t["location.back"]}
      />
    </ModalSheet>
  );
}
