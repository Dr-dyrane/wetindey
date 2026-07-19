import { getImageProps } from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { authClient } from "@/lib/auth-client";
import { getMyProfile, type MyProfile } from "@/app/_actions/actions";
import {
  useLocationChrome,
  useLocationHydration,
  useFreshDeviceLocation,
  useLocationStore,
  type DeviceLocation,
  type LocationChrome
} from "@/core/state/locationStore";

interface UseLocationIdentityArgs {
  setCameraCenter: (coords: { lat: number; lng: number }) => void;
}

interface SessionUser {
  name: string;
  email: string;
}

interface UseLocationIdentityReturn {
  location: LocationChrome;
  searchOrigin: { lat: number; lng: number };
  sessionUser: SessionUser | null;
  userProfile: MyProfile | null;
  selfIdentity: {
    name: string;
    avatarUrl: string | null;
  } | null;
  locateError: string | null;
  dismissLocateError: () => void;
  setLocateError: (message: string | null) => void;
  refetchSession: ReturnType<typeof authClient.useSession>["refetch"];
  handleRecenter: (deviceLocation: DeviceLocation) => void;
}

export function useLocationIdentity({ setCameraCenter }: UseLocationIdentityArgs): UseLocationIdentityReturn {
  const locationHydrated = useLocationHydration();
  const location = useLocationChrome();

  const [locateError, setLocateError] = useState<string | null>(null);
  const dismissLocateError = useCallback(() => setLocateError(null), []);

  const browsingLocation = useLocationStore((s) => s.browsingLocation);
  const deviceLocation = useLocationStore((s) => s.deviceLocation);
  const freshDeviceLocation = useFreshDeviceLocation();
  const recordDeviceLocation = useLocationStore((s) => s.recordDeviceLocation);

  const initialBrowsingCameraApplied = useRef(false);

  useEffect(() => {
    if (!locationHydrated || initialBrowsingCameraApplied.current) return;
    initialBrowsingCameraApplied.current = true;
    setCameraCenter({
      lat: browsingLocation.lat,
      lng: browsingLocation.lng,
    });
  }, [
    browsingLocation.lat,
    browsingLocation.lng,
    locationHydrated,
    setCameraCenter,
  ]);

  useEffect(() => {
    if (deviceLocation && !freshDeviceLocation) {
      setLocateError(
        "Your last device location expired. Tap the recenter control to refresh it."
      );
    }
  }, [deviceLocation, freshDeviceLocation]);

  /**
   * Who the user is, if we know. NEVER a gate.
   *
   * Read on the CLIENT, not in a Server Component, and that is not a stylistic
   * choice: Neon's `getSession` writes a refreshed session cookie through an
   * UNGUARDED `ctx.setCookie`, and Next throws ReadonlyRequestCookiesError for a
   * cookie write in an RSC. It would pass every test while signed out (the write
   * is skipped when there are no cookies to set) and then 500 the whole map for
   * exactly the people we had just recognised. Server Actions may write cookies;
   * Server Components may not.
   *
   * `pending` is deliberately unused. This resolves after first paint and the
   * map must never wait on it, a shopper reading prices is not asked to sign in,
   * so signed-out IS the ready state, not a loading state. If the fetch fails,
   * `data` is null, which means "not recognised", the honest degradation, and
   * identical to the anonymous path the app is built around.
   */
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const sessionUser = useMemo(() => {
    const u = session?.user;
    if (!u) return null;

    // `name` is "" for anyone created by email OTP; ProfileSheet falls back to
    // the email rather than rendering an empty identity.
    return { name: u.name ?? "", email: u.email };
  }, [session]);

  const [userProfile, setUserProfile] = useState<MyProfile | null>(null);

  const selfIdentity = useMemo(
    () => {
      if (!sessionUser) return null;

      const avatarUrl = userProfile?.avatarUrl;
      let markerAvatarUrl: string | null = null;
      if (avatarUrl) {
        try {
          markerAvatarUrl = getImageProps({
            src: avatarUrl,
            alt: "",
            width: 64,
            height: 64
          }).props.src;
        } catch {
          // A stale or malformed stored URL must degrade to initials, not make
          // the map page fail while Next validates the optimizer source.
        }
      }

      return {
        name: sessionUser.name || sessionUser.email,
        // The map adapter owns a DOM <img>, not a Next <Image>. Send that image
        // through the same configured, same-origin optimizer as the visible
        // profile avatars; a raw Vercel Blob URL is outside the document's
        // img-src policy and therefore fails before it can cover the initials.
        avatarUrl: markerAvatarUrl
      };
    },
    [sessionUser, userProfile?.avatarUrl]
  );

  // Load the signed-in user's profile for their avatar.
  useEffect(() => {
    let cancelled = false;
    // Never let the previous account's avatar bridge an auth transition.
    setUserProfile(null);
    if (sessionUser) {
      void getMyProfile()
        .then((profile) => {
          if (!cancelled) setUserProfile(profile);
        })
        .catch(() => {
          // Initials remain the local fallback when profile loading fails.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session, sessionUser]);

  /**
   * The persisted browsing context. Every search, distance and "Nearest"
   * measures from here; it is not a physical-location claim.
   *
   * NOT `cameraCenter`, and the difference is not academic: tapping a result flies
   * the camera to that market, so a query keyed on `cameraCenter` would measure the
   * next search from the last shop you looked at rather than from you. Open rice,
   * tap a stall two streets away, go back and open beans, and "Nearest" would
   * quietly mean "nearest to that stall". The camera follows the position; the
   * position never follows the camera.
   */
  const searchOrigin = useMemo(
    () => ({ lat: browsingLocation.lat, lng: browsingLocation.lng }),
    [browsingLocation.lat, browsingLocation.lng]
  );

  const handleRecenter = useCallback(
    (deviceLocation: DeviceLocation) => {
      setLocateError(null);
      if (!recordDeviceLocation(deviceLocation)) {
        setLocateError(
          "A newer device location is already active. The older response was ignored."
        );
        return;
      }
      setCameraCenter({
        lat: deviceLocation.lat,
        lng: deviceLocation.lng,
      });
    },
    [recordDeviceLocation, setCameraCenter]
  );

  return {
    location,
    searchOrigin,
    sessionUser,
    userProfile,
    selfIdentity,
    locateError,
    dismissLocateError,
    setLocateError,
    refetchSession,
    handleRecenter,
  };
}
