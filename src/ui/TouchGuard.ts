/** Keep browser selection/callouts out of gameplay, while allowing room-code editing. */
export function installTouchGuards(app: HTMLElement): void {
  const allowNativeText = 'input, textarea, select, [contenteditable="true"], #online-status';
  const guard = (event: Event): void => {
    const element = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
    if (!element?.closest(allowNativeText)) event.preventDefault();
  };
  for (const type of ['contextmenu', 'selectstart', 'dblclick']) app.addEventListener(type, guard);
}
