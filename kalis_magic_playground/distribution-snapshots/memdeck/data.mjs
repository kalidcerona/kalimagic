export const SUITS = {S:'♠',H:'♥',D:'♦',C:'♣'};
export const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const DECK = RANKS.flatMap(rank => Object.keys(SUITS).map(suit => rank+suit));
export const STACKS = {
  redford: {name:'Redford',author:'Patrick Redford',cards:'QH 2S 5D 8C JH KS 10H 7C 4D AS 8H 5C 2D QS 9H 6C 3D 10S 7H 4C AD JS 9S 6H 3C KD QD 10D 7S 4H AC JD 8S 5H 2C 2H QC 9D 6S 3H KC 4S AH JC 8D 5S 3S KH 10C 7D 6D 9C'.split(' ')},
  mnemonica: {name:'Mnemonica',author:'Juan Tamariz',cards:'4C 2H 7D 3C 4H 6D AS 5H 9S 2S QH 3D QC 8H 6S 5S 9H KC 2D JH 3S 8S 6H 10C 5D KD 2C 3H 8D 5C KS JD 8C 10S KH JC 7S 10H AD 4S 7H 4D AC 9C JS QD 7C QS 10D 6C AH 9D'.split(' ')}
};
export const label = card => card.slice(0,-1)+SUITS[card.slice(-1)];
export const red = card => /[HD]$/.test(card);
