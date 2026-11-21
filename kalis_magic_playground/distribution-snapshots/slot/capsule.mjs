export function setCapsule(node,state) {
  node.hidden = state === 'idle';
  node.dataset.motion = state;
}
