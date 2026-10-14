// 닉네임 규칙. 게임(입력 즉시 안내)과 Worker(최종 판정)가 이 파일을 함께 쓴다.
// 2~10자, 한글 완성형·영문·숫자만. 신랑·신부 이름과 운영자 사칭, 욕설은 막는다.

const ALLOWED = /^[가-힣a-zA-Z0-9]+$/;
const RESERVED_EXACT = ['신랑', '신부', '태웅', '수진', '김태웅', '박수진', '관리', '운영', 'administrator'];
const RESERVED_PART = ['관리자', '운영자', 'admin'];
const PROFANITY = [
  '씨발', '시발', '씨바', '시바', '씨팔', '시팔', 'ㅅㅂ', '병신', '븅신', '좆', '존나', '졸라', '개새', '새끼',
  '미친놈', '미친년', '지랄', '닥쳐', '꺼져', '엠창', '느금', '애미', '애비', '섹스', '보지', '자지', '창녀',
  'fuck', 'shit', 'bitch', 'sex', 'porn', 'dick', 'pussy', 'asshole', 'nigg', 'cunt',
];

export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'length' };
  const value = raw.normalize('NFC').trim();
  const len = [...value].length;
  if (len < 2 || len > 10) return { ok: false, reason: 'length' };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'chars' };

  const lower = value.toLowerCase();
  if (RESERVED_EXACT.includes(lower) || RESERVED_PART.some((w) => lower.includes(w))) {
    return { ok: false, reason: 'reserved' };
  }
  const squeezed = lower.replace(/[0-9]/g, '');   // "시1발" 처럼 숫자를 끼워 넣는 경우
  if (PROFANITY.some((w) => lower.includes(w) || squeezed.includes(w))) {
    return { ok: false, reason: 'profanity' };
  }
  return { ok: true, value };
}
