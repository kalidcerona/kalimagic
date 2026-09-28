import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../admin-tools.js', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../../admin-app-model.js', import.meta.url), 'utf8');

class Node {
  constructor(tag, className = '', text = '') {
    this.tag = tag;
    this.className = className;
    this.textContent = text;
    this.children = [];
    this.listeners = {};
    this.checked = false;
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.tag === selector || (selector === 'input:checked' && child.tag === 'input' && child.checked)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  fire(name) { this.listeners[name]({ preventDefault() {} }); }
}

function harness(rows, availability = { legacy: true, friendApps: true }) {
  const submitted = [];
  const context = vm.createContext({
    document: { createElement: (tag) => new Node(tag) },
    el: (tag, cls, text) => new Node(tag, cls, text),
    memberSelector: () => new Node('label'),
    personDetails: () => '',
    pendingCard: () => new Node('div'),
    adminToolLabel: (id) => id,
    renderBatchToolbar() {},
    submitMemberBatch: (...args) => submitted.push(args),
    state: { pendingTools: new Map(), selected: new Set(), tab: 'pending', busy: false },
    makeLifetime: () => ({ input: new Node('input'), label: new Node('label') }),
    textInput: () => Object.assign(new Node('input'), { value: '' })
  });
  vm.runInContext(modelSource, context);
  context.model = context.AdminAppModel;
  const members = context.model.groupMembers(rows);
  context.visibleMembers = () => members;
  for (const name of ['toolChecks', 'selectedTools', 'batchEntries', 'pendingMemberCard']) {
    const start = source.indexOf('  function ' + name + '(');
    const next = source.slice(start + 1).search(/\n  (?:async )?function /);
    const end = start + 1 + next;
    vm.runInContext(source.slice(start, end), context);
  }
  const cards = members.map((member) => context.pendingMemberCard(member, availability));
  return { context, members, cards, submitted, availability };
}

function choices(card) { return card.querySelector('fieldset').querySelectorAll('input'); }
function choose(input, checked = true) { input.checked = checked; input.fire('change'); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('pending member approves only explicitly checked requested apps through pending eligibility', () => {
  const view = harness([
    { id: 'a', email: 'member@example.com', tool: 'unlock' },
    { id: 'b', email: 'member@example.com', tool: 'aletheia' }
  ]);
  const card = view.cards[0];
  const inputs = choices(card);
  const form = card.querySelector('form');
  const submit = form.querySelector('button');
  assert.equal(inputs.every((input) => !input.checked), true);
  assert.equal(submit.disabled, true);
  form.fire('submit');
  assert.equal(view.submitted.length, 0);
  choose(inputs.find((input) => input.value === 'aletheia'));
  assert.equal(submit.disabled, false);
  form.fire('submit');
  assert.deepEqual(plain(view.submitted[0].slice(0, 2)), [
    [{ email: 'member@example.com', tools: ['aletheia'] }], 'pending'
  ]);
  choose(inputs.find((input) => input.value === 'aletheia'), false);
  assert.equal(submit.disabled, true);
});

test('multi-member approval preserves each member app selection and excludes stale or unselected apps', () => {
  const view = harness([
    { id: 'a', email: 'a@example.com', tool: 'unlock' },
    { id: 'b', email: 'a@example.com', tool: 'aletheia' },
    { id: 'c', email: 'b@example.com', tool: 'usotsuki' },
    { id: 'd', email: 'c@example.com', tool: 'unlock' }
  ]);
  choose(choices(view.cards[0]).find((input) => input.value === 'aletheia'));
  choose(choices(view.cards[1])[0]);
  view.context.state.selected = new Set(['a@example.com', 'b@example.com', 'c@example.com', 'stale@example.com']);
  view.context.state.pendingTools.get('a@example.com').add('calc');
  assert.deepEqual(plain(view.context.batchEntries(view.availability)), [
    { email: 'a@example.com', tools: ['aletheia'] },
    { email: 'b@example.com', tools: ['usotsuki'] }
  ]);
  const rerender = view.context.pendingMemberCard(view.members[0], view.availability);
  assert.deepEqual(choices(rerender).filter((input) => input.checked).map((input) => input.value), ['aletheia']);
  assert.deepEqual(plain(view.context.batchEntries({ legacy: true, friendApps: false })), []);
});

test('legacy all request links only its two legacy app choices in both directions', () => {
  const view = harness([
    { id: 'a', email: 'member@example.com', tool: 'all' },
    { id: 'b', email: 'member@example.com', tool: 'unlock' }
  ]);
  const inputs = choices(view.cards[0]);
  choose(inputs.find((input) => input.value === 'stopwatch'));
  assert.deepEqual(inputs.filter((input) => input.checked).map((input) => input.value), ['calc', 'stopwatch']);
  choose(inputs.find((input) => input.value === 'unlock'));
  choose(inputs.find((input) => input.value === 'calc'), false);
  assert.deepEqual(inputs.filter((input) => input.checked).map((input) => input.value), ['unlock']);
  assert.deepEqual(Array.from(view.context.state.pendingTools.get('member@example.com')), ['unlock']);
});

test('new friend apps are separate pending checkbox choices with their existing entitlement IDs', () => {
  const view = harness([
    { id: 'a', email: 'member@example.com', tool: 'tobira' },
    { id: 'b', email: 'member@example.com', tool: 'spinner' }
  ]);
  const inputs = choices(view.cards[0]);
  assert.deepEqual(inputs.map((input) => input.value), ['tobira', 'spinner']);
  choose(inputs.find((input) => input.value === 'spinner'));
  view.cards[0].querySelector('form').fire('submit');
  assert.deepEqual(plain(view.submitted[0][0]), [{ email: 'member@example.com', tools: ['spinner'] }]);
});
