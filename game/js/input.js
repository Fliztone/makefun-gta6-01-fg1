// VELA BAY — keyboard + mouse. Pointer lock for look; a drag-look fallback keeps
// the game playable when the browser refuses the lock (embedded frames, tests).

const down = new Set();
const pressed = new Set();
let dx = 0, dy = 0;
let locked = false;
let dragging = false;
export const mouse = { left: false, right: false, leftPressed: false };

export function initInput(canvas, onLockLost) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (e.button === 2) mouse.right = true;
    if (!locked) dragging = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
    dragging = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (locked || dragging) { dx += e.movementX || 0; dy += e.movementY || 0; }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) onLockLost();
  });
  document.addEventListener('pointerlockerror', () => { locked = false; });
}

export function requestLock(canvas) {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* drag-look fallback stays active */ }
}

export const isLocked = () => locked;
export const isDown = (code) => down.has(code);
export const wasPressed = (code) => pressed.has(code);
export const anyKey = (...codes) => codes.some((c) => down.has(c));

export function consumeMouse() {
  const r = { dx, dy };
  dx = 0; dy = 0;
  return r;
}

// Call once at the end of every frame.
export function endFrame() {
  pressed.clear();
  mouse.leftPressed = false;
}
// build marker: input.js