// Dev-only recorder logger, gated by window.SCREENITY_DEBUG_RECORDER (stripped from prod).
export const createDebugLogger = (prefix, enabled) => ({
  debug: (...args) => {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.log(prefix, ...args);
  },
  debugWarn: (...args) => {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.warn(prefix, ...args);
  },
  debugError: (...args) => {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.error(prefix, ...args);
  },
});
