import { createTab } from "./createTab";
import { focusTab } from "./focusTab";

const APP_BASE_URL = process.env.SCREENITY_APP_BASE;
const EDITOR_TAB_META_KEY = "editorTabMeta";

const toUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getAppOrigin = () => {
  const appUrl = toUrl(APP_BASE_URL);
  return appUrl?.origin || null;
};

export const parseEditorTargetUrl = (rawUrl) => {
  const url = toUrl(rawUrl);
  if (!url) return null;

  const appOrigin = getAppOrigin();
  if (!appOrigin || url.origin !== appOrigin) return null;

  const editorMatch = url.pathname.match(/^\/editor\/([^/]+)\/edit\/?$/);
  if (editorMatch?.[1]) {
    return {
      kind: "editor",
      projectId: editorMatch[1],
      origin: url.origin,
      href: url.href,
    };
  }

  const viewMatch = url.pathname.match(/^\/view\/([^/]+)\/?$/);
  if (viewMatch?.[1]) {
    return {
      kind: "view",
      projectId: viewMatch[1],
      origin: url.origin,
      href: url.href,
    };
  }

  return null;
};

const getTabUrl = (tab) => tab?.pendingUrl || tab?.url || null;

const getTabById = async (tabId) => {
  if (!Number.isInteger(tabId)) return null;
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
};

export const clearEditorTabReference = async (reason = "unknown", extra = {}) => {
  await chrome.storage.local.set({
    editorTab: null,
    [EDITOR_TAB_META_KEY]: null,
  });
  console.info("[Screenity][BG] Cleared editorTab reference", {
    reason,
    ...extra,
  });
};

export const setEditorTabReference = async ({
  tabId,
  tabUrl,
  source = "unknown",
  expectedProjectId = null,
}) => {
  if (!Number.isInteger(tabId)) {
    await clearEditorTabReference("set-editor-tab-invalid-id", {
      source,
      tabId,
    });
    return null;
  }

  const parsed = parseEditorTargetUrl(tabUrl);
  if (!parsed) {
    await clearEditorTabReference("set-editor-tab-invalid-url", {
      source,
      tabId,
      tabUrl,
    });
    return null;
  }

  if (expectedProjectId && expectedProjectId !== parsed.projectId) {
    await clearEditorTabReference("set-editor-tab-project-mismatch", {
      source,
      tabId,
      expectedProjectId,
      parsedProjectId: parsed.projectId,
      tabUrl,
    });
    return null;
  }

  const meta = {
    source,
    setAt: Date.now(),
    projectId: parsed.projectId,
    kind: parsed.kind,
    origin: parsed.origin,
    url: parsed.href,
  };

  await chrome.storage.local.set({
    editorTab: tabId,
    [EDITOR_TAB_META_KEY]: meta,
  });

  console.info("[Screenity][BG] Stored editorTab reference", {
    tabId,
    ...meta,
  });

  return { tabId, meta };
};

export const getValidatedEditorTab = async ({
  expectedProjectId = null,
  expectedKind = null,
  reason = "unknown",
}) => {
  const { editorTab, editorTabMeta } = await chrome.storage.local.get([
    "editorTab",
    EDITOR_TAB_META_KEY,
  ]);

  if (!Number.isInteger(editorTab)) {
    return { ok: false, reason: "missing-tab-id" };
  }

  const tab = await getTabById(editorTab);
  if (!tab?.id) {
    await clearEditorTabReference("validate-editor-tab-missing-tab", {
      reason,
      editorTab,
    });
    return { ok: false, reason: "tab-not-found" };
  }

  const tabUrl = getTabUrl(tab);
  const parsedUrl = parseEditorTargetUrl(tabUrl);
  if (!parsedUrl) {
    await clearEditorTabReference("validate-editor-tab-not-editor-url", {
      reason,
      editorTab,
      tabUrl,
    });
    return { ok: false, reason: "tab-not-editor-url" };
  }

  if (expectedProjectId && parsedUrl.projectId !== expectedProjectId) {
    await clearEditorTabReference("validate-editor-tab-project-mismatch", {
      reason,
      editorTab,
      expectedProjectId,
      parsedProjectId: parsedUrl.projectId,
      tabUrl,
    });
    return { ok: false, reason: "project-mismatch" };
  }

  if (expectedKind && parsedUrl.kind !== expectedKind) {
    await clearEditorTabReference("validate-editor-tab-kind-mismatch", {
      reason,
      editorTab,
      expectedKind,
      parsedKind: parsedUrl.kind,
      tabUrl,
    });
    return { ok: false, reason: "kind-mismatch" };
  }

  if (editorTabMeta?.projectId && editorTabMeta.projectId !== parsedUrl.projectId) {
    await clearEditorTabReference("validate-editor-tab-meta-project-mismatch", {
      reason,
      editorTab,
      metaProjectId: editorTabMeta.projectId,
      parsedProjectId: parsedUrl.projectId,
      tabUrl,
    });
    return { ok: false, reason: "meta-project-mismatch" };
  }

  if (editorTabMeta?.kind && editorTabMeta.kind !== parsedUrl.kind) {
    await clearEditorTabReference("validate-editor-tab-meta-kind-mismatch", {
      reason,
      editorTab,
      metaKind: editorTabMeta.kind,
      parsedKind: parsedUrl.kind,
      tabUrl,
    });
    return { ok: false, reason: "meta-kind-mismatch" };
  }

  return {
    ok: true,
    tab,
    tabUrl,
    parsedUrl,
    meta: editorTabMeta || null,
  };
};

export const resolveEditorTabForTarget = async ({
  targetUrl,
  expectedProjectId = null,
  expectedKind = null,
  reason = "unknown",
}) => {
  const parsedTarget = parseEditorTargetUrl(targetUrl);
  const projectId = expectedProjectId || parsedTarget?.projectId || null;
  const kind = expectedKind || parsedTarget?.kind || null;

  const existing = await getValidatedEditorTab({
    expectedProjectId: projectId,
    expectedKind: kind,
    reason,
  });

  if (existing.ok && existing.tab?.id) {
    const focused = await focusTab(existing.tab.id, {
      reason: `${reason}:reuse`,
      projectId,
      kind,
    });
    if (focused) {
      console.info("[Screenity][BG] Reusing validated editor tab", {
        reason,
        tabId: existing.tab.id,
        projectId,
        kind,
      });
      return { tabId: existing.tab.id, reused: true, opened: false };
    }
    console.warn("[Screenity][BG] Failed to focus validated editor tab", {
      reason,
      tabId: existing.tab.id,
      projectId,
      kind,
    });
  } else {
    console.info("[Screenity][BG] Stored editor tab not reusable", {
      reason,
      projectId,
      kind,
      validationReason: existing.reason,
    });
  }

  if (!targetUrl) {
    console.warn("[Screenity][BG] Cannot open fallback editor tab: missing URL", {
      reason,
      projectId,
      kind,
    });
    return { tabId: null, reused: false, opened: false };
  }

  const createdTab = await createTab(targetUrl, true, true);
  if (!createdTab?.id) {
    console.warn("[Screenity][BG] Failed to open fallback editor tab", {
      reason,
      targetUrl,
      projectId,
      kind,
    });
    return { tabId: null, reused: false, opened: false };
  }

  await setEditorTabReference({
    tabId: createdTab.id,
    tabUrl: getTabUrl(createdTab) || targetUrl,
    source: `fallback-open:${reason}`,
    expectedProjectId: projectId,
  });
  await focusTab(createdTab.id, {
    reason: `${reason}:opened`,
    projectId,
    kind,
  });

  console.info("[Screenity][BG] Opened fallback editor tab", {
    reason,
    tabId: createdTab.id,
    targetUrl,
    projectId,
    kind,
  });

  return { tabId: createdTab.id, reused: false, opened: true };
};
