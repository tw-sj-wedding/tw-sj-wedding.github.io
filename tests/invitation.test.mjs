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

const galleryLinks = [...html.matchAll(/<a href="(upload\/gallery\/[^"]+)"[^>]*data-size="([^"]+)"/g)]
  .map(([, href, size]) => ({ href, size }));

test('페이지가 가리키는 upload/ 사진이 모두 있다', () => {
  const refs = new Set([...html.matchAll(/upload\/(?:gallery|images)\/[\w.-]+\.(?:jpe?g|png)/g)].map((m) => m[0]));
  assert.ok(refs.size > 0, 'upload/ 사진 참조를 찾지 못함');
  for (const ref of refs) assert.ok(existsSync(ref), `${ref} 파일 없음`);
});

test('갤러리 폴더에 페이지가 안 쓰는 사진이 남아 있지 않다', () => {
  const used = new Set(galleryLinks.map((l) => l.href));
  for (const file of readdirSync('upload/gallery')) {
    assert.ok(used.has(`upload/gallery/${file}`), `upload/gallery/${file} 를 아무도 안 씀`);
  }
});

test('갤러리 data-size 가 실제 사진 크기와 같다 (다르면 python3 tools/sync-gallery-sizes.py)', () => {
  assert.ok(galleryLinks.length > 0, '갤러리 링크를 찾지 못함');
  for (const { href, size } of galleryLinks) {
    const { width, height } = jpegSize(readFileSync(href));
    assert.equal(size, `${width}x${height}`, href);
  }
});

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
