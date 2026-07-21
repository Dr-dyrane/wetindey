import {
  NigeriaLogo,
  ChevronDown,
  Plus,
  Avatar,
  SearchField,
  CrossCategorySignalRail
} from "../imports/imports";
import type { useHomePage } from "../hooks/useHomePage";

type HomePageState = ReturnType<typeof useHomePage>;

type HomeSheetHeaderViewProps = Pick<
  HomePageState,
  | "t"
  | "activeCategory"
  | "setIsCategoryOpen"
  | "crossCategorySignals"
  | "handleCategoryChange"
  | "openReport"
  | "openProfile"
  | "sessionUser"
  | "resolvedSelfAvatarUrl"
  | "searchQuery"
  | "handleSearchChange"
  | "clearSearch"
>;

export function HomeSheetHeaderView({
  t,
  activeCategory,
  setIsCategoryOpen,
  crossCategorySignals,
  handleCategoryChange,
  openReport,
  openProfile,
  sessionUser,
  resolvedSelfAvatarUrl,
  searchQuery,
  handleSearchChange,
  clearSearch
}: HomeSheetHeaderViewProps) {
  return (
    <div className="flex flex-col gap-2.5 px-4 pt-0 pb-2.5">
      <div className="flex w-full items-center gap-1">
        <div className="flex shrink-0 items-center space-x-1.5">
          <NigeriaLogo className="h-7 w-7" />
          <button
            type="button"
            onClick={() => setIsCategoryOpen(true)}
            className="flex h-9 items-center text-text-primary active:scale-95 transition-all duration-instant text-[13px] font-bold"
          >
            <span className="flex h-[30px] items-center gap-0.5 rounded-[18px] bg-fillSecondary px-2.5 shadow-sm">
              <span>
                {activeCategory === "money"
                  ? "Aboki FX"
                  : (t as Record<string, string>).category_food || "Food"}
              </span>
              <ChevronDown className="h-3 w-3 text-text-secondary" />
            </span>
          </button>
        </div>

        <CrossCategorySignalRail
          signals={crossCategorySignals}
          onActivate={handleCategoryChange}
        />

        {/* Both actions present a sheet over this one rather than replacing
            its contents, so the search context stays put underneath. */}
        <div className="flex shrink-0 items-center gap-1">
          {activeCategory === "food" && (
            <button
              type="button"
              onClick={openReport}
              className="grid h-9 w-9 place-items-center text-text-primary
                         active:scale-90 transition-transform duration-instant"
              aria-label={t.report_price}
            >
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-fillSecondary shadow-sm">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={openProfile}
            className="grid h-11 w-11 place-items-center squircle-full
                       active:scale-90 transition-transform duration-instant"
            aria-label="Profile"
          >
            {/* The one piece of persistent recognition chrome in the app.
                Without a name it drew the anonymous silhouette forever, so
                signing in changed nothing anyone could see: you were
                recognised only inside the sheet you had to reopen to check.
                `||`, not `??`, email OTP mints users with name: "". */}
            <Avatar
              name={sessionUser ? sessionUser.name || sessionUser.email : undefined}
              url={resolvedSelfAvatarUrl}
              size={32}
            />
          </button>
        </div>
      </div>

      {activeCategory === "food" && (
        <SearchField
          value={searchQuery}
          onChange={handleSearchChange}
          onClear={clearSearch}
          placeholder={t.search_placeholder}
        />
      )}
    </div>
  );
}
