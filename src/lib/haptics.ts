/**
 * Tactile haptic feedback for PWAs.
 *
 * Safe: no-ops when navigator.vibrate is unavailable (iOS Safari, desktop).
 * On Android, it calls the native vibration hardware.
 */
export const haptics = {
  selection: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(8); // Very light tap for list select or detent tick
      }
    } catch {}
  },
  impact: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15); // Medium tap for button press
      }
    } catch {}
  },
  success: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 60, 15]); // Double tap for successful submission
      }
    } catch {}
  },
  error: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 100, 60]); // Warning vibration for errors
      }
    } catch {}
  }
};
