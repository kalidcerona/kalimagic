import * as E from './engine.mjs';

const timer = new E.GoTimer(() => performance.now());
const gate = new E.OutputLossGate(() => performance.now());

export { timer, gate };
