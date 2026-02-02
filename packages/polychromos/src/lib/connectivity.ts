export type ConnectivityState = "online" | "offline" | "unknown";

let currentState: ConnectivityState = "unknown";
let lastCheck = 0;
const CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Check connectivity by making a HEAD request to the Convex URL.
 * Returns the current connectivity state.
 */
export async function checkConnectivity(
  convexUrl: string,
): Promise<ConnectivityState> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    await fetch(convexUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    currentState = "online";
  } catch {
    currentState = "offline";
  }

  lastCheck = Date.now();
  return currentState;
}

/**
 * Get the current connectivity state without making a new request.
 */
export function getConnectivityState(): ConnectivityState {
  return currentState;
}

/**
 * Check if enough time has passed to warrant a new connectivity check.
 */
export function shouldRecheck(): boolean {
  return Date.now() - lastCheck > CHECK_INTERVAL;
}

/**
 * Reset connectivity state (useful for testing).
 */
export function resetConnectivityState(): void {
  currentState = "unknown";
  lastCheck = 0;
}
