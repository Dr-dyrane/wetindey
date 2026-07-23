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
} from "../imports/imports";
import type { ProfileSheetProps, useProfileSheet } from "../hooks/useProfileSheet";
import { ProfileSignInView } from "./ProfileSignInView";
import { Avatar } from "./Avatar";

export { Avatar };
import "../styles/ProfileSheet.css";

export interface ProfileSheetViewProps extends ProfileSheetProps {
  sheet: ReturnType<typeof useProfileSheet>;
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
