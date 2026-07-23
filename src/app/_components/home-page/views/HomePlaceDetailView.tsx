import {
  AsyncList,
  Button,
  Navigation,
  MapPin,
  X,
  PlaceOfferRow,
  PlaceOfferRowSkeleton,
  formatDistance,
  getHaversineDistance
} from "../imports/imports";
import { useT } from "@/core/i18n";
import type { useHomePage } from "../hooks/useHomePage";

type HomePageState = ReturnType<typeof useHomePage>;

type HomePlaceDetailViewProps = Pick<
  HomePageState,
  | "isRegular"
  | "placeOffers"
  | "placeOffersError"
  | "isPlaceOffersLoading"
  | "searchOrigin"
  | "handleSelectPlaceOffer"
  | "setDetailPlaceId"
  | "setGetItTarget"
  | "setPlaceOffersRetry"
> & {
  detailPlace: NonNullable<HomePageState["detailPlace"]>;
  locationLabel: string;
};

export function HomePlaceDetailView({
  detailPlace,
  isRegular,
  placeOffers,
  placeOffersError,
  isPlaceOffersLoading,
  searchOrigin,
  locationLabel,
  handleSelectPlaceOffer,
  setDetailPlaceId,
  setGetItTarget,
  setPlaceOffersRetry
}: HomePlaceDetailViewProps) {
  // Zero-wiring module store (see @/core/i18n): no provider, no prop threading.
  const t = useT();
  const visitLabel = /kiosk|shop|supermarket/.test(detailPlace.placeType.toLowerCase())
    ? t("home.visit_shop")
    : t("home.visit_market");

  const getItAction = (
    <div
      className={`stack-surface z-10 shrink-0 ${isRegular ? "static pt-1" : "static py-2"}`}
    >
      <Button
        variant="primary"
        size="md"
        className="w-full flex items-center justify-center"
        onClick={() =>
          setGetItTarget({
            placeId: detailPlace.id,
            placeName: detailPlace.name,
            lat: detailPlace.location.lat,
            lng: detailPlace.location.lng,
            address: detailPlace.address,
            areaName: locationLabel,
            // Reached from a pin, so there is no single price under test,
            // and therefore nothing to confirm on the way back.
            offer: null
          })
        }
      >
        <Navigation className="h-4 w-4 mr-1.5" />
        {visitLabel}
      </Button>
    </div>
  );

  return (
    <div data-navigation-detail-bounded className="home-detail-bounded">
      <div className="flex shrink-0 items-start justify-between">
        <div className="flex-1 pr-4">
          <h2 className="text-headline tracking-tight text-text-primary">{detailPlace.name}</h2>
          <p className="text-caption-1 text-text-secondary mt-1 flex items-center">
            <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
            {/* From the user, not from the camera, this panel opens by tapping
                a pin, which centres the camera ON that pin. */}
            {formatDistance(
              getHaversineDistance(
                searchOrigin.lat,
                searchOrigin.lng,
                detailPlace.location.lat,
                detailPlace.location.lng
              )
            )}{" "}
            • {detailPlace.address || `${locationLabel}, Lagos`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDetailPlaceId(null)}
          aria-label={t("close")}
          className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full
                     text-text-secondary transition-colors hover:text-text-primary
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-accent"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-fillSecondary">
            <X className="h-4 w-4" />
          </span>
        </button>
      </div>

      {!isRegular ? getItAction : null}

      <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-2">
        <h4 className="shrink-0 px-2 text-footnote text-text-secondary">Prices in market</h4>
        <div
          data-navigation-detail-scroller
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-none pr-1"
        >
          <AsyncList
            items={placeOffers}
            isLoading={isPlaceOffersLoading}
            error={placeOffersError}
            onRetry={() => setPlaceOffersRetry((attempt) => attempt + 1)}
            subject={detailPlace.id}
            keyExtractor={(offer) => offer.id}
            className={isRegular ? "grid-cols-2" : undefined}
            renderItem={(offer) => (
              <PlaceOfferRow
                offer={offer}
                layout={isRegular ? "regular" : "compact"}
                onSelect={() => void handleSelectPlaceOffer(offer)}
              />
            )}
            skeleton={<PlaceOfferRowSkeleton layout={isRegular ? "regular" : "compact"} />}
            empty={{
              icon: <MapPin className="h-6 w-6" />,
              title: t("home.place_empty_title"),
              description: t("home.place_empty_body")
            }}
            errorState={{
              title: placeOffersError ?? t("home.err_load_title"),
              description: t("home.err_network_body"),
              retryLabel: t("home.retry")
            }}
          />
        </div>
      </div>

      {isRegular ? getItAction : null}
    </div>
  );
}
