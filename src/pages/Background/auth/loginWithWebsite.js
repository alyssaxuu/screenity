import { getCurrentTab, sendMessageTab } from "../tabManagement";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const loginWithWebsite = async () => {
  if (!CLOUD_FEATURES_ENABLED) {
    return { authenticated: false, instantMode: false };
  }
  const { screenityToken, lastAuthCheck, instantMode } =
    await chrome.storage.local.get([
      "screenityToken",
      "lastAuthCheck",
      "instantMode",
    ]);

  if (!screenityToken) {
    await chrome.storage.local.set({ isLoggedIn: false });
    return { authenticated: false, instantMode: false };
  }

  const now = Date.now();
  const FRESH_FOR = 1000 * 60 * 60 * 4; // 4 hours
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
      await chrome.storage.local.set({
        onboarding: false,
        isLoggedIn: true,
        wasLoggedIn: false,
      });

      const { originalTabId } = await chrome.storage.local.get("originalTabId");

      if (originalTabId) {
        chrome.tabs.update(originalTabId, { active: true });

        sendMessageTab(originalTabId, { type: "LOGIN_SUCCESS" });

        sendMessageTab(originalTabId, {
          type: "check-auth",
        });
      }

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

    // Cache is marked fresh but user payload is missing; force a verify call.
    await chrome.storage.local.set({ lastAuthCheck: 0 });
  }

  try {
    const response = await fetch(`${API_BASE}/auth/verify`, {
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
      isSubscribed: subscribed,
      proSubscription: subscription,
      hasSubscribedBefore: !!hasSubscribedBefore,
      pushToTalk: false,
      onboarding: false,
      showProSplash: false,
    });

    const { originalTabId } = await chrome.storage.local.get("originalTabId");

    if (originalTabId) {
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
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          credentials: "include",
        });
        if (refreshRes.ok) {
          const { token: newToken } = await refreshRes.json();
          await chrome.storage.local.set({ screenityToken: newToken });

          return await loginWithWebsite();
        }
      } catch (refreshErr) {
        console.error("❌ Refresh failed:", refreshErr.message);
      }

      // Token is invalid and refresh failed: perform full logout.
      await chrome.storage.local.remove([
        "screenityToken",
        "screenityUser",
        "lastAuthCheck",
        "isSubscribed",
        "proSubscription",
      ]);
      await chrome.storage.local.set({ isLoggedIn: false });
      return { authenticated: false, instantMode: false };
    }

    // Network/transient error: keep existing auth state instead of forcing logout.
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
      await chrome.storage.local.set({ isLoggedIn: true });
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
    return {
      authenticated: false,
      instantMode: instantMode || false,
      transient: true,
      error: err?.message || "auth-check-failed",
    };
  }
};
