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
      return { success: false, error: "Verbindung unterbrochen. Überprüft euer Signal und versucht es erneut." };
    }
    if (/\[firestore\/permission-denied\]/.test(msg)) {
      return { success: false, error: "Zugriff verweigert. Kontaktiert euren Koordinator." };
    }
    if (/\[firestore\/not-found\]/.test(msg)) {
      return { success: false, error: "Daten nicht gefunden. Die Mission wurde möglicherweise noch nicht eingerichtet." };
    }

    // Strip internal prefix: "[firestore/...] actual message" → "actual message"
    const stripped = msg.replace(/^\[[\w/]+\]\s*/, "");

    // Catch network-related messages that don't carry a Firebase error code
    // (e.g. fetch failures in Service Worker contexts, WebChannel transport errors).
    if (/offline|Connection failed|WebChannelConnection|Failed to fetch|network error/i.test(stripped)) {
      return { success: false, error: "Verbindung unterbrochen. Überprüft euer Signal und versucht es erneut." };
    }

    return { success: false, error: stripped || "Etwas ist schiefgelaufen. Bitte versucht es erneut." };
  }
  return { success: false, error: "Etwas ist schiefgelaufen. Bitte versucht es erneut." };
}
