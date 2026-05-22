// In a content script there's no document.currentScript, so webpack
// falls back to window.location.origin (the host page) when resolving
// chunk URLs. Chrome then blocks the cross-origin chunk fetch and
// every lazy import throws ChunkLoadError. Point it at the extension
// origin instead. Lives in its own file because imports are hoisted;
// must run before any module that touches webpack's runtime.
// eslint-disable-next-line no-undef, camelcase
__webpack_public_path__ = chrome.runtime.getURL("");
