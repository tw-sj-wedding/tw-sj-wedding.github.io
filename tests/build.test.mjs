import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildGame } from '../scripts/build-game.mjs';

// 테스트는 임시 폴더에 빌드한다 — 저장소의 game/index.html·game/dist 를 건드리지 않게
function tmpTargets() {
  const dir = mkdtempSync(path.join(tmpdir(), 'snowrun-build-'));
  return { distDir: path.join(dir, 'dist'), outHtml: path.join(dir, 'index.html') };
}

test('해시 파일명 번들을 만들고 index.html 이 그것만 참조한다', async () => {
  const t = tmpTargets();
  const { file, hash } = await buildGame(t);
  assert.match(file, /^game\.[0-9a-f]{10}\.js$/);
  assert.equal(hash.length, 10);
  assert.ok(existsSync(path.join(t.distDir, file)));
  const html = readFileSync(t.outHtml, 'utf8');
  assert.ok(html.includes(`dist/${file}`), '새 번들을 참조하지 않음');
  assert.ok(!html.includes('type="module"'), '모듈 스크립트가 남음');
  assert.ok(!html.includes('src/main.js'), '소스를 직접 참조함');
});

test('옛 번들은 정리된다', async () => {
  const t = tmpTargets();
  await buildGame(t);
  writeFileSync(path.join(t.distDir, 'game.0000000000.js'), '// old');
  const { file } = await buildGame(t);
  assert.deepEqual(readdirSync(t.distDir).filter((f) => f.endsWith('.js')), [file]);
});

test('index.html 본문은 dev.html 과 같다 (스크립트 태그만 다름)', async () => {
  const t = tmpTargets();
  await buildGame(t);
  const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  assert.equal(strip(readFileSync(t.outHtml, 'utf8')), strip(readFileSync('game/dev.html', 'utf8')));
});

test('같은 소스면 같은 해시 (재현 가능)', async () => {
  const a = await buildGame(tmpTargets());
  const b = await buildGame(tmpTargets());
  assert.equal(a.hash, b.hash);
});

test('저장소의 릴리즈 진입점이 최신 소스로 빌드돼 있다', async () => {
  // 배포 전에 npm run build 를 빼먹으면 하객에게 옛 버전이 나간다. 그걸 커밋 전에 잡는다.
  const { file } = await buildGame(tmpTargets());
  assert.ok(existsSync(path.join('game/dist', file)), `game/dist/${file} 없음 — npm run build 를 돌리세요`);
  assert.ok(readFileSync('game/index.html', 'utf8').includes(`dist/${file}`), 'game/index.html 이 옛 번들을 가리킴 — npm run build');
});
