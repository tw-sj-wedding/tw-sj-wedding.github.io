#!/usr/bin/env bash
# 스튜디오 원본 → 흐리게 구운 미리보기 사진을 만듭니다. (macOS: sips + ffmpeg + Chrome)
#
# 왜 굽는가
# ---------
# 공개 저장소라 CSS filter:blur 로 가리면 원본 파일이 그대로 내려받힙니다.
# 그래서 블러를 이미지 자체에 굽고, 원본은 커밋하지 않습니다.
#
# 사용법
# ------
#   tools/blur-preview-photos.sh 원본1.jpeg 원본2.jpeg ...
#
#   - 넘긴 순서대로 3열 격자 한 장 upload/gallery/preview_grid.jpg 를 만듭니다
#     (칸 400x533, 간격 8px 흰색). 장수를 바꿨으면 index.html 의 width/height 를 맞춥니다.
#   - 첫 장으로 메인 사진 upload/images/main_preview.jpg (가로 800)
#     과 카톡 공유 썸네일 upload/images/kakao_share_soon.jpg (800x600) 도 만듭니다.
#   - 공유 썸네일의 '사진 준비 중' 배지는 tools/share-badge.html 을 Chrome 헤드리스로 찍어
#     굽습니다(이 ffmpeg 에는 글자 필터가 없음). 글꼴을 Google Fonts 에서 받으므로 인터넷이 필요합니다.
#     Chrome 위치가 다르면 CHROME=/경로 로 넘깁니다.
#
# 보정본이 오면 이 스크립트는 더 쓰지 않습니다. 선명한 사진은 새 파일명으로 넣으세요
# (카톡 인앱 브라우저가 같은 주소의 옛 사진을 오래 붙잡고 있습니다).
set -euo pipefail

if [ $# -lt 1 ]; then
    sed -n '2,20p' "$0"
    exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRGB="/System/Library/ColorSync/Profiles/sRGB Profile.icc"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 블러 세기 = 가로폭 / 60 (600px → sigma 10). 누군지는 알아보되 피부·디테일은 뭉개집니다.
# 메인은 훨씬 약하게(800px → sigma 3.5) — 첫 화면이라 얼굴이 거의 보이고 디테일만 부드럽게.
blur() { # 입력 출력 블러-앞단-필터 sigma [블러-뒷단-필터]
    ffmpeg -loglevel error -y -i "$1" \
        -vf "$3,gblur=sigma=$4:steps=3${5:+,$5}" \
        -map_metadata -1 -q:v 3 "$2"
}

# 아이폰 원본은 Display P3 라서 그대로 넣으면 ffmpeg 가 프로필을 버려 색이 바랩니다.
# sips 로 sRGB 픽셀로 먼저 바꿔 둡니다.
to_srgb() {
    sips -s format png --matchTo "$SRGB" "$1" --out "$2" >/dev/null
}

# 격자 칸: 600x800 에서 블러(sigma 10)를 건 뒤 400x533 으로 줄입니다 → 블러 비율은 그대로
TILE_W=400 TILE_H=533 GAP=8 COLS=3
mkdir -p "$ROOT/upload/gallery"
inputs=() layout=()
i=0
for src in "$@"; do
    n=$(printf '%02d' $((i + 1)))
    to_srgb "$src" "$TMP/$n.png"
    blur "$TMP/$n.png" "$TMP/tile_$n.png" \
        "scale=600:800:force_original_aspect_ratio=increase:flags=area,crop=600:800" 10 \
        "scale=$TILE_W:$TILE_H:flags=area"
    inputs+=(-i "$TMP/tile_$n.png")
    layout+=("$(( i % COLS * (TILE_W + GAP) ))_$(( i / COLS * (TILE_H + GAP) ))")
    i=$((i + 1))
done
ffmpeg -loglevel error -y "${inputs[@]}" \
    -filter_complex "xstack=inputs=$i:layout=$(IFS='|'; echo "${layout[*]}"):fill=white" \
    -map_metadata -1 -q:v 3 "$ROOT/upload/gallery/preview_grid.jpg"

# 메인: 가로 800, 세로는 원본 비율
blur "$TMP/01.png" "$ROOT/upload/images/main_preview.jpg" "scale=800:-2:flags=area" 3.5
# 공유 썸네일: 800x600, 얼굴이 들어가도록 위쪽 13% 지점부터 자르고 배지를 얹습니다
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
blur "$TMP/01.png" "$TMP/share.png" "scale=800:-2:flags=area,crop=800:600:0:ih*0.13" 13
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --user-data-dir="$TMP/chrome" --force-device-scale-factor=1 --window-size=800,600 \
    --virtual-time-budget=8000 --allow-file-access-from-files \
    --screenshot="$TMP/share_badge.png" \
    "file://$ROOT/tools/share-badge.html?img=file://$TMP/share.png" >/dev/null 2>&1 || true
[ -s "$TMP/share_badge.png" ] || { echo "Chrome 헤드리스 캡처에 실패했습니다 (CHROME=$CHROME)" >&2; exit 1; }
ffmpeg -loglevel error -y -i "$TMP/share_badge.png" -map_metadata -1 -q:v 3 \
    "$ROOT/upload/images/kakao_share_soon.jpg"

echo "격자(${i}장) + 메인 + 공유 썸네일을 만들었습니다."
