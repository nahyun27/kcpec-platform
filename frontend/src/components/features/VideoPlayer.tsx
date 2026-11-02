"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "plyr/dist/plyr.css";

// Plyr 인스턴스에서 우리가 실제로 쓰는 메서드만 노출하는 최소 인터페이스.
interface PlyrLike {
  currentTime: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly seeking: boolean;
  play(): unknown;
  on(event: string, callback: () => void): void;
  destroy(): void;
}

export interface VideoPlayerTimeUpdate {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isSeeking: boolean;
}

interface Props {
  src: string;
  // 이어보기 시작점 + max_watched_position 초기값 (서버 last_position_sec)
  initialTime?: number;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (info: VideoPlayerTimeUpdate) => void;
  onEnded?: () => void;
  // 재생 주소(서명 URL)는 1시간 뒤 만료된다. 오래 멈춰 뒀다가 다시 틀면 영상 요청이
  // 거절돼 재생이 멈추던 문제(2026-11) — 오류가 나면 이 함수로 새 주소를 받아
  // 보던 위치부터 이어 재생한다.
  refreshSrc?: () => Promise<string>;
}

const SEEK_TOLERANCE_SEC = 0.5;
// 새 주소로도 계속 실패하면(영상 자체 문제 등) 무한 반복하지 않도록 횟수 제한.
const MAX_SRC_REFRESH = 3;
const PLAYER_THEME: CSSProperties = {
  ["--plyr-color-main" as string]: "#1C3461",
};

/**
 * Plyr 플레이어를 React 컴포넌트로 격리.
 * - video 엘리먼트를 JS 로 직접 만들어 React DOM 트리 밖에서 관리
 * - 부모는 key={lectureId} 로 강제 remount → 강의 전환 시 깨끗한 lifecycle
 * - cleanup: Plyr.destroy() 후 video.remove() 순서, 둘 다 try/catch
 * - 시청한 구간만 seek 가능, 시청 완료 구간 오버레이(.plyr__progress 위)
 */
export default function VideoPlayer({
  src,
  initialTime,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  refreshSrc,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 콜백을 ref 로 동기화 — Plyr 핸들러는 마운트 시 closure 를 잡으므로
  // 부모가 콜백 신규 생성해도 stale 안 되도록.
  const cbRef = useRef({ onLoadedMetadata, onTimeUpdate, onEnded, refreshSrc });
  useEffect(() => {
    cbRef.current = { onLoadedMetadata, onTimeUpdate, onEnded, refreshSrc };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const video = document.createElement("video");
    video.src = src;
    video.className = "h-full w-full";
    video.playsInline = true;
    container.appendChild(video);

    let player: PlyrLike | null = null;
    let cancelled = false;
    let isProgrammaticSeek = false;
    let overlay: HTMLDivElement | null = null;
    // max_watched_position — 서버 last_position_sec 로 초기화, 자연 재생으로 자동 증가.
    let maxWatched = initialTime ?? 0;
    // loadedmetadata 때 이동할 위치. 처음엔 이어보기 위치, 주소를 새로 받은 뒤엔 멈춘 위치.
    let resumeAt = initialTime ?? 0;
    let resumePlaying = false;
    let srcRefreshCount = 0;
    let refreshingSrc = false;
    // 사용자가 재생하려던 상태인지(play/pause 이벤트로 추적). 오류가 나는 순간의
    // paused 값은 브라우저마다 달라 믿을 수 없다.
    let wantsPlay = false;

    async function recoverFromError() {
      const refresh = cbRef.current.refreshSrc;
      if (!refresh || refreshingSrc || srcRefreshCount >= MAX_SRC_REFRESH) return;
      refreshingSrc = true;
      srcRefreshCount += 1;
      resumeAt = video.currentTime || resumeAt;
      resumePlaying = wantsPlay;
      try {
        const next = await refresh();
        if (cancelled) return;
        video.src = next;
        video.load();
      } catch {
        /* 주소 재발급 실패 — 그대로 둔다(새로고침 안내는 브라우저 기본 오류 표시) */
      } finally {
        refreshingSrc = false;
      }
    }
    video.addEventListener("error", () => void recoverFromError());

    function updateOverlay() {
      if (!overlay || !player || !player.duration) return;
      const pct = Math.min(100, (maxWatched / player.duration) * 100);
      overlay.style.width = `${pct}%`;
    }

    import("plyr").then((mod) => {
      if (cancelled) return;
      const PlyrCtor = mod.default;
      const instance = new PlyrCtor(video, {
        speed: { selected: 1, options: [0.5, 1, 1.25, 1.5, 2] },
        controls: [
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "speed",
          "fullscreen",
        ],
      }) as unknown as PlyrLike;
      player = instance;

      // 시청 완료 구간 오버레이를 .plyr__progress 컨테이너 안에 삽입
      const wrapper = video.closest(".plyr");
      const progressEl = wrapper?.querySelector<HTMLElement>(".plyr__progress");
      if (progressEl) {
        const ov = document.createElement("div");
        ov.style.cssText = [
          "position:absolute",
          "left:0",
          "top:50%",
          "transform:translateY(-50%)",
          "height:var(--plyr-range-track-height,5px)",
          "width:0%",
          "background:rgba(28,52,97,0.4)",
          "border-radius:100px",
          "pointer-events:none",
          "z-index:1",
          "transition:width 0.1s linear",
        ].join(";");
        progressEl.appendChild(ov);
        overlay = ov;
      }

      instance.on("loadedmetadata", () => {
        // 이어보기 위치로 seek (programmatic 플래그로 seek-block 회피)
        if (resumeAt > 0 && resumeAt < instance.duration) {
          isProgrammaticSeek = true;
          instance.currentTime = resumeAt;
        }
        if (resumePlaying) {
          resumePlaying = false;
          void Promise.resolve(instance.play()).catch(() => {});
        }
        if (Number.isFinite(instance.duration) && instance.duration > 0) {
          cbRef.current.onLoadedMetadata?.(instance.duration);
        }
        updateOverlay();
      });

      instance.on("timeupdate", () => {
        const t = instance.currentTime;
        // 자연 재생일 때만 max 증가
        if (instance.playing && !instance.seeking && t > maxWatched) {
          maxWatched = t;
          updateOverlay();
        }
        cbRef.current.onTimeUpdate?.({
          currentTime: t,
          duration: instance.duration,
          isPlaying: instance.playing,
          isSeeking: instance.seeking,
        });
      });

      // play/pause 즉시 상위에 알림 — timeupdate 는 재생 중에만 계속 발생하므로
      // pause 직후에는 다음 tick이 없어 상위의 "재생 중" 상태가 stale 하게 남는다
      // (이탈 경고가 일시정지 후에도 계속 뜨는 원인이었음).
      instance.on("pause", () => {
        if (!refreshingSrc) wantsPlay = false;
        cbRef.current.onTimeUpdate?.({
          currentTime: instance.currentTime,
          duration: instance.duration,
          isPlaying: false,
          isSeeking: instance.seeking,
        });
      });

      instance.on("play", () => {
        wantsPlay = true;
        cbRef.current.onTimeUpdate?.({
          currentTime: instance.currentTime,
          duration: instance.duration,
          isPlaying: true,
          isSeeking: instance.seeking,
        });
      });

      instance.on("seeking", () => {
        if (isProgrammaticSeek) {
          isProgrammaticSeek = false;
          return;
        }
        if (instance.currentTime > maxWatched + SEEK_TOLERANCE_SEC) {
          isProgrammaticSeek = true;
          instance.currentTime = maxWatched;
        }
      });

      instance.on("ended", () => {
        if (player) {
          maxWatched = player.duration;
          updateOverlay();
        }
        cbRef.current.onEnded?.();
      });
    });

    return () => {
      cancelled = true;
      // destroy 가 detached DOM 에서 실패해도 silent ignore.
      // video.remove() 도 마찬가지 — Plyr.destroy() 가 이미 정리한 경우가 있어 try/catch.
      try {
        player?.destroy();
      } catch {
        /* DOM 이미 정리됨 */
      }
      try {
        video.remove();
      } catch {
        /* 이미 제거됨 */
      }
      player = null;
      overlay = null;
    };
    // 마운트 시 1회. 강의 전환 시 부모가 key 로 remount 하므로 deps 비움.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={PLAYER_THEME}
    />
  );
}
