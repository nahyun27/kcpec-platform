#!/usr/bin/env bash
# 한글 PDF 생성을 위한 NanumGothic 폰트 다운로드.
# - 정식 배포 미러는 자주 바뀌므로 두어 곳을 fallback 으로 시도한다.
# - 이미 존재하면 다시 받지 않는다.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/static/fonts"
mkdir -p "$DIR"
TARGET="$DIR/NanumGothic.ttf"

if [[ -s "$TARGET" ]]; then
  echo "이미 존재합니다: $TARGET"
  exit 0
fi

URLS=(
  "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf"
  "https://cdn.jsdelivr.net/gh/google/fonts/ofl/nanumgothic/NanumGothic-Regular.ttf"
)

for URL in "${URLS[@]}"; do
  echo "다운로드 시도: $URL"
  if curl -fsSL --retry 2 --max-time 30 -o "$TARGET" "$URL"; then
    echo "완료: $TARGET ($(wc -c < "$TARGET") bytes)"
    exit 0
  fi
done

echo "❌ NanumGothic.ttf 다운로드 실패. 수동으로 $TARGET 에 배치해 주세요." >&2
exit 1
