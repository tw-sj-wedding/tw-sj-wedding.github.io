#!/usr/bin/env bash
# 스튜디오 보정본 → 청첩장에 올릴 웹용 사진을 만듭니다. (macOS: ffmpeg)
#
# 사용법
# ------
#   tools/make-web-photos.sh ~/Downloads/'2차 수정본'
#
# 만드는 것 (파일명 앞의 r2 = 스튜디오 2차 수정본)
#   upload/gallery/r2_NN.jpg      확대 화면(PhotoSwipe)용. 긴 변 1600
#   upload/gallery/r2_NN_s.jpg    매스너리 타일 배경용. 가로 640 (2열 타일 × 3배 화면에 충분)
#   upload/images/main_r2.jpg     메인 사진. 3:4 로 잘라 1200x1600
#   upload/images/kakao_share_r2.jpg  카톡 공유 썸네일(og:image). 4:3 으로 잘라 800x600
#
# 원칙
#   - 원본(장당 20~100MB)은 커밋하지 않습니다. 줄인 사본만 올립니다.
#   - 메타데이터(카메라·촬영 정보)는 지웁니다(-map_metadata -1). 원본이 sRGB 라
#     프로필이 빠져도 브라우저가 sRGB 로 읽어 색이 같습니다.
#   - 사진이 다시 오면(3차 등) 접두어를 r3 처럼 바꿔 **새 파일명**으로 넣습니다.
#     같은 이름을 덮어쓰면 카톡 인앱 브라우저·카카오 공유 썸네일이 옛 사진을 오래 붙잡습니다.
#     파일명을 바꿨다면 index.html 의 갤러리·메인·og:image 경로도 함께 바꿉니다.
#
# 갤러리 순서는 아래 GALLERY 목록 순서 그대로입니다(r2_01 이 첫 칸).
# 처음 8장만 보이고 나머지는 '사진 더보기' 뒤에 있습니다(css/aesthetic.css :nth-of-type).
# 매스너리는 세로로 먼저 채우므로 1~4 가 왼쪽 열, 5~8 이 오른쪽 열에 섭니다.
set -euo pipefail

if [ $# -ne 1 ] || [ ! -d "$1" ]; then
    sed -n '2,8p' "$0"
    exit 1
fi

SRC="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX=r2

# 처음 보이는 8장: 의상 콘셉트(검정·베이지·그레이)와 장소가 고루 섞이게 고른 것
# 나머지: 촬영 순서(= 원본 파일 번호 순, 콘셉트별로 묶여 있음)
GALLERY=(
    AHJ06216 AHJ06970 AHJ06781 AHJ07467
    AHJ07645 AHJ07016 AHJ07234 AHJ06328

    AHJ06063 AHJ06112 AHJ06346 AHJ06406 AHJ06697 AHJ06761 AHJ06814
    AHJ07031 AHJ07067 AHJ07110 AHJ07126 AHJ07198 AHJ07255 AHJ07333
    AHJ07373 AHJ07395 AHJ07416 AHJ07439 AHJ07554 AHJ07629 AHJ07673
    AHJ07699 MSU04877
)

# 메인·공유 사진: 원본 파일 / 잘라낼 영역(ffmpeg crop=가로:세로:x:y, 원본 픽셀 기준)
HERO=AHJ06112;  HERO_CROP=6336:8448:0:1000     # 3:4, 천장 쪽을 덜어냄
SHARE=AHJ06112; SHARE_CROP=4400:3300:840:2900  # 4:3, 두 사람 상반신

# 원본 파일명 뒤에 설명이 붙은 것(예: AHJ07395스프레드.jpg)도 있어 접두어로 찾습니다
src_of() {
    local matches=("$SRC/$1"*.jpg)
    if [ ${#matches[@]} -ne 1 ] || [ ! -f "${matches[0]}" ]; then
        echo "원본을 하나로 특정할 수 없음: $1 (${#matches[@]}개)" >&2
        exit 1
    fi
    printf '%s' "${matches[0]}"
}

jpeg() { # 입력 출력 필터 품질(ffmpeg -q:v, 낮을수록 고화질)
    ffmpeg -loglevel error -y -i "$1" -vf "$3" \
        -map_metadata -1 -pix_fmt yuvj420p -q:v "$4" "$2"
}

mkdir -p "$ROOT/upload/gallery" "$ROOT/upload/images"
rm -f "$ROOT/upload/gallery/${PREFIX}_"*.jpg

i=0
for id in "${GALLERY[@]}"; do
    i=$((i + 1))
    n=$(printf '%s_%02d' "$PREFIX" "$i")
    src="$(src_of "$id")"
    jpeg "$src" "$ROOT/upload/gallery/$n.jpg" \
        "scale=1600:1600:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos" 4
    jpeg "$src" "$ROOT/upload/gallery/${n}_s.jpg" "scale=640:-2:flags=lanczos" 4
    echo "  $n  ← $(basename "$src")"
done

jpeg "$(src_of "$HERO")" "$ROOT/upload/images/main_$PREFIX.jpg" \
    "crop=$HERO_CROP,scale=1200:1600:flags=lanczos" 3
jpeg "$(src_of "$SHARE")" "$ROOT/upload/images/kakao_share_$PREFIX.jpg" \
    "crop=$SHARE_CROP,scale=800:600:flags=lanczos" 3
echo "  main_$PREFIX.jpg ← $HERO, kakao_share_$PREFIX.jpg ← $SHARE"

echo
echo "다음: python3 tools/sync-gallery-sizes.py 로 data-size 를 맞추고 npm test"
