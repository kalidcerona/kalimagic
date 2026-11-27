export const labels = Object.freeze({
  bundle: '통합권', special: '특별 렉쳐', lecture: '렉쳐', show: '공연', meeting: '본모임', open: '오픈 세션'
});

// The offer is supplied by the server. A preview can be priced while sales are closed.
export function quote(offer, selection) {
  if (offer.eventId === 'cupsnballs') {
    if (!Array.isArray(selection) || selection.length !== 1 || selection[0] !== 'admission') {
      throw new RangeError('invalid_selection');
    }
    const price = offer.prices?.admission;
    if (!Number.isSafeInteger(price) || price <= 0) throw new RangeError('invalid_price');
    return {items: [{id: 'admission', label: offer.admissionLabel || '참가권', price, quantity: 1}],
      total: price, version: offer.version, tier: offer.tier};
  }
  if (!Array.isArray(selection) || !selection.length || new Set(selection).size !== selection.length ||
      selection.some(id => !Object.hasOwn(labels, id)) || selection.every(id => id === 'open') ||
      (selection.includes('bundle') && selection.some(id => id !== 'bundle' && id !== 'open'))) {
    throw new RangeError('invalid_selection');
  }
  const items = Object.keys(labels).filter(id => selection.includes(id)).map(id => {
    const price = offer.prices[id];
    if (!Number.isSafeInteger(price) || price <= 0) throw new RangeError('invalid_price');
    return {id, label: id === 'bundle' ? offer.bundleLabel : labels[id], price, quantity: 1};
  });
  return {items, total: items.reduce((sum, item) => sum + item.price, 0), version: offer.version, tier: offer.tier};
}
