import React from "react";
import {
  Settings,
  Flag,
  Bookmark,
  MapPin,
  TrendingUp,
  CircleHelp,
  UserRound,
  ModalSheet,
  ListRow,
  ListGroup,
  Image,
} from "../imports/imports";
import type { ProfileSheetProps, useProfileSheet } from "../hooks/useProfileSheet";
import { ProfileSignInView } from "./ProfileSignInView";
import "../styles/ProfileSheet.css";

export interface ProfileSheetViewProps extends ProfileSheetProps {
  sheet: ReturnType<typeof useProfileSheet>;
}

export function Avatar({ name, url, size = 32 }: { name?: string; url?: string | null; size?: number }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center squircle-full bg-fillPrimary text-text-primary overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt={name ?? "Avatar"}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : initials ? (
        <span className="text-subhead font-semibold">{initials}</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" aria-hidden>
          <circle cx="12" cy="8" r="3.5" fill="currentColor" opacity="0.55" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="currentColor" opacity="0.55" />
        </svg>
      )}
    </span>
  );
}

export function ProfileSheetView({
  open,
  onClose,
  onOpenSettings,
  onChangeArea,
  onOpenMyReports,
  onOpenReportProblem,
  onOpenAbout,
  onOpenManageProfile,
  currentAreaName,
  user,
  sheet,
}: ProfileSheetViewProps) {
  const {
    t,
    signedIn,
    profile,
    signIn,
    signingOut,
    signOutError,
    signOut,
  } = sheet;

  const displayName = user ? user.name || user.email : null;

  let identityName: string;
  let identitySub: string | null;
  if (user) {
    identityName = user.name || user.email;
    identitySub = user.name ? user.email : null;
  } else if (signIn.kind === "code") {
    if (signIn.delivery === "indeterminate") {
      identityName = signIn.email;
      identitySub = null;
    } else {
      identityName = t("auth.check_mail");
      identitySub = t("auth.sent_to", { email: signIn.email });
    }
  } else if (signIn.kind === "verified") {
    identityName = t("auth.code_accepted");
    identitySub = signIn.email;
  } else {
    identityName = t("profile.signed_out_name");
    identitySub = null;
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={signedIn ? t("profile.title_signed_in") : t("profile.title_signed_out")}
      size="form"
    >
      <div className="space-y-6 py-3">
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <Avatar name={displayName ?? undefined} url={profile?.avatarUrl} size={64} />
          <div className="min-w-0 max-w-full">
            <p className="truncate text-title-3 font-semibold text-text-primary">{identityName}</p>
            {identitySub && (
              <p className="break-words text-subhead text-text-secondary">{identitySub}</p>
            )}
          </div>
        </div>

        {!signedIn && <ProfileSignInView sheet={sheet} />}

        {signedIn && (
          <ListGroup>
            <ListRow
              icon={<UserRound />}
              label={t("profile.manage")}
              onClick={() => {
                onClose();
                onOpenManageProfile();
              }}
            />
          </ListGroup>
        )}

        <ListGroup>
          <ListRow
            icon={<TrendingUp />}
            label={t("profile.my_reports")}
            onClick={() => {
              onClose();
              onOpenMyReports();
            }}
          />
          <ListRow
            icon={<Bookmark />}
            label={t("profile.saved_markets")}
            disabled
            onClick={() => {}}
          />
          <ListRow
            icon={<MapPin />}
            label={t("profile.change_area")}
            detail={currentAreaName}
            onClick={() => {
              onClose();
              onChangeArea();
            }}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={<Settings />}
            label={t("profile.settings")}
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          />
          <ListRow
            icon={<Flag />}
            label={t("profile.report_problem")}
            onClick={() => {
              onClose();
              onOpenReportProblem();
            }}
          />
          <ListRow
            icon={<CircleHelp />}
            label={t("profile.about")}
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
          />
        </ListGroup>

        {signedIn && (
          <div className="space-y-1.5">
            <ListGroup>
              <ListRow
                label={t("auth.sign_out")}
                chevron={false}
                disabled={signingOut}
                onClick={() => void signOut()}
              />
            </ListGroup>
            {signOutError && (
              <p role="alert" className="px-4 text-footnote text-status-unavailable">
                {t(signOutError)}
              </p>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
