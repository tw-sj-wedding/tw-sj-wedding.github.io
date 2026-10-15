#!/usr/bin/env bash
# 스튜디오 원본 → 흐리게 구운 미리보기 사진을 만듭니다. (macOS: sips + ffmpeg)
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
#   - 넘긴 순서대로 upload/gallery/preview_01.jpg, preview_02.jpg ... (600x800)
#   - 첫 장으로 메인 사진 upload/images/main_preview.jpg (가로 800)
#     과 카톡 공유 썸네일 upload/images/kakao_share_preview.jpg (800x600) 도 만듭니다.
#   - 만든 뒤 index.html 의 갤러리 figure 를 장수에 맞추고
#     python3 tools/sync-gallery-sizes.py 로 data-size 를 맞춥니다.
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

# 블러 세기 = 결과 가로폭 / 60 (600px → sigma 10). 누군지는 알아보되 피부·디테일은 뭉개집니다.
blur() { # 입력 출력 블러-앞단-필터 sigma
    ffmpeg -loglevel error -y -i "$1" \
        -vf "$3,gblur=sigma=$4:steps=3" \
        -map_metadata -1 -q:v 3 "$2"
}

# 아이폰 원본은 Display P3 라서 그대로 넣으면 ffmpeg 가 프로필을 버려 색이 바랩니다.
# sips 로 sRGB 픽셀로 먼저 바꿔 둡니다.
to_srgb() {
    sips -s format png --matchTo "$SRGB" "$1" --out "$2" >/dev/null
}

rm -f "$ROOT"/upload/gallery/preview_*.jpg

i=1
for src in "$@"; do
    n=$(printf '%02d' "$i")
    to_srgb "$src" "$TMP/$n.png"
    blur "$TMP/$n.png" "$ROOT/upload/gallery/preview_$n.jpg" \
        "scale=600:800:force_original_aspect_ratio=increase:flags=area,crop=600:800" 10
    i=$((i + 1))
done

# 메인: 가로 800, 세로는 원본 비율
blur "$TMP/01.png" "$ROOT/upload/images/main_preview.jpg" "scale=800:-2:flags=area" 13
# 공유 썸네일: 800x600, 얼굴이 들어가도록 위쪽 13% 지점부터 자릅니다
blur "$TMP/01.png" "$ROOT/upload/images/kakao_share_preview.jpg" \
    "scale=800:-2:flags=area,crop=800:600:0:ih*0.13" 13

echo "갤러리 $((i - 1))장 + 메인 + 공유 썸네일을 만들었습니다."
