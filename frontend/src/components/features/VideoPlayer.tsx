"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import "plyr/dist/plyr.css";

// Plyr 인스턴스에서 우리가 실제로 쓰는 메서드만 노출하는 최소 인터페이스.
interface PlyrLike {
  currentTime: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly seeking: boolean;
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
}

const SEEK_TOLERANCE_SEC = 0.5;
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 콜백을 ref 로 동기화 — Plyr 핸들러는 마운트 시 closure 를 잡으므로
  // 부모가 콜백 신규 생성해도 stale 안 되도록.
  const cbRef = useRef({ onLoadedMetadata, onTimeUpdate, onEnded });
  useEffect(() => {
    cbRef.current = { onLoadedMetadata, onTimeUpdate, onEnded };
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
        if (
          initialTime != null &&
          initialTime > 0 &&
          initialTime < instance.duration
        ) {
          isProgrammaticSeek = true;
          instance.currentTime = initialTime;
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
        cbRef.current.onTimeUpdate?.({
          currentTime: instance.currentTime,
          duration: instance.duration,
          isPlaying: false,
          isSeeking: instance.seeking,
        });
      });

      instance.on("play", () => {
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
