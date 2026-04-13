// ============================================================
// eventBus.js — Minimal publish/subscribe event bus
//
// Decouples modules: instead of direct references between game
// systems, each module emits named events and subscribes to
// those it cares about.  This keeps the dependency graph flat.
//
// Usage:
//   EventBus.on('player:landed', ({x, z}) => { ... });
//   EventBus.emit('player:landed', { x: 3, z: 5 });
//   EventBus.off('player:landed', handler);
// ============================================================

const EventBus = (() => {
  /** @type {Object.<string, Function[]>} */
  const _listeners = {};

  return {
    /**
     * Subscribe to an event.
     * @param {string}   event   - Event name
     * @param {Function} handler - Callback receives the emitted payload
     */
    on(event, handler) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(handler);
    },

    /**
     * Unsubscribe a specific handler from an event.
     * Pass the exact same function reference used in on().
     */
    off(event, handler) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(h => h !== handler);
    },

    /**
     * Publish an event to all subscribers.
     * @param {string} event - Event name
     * @param {*}      data  - Arbitrary payload passed to each handler
     */
    emit(event, data) {
      if (!_listeners[event]) return;
      // Shallow-copy so a handler can safely call off() mid-iteration
      [..._listeners[event]].forEach(h => h(data));
    },

    /**
     * Remove ALL listeners (call when fully resetting game state).
     */
    clear() {
      Object.keys(_listeners).forEach(k => delete _listeners[k]);
    },
  };
})();
