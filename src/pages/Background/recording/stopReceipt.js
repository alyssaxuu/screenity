// A recorder tells the SW it received a Stop. The SW's own sendMessage can
// come back with no reply even when a recorder frame answered it, so the Stop
// check also looks for this report.
let lastReceivedAt = 0;

export const noteStopReceived = () => {
  lastReceivedAt = Date.now();
};

export const stopReceivedSince = (since) => lastReceivedAt >= since;
