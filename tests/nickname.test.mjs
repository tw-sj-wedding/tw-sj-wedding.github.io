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

test('비속어 갈래별 대표', () => {
  const samples = [
    '개새끼야', '지랄하네', '니애미', '존나잘함', '꺼져라',                 // 욕설
    '섹스왕', '야동마스터', '변태하객',                                     // 성적 표현
    '한남충', '김치녀', '틀딱', '일베충',                                   // 혐오·비하
    '이혼각', '파혼하자', '불륜커플',                                       // 결혼식에 어울리지 않는 말
    'BITCH', 'mthrfucker', 'nigga', 'WhoreX',                              // 영어
    'tlqkf', 'qudtls', 'ssibal',                                             // 영타·로마자
  ];
  for (const v of samples) assert.deepEqual(validateNickname(v), { ok: false, reason: 'profanity' }, v);
});

test('우회: 숫자 끼우기, 숫자→영문, 같은 글자 반복, 숫자 욕', () => {
  for (const v of ['씨1발', '병2신', 'sh1t', 's3x', 'b00b', 'fuuuuck', 'asssshole', '씨씨발', '개18', '18놈', '씨8']) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'profanity' }, v);
  }
});

test('평범한 닉네임은 금칙어 조각이 들어 있어도 통과', () => {
  const fine = [
    '들러리민수', '수진베프', '회사동기', '막내이모', '사촌동생', '태웅친구', '신랑친구', '신부측하객',
    '한남동주민', '김성기', '이애자', '사정없이', '노무사', '개발자', '개구리', '바람돌이', '수발',
    '졸라맨', '시바견', '메갈로돈', '갈보리교회', '십팔번', '새끼손가락', '보지마',
    'Bobby', 'grape', 'peacock', 'analyst', 'basement', 'outfits', 'classic', 'passion', 'Fukuoka', 'Jessie',
    '하객1004', 'guest7', 'king18', 'Hello', 'Michelle',
  ];
  for (const v of fine) assert.deepEqual(validateNickname(v), { ok: true, value: v }, v);
});

test('멀쩡한 말을 지워도 남은 부분은 검사한다', () => {
  for (const v of ['졸라맨존나', '시바견씨발', '보지마보지']) {
    assert.deepEqual(validateNickname(v), { ok: false, reason: 'profanity' }, v);
  }
});

test('조합형(NFD) 한글은 완성형(NFC)으로 바뀌어 통과한다', () => {
  const nfd = '하객'.normalize('NFD');
  assert.notEqual(nfd, '하객');
  assert.deepEqual(validateNickname(nfd), { ok: true, value: '하객' });
});
