import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNickname } from '../game/src/shared/nickname.js';

test('한글·영문·숫자 2~10자는 통과하고 앞뒤 공백은 지운다', () => {
  assert.deepEqual(validateNickname('하객1'), { ok: true, value: '하객1' });
  assert.deepEqual(validateNickname('  Guest7 '), { ok: true, value: 'Guest7' });
  assert.equal(validateNickname('가나다라마바사아자차').ok, true);
});

test('길이가 맞지 않으면 length', () => {
  for (const v of ['a', '', 'abcdefghijk', null, undefined, 42]) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'length' }, String(v));
  }
});

test('공백·기호·자모·이모지는 chars', () => {
  for (const v of ['하 객', 'abc!', 'ㅅㅂ', '하객😀', '<b>x</b>']) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'chars' }, v);
  }
});

test('신랑·신부 이름과 운영자 사칭은 reserved', () => {
  for (const v of ['신랑', '신부', '태웅', '수진', '박수진', 'ADMIN', '관리자1', '운영자']) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'reserved' }, v);
  }
});

test('욕설은 숫자를 끼워 넣어도 profanity', () => {
  for (const v of ['씨발놈', '시1발', 'fuckyou', 'Shit123', '병신아']) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'profanity' }, v);
  }
});

test('조합형(NFD) 한글은 완성형(NFC)으로 바뀌어 통과한다', () => {
  const nfd = '하객'.normalize('NFD');
  assert.notEqual(nfd, '하객');
  assert.deepEqual(validateNickname(nfd), { ok: true, value: '하객' });
});
