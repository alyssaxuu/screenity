// An IDB take is read from its slot. Looking in OPFS for it would hand back an
// unrelated older recording, so only a ref that is not idb falls through to the
// OPFS pointer and directory scan.
export const downloadSource = (ref) => (ref?.backend === "idb" ? "idb" : "opfs");
