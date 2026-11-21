const symbols = ['🍒','🍋','🔔','7'];
// Extra full rotations preserve the landing symbol while increasing peak speed.
const extraRotations = [7, 6, 5];
const startCell = 14 + 4 * Math.max(...extraRotations);
const stripLength = startCell + 4;
export const stopTime = index => 1900 + 300 * index;

export function createReels(strips, random = Math.random) {
  const travel = [], offsets = [];
  function place(strip, cell) {
    strip.style.transform = 'translateY(' + (-100 * cell) + '%)';
  }
  return {
    reset() {
      strips.forEach((strip, i) => {
        offsets[i] = i + 2;
        strip.textContent = Array.from({length:stripLength}, (_, row) =>
          symbols[(row + offsets[i]) % symbols.length]).join('\n');
        travel[i] = 8 + 4 * extraRotations[i] + Math.floor(random() * symbols.length);
        place(strip, startCell);
      });
    },
    start(winning) {
      const ends = strips.map(() => Math.floor(random() * symbols.length));
      if (winning) ends.fill(3);
      else if (ends.every(value => value === ends[0])) ends[2] = (ends[2]+1)%4;
      strips.forEach((strip,i) => {
        // Rebase the strip at its previous visible symbol before starting again.
        const previous = Math.round(-parseFloat(strip.style.transform.slice(11))/100);
        offsets[i] = (previous + offsets[i] - startCell % 4 + 4) % 4;
        strip.textContent = Array.from({length:stripLength}, (_,row) => symbols[(row+offsets[i])%4]).join('\n');
        travel[i] = 8 + 4 * extraRotations[i] + (startCell + offsets[i] - ends[i]) % 4;
        place(strip,startCell);
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
