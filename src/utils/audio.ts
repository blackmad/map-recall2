// Sound is permanently disabled. The product has no audio: this stub keeps the
// call sites compiling but never touches the Web Audio API.
class SoundManager {
  public playPinDrop() {}
  public playBullseye() {}
  public playSuccess() {}
  public playMiss() {}
}

export const sounds = new SoundManager();
