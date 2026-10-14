// 결정론 PRNG. 부동소수 연산을 쓰지 않으려고 0~1 실수 대신 uint32를 돌려준다.
// 시뮬용 RNG와 연출(파티클)용 RNG는 반드시 별도 인스턴스를 만들어 쓴다.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// 0 이상 n 미만
export function randInt(rng, n) {
  return (rng() % n) >>> 0;
}

// lo 이상 hi 이하
export function randRange(rng, lo, hi) {
  return lo + randInt(rng, hi - lo + 1);
}
