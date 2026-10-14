import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng, encodePng } from '../scripts/lib/png.mjs';
import { buildPhoto } from '../scripts/build-photos.mjs';

const NAMES = ['groom', 'bride'];
const html = readFileSync('game/dev.html', 'utf8');

test('선택 카드가 실사 인물 사진을 쓴다', () => {
  for (const name of NAMES) {
    assert.ok(html.includes(`src="assets/photos/${name}.png"`), `${name} 사진 참조 없음`);
  }
});

for (const name of NAMES) {
  const src = decodePng(readFileSync(`game/assets/src/photos/${name}.png`));
  const { out, key } = buildPhoto(src);

  test(`${name}: 사진이 원본에서 다시 만든 것과 같다 (원본을 바꿨으면 npm run photos)`, () => {
    assert.ok(encodePng(out).equals(readFileSync(`game/assets/photos/${name}.png`)));
  });

  test(`${name}: 배경이 빠지고 인물만 남는다`, () => {
    const { width, height, data } = out;
    let visible = 0, pink = 0, cornerOpaque = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!data[i + 3]) continue;
        visible++;
        if (Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]) < 40) pink++;
        if ((x < 3 || x >= width - 3) && (y < 3 || y >= height - 3)) cornerOpaque++;
      }
    }
    assert.ok(visible > width * height * 0.25, `보이는 픽셀이 너무 적음 ${visible}`);
    assert.equal(pink, 0, '배경색이 남은 픽셀');
    assert.equal(cornerOpaque, 0, '잘라 낸 모서리에 배경이 남음');
    assert.ok(height <= 420 && height >= 300, `높이 ${height}`);
  });
}
