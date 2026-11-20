import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillDeck, findForeignCards } from '@meme/shared';

const base = ['b1', 'b2', 'b3', 'b4', 'b5'];

test('добирает колоду базовыми картами', () => {
  const available = new Set([...base, 'p1', 'p2']);
  const deck = fillDeck(['p1', 'p2'], available, base, 4);
  assert.deepEqual(deck.finalIds, ['p1', 'p2', 'b1', 'b2']);
  assert.deepEqual(deck.autoFilledIds, ['b1', 'b2']);
});

test('не дублирует базовые карты, уже выбранные игроком', () => {
  const available = new Set(base);
  const deck = fillDeck(['b2', 'b1'], available, base, 4);
  assert.deepEqual(deck.finalIds, ['b2', 'b1', 'b3', 'b4']);
});

test('выкидывает карты, которые больше недоступны', () => {
  const available = new Set(base);
  const deck = fillDeck(['gone', 'b1'], available, base, 3);
  assert.deepEqual(deck.droppedIds, ['gone']);
  assert.deepEqual(deck.finalIds, ['b1', 'b2', 'b3']);
});

test('полная колода не трогается', () => {
  const available = new Set([...base, 'x', 'y', 'z']);
  const deck = fillDeck(['x', 'y', 'z'], available, base, 3);
  assert.deepEqual(deck.finalIds, ['x', 'y', 'z']);
  assert.deepEqual(deck.autoFilledIds, []);
});

test('находит чужие карты', () => {
  assert.deepEqual(findForeignCards(['b1', 'paid'], new Set(base)), ['paid']);
});
