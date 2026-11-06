import { config } from '../config';
import { clamp } from '../school/math';

export class Input {
  keys = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  mouseActive = false;
  pointerBoost = false;
  touchX = 0;
  touchY = 0;
  touchDepth = 0;
  private padCamera = false;
  onCamera = (): void => {};
  onReset = (): void => {};
  onPause = (): void => {};

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (event) => {
      if ((event.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"]')) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault(); this.keys.add(event.code);
      }
      if (event.repeat) return;
      if (event.code === 'KeyV') this.onCamera();
      if (event.code === 'KeyR') this.onReset();
      if (event.code === 'Escape' || event.code === 'KeyP') this.onPause();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      this.mouseX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      this.mouseY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
      this.mouseActive = true;
    });
    canvas.addEventListener('pointerleave', () => { this.mouseActive = false; });
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.pointerBoost = true; });
    window.addEventListener('pointerup', event => { if(event.pointerType === 'mouse')this.pointerBoost = false; });
    window.addEventListener('pointercancel', event => { if(event.pointerType === 'mouse')this.clear(); });
  }
  clear(): void {
    this.keys.clear(); this.mouseActive = false; this.pointerBoost = false; this.touchX = 0; this.touchY = 0; this.touchDepth = 0;
  }
  get axes(): { yaw: number; pitch: number; boost: boolean } {
    const pad = navigator.getGamepads?.().find(p => p?.connected);
    const camera = Boolean(pad?.buttons[3]?.pressed);if(camera&&!this.padCamera)this.onCamera();this.padCamera=camera;
    const axis=(index:number):number=>Math.abs(pad?.axes[index]??0)>.16?(pad!.axes[index]):0;
    const keyboardYaw = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const keyboardPitch = Number(this.keys.has('KeyW') || this.keys.has('Space')) - Number(this.keys.has('KeyS') || this.keys.has('KeyC'));
    const deadzone = (v: number): number => Math.abs(v) < config.player.mouseDeadzone ? 0 : (v - Math.sign(v) * config.player.mouseDeadzone) / (1 - config.player.mouseDeadzone);
    return {
      yaw: keyboardYaw || axis(0) || this.touchX || (this.mouseActive ? deadzone(this.mouseX) : 0),
      pitch: keyboardPitch || -axis(3) || this.touchDepth || this.touchY || (this.mouseActive ? -deadzone(this.mouseY) : 0),
      boost: (pad?.buttons[7]?.value??0)>.3 || this.pointerBoost || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }
}
