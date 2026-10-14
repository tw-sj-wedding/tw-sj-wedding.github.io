import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

test('게임 진입 링크가 하나 있다', () => {
  const matches = html.match(/href="\.\/game\/"/g) ?? [];
  assert.equal(matches.length, 1, `./game/ 링크가 ${matches.length}개`);
});

test('진입 카드는 hero 다음, 인사말 앞에 있다', () => {
  const heroEnd = html.indexOf('</header>');
  const greeting = html.indexOf('id="area2"');
  const card = html.indexOf('class="minigame');
  assert.ok(heroEnd > 0 && greeting > 0 && card > 0, '기준 마크업을 찾지 못함');
  assert.ok(card > heroEnd, '진입 카드가 hero 안에 있음');
  assert.ok(card < greeting, '진입 카드가 인사말 뒤로 밀림');
});

test('진입 카드 스타일이 있다', () => {
  assert.ok(readFileSync('css/aesthetic.css', 'utf8').includes('.minigame__card'));
});
