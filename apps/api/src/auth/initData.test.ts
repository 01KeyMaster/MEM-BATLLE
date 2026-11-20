// Тесты проверки initData. Запуск: pnpm --filter @meme/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InitDataError, signInitData, validateInitData } from './initData.ts';

const TOKEN = '123456:TEST_TOKEN';
const user = JSON.stringify({ id: 42, first_name: 'Вадим', username: 'vadim' });
const now = Date.now();
const authDate = String(Math.floor(now / 1000));

test('принимает правильно подписанные данные', () => {
  const initData = signInitData({ user, auth_date: authDate, start_param: 'room123' }, TOKEN);
  const result = validateInitData(initData, TOKEN, now);
  assert.equal(result.user.id, 42);
  assert.equal(result.startParam, 'room123');
});

test('отклоняет подделанного пользователя', () => {
  const initData = signInitData({ user, auth_date: authDate }, TOKEN);
  // Злоумышленник подменил id на чужой, но подпись осталась старой
  const forged = initData.replace(encodeURIComponent('"id":42'), encodeURIComponent('"id":777'));
  assert.throws(() => validateInitData(forged, TOKEN, now), InitDataError);
});

test('отклоняет подпись чужим токеном', () => {
  const initData = signInitData({ user, auth_date: authDate }, 'other:token');
  assert.throws(() => validateInitData(initData, TOKEN, now), InitDataError);
});

test('отклоняет устаревшие данные', () => {
  const old = String(Math.floor(now / 1000) - 2 * 24 * 60 * 60);
  const initData = signInitData({ user, auth_date: old }, TOKEN);
  assert.throws(() => validateInitData(initData, TOKEN, now), /устарел/);
});

test('отклоняет данные без подписи', () => {
  assert.throws(() => validateInitData(`user=${encodeURIComponent(user)}`, TOKEN, now), /hash/);
});
