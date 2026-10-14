// 닉네임 규칙. 게임(입력 즉시 안내)과 Worker(최종 판정)가 이 파일을 함께 쓴다 — 고치면 Worker 도 다시 배포한다.
// 2~10자, 한글 완성형·영문·숫자만. 신랑·신부 이름과 운영자 사칭, 비속어는 막는다.

const ALLOWED = /^[가-힣a-zA-Z0-9]+$/;
const RESERVED_EXACT = ['신랑', '신부', '태웅', '수진', '김태웅', '박수진', '관리', '운영', 'administrator'];
const RESERVED_PART = ['관리자', '운영자', 'admin'];

// 비속어. 닉네임 안에 들어 있기만 해도 막는다. 자모(ㅅㅂ)·띄어쓰기·기호는 ALLOWED 에서 이미 막힌다.
// 평범한 말에 흔히 섞이는 짧은 말('한남'→한남동, '사정', '성기'·'애자'→사람 이름, 'cock'→peacock,
// 'rape'→grape, 'anal'→analyst, 'semen'→basement, 'tits'→outfits)은 넣지 않거나 더 긴 꼴로만 넣는다.
const PROFANITY = [
  // 욕설
  '씨발', '시발', '씨바', '시바', '씨빨', '시빨', '씨벌', '시벌', '씨팔', '시팔', '씨펄', '시펄', '쓰발', '쓰벌',
  '씌발', '쒸발', '쉬발', '쉬바', '슈발', '싸발', '띠발', '띠바', '씨부랄', '시부랄', '씨부럴', '시부럴', '씨이발',
  '시이발', '십팔', '씹', '좆', '좃', '존나', '졸라', '존니', '조낸', '조까', '병신', '븅신', '빙신', '병싄', '병쉰',
  '뵹신', '등신', '개새', '개색', '개섀', '개세끼', '개쉐', '개년', '개놈', '새끼', '쌔끼', '새꺄', '쌔꺄', '섀끼',
  '새키', '쌔키', '색히', '쉐끼', '지랄', '지럴', '즤랄', '닥쳐', '닥치', '꺼져', '꺼지라', '엠창', '앰창', '엠생',
  '앰생', '느금', '니애미', '니애비', '느개비', '니미럴', '니기미', '애미', '애비', '염병', '엠병', '썅', '쌍년',
  '쌍놈', '호로새', '호로자식', '후레자식', '화냥', '갈보', '걸레', '찐따', '또라이', '똘아이', '미친놈', '미친년',
  '미친새', '정신병', '뒤져', '뒈져', '디져', '뒤질래', '죽어라', '죽여버', '자살', '썩을', '빡대가리',
  // 성적 표현
  '섹스', '쎅스', '섹쓰', '보지', '보짓', '자지', '잠지', '딸딸이', '자위', '야동', '몰카', '강간', '성폭', '성추행',
  '오르가', '정액', '질싸', '사까시', '펠라', '풀발', '발기', '콘돔', '포르노', '유두', '젖꼭지', '빨통', '떡치',
  '빠구리', '음란', '변태', '꼴리', '꼴려', '애널', '오랄', '쓰리썸', '스와핑', '조건만남', '원나잇', '창녀', '창놈',
  '매춘', '성매매',
  // 혐오·비하
  '한남충', '한녀충', '김치녀', '김치남', '된장녀', '메갈', '워마드', '일베', '홍어', '틀딱', '급식충', '맘충',
  '짱깨', '짱개', '쪽바리', '쪽발이', '깜둥이', '조센징', '똥꼬충', '운지', '착짱죽짱',
  // 결혼식에 어울리지 않는 말
  '이혼', '파혼', '불륜', '상간녀', '상간남',
  // 영어
  'fuck', 'fuk', 'fck', 'fvck', 'phuck', 'shit', 'bitch', 'biatch', 'sex', 'porn', 'dick', 'pussy', 'asshole',
  'nigg', 'cunt', 'whore', 'slut', 'bastard', 'motherf', 'faggot', 'retard', 'rapist', 'penis', 'vagina', 'boob',
  'nude', 'milf', 'hentai', 'jizz', 'horny', 'blowjob', 'handjob', 'dildo', 'orgasm', 'stfu', 'wtf', 'nazi',
  'hitler', 'xxx',
  // 영문 자판으로 친 한글 욕(tlqkf = 시발), 로마자 표기
  'tlqkf', 'qudtls', 'wlfkf', 'whssk', 'rotorl', 'dpackd', 'sibal', 'ssibal', 'shibal', 'byungsin', 'byeongsin',
  'jonna', 'jiral', 'gaesaekki', 'saekki',
  // 숫자가 섞인 욕 (숫자를 지우기 전 문자열에서 찾힌다)
  '18놈', '개18', '씨8', '시8', '십8',
];

// 자음·모음 욕. 자모는 ALLOWED 에서도 막히지만, 자모 허용 여부와 상관없이 막고 '다른 닉네임' 안내가
// 나가도록 문자 검사보다 먼저 본다. 자모만 뽑아서(ㅅ1ㅂ·ㅂ민ㅅ → ㅅㅂ·ㅂㅅ) 찾고, 글자와 섞인 꼴(ㅈ같, 시ㅂ)도 찾는다.
const JAMO_PROFANITY = [
  'ㅅㅂ', 'ㅆㅂ', 'ㅅㅃ', 'ㅂㅅ', 'ㅄ', 'ㅈㄹ', 'ㅈㄴ', 'ㅁㅊ', 'ㅅㄲ', 'ㄱㅅㄲ', 'ㅆㄹㄱ', 'ㄲㅈ', 'ㄷㅊ', 'ㅈㄲ',
  'ㄴㄱㅁ', 'ㅇㅁ', 'ㅂㅈ', 'ㅈㅈ', 'ㅗ',
  'ㅈ같', 'ㅈ밥', 'ㅈ까', 'ㅅ발', 'ㅆ발', '시ㅂ', '씨ㅂ', 'ㅂ신', '병ㅅ', 'ㅈ랄', '지ㄹ', '개ㅅㄲ', '개ㅆㄲ',
];

// 금칙어를 품고 있지만 멀쩡한 말. 검사 전에 이 부분만 지운다 (남은 부분은 그대로 검사한다)
const INNOCENT = ['졸라맨', '시바견', '시바이누', '십팔번', '새끼손가락', '보지마', '자지러', '메갈로', '갈보리', 'fuku'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };
const collapse = (s) => s.replace(/(.)\1+/gu, '$1');   // fuuuck → fuck, 씨씨발 → 씨발

// 겹글자를 줄인 꼴(asshole → ashole)로도 찾되, 줄여서 5자 미만이 되는 말은 뺀다 ('boob'→'bob'은 Bobby 를 막는다)
const TERMS = PROFANITY.flatMap((w) => {
  const c = collapse(w);
  return c !== w && c.length >= 5 ? [w, c] : [w];
});

// 우회 꼴: 그대로, 숫자 지움(시1발), 숫자→영문(sh1t, s3x), 겹글자 줄임(fuuuck, 씨씨발)
function variants(lower) {
  let s = lower;
  for (const w of INNOCENT) s = s.split(w).join('');
  const noDigits = s.replace(/[0-9]/g, '');
  const leet = s.replace(/[013457]/g, (d) => LEET[d]);
  return [s, noDigits, leet, collapse(noDigits), collapse(leet)];
}

export function validateNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'length' };
  const value = raw.normalize('NFC').trim();
  const len = [...value].length;
  if (len < 2 || len > 10) return { ok: false, reason: 'length' };

  const lower = value.toLowerCase();
  const jamo = lower.replace(/[^ㄱ-ㅣ]/g, '');
  const letters = lower.replace(/[^가-힣ㄱ-ㅣa-z]/g, '');
  if (JAMO_PROFANITY.some((w) => jamo.includes(w) || letters.includes(w))) return { ok: false, reason: 'profanity' };

  if (!ALLOWED.test(value)) return { ok: false, reason: 'chars' };

  if (RESERVED_EXACT.includes(lower) || RESERVED_PART.some((w) => lower.includes(w))) {
    return { ok: false, reason: 'reserved' };
  }
  const forms = variants(lower);
  if (forms.some((f) => TERMS.some((w) => f.includes(w)))) return { ok: false, reason: 'profanity' };
  return { ok: true, value };
}
