import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { hasSeenOnboarding, markOnboardingSeen } from "./storage";

const CORE_KEY = "proPopupCore";
const CAMERA_KEY = "proCameraInfo";
const POPOVER_CLASS = "ScreenityOnboardingPopover onboarding-popover";
const DRIVER_STYLE_ID = "screenity-driver-onboarding-style";
const TOOLBAR_HELP_URL =
  "https://help.screenity.io/recording/how-to-hide-the-toolbar";
const IDLE_START_DELAY_MS = 420;

const STEP_IDS = {
  WELCOME: "welcome",
  TOOLBAR: "toolbar",
  CAMERA: "camera",
  INSTANT: "instant",
};

const TOOLBAR_SELECTORS = [
  "#pro-onboarding-recording-toolbar-root",
  "#pro-onboarding-recording-toolbar .ToolbarRoot",
  "#pro-onboarding-recording-toolbar",
  "#pro-onboarding-recording-toolbar-controls",
  ".react-draggable .ToolbarRoot",
];
const INSTANT_PRIMARY_SELECTORS = [
  "#pro-onboarding-instant-mode-toggle-row",
  "#pro-onboarding-instant-mode-field",
  "#pro-onboarding-instant-mode-toggle",
];
const INSTANT_FALLBACK_SELECTORS = [
  "#pro-onboarding-popup-container",
  ".popup-container",
];
const CAMERA_SELECTORS = [
  ".camera-page .camera-draggable",
  ".camera-draggable",
  ".camera-page",
];
const CONFLICT_SELECTORS = [
  ".AlertDialogContent",
  ".AlertDialogOverlay",
  ".countdown-overlay",
  ".countdown-circle",
  ".recording-countdown",
];
const START_CANCEL_EVENTS = ["mousedown", "click", "keydown"];

const DEBUG =
  typeof window !== "undefined" && Boolean(window.SCREENITY_DEBUG_ONBOARDING);

let activeDriver = null;
let activeRun = null;
let restoreRootStyle = null;
let pendingStartTimer = null;
let cancelPendingStartListeners = null;
let onboardingInProgress = false;
let pendingStartToken = 0;

const logDebug = (event, payload = {}) => {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.debug("[Screenity][Onboarding]", event, payload);
};

const getRoot = (context) => (context?.querySelector ? context : document);

const t = (key, fallback) => {
  try {
    return chrome.i18n.getMessage(key) || fallback;
  } catch {
    return fallback;
  }
};

const getOnboardingText = () => ({
  welcomeTitle: t(
    "proOnboardingWelcomeTitle",
    "Welcome to the Screenity Pro extension",
  ),
  welcomeDescription: t(
    "proOnboardingWelcomeDescription",
    "A few quick tips before you record.<br/>Auto-zooms only work for clicks inside <strong>Chrome tabs</strong>. You can still add zooms manually later.",
  ),
  toolbarTitle: t("proOnboardingToolbarTitle", "Recording toolbar & effects"),
  toolbarDescription: t(
    "proOnboardingToolbarDescription",
    "Use this toolbar for drawing, cursor effects, blur, and recording controls.<br/><br/><strong>This toolbar is included in the video</strong> unless you hide it.",
  ),
  cameraTitle: t("proOnboardingCameraTitle", "Camera is captured separately"),
  cameraDescription: t(
    "proOnboardingCameraDescription",
    "Your camera may <strong>hide or move to PiP</strong> while recording, that’s normal.<br/><br/>It’s captured separately so you can position it later.",
  ),
  instantTitle: t("proOnboardingInstantTitle", "Instant mode"),
  instantDescription: t(
    "proOnboardingInstantDescription",
    "Best for quick sharing with <strong>unlimited downloads</strong>.<br/><br/>Advanced layouts/editor options aren’t available in this mode.",
  ),
  doneBtnText: t("proOnboardingDone", "Got it"),
  nextBtnText: t("proOnboardingNext", "Next"),
  prevBtnText: t("proOnboardingBack", "Back"),
  learnMoreLabel: t("proOnboardingToolbarLearnMore", "Learn more"),
});

const find = (root, selector) => {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
};

const findFirst = (root, selectors = []) => {
  for (const selector of selectors) {
    const el = find(root, selector);
    if (el) return el;
  }
  return null;
};

const isElementVisible = (el) => {
  if (!el || !el.isConnected) return false;
  if (
    typeof el.getClientRects === "function" &&
    el.getClientRects().length === 0
  ) {
    return false;
  }
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
};

const waitForElement = async (root, selectors, timeoutMs = 1200) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = findFirst(root, selectors);
    if (isElementVisible(el)) return el;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return null;
};

const clearScheduledStart = () => {
  if (pendingStartTimer) {
    clearTimeout(pendingStartTimer);
    pendingStartTimer = null;
  }
  if (typeof cancelPendingStartListeners === "function") {
    cancelPendingStartListeners();
    cancelPendingStartListeners = null;
  }
};

const clearDriverUiState = (root) => {
  document.documentElement.classList.remove("screenity-driver-modal-step");
  document.documentElement.classList.remove("screenity-driver-active");
  setToolbarCloseVisible(root, false);
  if (typeof restoreRootStyle === "function") restoreRootStyle();
  restoreRootStyle = null;
};

const hasConflictSelectorsVisible = (root) => {
  for (const selector of CONFLICT_SELECTORS) {
    if (isElementVisible(find(root, selector))) return true;
    if (root !== document && isElementVisible(find(document, selector))) {
      return true;
    }
  }
  return false;
};

const hasBlockingFlags = (state = {}) =>
  Boolean(
    state.pendingRecording ||
      state.preparingRecording ||
      state.recording ||
      state.countdownActive ||
      state.isCountdownVisible,
  );

const shouldSkip = ({ root, popupOpen, isPro, isLoggedIn, state = {} }) => {
  if (!popupOpen || !isPro || !isLoggedIn) return true;
  if (document.hidden) return true;
  if (hasBlockingFlags(state)) return true;
  if (hasConflictSelectorsVisible(root)) return true;
  return false;
};

const isRecordingNow = async () => {
  try {
    const result = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "preparingRecording",
      "countdownActive",
      "isCountdownVisible",
    ]);
    return Boolean(
      result.recording ||
        result.pendingRecording ||
        result.preparingRecording ||
        result.countdownActive ||
        result.isCountdownVisible,
    );
  } catch {
    return false;
  }
};

const describeNode = (node) => {
  if (!node) return null;
  const rootNode = node.getRootNode?.();
  const rootType =
    rootNode === document
      ? "document"
      : rootNode?.host
      ? "shadow-root"
      : "other";
  let rect = null;
  try {
    const r = node.getBoundingClientRect();
    rect = { x: r.x, y: r.y, width: r.width, height: r.height };
  } catch {}
  return {
    tag: node.tagName,
    id: node.id || null,
    className: node.className || null,
    isConnected: Boolean(node.isConnected),
    rootType,
    parentTag: node.parentElement?.tagName || null,
    parentClass: node.parentElement?.className || null,
    rect,
  };
};

const getDriverDomSnapshot = () => {
  const overlay = document.querySelector(".driver-overlay");
  const stage = document.querySelector(".driver-stage");
  const popover = document.querySelector(".driver-popover");
  return {
    overlay: describeNode(overlay),
    stage: describeNode(stage),
    popover: describeNode(popover),
  };
};

const resolveStepElement = (step) => {
  const raw = step?.element;
  if (!raw) return null;
  if (typeof raw === "function") {
    try {
      return raw();
    } catch {
      return null;
    }
  }
  if (typeof raw === "string") {
    try {
      return document.querySelector(raw);
    } catch {
      return null;
    }
  }
  return raw;
};

const logStepState = (event, step, options) => {
  const state = options?.state || activeDriver?.getState?.() || {};
  const activeStep =
    step || state.activeStep || activeDriver?.getActiveStep?.();
  const target = resolveStepElement(activeStep);
  logDebug(event, {
    activeIndex: state.activeIndex ?? activeDriver?.getActiveIndex?.(),
    title: activeStep?.popover?.title || null,
    target: describeNode(target),
    targetVisible: isElementVisible(target),
    targetRootType:
      target?.getRootNode?.()?.host != null ? "shadow-root" : "document",
    driverDom: getDriverDomSnapshot(),
  });
};

const ensureDriverStyles = () => {
  if (document.getElementById(DRIVER_STYLE_ID)) return;
  // Driver computes coordinates in document viewport space.
  // Keeping driver DOM in document.body avoids shadow-root stage/popover drift.
  const style = document.createElement("style");
  style.id = DRIVER_STYLE_ID;
  style.textContent = `
    .driver-overlay { z-index: 2147483645 !important; }
    .driver-stage { z-index: 2147483646 !important; }
    .driver-popover.ScreenityOnboardingPopover,
    .ScreenityOnboardingPopover {
      z-index: 2147483647 !important;
      border-radius: 30px !important;
      max-width: 340px !important;
      background: var(--color-background, #f9fafb) !important;
      color: var(--color-text-primary, #1f2430) !important;
      font-family: "Satoshi-Medium", sans-serif !important;
      box-shadow: 0px 4px 30px rgba(30, 31, 37, 0.12) !important;
      padding: 20px !important;
      font-size: 14px !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-title,
    .ScreenityOnboardingPopover .driver-popover-title {
      font-size: 1rem !important;
      font-family: "Satoshi-Medium", sans-serif !important;
      font-weight: 500 !important;
      margin-bottom: 12px !important;
      color: var(--color-text-primary, #1f2430) !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-description,
    .ScreenityOnboardingPopover .driver-popover-description {
      font-size: 14px !important;
      font-family: "Satoshi-Medium", sans-serif !important;
      font-weight: 500 !important;
      color: var(--color-text-secondary, #667085) !important;
      line-height: 1.5 !important;
      margin-bottom: 18px !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-close-btn,
    .ScreenityOnboardingPopover .driver-popover-close-btn {
      display: none !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-description a,
    .ScreenityOnboardingPopover .driver-popover-description a {
      color: #3b82f6 !important;
      text-decoration: none !important;
      cursor: pointer !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-progress-text,
    .ScreenityOnboardingPopover .driver-popover-progress-text {
      font-size: 12px !important;
      font-family: "Satoshi-Medium", sans-serif !important;
      color: var(--color-text-secondary, #667085) !important;
      opacity: 0.7 !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns,
    .ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns {
      gap: 6px !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-next-btn,
    .driver-popover.ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-prev-btn,
    .ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-next-btn,
    .ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-prev-btn {
      border-radius: 30px !important;
      padding: 10px 14px !important;
      font-size: 14px !important;
      text-shadow: none !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-next-btn,
    .ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-next-btn {
      background-color: var(--color-primary, #3b82f6) !important;
      color: white !important;
      border: none !important;
    }
    .driver-popover.ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-prev-btn,
    .ScreenityOnboardingPopover .driver-popover-footer .driver-popover-navigation-btns .driver-popover-prev-btn {
      background-color: transparent !important;
      color: var(--color-text-primary, #1f2430) !important;
      border: 1px solid var(--color-border, #d0d5dd) !important;
    }
			/* Modal step: hide stage cutout + center popover */
.screenity-driver-modal-step .driver-stage,
.screenity-driver-modal-step .driver-stage-wrapper {
  display: none !important;
}

.screenity-driver-modal-step .driver-popover-arrow {
  display: none !important;
}

.screenity-driver-modal-step .driver-popover.ScreenityOnboardingPopover,
.screenity-driver-modal-step .ScreenityOnboardingPopover {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
}
	.screenity-driver-modal-step .driver-popover.ScreenityOnboardingPopover,
.screenity-driver-modal-step .ScreenityOnboardingPopover {
  max-width: 420px !important;
  padding: 26px !important;
}
	/* Welcome icon */
.screenity-driver-modal-step .screenity-welcome-emoji {
  font-size: 24px;
  line-height: 1;
  margin-bottom: 10px;
}
  `;
  document.head.appendChild(style);
};

const lowerRootContainerZIndex = (root) => {
  const container =
    find(root, "#screenity-root-container") ||
    root?.host ||
    document.getElementById("screenity-root-container");
  if (!container) return () => {};
  const prevValue = container.style.zIndex;
  const prevPriority = container.style.getPropertyPriority("z-index");
  container.style.setProperty("z-index", "10000", "important");
  return () => {
    if (prevValue) {
      container.style.setProperty("z-index", prevValue, prevPriority || "");
    } else {
      container.style.removeProperty("z-index");
    }
  };
};

const setToolbarCloseVisible = (root, visible) => {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(".toolbar-controls").forEach((node) => {
    if (visible) node.classList.add("open");
    else node.classList.remove("open");
  });
};

const buildWelcomeStep = (copy) => ({
  id: STEP_IDS.WELCOME,
  // No element => no cutout highlight (acts like a modal when centered in onPopoverRender)
  popover: {
    title: copy.welcomeTitle,
    showButtons: ["next"],
    description: copy.welcomeDescription,
  },
});

const buildToolbarStep = (element, copy) => ({
  id: STEP_IDS.TOOLBAR,
  element,
  popover: {
    title: copy.toolbarTitle,
    side: "top",
    align: "center",
    showButtons: ["previous", "next"],
    description: copy.toolbarDescription,
  },
});

const buildCameraStep = (element, copy) => ({
  id: STEP_IDS.CAMERA,
  element,
  popover: {
    title: copy.cameraTitle,
    side: "top",
    align: "center",
    showButtons: ["previous", "next"],
    description: copy.cameraDescription,
  },
});

const buildInstantStep = (element, copy) => ({
  id: STEP_IDS.INSTANT,
  element,
  popover: {
    title: copy.instantTitle,
    side: "left",
    align: "center",
    showButtons: ["previous", "next"],
    description: copy.instantDescription,
  },
});

const shouldMarkSeen = (abortReason) =>
  abortReason == null || abortReason === "dismissed";

const destroyActive = (abortReason = "external") => {
  if (!activeRun) return;
  if (!activeRun.abortReason) activeRun.abortReason = abortReason;
  if (!activeDriver) {
    clearDriverUiState(activeRun.root);
    if (typeof activeRun.stopObserver === "function") activeRun.stopObserver();
    activeRun = null;
    onboardingInProgress = false;
    return;
  }
  try {
    activeDriver.destroy();
  } catch {}
};

const setModalStep = (enabled) => {
  document.documentElement.classList.toggle(
    "screenity-driver-modal-step",
    enabled,
  );
};

const startBlockingObserver = ({ root, getState }) => {
  const observer = new MutationObserver(() => {
    if (!activeDriver) return;
    const runtimeState = getState?.() || {};
    if (
      hasConflictSelectorsVisible(root) ||
      hasBlockingFlags(runtimeState) ||
      document.hidden
    ) {
      destroyActive("conflict");
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  return () => observer.disconnect();
};

const addInteractionCancelListeners = (root, onCancel) => {
  const popup =
    find(root, "#pro-onboarding-popup-container") ||
    find(root, ".popup-container");
  const target = popup || document;
  const handler = (event) => {
    if (event.type === "keydown" && event.key === "Tab") return;
    onCancel();
  };
  START_CANCEL_EVENTS.forEach((eventName) => {
    target.addEventListener(eventName, handler, { capture: true });
  });
  return () => {
    START_CANCEL_EVENTS.forEach((eventName) => {
      target.removeEventListener(eventName, handler, { capture: true });
    });
  };
};

const resolveTourSteps = ({
  toolbarEl,
  cameraEl,
  instantEl,
  copy,
  includeCamera = false,
}) => {
  const steps = [buildWelcomeStep(copy)];

  if (isElementVisible(toolbarEl)) steps.push(buildToolbarStep(toolbarEl, copy));
  if (includeCamera && isElementVisible(cameraEl)) {
    steps.push(buildCameraStep(cameraEl, copy));
  }
  if (isElementVisible(instantEl)) steps.push(buildInstantStep(instantEl, copy));

  return steps;
};

const startDriver = ({ steps, root, getState, onFinish, copy }) => {
  if (!steps.length) return;
  ensureDriverStyles();
  restoreRootStyle = lowerRootContainerZIndex(root);
  document.documentElement.classList.add("screenity-driver-active");

  activeRun = {
    root,
    cameraStepShown: false,
    abortReason: null,
    stopObserver: startBlockingObserver({ root, getState }),
    onFinish,
  };

  const d = driver({
    allowClose: true,
    overlayClickBehavior: "close",
    showProgress: true,
    popoverOffset: 18,
    stagePadding: 12,
    popoverClass: POPOVER_CLASS,
    doneBtnText: copy.doneBtnText,
    nextBtnText: copy.nextBtnText,
    prevBtnText: copy.prevBtnText,
    steps,
    onCloseClick: () => {
      destroyActive("dismissed");
    },
    onHighlightStarted: (element, step) => {
      const isWelcome = step?.id === STEP_IDS.WELCOME;
      setModalStep(isWelcome);

      const isToolbarStep = step?.id === STEP_IDS.TOOLBAR;
      setToolbarCloseVisible(root, isToolbarStep);
    },
    onHighlighted: (element, step, options) => {
      if (step?.id === STEP_IDS.CAMERA && activeRun) {
        activeRun.cameraStepShown = true;
      }
      logStepState("highlighted", step, options);
    },
    onPopoverRender: (popover, options) => {
      const step = options?.state?.activeStep || {};

      if (step.id === STEP_IDS.WELCOME && popover?.title) {
        // Only insert once
        if (
          !popover.title.parentElement?.querySelector(
            ".screenity-welcome-emoji",
          )
        ) {
          const emoji = document.createElement("div");
          emoji.className = "screenity-welcome-emoji";
          emoji.textContent = "👋";
          popover.title.parentElement.insertBefore(emoji, popover.title);
        }
      }
      if (
        step.id === STEP_IDS.TOOLBAR &&
        popover?.description &&
        !popover.description.querySelector("a")
      ) {
        const desc = popover.description;
        desc.appendChild(document.createTextNode(" "));
        const link = document.createElement("a");
        link.href = TOOLBAR_HELP_URL;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = copy.learnMoreLabel;
        desc.appendChild(link);
      }

      logStepState("popover_render", options?.state?.activeStep, options);
    },
    onDestroyed: async (element, step, options) => {
      const run = activeRun;
      clearDriverUiState(root);
      if (run && typeof run.stopObserver === "function") run.stopObserver();

      activeDriver = null;
      activeRun = null;
      onboardingInProgress = false;

      logStepState("destroyed", step, options);
      run?.onFinish?.({
        cameraStepShown: Boolean(run?.cameraStepShown),
        shouldMarkSeen: shouldMarkSeen(run?.abortReason),
      });
    },
  });

  activeDriver = d;
  d.drive();
  logStepState("drive_started", steps[0], { state: d.getState?.() || {} });
};

export const runProPopupOnboardingIfNeeded = async ({
  rootContext = null,
  isPro = false,
  isLoggedIn = false,
  popupOpen = false,
  cameraEnabled = false,
  pendingRecording = false,
  preparingRecording = false,
  recording = false,
  countdownActive = false,
  isCountdownVisible = false,
  forceStart = false,
} = {}) => {
  const root = getRoot(rootContext);
  const state = {
    pendingRecording,
    preparingRecording,
    recording,
    countdownActive,
    isCountdownVisible,
  };
  const copy = getOnboardingText();

  if (!popupOpen || !isPro || !isLoggedIn) {
    clearScheduledStart();
    if (activeDriver) destroyActive("popup-closed");
    return;
  }

  if (
    shouldSkip({
      root,
      popupOpen,
      isPro,
      isLoggedIn,
      state,
    })
  ) {
    clearScheduledStart();
    if (
      activeDriver &&
      (hasBlockingFlags(state) || hasConflictSelectorsVisible(root))
    ) {
      destroyActive("conflict");
    }
    return;
  }

  if (await hasSeenOnboarding(CORE_KEY)) return;
  if (pendingStartTimer || onboardingInProgress || activeDriver) return;

  const startDelayMs = forceStart ? 0 : IDLE_START_DELAY_MS;
  const token = ++pendingStartToken;
  if (!forceStart) {
    cancelPendingStartListeners = addInteractionCancelListeners(root, () => {
      clearScheduledStart();
    });
  }

  pendingStartTimer = setTimeout(async () => {
    if (token !== pendingStartToken) return;
    clearScheduledStart();

    const latestSkip = shouldSkip({
      root,
      popupOpen,
      isPro,
      isLoggedIn,
      state,
    });
    if (latestSkip) return;
    if (await isRecordingNow()) return;
    if (await hasSeenOnboarding(CORE_KEY)) return;

    onboardingInProgress = true;

    const toolbarEl = await waitForElement(root, TOOLBAR_SELECTORS, 900);
    const cameraEl = await waitForElement(root, CAMERA_SELECTORS, 700);
    const instantPrimaryEl = await waitForElement(
      root,
      INSTANT_PRIMARY_SELECTORS,
      900,
    );
    const instantEl =
      instantPrimaryEl ||
      (await waitForElement(root, INSTANT_FALLBACK_SELECTORS, 250));

    const includeCamera =
      cameraEnabled &&
      !(await hasSeenOnboarding(CAMERA_KEY)) &&
      isElementVisible(cameraEl);

    const steps = resolveTourSteps({
      toolbarEl,
      cameraEl,
      instantEl,
      copy,
      includeCamera,
    });

    if (!steps.length) {
      onboardingInProgress = false;
      return;
    }

    startDriver({
      steps,
      root,
      copy,
      getState: () => state,
      onFinish: async ({ cameraStepShown, shouldMarkSeen }) => {
        if (!shouldMarkSeen) return;
        await markOnboardingSeen(CORE_KEY);
        if (includeCamera || cameraStepShown) {
          await markOnboardingSeen(CAMERA_KEY);
        }
      },
    });
  }, startDelayMs);
};

export const runProCameraOnboardingIfNeeded = async ({
  rootContext = null,
  isPro = false,
  isLoggedIn = false,
  popupOpen = false,
  cameraEnabled = false,
  pendingRecording = false,
  preparingRecording = false,
  recording = false,
  countdownActive = false,
  isCountdownVisible = false,
} = {}) => {
  const root = getRoot(rootContext);
  const state = {
    pendingRecording,
    preparingRecording,
    recording,
    countdownActive,
    isCountdownVisible,
  };
  const copy = getOnboardingText();

  if (
    shouldSkip({
      root,
      popupOpen,
      isPro,
      isLoggedIn,
      state,
    })
  ) {
    if (
      activeDriver &&
      (hasBlockingFlags(state) || hasConflictSelectorsVisible(root))
    ) {
      destroyActive("conflict");
    }
    return;
  }
  if (!cameraEnabled) return;
  if (await hasSeenOnboarding(CAMERA_KEY)) return;
  if (pendingStartTimer || onboardingInProgress || activeDriver) return;

  const cameraEl = await waitForElement(root, CAMERA_SELECTORS, 900);
  if (!isElementVisible(cameraEl)) return;

  setTimeout(() => {
    if (
      shouldSkip({
        root,
        popupOpen,
        isPro,
        isLoggedIn,
        state,
      })
    ) {
      return;
    }
    onboardingInProgress = true;
    startDriver({
      steps: [
        {
          id: STEP_IDS.CAMERA,
          element: cameraEl,
          popover: {
            title: copy.cameraTitle,
            side: "top",
            align: "center",
            showButtons: ["next"],
            description: copy.cameraDescription,
          },
        },
      ],
      root,
      copy,
      getState: () => state,
      onFinish: async ({ shouldMarkSeen }) => {
        if (!shouldMarkSeen) return;
        await markOnboardingSeen(CAMERA_KEY);
      },
    });
  }, 260);
};
