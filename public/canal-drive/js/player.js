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
      return;
    }
    this.throttle = keyboard.ArrowUp ? 1 : 0;
    this.brake = keyboard.ArrowDown ? 1 : 0;
    this.steerInput = 0;
    if (keyboard.ArrowLeft) this.steerInput = -1;
    if (keyboard.ArrowRight) this.steerInput = 1;
  }

  update(dt, track) {
    const ui = window.CanalRecallUi;
    if (this._headingTarget != null) {
      // Follow the street/canal when the pointed direction is close to it, so
      // a slanted street does not mean steering into the kerb.
      const road = track && track.isOpenTrack && track.getNearestRoad
        ? track.getNearestRoad(this.x, this.y, this._headingTarget)
        : null;
      const heading = ui.assistedHeading(this._headingTarget, road ? road.angle : null);
      this.angle = ui.turnToward(this.angle, heading, ui.ABSOLUTE_TURN_RATE * dt);
    }
    if (this._cruiseFraction != null) {
      this.throttle = ui.cruiseThrottle(this.speed, this.maxSpeed * this._cruiseFraction, this.maxSpeed);
    }
    super.update(dt, track);
  }
}
