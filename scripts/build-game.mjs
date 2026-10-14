// game/dev.html 을 원본으로 릴리즈용 game/index.html 을 만든다.
// 마크업은 dev.html 한 곳에만 두어 두 진입점이 어긋나지 않게 한다.
//
// 카톡 인앱 브라우저는 캐시가 강해서 해시 파일명이 사실상 유일한 무효화 수단이다.
// 배포 전에 반드시 `npm run build` — tests/build.test.mjs 가 빼먹은 빌드를 잡는다.

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_HTML = path.join(ROOT, 'game/dev.html');
const BANNER = '<!-- 생성된 파일입니다. game/dev.html 을 고치고 `npm run build` 를 돌리세요. -->';

export async function buildGame({
  distDir = path.join(ROOT, 'game/dist'),
  outHtml = path.join(ROOT, 'game/index.html'),
} = {}) {
  const result = await build({
    entryPoints: [path.join(ROOT, 'game/src/main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020', 'safari14.1'],   // 카톡 iOS 는 시스템 WebKit. 14.0 은 esbuild 가 구조 분해를 못 내린다
    legalComments: 'none',
    write: false,
  });

  const code = result.outputFiles[0].text;
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
  const file = `game.${hash}.js`;

  mkdirSync(distDir, { recursive: true });
  for (const f of readdirSync(distDir)) {
    if (f.endsWith('.js') && f !== file) rmSync(path.join(distDir, f));
  }
  writeFileSync(path.join(distDir, file), code);

  const html = readFileSync(DEV_HTML, 'utf8').replace(
    /<script type="module" src="src\/main\.js"><\/script>/,
    `<script src="dist/${file}" defer></script>`,
  );
  if (!html.includes(`dist/${file}`)) {
    throw new Error('dev.html 의 모듈 스크립트 태그를 찾지 못했습니다. 태그를 바꿨다면 이 스크립트도 고치세요.');
  }
  writeFileSync(outHtml, `${BANNER}\n${html}`);
  return { file, hash };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { file } = await buildGame();
  console.log(`빌드 완료: game/dist/${file}`);
}
