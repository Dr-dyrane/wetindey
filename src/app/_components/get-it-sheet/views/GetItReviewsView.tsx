import {
  IconOrb,
  SolidIcon,
  Star,
  useT,
  type ReviewAggregateData,
  type ReviewData,
} from "../imports/imports";

interface GetItReviewsViewProps {
  loading: boolean;
  reviews: ReviewData[];
}

export function GetItReviewAggregateView({
  aggregate,
}: {
  aggregate: ReviewAggregateData | null;
}) {
  const t = useT();

  if (!aggregate || aggregate.ratingCount <= 0) return null;

  return (
    <div className="mx-4 flex items-center gap-1.5">
      <div className="flex items-center text-rating">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={`h-3.5 w-3.5 ${
              index < Math.round(aggregate.ratingAverage)
                ? "fill-current"
                : "text-rating-muted"
            }`}
          />
        ))}
      </div>
      <span className="text-caption-1 font-semibold text-text-secondary">
        {aggregate.ratingAverage.toFixed(1)} ({aggregate.ratingCount}{" "}
        {aggregate.ratingCount === 1 ? t("get.reviews_one") : t("get.reviews_other")})
      </span>
    </div>
  );
}

export function GetItReviewsView({ loading, reviews }: GetItReviewsViewProps) {
  const t = useT();

  return (
    <>
      <div className="px-4 pt-5 space-y-4">
        <div>
          <h3 className="text-headline text-text-primary font-bold">{t("get.reviews_title")}</h3>
          <p className="mt-1 text-footnote text-text-secondary">
            {t("get.reviews_prep_note")}
          </p>
        </div>

        {loading ? (
          <p className="text-footnote text-text-secondary py-2">{t("get.reviews_loading")}</p>
        ) : reviews.length === 0 ? (
          <div className="rounded-[20px] bg-fillSecondary px-4 py-8 text-center">
            <div className="mb-2 flex justify-center">
              <IconOrb tone="rating">
                <SolidIcon name="star" size={16} />
              </IconOrb>
            </div>
            <p className="text-subhead font-semibold text-text-secondary">{t("get.reviews_unavailable_title")}</p>
            <p className="text-caption-1 text-text-tertiary mt-1 max-w-[240px] mx-auto leading-relaxed">
              {t("get.reviews_unavailable_body")}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {reviews.map((review) => {
              const initials =
                review.reviewerName
                  .split(" ")
                  .map((name) => name[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase() || "?";

              return (
                <div key={review.id} className="rounded-[20px] bg-fillSecondary p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-fillPrimary text-footnote font-bold text-text-primary">
                        {review.reviewerAvatarUrl ? (
                          <img
                            src={review.reviewerAvatarUrl}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div>
                        <p className="text-footnote font-semibold text-text-primary leading-tight">
                          {review.reviewerName}
                        </p>
                        <div className="mt-0.5 flex items-center text-rating">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-3 w-3 ${
                                index < review.rating ? "fill-current" : "text-rating-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-caption-1 text-text-tertiary">
                      {new Date(review.createdAt).toLocaleDateString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {review.title && (
                    <p className="text-footnote font-semibold text-text-primary">{review.title}</p>
                  )}

                  {review.body && (
                    <p className="text-footnote text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {review.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
