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
  private touchId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  onMouseSteering = (_active: boolean): void => {};
  onTouch = (_state: { x: number; y: number; dx: number; dy: number } | null): void => {};
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
    const mousePosition = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      this.mouseY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') {
        if (event.button !== 0) return;
        this.setMouseSteering(!this.mouseActive);
        if (this.mouseActive) mousePosition(event);
        return;
      }
      if (this.touchId !== null) return;
      event.preventDefault();
      this.setMouseSteering(false);
      this.touchId = event.pointerId;
      this.touchOrigin = { x: event.clientX, y: event.clientY };
      this.touchX = this.touchY = 0;
      canvas.setPointerCapture(event.pointerId);
      this.onTouch({ ...this.touchOrigin, dx: 0, dy: 0 });
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') {
        if (this.mouseActive) mousePosition(event);
        return;
      }
      if (event.pointerId !== this.touchId) return;
      const dx = event.clientX - this.touchOrigin.x, dy = event.clientY - this.touchOrigin.y;
      const drag = (v: number): number => Math.abs(v) <= 5 ? 0 : clamp((v - Math.sign(v) * 5) / 65, -1, 1);
      this.touchX = drag(dx); this.touchY = -drag(dy);
      this.onTouch({ ...this.touchOrigin, dx: this.touchX * 35, dy: -this.touchY * 35 });
    });
    canvas.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') this.mouseX = this.mouseY = 0;
    });
    const endTouch = (event: PointerEvent): void => {
      if (event.pointerId !== this.touchId) return;
      this.touchId = null; this.touchX = this.touchY = 0; this.onTouch(null);
    };
    canvas.addEventListener('pointerup', endTouch);
    canvas.addEventListener('pointercancel', endTouch);
    canvas.addEventListener('lostpointercapture', endTouch);
  }
  setMouseSteering(active: boolean): void {
    this.mouseActive = active; this.mouseX = this.mouseY = 0;
    this.onMouseSteering(active);
  }
  clear(): void {
    this.keys.clear(); this.setMouseSteering(false); this.pointerBoost = false;
    this.touchId = null; this.touchX = this.touchY = 0; this.onTouch(null);
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
      pitch: keyboardPitch || -axis(3) || this.touchY || (this.mouseActive ? -deadzone(this.mouseY) : 0),
      boost: (pad?.buttons[7]?.value??0)>.3 || this.pointerBoost || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }
}
