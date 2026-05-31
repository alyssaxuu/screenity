// Skip getUserMedia at record start when the user has the mic off: gain-muting
// still wakes iPhone Continuity etc. Pure (unit-tested under tests/unit/).
export function shouldAcquireMicAtStart(data) {
  return Boolean(data && data.micActive === true);
}
