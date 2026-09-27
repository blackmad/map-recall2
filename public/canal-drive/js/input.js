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
    this._stickTouch = null;
    // The hint is a one-line "steer with the pad" nudge now, not a diagram of
    // an invisible scheme; the pad itself is the documentation.
    this._showTouchHint = this._isMobile;
    this._touchHintTimer = 6; // seconds to show hint
    this._suppressTapEnter = false;

    // Keyboard input. Form fields keep their own shortcuts while they are the
    // real focus target; a leftover focus on a hidden quiz input or a settings
    // gear button must not swallow Enter/Esc on the finish card.
    window.addEventListener('keydown', e => {
      if (this._shouldIgnoreKeyboardTarget(e.target)) return;
      // The knowledge screen can open mid-ride; while it is up it owns the
      // keyboard (its own Escape closes it, not the settings under it).
      if (document.getElementById('knowledge-review')) return;
      // Tab toggles the minimap while driving, but it is also the only way a
      // keyboard moves between buttons. It used to be swallowed everywhere, so
      // focus stuck on the first control of setup and the knowledge screen.
      if (e.code === 'Tab' && this._domOwnsTab(e.target)) return;
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Escape','Minus','Equal','NumpadAdd','NumpadSubtract','Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      if (this._shouldIgnoreKeyboardTarget(e.target)) return;
      this.keys[e.code] = false;
    });

    // Touch input (mobile)
    if (this._isMobile) {
      this._setupTouch();
    }
  }

  /**
   * True when the event target is an editable field that should keep the key.
   * Buttons are excluded: focus often sticks on the settings gear or a quiz
   * choice after the panel closes, and Enter/Esc must still drive the game.
   */
  _shouldIgnoreKeyboardTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (!target.matches('input, textarea, select')) return false;
    // A focused field inside a display:none prompt still receives events;
    // treat that as abandoned focus so the game can hear Enter/Esc again.
    let node = target;
    while (node) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  /** True when an HTML surface is up (setup, knowledge review, a panel, the
   *  quiz) or focus sits on a control: then Tab is the browser's. */
  _domOwnsTab(target) {
    const body = document.body;
    if (body.classList.contains('setup-open')) return true;
    if (document.querySelector('.knowledge-review')) return true;
    for (const panel of document.querySelectorAll('.utility-panel, #canal-prompt')) {
      if (window.getComputedStyle(panel).display !== 'none') return true;
    }
    return target instanceof HTMLElement && target !== body && target.id !== 'gameCanvas';
  }

  /** Called by Game._resize: the pad's geometry follows the logical canvas. */
  setViewport(viewport) {
    this._viewport = viewport;
    this._dpad = window.CanalRecallUi.dpadLayout(viewport);
  }

  /** The stick's activation zone, for the renderer and for the camera-pan
   *  gesture, which must not steal touches that belong to the controls. */
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

  // Driving used to be an invisible gesture, then a binary 3×3 d-pad. The pad
  // made due east/west unreachable in absolute mode (auto-throttle turned
  // "right" into right+up) and dropped the thumb the moment it slid off the
  // edge. Now the pad's rectangle is only the *activation zone* of an analog
  // stick: the origin floats under the thumb, and the touch stays captured
  // until it lifts, wherever it wanders. Touches that start outside the zone
  // are left alone for the pan gesture.
  _setupTouch() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    this._stickTouch = null; // { id, origin, point }

    canvas.addEventListener('touchstart', (e) => {
      let claimed = false;
      for (const touch of e.changedTouches) {
        if (this._stickTouch) break;
        const point = this._canvasPoint(touch, canvas);
        if (window.CanalRecallUi.isInsideDpad(point, this._dpad)) {
          this._stickTouch = { id: touch.identifier, origin: point, point };
          claimed = true;
        }
      }
      // Only swallow the gesture when it is ours; otherwise the map keeps its
      // pan and pinch.
      if (claimed) e.preventDefault();
      this._touchActive = true;
      // A quick tap can start and end between two frames; remember it.
      this._touchedThisFrame = true;
      if (claimed) this._showTouchHint = false;
      // A tap restarts the finished screen. It must not fire while driving,
      // where it used to press Enter on every single touch.
      if (!claimed && !this._suppressTapEnter) {
        this.justPressed['Enter'] = true;
        this.keys['Enter'] = true;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (!this._stickTouch) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier !== this._stickTouch.id) continue;
        this._stickTouch.point = this._canvasPoint(touch, canvas);
        e.preventDefault();
      }
    }, { passive: false });

    const release = (e) => {
      for (const touch of e.changedTouches) {
        if (this._stickTouch && touch.identifier === this._stickTouch.id) this._stickTouch = null;
      }
      if (e.touches.length === 0) this._touchActive = false;
      this.keys['Enter'] = false;
    };
    canvas.addEventListener('touchend', release, { passive: false });
    canvas.addEventListener('touchcancel', release, { passive: false });
  }

  /** A tap on the map restarts a finished route; while driving it must not. */
  setTapRestartEnabled(enabled) { this._suppressTapEnter = !enabled; }

  /** The touch id the stick owns, so the pan gesture can ignore it even after
   *  the thumb has wandered out of the zone. */
  get stickTouchId() { return this._stickTouch ? this._stickTouch.id : null; }

  /** True while a thumb is on the stick (even inside the dead zone). */
  get stickHeld() { return !!this._stickTouch; }

  /** Screen-space deflection, or null when idle or inside the dead zone. */
  get stick() {
    if (!this._stickTouch || !this._dpad) return null;
    const ui = window.CanalRecallUi;
    return ui.stickVector(this._stickTouch.origin, this._stickTouch.point, ui.stickRadius(this._dpad));
  }

  /** What the HUD draws: the floating origin and thumb, or null when idle. */
  get stickView() {
    if (!this._stickTouch || !this._dpad) return null;
    const ui = window.CanalRecallUi;
    const radius = ui.stickRadius(this._dpad);
    return {
      origin: this._stickTouch.origin,
      point: this._stickTouch.point,
      radius,
      vector: ui.stickVector(this._stickTouch.origin, this._stickTouch.point, radius),
    };
  }

  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }

  clear() {
    this.justPressed = {};
    this._touchedThisFrame = false;
    if (this._showTouchHint && this._touchHintTimer > 0) {
      this._touchHintTimer -= 1 / 60;
      if (this._touchHintTimer <= 0) this._showTouchHint = false;
    }
  }

  /** Anything the player did this frame: a key edge, a touch, the stick.
   *  The start-of-ride flight uses it as "skip". */
  get anyInput() {
    return this._touchActive || this._touchedThisFrame || !!this._stickTouch
      || Object.keys(this.justPressed).length > 0;
  }

  get isMobile() { return this._isMobile; }
  get showTouchHint() { return this._showTouchHint; }
}
