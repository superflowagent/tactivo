let dragging = false;

export function setDragging(flag: boolean) {
  dragging = Boolean(flag);
  // dispatch event so listeners can recompute when dragging stops
  try {
    window.dispatchEvent(new CustomEvent('tactivo:dragging-changed', { detail: { dragging: flag } }));
  } catch (err) {
    // noop
  }
}

export function isDragging() {
  return dragging;
}
