import { useEffect } from 'react';
import { focusPlayerIframe } from './useBlockEmbedRedirects';

const isTypingTarget = (target) => {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName || '').toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
};

const isIframeFocused = () => {
  const active = document.activeElement;
  return Boolean(active && String(active.tagName || '').toUpperCase() === 'IFRAME');
};

/**
 * Watch-page keyboard:
 * - Space / K / arrows / M are NOT stolen — they belong to the embed (normal play/pause/seek)
 * - If Space is pressed while focus is outside the player, focus the iframe first
 * - F fullscreen · Esc exit/back · R reload · [ ] servers · N/P episodes
 */
export function usePlayerKeyboard({
  enabled = true,
  playerShellRef,
  playerFrameRef,
  unlocked,
  unlock,
  onReload,
  onPrevServer,
  onNextServer,
  onSelectServer,
  onPrevEpisode,
  onNextEpisode,
  onBack
} = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const toggleFullscreen = async () => {
      const shell = playerShellRef?.current;
      if (!shell) return;
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await shell.requestFullscreen();
        }
      } catch {
        // ignored
      }
    };

    const ensurePlayerFocus = () => {
      if (!unlocked) unlock?.();
      focusPlayerIframe(playerFrameRef);
    };

    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // When the embed iframe already has focus, the browser delivers keys there —
      // this listener usually won't run. If it does, never steal media keys.
      if (isIframeFocused()) {
        if (keyIsMediaControl(event.key)) return;
      }

      const key = event.key;

      // Normal media keys: focus player, don't implement play/pause ourselves
      // (cross-origin embeds must handle Space themselves once focused).
      if (key === ' ' || key === 'k' || key === 'K') {
        event.preventDefault();
        ensurePlayerFocus();
        return;
      }

      if (
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'm' ||
        key === 'M' ||
        key === 'j' ||
        key === 'J' ||
        key === 'l' ||
        key === 'L' ||
        key === '.' ||
        key === ','
      ) {
        // Don't steal seek/volume/mute — hand focus to the player instead
        ensurePlayerFocus();
        return;
      }

      if (key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          event.preventDefault();
          return;
        }
        if (typeof onBack === 'function') {
          onBack();
          event.preventDefault();
        }
        return;
      }

      if (key === 'f' || key === 'F') {
        event.preventDefault();
        toggleFullscreen();
        return;
      }

      if (key === 'r' || key === 'R') {
        event.preventDefault();
        onReload?.();
        return;
      }

      if (key === '[') {
        event.preventDefault();
        onPrevServer?.();
        return;
      }

      if (key === ']') {
        event.preventDefault();
        onNextServer?.();
        return;
      }

      if (/^[1-9]$/.test(key)) {
        event.preventDefault();
        onSelectServer?.(Number(key) - 1);
        return;
      }

      // Episodes: N/P only — arrows reserved for normal seek inside the player
      if (key === 'p' || key === 'P') {
        if (typeof onPrevEpisode === 'function') {
          event.preventDefault();
          onPrevEpisode();
        }
        return;
      }

      if (key === 'n' || key === 'N') {
        if (typeof onNextEpisode === 'function') {
          event.preventDefault();
          onNextEpisode();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    enabled,
    playerShellRef,
    playerFrameRef,
    unlocked,
    unlock,
    onReload,
    onPrevServer,
    onNextServer,
    onSelectServer,
    onPrevEpisode,
    onNextEpisode,
    onBack
  ]);
}

function keyIsMediaControl(key) {
  return (
    key === ' ' ||
    key === 'k' ||
    key === 'K' ||
    key === 'm' ||
    key === 'M' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight' ||
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'j' ||
    key === 'J' ||
    key === 'l' ||
    key === 'L' ||
    key === 'f' ||
    key === 'F'
  );
}

/**
 * Native &lt;video&gt; keyboard controls (direct streams in MoviePlayer).
 * Space play/pause · ←→ seek · ↑↓ volume · M mute · F fullscreen
 */
export function useNativeVideoKeyboard(videoRef, containerRef, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const video = videoRef?.current;
      if (!video) return;

      const key = event.key;

      if (key === ' ' || key === 'k' || key === 'K') {
        event.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        return;
      }

      if (key === 'ArrowLeft' || key === 'j' || key === 'J') {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        return;
      }

      if (key === 'ArrowRight' || key === 'l' || key === 'L') {
        event.preventDefault();
        video.currentTime = Math.min(video.duration || video.currentTime + 5, video.currentTime + 5);
        return;
      }

      if (key === 'ArrowUp') {
        event.preventDefault();
        video.volume = Math.min(1, video.volume + 0.05);
        video.muted = false;
        return;
      }

      if (key === 'ArrowDown') {
        event.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        return;
      }

      if (key === 'm' || key === 'M') {
        event.preventDefault();
        video.muted = !video.muted;
        return;
      }

      if (key === 'f' || key === 'F') {
        event.preventDefault();
        const shell = containerRef?.current || video;
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          (shell.requestFullscreen || video.requestFullscreen)?.call(shell || video)?.catch?.(() => {});
        }
        return;
      }

      if (key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [videoRef, containerRef, enabled]);
}
