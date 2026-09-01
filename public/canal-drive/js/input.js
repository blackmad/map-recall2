// ============================================================
// INPUT MANAGER
// ============================================================
class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this._isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this._touchActive = false;
    this._viewport = null;
    this._dpad = null;
    this._padActive = false;
    this._touches = new Map();
    // The hint is a one-line "steer with the pad" nudge now, not a diagram of
    // an invisible scheme; the pad itself is the documentation.
    this._showTouchHint = this._isMobile;
    this._touchHintTimer = 6; // seconds to show hint
    this._suppressTapEnter = false;

    // Keyboard input
    window.addEventListener('keydown', e => {
      const target = e.target;
      if (target instanceof HTMLElement && (target.matches('input, textarea, select, button') || target.isContentEditable)) return;
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Minus','Equal','NumpadAdd','NumpadSubtract','Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      const target = e.target;
      if (target instanceof HTMLElement && (target.matches('input, textarea, select, button') || target.isContentEditable)) return;
      this.keys[e.code] = false;
    });

    // Touch input (mobile)
    if (this._isMobile) {
      this._setupTouch();
    }
  }

  /** Called by Game._resize: the pad's geometry follows the logical canvas. */
  setViewport(viewport) {
    this._viewport = viewport;
    this._dpad = window.CanalRecallUi.dpadLayout(viewport);
  }

  /** The pad rectangle, for the renderer and for the camera-pan gesture, which
   *  must not steal touches that belong to the controls. */
  get dpad() { return this._dpad || null; }

  /** Logical canvas coordinates for a touch. The canvas is CSS-scaled, so
   *  client coordinates are not canvas coordinates. */
  _canvasPoint(touch, canvas) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: (touch.clientX - rect.left) * CANVAS_W / rect.width,
      y: (touch.clientY - rect.top) * CANVAS_H / rect.height,
    };
  }

  // Driving used to be an invisible gesture: the left half of the screen
  // steered and applied throttle, the right half was gas above and brake
  // below. It could not be discovered, it forced the throttle on whenever you
  // steered, and it covered the same pixels as the camera-pan drag, so panning
  // the map also drove the boat.
  //
  // Now a drawn d-pad owns its own rectangle and nothing else. Touches outside
  // it are left alone for the pan gesture.
  _setupTouch() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    this._touches = new Map();

    const processTouches = () => {
      const ui = window.CanalRecallUi;
      const points = [...this._touches.values()];
      const pressed = ui.dpadKeysAt(points, this._dpad);
      // Auto-throttle: the vehicle rolls forward unless the player brakes, so
      // a learner spends their attention on the city rather than on a pedal.
      const keys = this._padHasFocus(points) ? ui.applyAutoThrottle(pressed) : ui.noKeys();
      this.keys['ArrowUp'] = keys.ArrowUp;
      this.keys['ArrowDown'] = keys.ArrowDown;
      this.keys['ArrowLeft'] = keys.ArrowLeft;
      this.keys['ArrowRight'] = keys.ArrowRight;
      this._padActive = ui.isInsideDpad(points[0] || { x: -1, y: -1 }, this._dpad)
        || points.some(point => ui.isInsideDpad(point, this._dpad));
    };

    canvas.addEventListener('touchstart', (e) => {
      let claimed = false;
      for (const touch of e.changedTouches) {
        const point = this._canvasPoint(touch, canvas);
        if (window.CanalRecallUi.isInsideDpad(point, this._dpad)) {
          this._touches.set(touch.identifier, point);
          claimed = true;
        }
      }
      // Only swallow the gesture when it is ours; otherwise the map keeps its
      // pan and pinch.
      if (claimed) e.preventDefault();
      this._touchActive = true;
      this._showTouchHint = false;
      // A tap restarts the finished screen. It must not fire while driving,
      // where it used to press Enter on every single touch.
      if (!claimed && !this._suppressTapEnter) {
        this.justPressed['Enter'] = true;
        this.keys['Enter'] = true;
      }
      processTouches();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      let claimed = false;
      for (const touch of e.changedTouches) {
        if (!this._touches.has(touch.identifier)) continue;
        this._touches.set(touch.identifier, this._canvasPoint(touch, canvas));
        claimed = true;
      }
      if (claimed) e.preventDefault();
      processTouches();
    }, { passive: false });

    const release = (e) => {
      for (const touch of e.changedTouches) this._touches.delete(touch.identifier);
      if (this._touches.size === 0) this._touchActive = false;
      processTouches();
      this.keys['Enter'] = false;
    };
    canvas.addEventListener('touchend', release, { passive: false });
    canvas.addEventListener('touchcancel', release, { passive: false });
  }

  /** A tap on the map restarts a finished route; while driving it must not. */
  setTapRestartEnabled(enabled) { this._suppressTapEnter = !enabled; }

  /** True while at least one touch is on the pad. */
  _padHasFocus(points) {
    return points.some(point => window.CanalRecallUi.isInsideDpad(point, this._dpad));
  }

  /** Which directions are lit, for drawing the pad. */
  get padKeys() {
    return window.CanalRecallUi.dpadKeysAt([...(this._touches?.values() ?? [])], this._dpad);
  }

  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }

  clear() {
    this.justPressed = {};
    if (this._showTouchHint && this._touchHintTimer > 0) {
      this._touchHintTimer -= 1 / 60;
      if (this._touchHintTimer <= 0) this._showTouchHint = false;
    }
  }

  get isMobile() { return this._isMobile; }
  get showTouchHint() { return this._showTouchHint; }
}
