// ============================================================
// PLAYER CAR
// ============================================================
class PlayerCar extends Car {
  constructor(x, y, angle) {
    super(x, y, angle, COLORS.player, 'PLAYER');
    this.controlMode = 'relative';
  }
  // Touch drives through an analog stick (input.stick); the keyboard keeps
  // its arrows. Absolute mode is screen-relative in both: the pointed
  // direction is rotated by the camera, so "right" is right on screen whether
  // the map is north-up or turned. `camera` is attached by the route setup.
  handleInput(input) {
    const ui = window.CanalRecallUi;
    this._headingTarget = null;
    this._cruiseFraction = null;
    this._stickBraking = false;
    this._stickHardSteer = false;
    this._pivot = 0;
    const wantedTurnAround = this._turnAroundHeld;
    this._turnAroundHeld = false;
    this.handbrake = input.isDown('Space');
    const keyboard = {
      ArrowUp: input.isDown('ArrowUp') || input.isDown('KeyW'),
      ArrowDown: input.isDown('ArrowDown') || input.isDown('KeyS'),
      ArrowLeft: input.isDown('ArrowLeft') || input.isDown('KeyA'),
      ArrowRight: input.isDown('ArrowRight') || input.isDown('KeyD'),
    };
    const stickHeld = !!input.stickHeld;
    const stick = stickHeld ? input.stick : null;
    const rotation = (this.camera && this.camera.rotation) || 0;

    if (this.controlMode === 'absolute') {
      let command = null;
      if (stick) command = ui.absoluteCommand(stick, rotation);
      else {
        const screenAngle = ui.keysScreenAngle(keyboard);
        if (screenAngle != null) command = { targetAngle: ui.screenToWorldAngle(screenAngle, rotation), speedFraction: 1 };
      }
      this.steerInput = 0;
      this.brake = 0;
      if (command) {
        this._headingTarget = command.targetAngle;
        this._cruiseFraction = command.speedFraction;
      } else {
        this.throttle = 0;
      }
      return;
    }

    if (stickHeld) {
      const command = ui.relativeCommand(stick);
      this.steerInput = command.steer;
      this.brake = command.brake;
      this.throttle = 0;
      this._cruiseFraction = command.brake > 0 ? null : command.speedFraction;
      this._stickBraking = command.brake > 0;
      this._stickHardSteer = Math.abs(command.steer) > 0.6;
      this._pivot = command.pivot;
      // One swing per pull: the stick must come off "back" to arm another.
      this._turnAroundHeld = command.turnAround;
      if (command.turnAround && !wantedTurnAround) this._turnAroundArmed = true;
      if (!command.turnAround) this._turnAroundArmed = false;
      return;
    }
    this._turnAroundArmed = false;
    this.throttle = keyboard.ArrowUp ? 1 : 0;
    this.brake = keyboard.ArrowDown ? 1 : 0;
    this.steerInput = 0;
    if (keyboard.ArrowLeft) this.steerInput = -1;
    if (keyboard.ArrowRight) this.steerInput = 1;
  }

  update(dt, track) {
    const ui = window.CanalRecallUi;
    const nearestRoad = (angle) => (track && track.isOpenTrack && track.getNearestRoad
      ? track.getNearestRoad(this.x, this.y, angle)
      : null);
    // Relative stick pulled straight back and held: once slow, swing round
    // along the street on the spot (see touchControls.relativeCommand).
    if (this._turnAroundArmed && this._uTurnHeading == null && Math.abs(this.speed) < ui.TURN_AROUND_MAX_SPEED) {
      const road = nearestRoad(this.angle);
      this._uTurnHeading = ui.turnAroundHeading(this.angle, road ? road.angle : null);
      this._turnAroundArmed = false;
    }
    if (this._uTurnHeading != null) {
      this.angle = ui.turnToward(this.angle, this._uTurnHeading, ui.TURN_AROUND_RATE * dt);
      this.speed = 0; this.vx = 0; this.vy = 0; this.throttle = 0; this.steerInput = 0;
      if (Math.abs(ui.normalizeAngle(this._uTurnHeading - this.angle)) < 1e-3) this._uTurnHeading = null;
    }
    let cruise = this._cruiseFraction;
    // Hard sideways while nearly stopped (stuck at a kerb, or waiting at a
    // junction): swing on the spot rather than rolling forward into the kerb.
    if (this._pivot && this._uTurnHeading == null && Math.abs(this.speed) < ui.TURN_AROUND_MAX_SPEED) {
      this.angle = ui.normalizeAngle(this.angle + this._pivot * ui.PIVOT_RATE * dt);
      this.speed = 0; this.vx = 0; this.vy = 0; this.steerInput = 0;
      cruise = null; this.throttle = 0;
    }
    if (this._headingTarget != null) {
      // Follow the street/canal when the pointed direction is close to it, so
      // a slanted street does not mean steering into the kerb.
      const road = nearestRoad(this._headingTarget);
      const heading = ui.assistedHeading(this._headingTarget, road ? road.angle : null);
      // Pointing back down the street turns on the spot instead of arcing
      // into the kerb, where the road guard would straighten it again.
      if (cruise != null) cruise *= ui.alignmentSpeedScale(heading - this.angle);
      this.angle = ui.turnToward(this.angle, heading, ui.ABSOLUTE_TURN_RATE * dt);
    }
    if (cruise != null) {
      this.throttle = ui.cruiseThrottle(this.speed, this.maxSpeed * cruise, this.maxSpeed);
    }
    super.update(dt, track);
    // Stick braking stops; it does not reverse a bicycle down the street.
    if (this._stickBraking && this.speed < 0) { this.speed = 0; this.vx = 0; this.vy = 0; }
  }
}
