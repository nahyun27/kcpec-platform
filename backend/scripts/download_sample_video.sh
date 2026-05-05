#!/usr/bin/env bash
# 강의 플레이어 로컬 테스트용 샘플 MP4 다운로드.
# - 저작권 무료 (W3Schools "Big Buck Bunny" 발췌)
# - 이미 받은 파일이 있으면 다시 받지 않음 (멱등)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/static/videos"
mkdir -p "$DIR"
TARGET="$DIR/sample_lecture.mp4"

if [[ -s "$TARGET" ]]; then
  echo "이미 존재합니다: $TARGET ($(wc -c < "$TARGET") bytes)"
  exit 0
fi

URL="https://www.w3schools.com/html/mov_bbb.mp4"
echo "다운로드: $URL"
if curl -fsSL --retry 2 --max-time 60 -o "$TARGET" "$URL"; then
  echo "✓ 완료: $TARGET ($(wc -c < "$TARGET") bytes)"
  echo
  echo "어드민 영상 추가 모달에 아래 URL 입력:"
  echo "  http://localhost:8000/static/videos/sample_lecture.mp4"
  exit 0
fi

echo "❌ 다운로드 실패. 네트워크를 확인하거나 동일 위치에 직접 파일을 두세요." >&2
exit 1
