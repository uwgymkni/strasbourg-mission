export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function err(error: unknown): ServiceResult<never> {
  if (error instanceof Error) {
    const msg = error.message;

    // Map Firebase error codes to student-friendly strings before stripping the prefix.
    // These codes appear inside the brackets: "[firestore/unavailable] ..."
    if (/\[firestore\/unavailable\]|\[firestore\/cancelled\]/.test(msg)) {
      return { success: false, error: "Connection lost. Check your signal and try again." };
    }
    if (/\[firestore\/permission-denied\]/.test(msg)) {
      return { success: false, error: "Access denied. Contact your coordinator." };
    }
    if (/\[firestore\/not-found\]/.test(msg)) {
      return { success: false, error: "Data not found. The mission may not be set up yet." };
    }

    // Strip internal prefix: "[firestore/...] actual message" → "actual message"
    const stripped = msg.replace(/^\[[\w/]+\]\s*/, "");

    // Catch network-related messages that don't carry a Firebase error code
    // (e.g. fetch failures in Service Worker contexts, WebChannel transport errors).
    if (/offline|Connection failed|WebChannelConnection|Failed to fetch|network error/i.test(stripped)) {
      return { success: false, error: "Connection lost. Check your signal and try again." };
    }

    return { success: false, error: stripped || "Something went wrong. Please try again." };
  }
  return { success: false, error: "Something went wrong. Please try again." };
}
