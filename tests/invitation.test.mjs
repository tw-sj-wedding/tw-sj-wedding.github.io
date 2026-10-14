import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

test('게임 진입 링크가 하나 있다', () => {
  const matches = html.match(/href="\.\/game\/"/g) ?? [];
  assert.equal(matches.length, 1, `./game/ 링크가 ${matches.length}개`);
});

test('진입 버튼은 사진 갤러리 다음, 오시는 길 앞에 있다', () => {
  const galleryMore = html.indexOf('class="gallery__more"');
  const location = html.indexOf('id="area9"');
  const entry = html.indexOf('class="minigame');
  assert.ok(galleryMore > 0 && location > 0 && entry > 0, '기준 마크업을 찾지 못함');
  assert.ok(entry > galleryMore, '진입 버튼이 갤러리보다 앞에 있음');
  assert.ok(entry < location, '진입 버튼이 오시는 길 뒤로 밀림');
});

test('진입 버튼 스타일이 있다', () => {
  assert.ok(readFileSync('css/aesthetic.css', 'utf8').includes('.minigame__btn'));
});
