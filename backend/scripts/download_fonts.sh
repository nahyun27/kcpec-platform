#!/usr/bin/env bash
# 한글 PDF 생성을 위한 NanumGothic Regular / Bold 폰트 다운로드.
# - 정식 배포 미러는 자주 바뀌므로 두어 곳을 fallback 으로 시도한다.
# - 이미 존재하는 파일은 다시 받지 않는다.
# - Bold 다운로드 실패는 치명적이지 않음 (PDF 생성기가 Regular 로 폴백).
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/static/fonts"
mkdir -p "$DIR"

download_one() {
  local target="$1"
  shift
  local urls=("$@")

  if [[ -s "$target" ]]; then
    echo "이미 존재합니다: $target"
    return 0
  fi

  for url in "${urls[@]}"; do
    echo "다운로드 시도: $url → $(basename "$target")"
    if curl -fsSL --retry 2 --max-time 30 -o "$target" "$url"; then
      echo "완료: $target ($(wc -c < "$target") bytes)"
      return 0
    fi
  done

  echo "❌ $(basename "$target") 다운로드 실패." >&2
  return 1
}

# 1) Regular — 필수
download_one "$DIR/NanumGothic.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf" \
  "https://cdn.jsdelivr.net/gh/google/fonts/ofl/nanumgothic/NanumGothic-Regular.ttf" \
  || { echo "Regular 폰트 없이는 PDF 생성 불가 — 수동 배치 필요." >&2; exit 1; }

# 2) Bold — 선택 (실패해도 진행)
download_one "$DIR/NanumGothicBold.ttf" \
  "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Bold.ttf" \
  "https://cdn.jsdelivr.net/gh/google/fonts/ofl/nanumgothic/NanumGothic-Bold.ttf" \
  || echo "⚠️  Bold 폰트는 다운로드 실패. PDF 생성 시 Regular 로 폴백됩니다." >&2
