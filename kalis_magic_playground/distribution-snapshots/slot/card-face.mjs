const names = {'♠':'스페이드','♥':'하트','♣':'클럽','♦':'다이아몬드'};
const middle = [50,50];
const rows = (...ys) => ys.flatMap(y => [[27,y],[73,y]]);
const corners = rows(16,84);
const six = rows(16,50,84);
const eight = rows(16,39,61,84);
const layouts = [
  [], [middle], [[50,16],[50,84]], [[50,16],middle,[50,84]],
  corners, [...corners,middle], six, [...six,[50,33]],
  [...six,[50,33],[50,67]], [...eight,middle], [...eight,[50,27.5],[50,72.5]]
];
export function drawCard(container, card) {
  container.replaceChildren();
  if (!card) return;
  const {rank,suit} = card;
  const value = rank === 1 ? 'A' : String(rank);
  const face = document.createElement('div');
  face.className = 'card';
  face.style.color = '♥♦'.includes(suit) ? '#ae233b' : '#171821';
  face.setAttribute('role','img');
  face.setAttribute('aria-label',names[suit]+' '+value);
  for (const side of ['top','bottom']) {
    const corner = document.createElement('b');
    corner.className = side;
    corner.textContent = value+'\n'+suit;
    face.append(corner);
  }
  for (const [x,y] of layouts[rank]) {
    const mark = document.createElement('span');
    if (y > 50) mark.className = 'inverted';
    mark.style.left = x+'%';
    mark.style.top = y+'%';
    mark.textContent = suit;
    if (rank === 1) mark.className = 'ace';
    face.append(mark);
  }
  container.append(face);
}
