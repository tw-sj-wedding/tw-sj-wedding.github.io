import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

/** JPEG 의 SOF 마커에서 가로·세로를 읽는다. */
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const code = buf[i + 1];
    if (code === 0xd8 || code === 0x01 || (code >= 0xd0 && code <= 0xd7) || code === 0xff) { i++; continue; }
    if (code >= 0xc0 && code <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(code)) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

// 갤러리 사진과 마크업에 적힌 크기. 매스너리는 <a data-size>, 임시 3x3 한 장은 <img width height>.
const gallerySizes = [
  ...[...html.matchAll(/<a href="(upload\/gallery\/[^"]+)"[^>]*data-size="([^"]+)"/g)]
    .map(([, file, size]) => ({ file, size })),
  ...[...html.matchAll(/<img [^>]*src="(upload\/gallery\/[^"]+)"[^>]*width="(\d+)" height="(\d+)"/g)]
    .map(([, file, w, h]) => ({ file, size: `${w}x${h}` })),
];

test('페이지가 가리키는 upload/ 사진이 모두 있다', () => {
  const refs = new Set([...html.matchAll(/upload\/(?:gallery|images)\/[\w.-]+\.(?:jpe?g|png)/g)].map((m) => m[0]));
  assert.ok(refs.size > 0, 'upload/ 사진 참조를 찾지 못함');
  for (const ref of refs) assert.ok(existsSync(ref), `${ref} 파일 없음`);
});

test('갤러리 폴더에 페이지가 안 쓰는 사진이 남아 있지 않다', () => {
  const used = new Set(html.match(/upload\/gallery\/[\w.-]+/g) ?? []);
  for (const file of readdirSync('upload/gallery')) {
    assert.ok(used.has(`upload/gallery/${file}`), `upload/gallery/${file} 를 아무도 안 씀`);
  }
});

test('갤러리 사진에 적힌 크기가 실제와 같다 (data-size 는 python3 tools/sync-gallery-sizes.py)', () => {
  assert.ok(gallerySizes.length > 0, '크기가 적힌 갤러리 사진을 찾지 못함');
  for (const { file, size } of gallerySizes) {
    const { width, height } = jpegSize(readFileSync(file));
    assert.equal(size, `${width}x${height}`, file);
  }
});

test('게임 진입 링크가 하나 있다', () => {
  const matches = html.match(/href="\.\/game\/"/g) ?? [];
  assert.equal(matches.length, 1, `./game/ 링크가 ${matches.length}개`);
});

test('진입 버튼은 사진 갤러리 다음, 오시는 길 앞에 있다', () => {
  const gallery = html.indexOf('id="gallery"');
  const location = html.indexOf('id="area9"');
  const entry = html.indexOf('class="minigame');
  assert.ok(gallery > 0 && location > 0 && entry > 0, '기준 마크업을 찾지 못함');
  assert.ok(entry > gallery, '진입 버튼이 갤러리보다 앞에 있음');
  assert.ok(entry < location, '진입 버튼이 오시는 길 뒤로 밀림');
});

test('진입 버튼 스타일이 있다', () => {
  assert.ok(readFileSync('css/aesthetic.css', 'utf8').includes('.minigame__btn'));
});

test('인사말에 임시 서명이 없다', () => {
  assert.ok(!/Written by Gemini/i.test(html));
});

test('교통·주차 안내는 예식장 공식 안내다', () => {
  for (const s of ['지하철 및 셔틀버스 이용시', '일반 버스 이용시', '자동차 이용시', '동시 950대 주차 가능', '서울상록회관']) {
    assert.ok(html.includes(s), `${s} 없음`);
  }
  assert.ok(!html.includes('가까울듯'), '임시 도보 안내가 남음');
});

test('화환 보내기는 최하단 버튼 하나뿐이고 오늘의화환 주문 페이지로 간다', () => {
  assert.ok(!html.includes('floatingBanner'), '좌측 하단 플로팅 배너가 남음');
  assert.ok(!html.includes('waiting.html'), '임시 페이지 링크가 남음');
  const links = html.match(/<a [^>]*class="[^"]*fl_btn[^"]*"[^>]*>/g) ?? [];
  assert.equal(links.length, 1);
  assert.match(links[0], /href="https:\/\/xn--wh1br48ap0ao51bua\.com\/w\/npZFSGwCKC\/order"/);
});

test('임시 ATM 안내가 없다', () => {
  assert.ok(!html.includes('ATM 안내'));
});

test('신랑 측 혼주 이름·연락처가 채워져 있다', () => {
  const block = html.slice(html.indexOf('<h3>신랑 측 혼주</h3>'), html.indexOf('<h3>신부 측 혼주</h3>'));
  assert.ok(!block.includes('(temp)'), '임시 이름이 남음');
  for (const [name, tel] of [['김세광', '01037418682'], ['민미경', '01089715791']]) {
    assert.ok(block.includes(name), `${name} 없음`);
    assert.ok(block.includes(`href="tel:${tel}"`) && block.includes(`href="sms:${tel}"`), `${name} 연락처 없음`);
  }
  assert.ok(!/href="(tel|sms):"/.test(block), '빈 연락처 버튼이 남음');
});
