const symbols = ['🍒','🍋','🔔','7'];
const startCell = 14;
export const stopTime = index => 900 + 300 * index;

export function createReels(strips, random = Math.random) {
  const travel = [];
  function place(strip, cell) {
    strip.style.transform = 'translateY(' + (-100 * cell) + '%)';
  }
  return {
    reset() {
      strips.forEach((strip, i) => {
        strip.textContent = Array.from({length:18}, (_, row) =>
          symbols[(row + i + 2) % symbols.length]).join('\n');
        travel[i] = 8 + Math.floor(random() * symbols.length);
        place(strip, startCell);
      });
    },
    frame(elapsed) {
      strips.forEach((strip,i) => {
        const duration = stopTime(i);
        const brakeEnd = duration - 110;
        const progress = Math.min(1, elapsed / brakeEnd);
        const distance = travel[i] * (1 - (1-progress)**2);
        const settle = Math.min(1, Math.max(0, (elapsed-brakeEnd)/110));
        const bounce = settle === 1 ? 0 : .085 * Math.sin(Math.PI * settle);
        place(strip,startCell - distance - bounce);
      });
    }
  };
}
