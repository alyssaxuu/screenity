// The Stop broadcast can return no reply even though a recorder frame got it (another extension
// context answers first). Re-sending is out: the next take may be active by then and would be stopped.
// So an empty or not-ok reply is checked against `received`, the recorder's own report of a Stop, for
// a short grace. An error or silence for the whole window is final.
export const awaitStopAck = async (
  send,
  { timeoutMs = 3000, graceMs = 500, received = null } = {}
) => {
  let timer;
  let reply;
  try {
    reply = await Promise.race([
      send(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("stop-ack-timeout")),
          timeoutMs
        );
      }),
    ]);
  } catch (err) {
    return { acked: false, reply: undefined, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
  if (reply && reply.ok === true) return { acked: true, reply };
  const until = Date.now() + graceMs;
  while (received) {
    if (received()) return { acked: true, reply, viaReceipt: true };
    if (Date.now() >= until) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  return { acked: false, reply, error: "stop-no-ack" };
};
