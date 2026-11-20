export const presets = [
  { id: 'desk', name: '탁상벨', hz: [960, 2410, 4480, 7080], weights: [.16, .36, 1, .55], decay: [1.65, 1.35, 1.05, .48], noise: .05 },
  { id: 'brass', name: '부드러운 황동벨', hz: [780, 1940, 3460, 5570], weights: [.38, .80, .68, .18], decay: [1.75, 1.50, .92, .36], noise: .03 },
  { id: 'glass', name: '짧은 유리 차임', hz: [1340, 3160, 5260, 7610], weights: [.72, 1, .34, .12], decay: [.92, .73, .41, .22], noise: 0 },
];
export function preset(id) {
  return presets.find(sound => sound.id === id) ?? presets[0];
}
