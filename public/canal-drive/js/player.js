// ============================================================
// PLAYER CAR
// ============================================================
class PlayerCar extends Car {
  constructor(x, y, angle) {
    super(x, y, angle, COLORS.player, 'PLAYER');
    this.controlMode = 'relative';
  }
  handleInput(input) {
    if (this.controlMode === 'absolute') {
      const horizontal = (input.isDown('ArrowRight') || input.isDown('KeyD') ? 1 : 0) - (input.isDown('ArrowLeft') || input.isDown('KeyA') ? 1 : 0);
      const vertical = (input.isDown('ArrowDown') || input.isDown('KeyS') ? 1 : 0) - (input.isDown('ArrowUp') || input.isDown('KeyW') ? 1 : 0);
      if (horizontal || vertical) {
        this.angle = Math.atan2(vertical, horizontal);
        this.throttle = 1;
        this.brake = 0;
        this.steerInput = 0;
      } else {
        this.throttle = 0;
        this.brake = 0;
        this.steerInput = 0;
      }
      this.handbrake = input.isDown('Space');
      return;
    }
    this.throttle = (input.isDown('ArrowUp') || input.isDown('KeyW')) ? 1 : 0;
    this.brake = (input.isDown('ArrowDown') || input.isDown('KeyS')) ? 1 : 0;
    this.steerInput = 0;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) this.steerInput = -1;
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.steerInput = 1;
    this.handbrake = input.isDown('Space');
  }
}
