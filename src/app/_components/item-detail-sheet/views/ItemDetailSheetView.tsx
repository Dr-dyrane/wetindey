import {
  Image,
  CardListSkeleton,
  IconOrb,
  ModalSheet,
  SheetPicker,
  SolidIcon,
  type OfferSort,
} from "../imports/imports";
import { copy } from "../copy/copy";
import { ItemDetailOfferRow } from "./ItemDetailOfferRow";
import {
  type ItemDetailSheetProps,
  type useItemDetailSheet,
} from "../hooks/useItemDetailSheet";
import "../styles/ItemDetailSheet.css";

const SORTS: { id: OfferSort; label: string }[] = [
  { id: "nearest", label: copy.nearest },
  { id: "cheapest", label: copy.cheapest },
  { id: "freshest", label: copy.freshest },
];

/**
 * One step of the narrowing path.
 *
 * A choice presents a sheet — SheetPicker, per the HIG rule this app follows.
 * With one option there is no choice to present, so it renders as a plain
 * resolved value: a picker that opens a sheet containing a single row you
 * cannot deselect is a control that lies about having an outcome. The pilot
 * data hits this constantly — every item currently carries exactly one variant
 * and one unit — so the taxonomy stays visible without the dead affordance.
 */
function NarrowStep({
  label,
  title,
  options,
  value,
  onSelect,
}: {
  label: string;
  title: string;
  options: { id: string; label: string; detail?: string; disabled?: boolean }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  if (options.length <= 1) {
    const only = options[0];

    return (
      <div>
        <span className="mb-1.5 block text-footnote text-text-secondary">{label}</span>
        <div className="flex min-h-tap w-full items-center bg-fillQuaternary px-4 squircle">
          <span className="truncate text-body text-text-primary">
            {only?.label ?? copy.nothingNearby}
          </span>
        </div>
      </div>
    );
  }

  return (
    <SheetPicker
      title={title}
      label={label}
      options={options}
      value={value}
      onSelect={onSelect}
      placeholder={copy.choose}
    />
  );
}

interface ItemDetailSheetViewProps extends ItemDetailSheetProps {
  sheet: ReturnType<typeof useItemDetailSheet>;
}

export function ItemDetailSheetView({
  open,
  onClose,
  item,
  radiusKm,
  areaName,
  onSelectOffer,
  sheet,
}: ItemDetailSheetViewProps) {
  const {
    variantId,
    setVariantId,
    unitId,
    setUnitId,
    sort,
    setSort,
    detailsOpen,
    setDetailsOpen,
    variantOptions,
    unitOptions,
    rows,
    loading,
    error,
    imageBroken,
    setImageBroken,
    countLabel,
  } = sheet;

  /**
   * The Maps place-card order: photo bleeding to the panel's top edge, then the
   * name centred beneath it. Apple publishes no rule for the bleed — the Images
   * and Collections pages cover resolution, format and colour only — so this is
   * precedent, not law. What is law is below: the panel keeps its dismissal
   * affordances, which ModalSheet floats over this block.
   *
   * No corner radius here. The panel is overflow-hidden and already carries
   * SHEET_RADIUS; a second declaration would drift the moment that constant does.
   *
   * With no photo there is no hero, and ModalSheet renders its ordinary header.
   * A monogram blown up to hero scale is a worse header than a real header.
   */
  const hero =
    item && item.imageUrl && !imageBroken ? (
      <div>
        {/* Height tracks the viewport, not the width: the panel is sized as a
            fraction of the screen's height in both size classes, so a hero in vh
            holds one proportion of it at compact and regular alike. */}
        <div className="relative h-[clamp(140px,22vh,200px)] w-full bg-surface-sunken">
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 440px, 100vw"
            className="object-cover"
            /**
             * Straight from Wikimedia's CDN, not /_next/image. The optimizer
             * fetches every photo server-side from one IP, which
             * upload.wikimedia.org answers with 429 and no image renders. This
             * failure reaches production without ever showing up locally.
             */
            unoptimized
            onError={() => setImageBroken(true)}
          />
        </div>

        {/* Restores the heading ModalSheet's hero path drops. `title` still
            carries the dialog's accessible name, so this is the outline, not
            the label. */}
        <h2 className="text-balance px-10 pt-3 pb-1 text-center text-title-2 text-text-primary">
          {item.name}
        </h2>
      </div>
    ) : undefined;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={item?.name ?? copy.fallbackTitle}
      hero={hero}
      size="page"
    >
      <div className="space-y-4 py-3">
        {/* The narrowing path: item → type → size. */}
        <div className="mx-4 grid grid-cols-2 gap-3">
          <NarrowStep
            label={copy.type}
            title={copy.chooseType}
            options={variantOptions}
            value={variantId}
            onSelect={setVariantId}
          />
          <NarrowStep
            label={copy.size}
            title={copy.chooseSize}
            options={unitOptions}
            value={unitId}
            onSelect={setUnitId}
          />
        </div>

        <div className="mx-4 flex items-center justify-between gap-3">
          <p className="text-footnote text-text-secondary">
            {loading ? copy.checkingPrices : `${countLabel} within ${radiusKm} km`}
          </p>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="item-detail-secondary"
            onClick={() => setDetailsOpen((openState) => !openState)}
            className={[
              "min-h-tap shrink-0 px-2 text-footnote font-medium text-text-secondary",
              "transition duration-micro active:opacity-60",
              "focus-visible:outline-2 focus-visible:outline-accent",
            ].join(" ")}
          >
            {detailsOpen ? copy.hideDetails : copy.moreDetails}
          </button>
        </div>

        {detailsOpen && (
          <div id="item-detail-secondary" className="mx-4 space-y-3 px-0 py-1">
            {item?.imageAttribution && (
              <p className="text-caption-1 text-text-secondary">
                {copy.photoCredit} {item.imageAttribution}
                {item.imageLicense ? ` · ${item.imageLicense}` : ""}
              </p>
            )}

            {/* Secondary ordering belongs with the other comparison detail, not
                in the first scan of the selected item. */}
            <div className="grid grid-cols-3 gap-1 squircle bg-fillTertiary p-1">
              {SORTS.map((option) => {
                const active = sort === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSort(option.id)}
                    className={`min-h-tap squircle text-footnote font-medium transition duration-micro ${
                      active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error ? (
          <div className="mx-4 space-y-2 squircle-card bg-surface dark:bg-surface-elevated p-5 text-center shadow-card">
            <div className="flex justify-center">
              <IconOrb size={48} tone="status-unavailable">
                <SolidIcon name="warning" size={24} />
              </IconOrb>
            </div>
            <p className="text-headline text-text-primary">{error}</p>
            <p className="text-footnote text-text-secondary">{copy.retry}</p>
          </div>
        ) : loading ? (
          <div className="mx-4">
            <CardListSkeleton count={3} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mx-4 space-y-2 squircle-card bg-surface dark:bg-surface-elevated p-6 text-center shadow-card">
            <div className="flex justify-center">
              <IconOrb tone="context-location">
                <SolidIcon name="map-pin" size={16} />
              </IconOrb>
            </div>
            <p className="text-headline text-text-primary">
              {copy.nothingWithin} {radiusKm} km
            </p>
            <p className="text-footnote text-text-secondary">
              {copy.noReportsPrefix} {item?.name.toLowerCase() ?? "this"} near {areaName}{" "}
              {copy.noReportsSuffix}
            </p>
          </div>
        ) : (
          <div className="mx-4 space-y-2">
            {rows.map((row) => (
              <ItemDetailOfferRow
                key={row.offer.id}
                row={row}
                detailsOpen={detailsOpen}
                onSelectOffer={onSelectOffer}
                translate={sheet.translate}
              />
            ))}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
