// One take's policy state for CloudRecorder: the plan made at the click, the
// runtime, and what happens at the end. Stop, dismiss, restart and reset all
// go through here, so the loop never keeps ticking through the stop tail and a
// restart in the same frame starts clean. No React, no chrome.*; tested in
// tests/unit/adaptivePolicyTake.test.mjs
import { createPolicyRuntime } from "./adaptivePolicyRuntime.js";
import { createTrackApply } from "./adaptivePolicyApply.js";

export const createPolicyTake = ({
  createRuntime = createPolicyRuntime,
  recordEvent = null,
} = {}) => {
  let plan = null;
  let rt = null;
  let apply = null;
  let ended = false;
  let recorded = false;
  let micRecorded = false;

  const stopLoop = () => {
    try {
      rt?.stop?.();
    } catch {}
  };

  return {
    // Set at the click from planStart(). A plan that is off counts as none.
    setPlan(p) {
      plan = p?.enabled ? p : null;
    },
    plan: () => plan,
    isRunning: () => Boolean(rt?.enabled) && !ended,

    // Called once the take is live. Resolves once the start rung is in (at most
    // startWaitMs), so the camera encoder sizes itself against the capped track.
    async begin({
      sources,
      screenTrack,
      cameraTrack,
      stopCameraTracks,
      startWaitMs = 1000,
    }) {
      try {
        if (!plan || rt || ended) return false;
        apply = createTrackApply({
          screen: screenTrack,
          camera: cameraTrack,
          stopCameraTracks,
        });
        rt = createRuntime({
          config: plan.flags,
          startRung: plan.rung,
          startInputs: plan.startInputs,
          cameraOn: Boolean(cameraTrack?.()),
          sources,
          apply,
        });
        const started = rt.start();
        // Rung 0 touches no track, so there is nothing to wait for.
        if (!(plan.rung > 0)) return true;
        let t;
        await Promise.race([
          Promise.resolve(started).catch(() => {}),
          new Promise((r) => {
            t = setTimeout(r, startWaitMs);
          }),
        ]);
        clearTimeout(t);
        return true;
      } catch {
        return false;
      }
    },

    // Stop ticking and freeze the record. Idempotent. `record` writes the take's
    // marks to the device history; dismiss, restart and reset pass false: a take
    // that was thrown away says nothing about the machine.
    end({ record = true, micEnded = false } = {}) {
      try {
        stopLoop();
        if (!rt?.enabled) return;
        const steps = rt.record()?.stepCount || 0;
        if (ended) {
          // The mic can end during the stop tail, after the first end().
          if (recorded && micEnded && !micRecorded) {
            micRecorded = true;
            void recordEvent?.({
              micEnded: true,
              micEndedUnderLoad: steps > 0,
            });
          }
          return;
        }
        ended = true;
        if (!record) return;
        recorded = true;
        micRecorded = micEnded;
        if (steps > 0 || micEnded) {
          void recordEvent?.({
            heavyLoad: steps > 0,
            micEnded,
            micEndedUnderLoad: micEnded && steps > 0,
          });
        }
      } catch {}
    },

    // Back to the opening state; always stops the loop first. `restoreTracks`
    // puts the opening rates back (restart keeps the tracks), `keepPlan` keeps
    // the click's plan. Resolves with whether R4 stopped the camera.
    async reset({ restoreTracks = false, keepPlan = false } = {}) {
      stopLoop();
      const a = apply;
      const cameraWasStopped = Boolean(a?.cameraStopped?.());
      const original = a?.original?.() || null;
      if (restoreTracks && a) {
        try {
          await a.restore();
        } catch {}
      }
      if (!keepPlan) plan = null;
      rt = null;
      apply = null;
      ended = false;
      recorded = false;
      micRecorded = false;
      return { cameraWasStopped, original };
    },

    telemetry(deviceHistoryFallback = null) {
      try {
        if (!rt?.enabled) return {};
        return {
          degradation: rt.record(),
          deviceHistory: plan?.deviceHistory || deviceHistoryFallback,
        };
      } catch {
        return {};
      }
    },
    editorFacts() {
      try {
        return rt?.editorFacts?.() || null;
      } catch {
        return null;
      }
    },
  };
};
