// Where the time between countdown end and recorder start went: the first time
// each start mark was reached, as ms offsets from the first mark, small enough
// for the uploaded diagnostic report.

const MAX_STAGES = 24;

export const createStartStageLog = () => {
  let stages = {};
  let order = [];
  return {
    note(stage, at = Date.now()) {
      if (typeof stage !== "string" || stage in stages || order.length >= MAX_STAGES) return;
      stages[stage] = at;
      order.push(stage);
    },
    reset() {
      stages = {};
      order = [];
    },
    build({ countdownEndAt = null, startedAt = Date.now() } = {}) {
      if (!order.length) return null;
      const first = stages[order[0]];
      const offsets = {};
      for (const name of order) offsets[name] = Math.max(0, Math.round(stages[name] - first));
      const lag = Number.isFinite(countdownEndAt) ? first - countdownEndAt : null;
      return {
        afterCountdownMs: lag !== null && lag >= 0 && lag < 10 * 60_000 ? Math.round(lag) : null,
        totalMs: Math.max(0, Math.round(startedAt - first)),
        stages: offsets,
      };
    },
  };
};
