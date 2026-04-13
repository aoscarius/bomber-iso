// ============================================================
// dialogueScript.js — Per-level dialogue trigger runner (i18n-aware)
//
// Does NOT store the text itself — all text lives in i18n.js.
// This module reads I18n.getScripts() on each loadLevel() call,
// so language changes take effect at the next level load.
// ============================================================

const DialogueScript = (() => {

  let currentId  = null;
  let stepFired  = {};    // `levelId_step_N` → bool
  let eventFired = {};    // `levelId_eventName` → bool
  let handles    = {};    // EventBus handler references for cleanup

  // ── Lifecycle ─────────────────────────────────────────────

  /**
   * Load the dialogue script for a level.
   * Reads current-language scripts from I18n.getScripts().
   * @param {number|string} levelId
   */
  function loadLevel(levelId) {
    unload();
    currentId  = levelId;
    stepFired  = {};
    eventFired = {};

    const script = I18n.getLevelScripts(levelId);
    if (!script) return;

    // Show intro after delay
    if (script.intro) {
      const delay = script.introDelay || 1200;
      setTimeout(() => {
        DialoguePanel.show({
          speaker: script.intro.speaker || 'amica',
          lines:   I18n.getLocalized(script.intro.lines),
          onDone:  () => {
            // Chain introContinue if present
            if (script.introContinue) {
              DialoguePanel.show({
                speaker: script.introContinue.speaker || 'amica',
                lines:   I18n.getLocalized(script.introContinue.lines),
              });
            }
          },
        });
      }, delay);
    }

    // Wire event cues
    if (script.events) {
      Object.entries(script.events).forEach(([ev, cue]) => {
        const key = `${levelId}_${ev}`;
        const handler = (data) => {
          if (cue.once && eventFired[key]) return;
          if (!cue.condition(data)) return;
          if (cue.once) eventFired[key] = true;
          setTimeout(() => {
            DialoguePanel.enqueue({ speaker: 'amica', lines: I18n.getLocalized(cue.lines) });
          }, 500);
        };
        EventBus.on(ev, handler);
        handles[key] = { ev, handler };
      });
    }
  }

  /**
   * Called by gameLogic every step — fires step-count-based cues.
   * @param {number} stepCount
   */
  function onStep(stepCount) {
    const script = I18n.getLevelScripts(currentId);
    if (!script?.stepCues) return;

    script.stepCues.forEach((cue, i) => {
      const key = `${currentId}_step_${i}`;
      if (!stepFired[key] && stepCount >= cue.steps) {
        stepFired[key] = true;
        setTimeout(() => {
          DialoguePanel.enqueue({ speaker: 'amica', lines: I18n.getLocalized(cue.lines) });
        }, 600);
      }
    });
  }

  /** Remove all event listeners registered for the current level. */
  function unload() {
    Object.values(handles).forEach(({ ev, handler }) => EventBus.off(ev, handler));
    handles   = {};
    currentId = null;
  }

  return { loadLevel, onStep, unload };
})();
