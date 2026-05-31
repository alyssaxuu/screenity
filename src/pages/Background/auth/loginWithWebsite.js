import { getCurrentTab, sendMessageTab } from "../tabManagement";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const MAX_REFRESH_DEPTH = 2;

// MV3 SW fetch has no default timeout; cap so hung connections fall through to cached auth.
const AUTH_FETCH_TIMEOUT_MS = 15000;
const fetchWithTimeout = (url, opts = {}) => {
  // reject as AbortError so timeout-path callers handle this identically
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const err = new Error("auth-fetch-offline");
    err.name = "AbortError";
    return Promise.reject(err);
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort("auth-fetch-timeout"),
    AUTH_FETCH_TIMEOUT_MS,
  );
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

const recordSubscriptionLoss = async (reason, extra = {}) => {
  try {
    await chrome.storage.local.set({
      lastSubscriptionLoss: {
        ts: Date.now(),
        reason,
        ...extra,
      },
    });
  } catch {}
};

// force=true bypasses the prior-signals gate for cookie-refresh recovery.
// It does NOT override stayLoggedOut: explicit logout stays sticky.
export const loginWithWebsite = async (arg = {}) => {
  const _depth = typeof arg === "number" ? arg : Number(arg._depth) || 0;
  const force = typeof arg === "object" && arg !== null ? Boolean(arg.force) : false;
  if (!CLOUD_FEATURES_ENABLED) {
    return { authenticated: false, instantMode: false };
  }

  // Single storage IPC for the initial branch decision. The three
  // separate gets here added ~30-60ms of serial round-trips on the
  // start critical path; consolidating doesn't change semantics but
  // shaves a few ms off every recording start.
  const {
    stayLoggedOut,
    screenityToken,
    lastAuthCheck,
    instantMode,
    wasLoggedIn,
    hasSubscribedBefore,
    screenityUser,
  } = await chrome.storage.local.get([
    "stayLoggedOut",
    "screenityToken",
    "lastAuthCheck",
    "instantMode",
    "wasLoggedIn",
    "hasSubscribedBefore",
    "screenityUser",
  ]);

  // Only AUTH_SUCCESS from the website clears stayLoggedOut. Implicit paths
  // (record click, popup, tab update, action click) must not revive auth.
  if (stayLoggedOut) {
    return { authenticated: false, instantMode: false };
  }

  if (!screenityToken) {
    // gated on prior signals; force bypasses the gate.
    const hasPriorSignals =
      Boolean(wasLoggedIn) ||
      Boolean(hasSubscribedBefore) ||
      Boolean(screenityUser);
    const shouldTryRefresh = force || hasPriorSignals;
    if (shouldTryRefresh && _depth < MAX_REFRESH_DEPTH && API_BASE) {
      try {
        const refreshRes = await fetchWithTimeout(
          `${API_BASE}/auth/refresh`,
          { credentials: "include" },
        );
        if (refreshRes.ok) {
          const { token: newToken } = await refreshRes.json();
          if (newToken) {
            await chrome.storage.local.set({ screenityToken: newToken });
            return await loginWithWebsite({ _depth: _depth + 1, force });
          }
        }
        // only mark as subscription loss for users with prior-Pro evidence.
        if (hasPriorSignals) {
          await recordSubscriptionLoss("refresh-failed-no-token", {
            status: refreshRes.status,
            hadPriorSignals: true,
          });
        }
      } catch (refreshErr) {
        if (hasPriorSignals) {
          await recordSubscriptionLoss("refresh-threw", {
            err: String(refreshErr?.message || refreshErr).slice(0, 200),
            hadPriorSignals: true,
          });
        }
      }
    } else if (hasPriorSignals) {
      await recordSubscriptionLoss("no-token-no-refresh-allowed", {
        hadPriorSignals: true,
        depth: _depth,
      });
    }
    // Don't block the start path on this write; it's just a UI flag
    // that will get re-read on next mount.
    chrome.storage.local.set({ isLoggedIn: false });
    return { authenticated: false, instantMode: false };
  }

  const now = Date.now();
  const FRESH_FOR = 1000 * 60 * 60 * 4;
  let isTokenInvalid = false;

  if (lastAuthCheck && now - lastAuthCheck < FRESH_FOR) {
    const {
      screenityUser,
      isSubscribed,
      proSubscription,
      hasSubscribedBefore,
    } = await chrome.storage.local.get([
      "screenityUser",
      "isSubscribed",
      "proSubscription",
      "hasSubscribedBefore",
    ]);

    if (screenityUser) {
      // single write to avoid multiple onChanged events
      await chrome.storage.local.set({
        onboarding: false,
        isLoggedIn: true,
        wasLoggedIn: false,
        stayLoggedOut: false,
        ...(!instantMode
          ? {
              backgroundEffectsActive: false,
              backgroundEffect: "",
              fpsValue: "30",
            }
          : {}),
      });

      return {
        authenticated: true,
        user: screenityUser,
        subscribed: isSubscribed || false,
        proSubscription: proSubscription || null,
        hasSubscribedBefore: !!hasSubscribedBefore,
        cached: true,
        instantMode: instantMode || false,
      };
    }

    // fresh marker but missing user payload; force a verify call
    await chrome.storage.local.set({ lastAuthCheck: 0 });
  }

  try {
    const response = await fetchWithTimeout(`${API_BASE}/auth/verify`, {
      headers: {
        Authorization: `Bearer ${screenityToken}`,
      },
    });

    if (!response.ok) {
      isTokenInvalid = response.status === 401 || response.status === 403;
      throw new Error(`Token verify failed (${response.status})`);
    }

    const responseData = await response.json();
    const { subscribed, subscription, hasSubscribedBefore, ...user } =
      responseData;

    await chrome.storage.local.set({
      screenityUser: user,
      lastAuthCheck: now,
      isLoggedIn: true,
      wasLoggedIn: false,
      stayLoggedOut: false,
      isSubscribed: subscribed,
      proSubscription: subscription,
      hasSubscribedBefore: !!hasSubscribedBefore,
      pushToTalk: false,
      onboarding: false,
      showProSplash: false,
      ...(!instantMode
        ? {
            backgroundEffectsActive: false,
            backgroundEffect: "",
            fpsValue: "30",
          }
        : {}),
    });

    const { originalTabId } = await chrome.storage.local.get("originalTabId");

    if (originalTabId) {
      await chrome.storage.local.remove("originalTabId");

      chrome.tabs.update(originalTabId, { active: true });

      sendMessageTab(originalTabId, { type: "LOGIN_SUCCESS" });

      sendMessageTab(originalTabId, {
        type: "check-auth",
      });
    }

    return {
      authenticated: true,
      user,
      subscribed: !!subscribed,
      proSubscription: subscription,
      hasSubscribedBefore: !!hasSubscribedBefore,
      cached: false,
      instantMode: instantMode || false,
    };
  } catch (err) {
    if (isTokenInvalid) {
      if (_depth >= MAX_REFRESH_DEPTH) {
        console.warn(
          "[Auth] verify-after-refresh still failing; forcing logout to break loop",
        );
      } else {
        try {
          const refreshRes = await fetchWithTimeout(
            `${API_BASE}/auth/refresh`,
            { credentials: "include" },
          );
          if (refreshRes.ok) {
            const { token: newToken } = await refreshRes.json();
            await chrome.storage.local.set({ screenityToken: newToken });
            return await loginWithWebsite({ _depth: _depth + 1, force });
          }
        } catch (refreshErr) {
          console.error("❌ Refresh failed:", refreshErr.message);
        }
      }

      // refresh failed; full logout
      await chrome.storage.local.remove([
        "screenityToken",
        "screenityUser",
        "lastAuthCheck",
        "isSubscribed",
        "proSubscription",
      ]);
      await chrome.storage.local.set({ isLoggedIn: false });
      await recordSubscriptionLoss("token-invalid-refresh-failed", {
        depth: _depth,
      });
      return { authenticated: false, instantMode: false };
    }

    // transient error: keep existing auth state
    const {
      screenityUser,
      isSubscribed,
      proSubscription,
      hasSubscribedBefore,
    } = await chrome.storage.local.get([
      "screenityUser",
      "isSubscribed",
      "proSubscription",
      "hasSubscribedBefore",
    ]);

    if (screenityUser) {
      await chrome.storage.local.set({
        isLoggedIn: true,
        ...(!instantMode
          ? {
              backgroundEffectsActive: false,
              backgroundEffect: "",
              fpsValue: "30",
            }
          : {}),
      });

      return {
        authenticated: true,
        user: screenityUser,
        subscribed: !!isSubscribed,
        proSubscription: proSubscription || null,
        hasSubscribedBefore: !!hasSubscribedBefore,
        cached: true,
        instantMode: instantMode || false,
      };
    }

    await chrome.storage.local.set({ isLoggedIn: false });
    await recordSubscriptionLoss("verify-transient-no-cached-user", {
      err: String(err?.message || err).slice(0, 200),
    });
    return {
      authenticated: false,
      instantMode: instantMode || false,
      transient: true,
      error: err?.message || "auth-check-failed",
    };
  }
};
