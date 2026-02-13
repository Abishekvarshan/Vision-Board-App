import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Music, Pause, Play, RefreshCcw, Volume2 } from 'lucide-react';

type MonkLink = {
  id: string;
  url: string;
  title?: string;
  publishedAt?: string;
};

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// --- Voice Bar Visualizer ---
const VoiceVisualizer: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  // Keep this deterministic (no Math.random in render) so the UI doesn't “jump” on re-render.
  const bars = Array.from({ length: 10 });
  return (
    <div className="flex items-end justify-center gap-[3px] h-6 px-4" aria-hidden="true">
      {bars.map((_, i) => (
        <div
          key={i}
          className={`w-[3px] bg-indigo-500 rounded-full ${isPlaying ? 'animate-bounce-voice' : ''}`}
          style={
            isPlaying
              ? {
                  animationDelay: `${i * 90}ms`,
                  animationDuration: `${650 + i * 35}ms`,
                }
              : { height: 3 }
          }
        />
      ))}

      <style>{`
        @keyframes bounce-voice {
          0%, 100% { height: 4px; opacity: 0.65; }
          50% { height: 18px; opacity: 1; }
        }
        .animate-bounce-voice {
          animation-name: bounce-voice;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};

// --- YouTube helpers ---
function extractYouTubeId(inputUrl: string): string | null {
  try {
    const u = new URL(inputUrl);
    // https://www.youtube.com/watch?v=VIDEO_ID
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // https://www.youtube.com/embed/VIDEO_ID
      const parts = u.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
    // https://youtu.be/VIDEO_ID
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    return null;
  } catch {
    return null;
  }
}

function formatPublishedAt(iso?: string): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

function toYouTubeWatchUrl(inputUrl: string): string {
  const id = extractYouTubeId(inputUrl);
  return id ? `https://www.youtube.com/watch?v=${id}` : inputUrl;
}

// --- Minimal YouTube Iframe API (audio-only via hidden iframe) ---
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeIframeApi(): Promise<any> {
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    // Already loaded
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector('script[data-youtube-iframe-api="true"]') as HTMLScriptElement | null;
    if (existing) {
      // If script exists but YT isn't ready yet, wait for global callback.
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.dataset.youtubeIframeApi = 'true';
    tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };

    document.head.appendChild(tag);
  });

  return ytApiPromise;
}

export const Podcast: React.FC = () => {
  const [links, setLinks] = useState<MonkLink[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');

  const playerRef = useRef<any>(null);
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerReadyRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);

  const active = useMemo(() => links.find((l) => l.id === activeId) || null, [links, activeId]);
  const activeVideoId = useMemo(() => (active ? extractYouTubeId(active.url) : null), [active]);

  const fetchLinks = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(
        'https://visionboard-ab444-default-rtdb.asia-southeast1.firebasedatabase.app/monk_links.json',
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`Failed to fetch links (${res.status})`);
      const data = (await res.json()) as Record<string, { url?: string; publishedAt?: string }> | null;

      const raw: MonkLink[] = Object.entries(data || {})
        .map(([id, v]) => ({
          id,
          url: String(v?.url || ''),
          title: (v as any)?.title ? String((v as any).title) : undefined,
          publishedAt: v?.publishedAt,
        }))
        .filter((x) => x.url && extractYouTubeId(x.url));

      // Deduplicate by YouTube video id (RTDB can contain duplicate pushes)
      const byVideo = new Map<string, MonkLink>();
      for (const item of raw) {
        const vid = extractYouTubeId(item.url);
        if (!vid) continue;
        const prev = byVideo.get(vid);
        if (!prev) byVideo.set(vid, item);
        else {
          const pt = prev.publishedAt ? new Date(prev.publishedAt).getTime() : 0;
          const it = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
          if (it >= pt) byVideo.set(vid, item);
        }
      }

      const parsed: MonkLink[] = Array.from(byVideo.values()).sort((a, b) => {
        const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bt - at;
      });

      setLinks(parsed);
      if (!activeId && parsed.length > 0) setActiveId(parsed[0].id);
    } catch (e: any) {
      setListError(e?.message || 'Failed to fetch links');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create player once, reuse it.
  // NOTE: We wait until we have an activeVideoId before creating the player.
  // Creating with an undefined videoId can cause the IFrame API to error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!playerMountRef.current) return;
      if (playerRef.current) return;
      if (!activeVideoId) return;
      try {
        setPlayerState('idle');
        const YT = await loadYouTubeIframeApi();
        if (cancelled) return;

        playerRef.current = new YT.Player(playerMountRef.current, {
          // Use 1x1 instead of 0x0; some browsers/extensions treat 0x0 iframes as invalid.
          height: '1',
          width: '1',
          videoId: activeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              playerReadyRef.current = true;
              // If we had a pending selection before the player became ready, load it now.
              const pending = pendingVideoIdRef.current;
              if (pending) {
                pendingVideoIdRef.current = null;
                try {
                  setPlayerState('loading');
                  playerRef.current?.loadVideoById(pending);
                } catch {
                  setPlayerState('error');
                }
              }
            },
            onStateChange: (ev: any) => {
              // https://developers.google.com/youtube/iframe_api_reference#Events
              const s = ev?.data;
              // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
              if (s === 1) setPlayerState('playing');
              else if (s === 2) setPlayerState('paused');
              else if (s === 3) setPlayerState('loading');
              else if (s === 0) setPlayerState('paused');
              else if (s === -1 || s === 5) setPlayerState('idle');
            },
            onError: () => setPlayerState('error'),
          },
        });
      } catch {
        setPlayerState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeVideoId]);

  // When active changes, load & play the new video
  useEffect(() => {
    const p = playerRef.current;
    if (!activeVideoId) return;

    // If the player isn't created yet, or isn't ready yet, queue the video.
    if (!p || !playerReadyRef.current) {
      pendingVideoIdRef.current = activeVideoId;
      return;
    }

    try {
      setPlayerState('loading');
      // cue then play for snappier switching
      p.loadVideoById(activeVideoId);
    } catch {
      setPlayerState('error');
    }
  }, [activeVideoId]);

  const play = () => {
    const p = playerRef.current;
    if (!p) return;
    if (!playerReadyRef.current) return;
    try {
      p.playVideo();
    } catch {
      setPlayerState('error');
    }
  };

  const pause = () => {
    const p = playerRef.current;
    if (!p) return;
    if (!playerReadyRef.current) return;
    try {
      p.pauseVideo();
    } catch {
      setPlayerState('error');
    }
  };

  const toggle = () => {
    if (playerState === 'playing') pause();
    else play();
  };

  const getEpisodeTitle = (l: MonkLink | null): string => {
    if (!l) return 'Select a session';
    const t = (l.title || '').trim();
    if (t) return t;
    const vid = extractYouTubeId(l.url);
    return vid ? `Episode: ${vid}` : toYouTubeWatchUrl(l.url);
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-300">
            <Music className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Audio Focus</h2>
        </div>
        <button
          onClick={fetchLinks}
          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCcw className={`w-5 h-5 ${loadingList ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/*
        Hidden player mount
        IMPORTANT: Do NOT use `display: none` here.
        The YouTube IFrame API can fail to initialize when the mount element is not rendered.
      */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-px h-px overflow-hidden opacity-0 pointer-events-none"
      >
        <div ref={playerMountRef} />
      </div>

      {/* Modern Player UI */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 p-6 space-y-6 relative overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-40 h-40 bg-slate-100 dark:bg-slate-800 rounded-[2.25rem] flex items-center justify-center shadow-inner relative group overflow-hidden">
            {activeVideoId ? (
              <img
                src={`https://img.youtube.com/vi/${activeVideoId}/mqdefault.jpg`}
                className="w-full h-full object-cover rounded-[2.25rem] opacity-85 group-hover:scale-110 transition-transform duration-700"
                alt="Thumbnail"
              />
            ) : (
              <Music className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            )}
            <div className="absolute inset-0 bg-indigo-600/10 rounded-[2.25rem]" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Now Streaming</p>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight px-4 line-clamp-2">
              {getEpisodeTitle(active)}
            </h3>
            <p className="text-xs font-medium text-slate-400">{active ? formatPublishedAt(active.publishedAt) : 'VisionFlow Original'}</p>
          </div>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={toggle}
            className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-200/50 dark:shadow-indigo-950/40 hover:bg-indigo-700 hover:scale-110 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!activeVideoId || playerState === 'loading'}
            aria-label={playerState === 'playing' ? 'Pause' : 'Play'}
            title={playerState === 'playing' ? 'Pause' : 'Play'}
          >
            {playerState === 'playing' ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
        </div>

        {/* Visualizer at Bottom */}
        <div className="pt-4">
          <VoiceVisualizer isPlaying={playerState === 'playing'} />
        </div>

        {(listError || playerState === 'error') && (
          <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {listError || 'Player failed to load/play this video.'}
          </div>
        )}
      </div>

      {/* Library */}
      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Library</h4>

        {loadingList ? (
          <div className="px-2 text-slate-500 dark:text-slate-400">Loading…</div>
        ) : links.length === 0 ? (
          <div className="px-2 text-slate-500 dark:text-slate-400">No links found.</div>
        ) : (
          <div className="space-y-3">
            {links.map((l) => {
              const selected = l.id === activeId;
              const isPlayingThis = selected && playerState === 'playing';
              const id = extractYouTubeId(l.url);
              const title = (l.title || '').trim();

              return (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveId(l.id);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all border ${
                    selected
                      ? 'bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900/30 shadow-md ring-1 ring-indigo-50 dark:ring-indigo-950/30'
                      : 'bg-white/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                  aria-label={`Select ${title || id || 'episode'}`}
                >
                  <div
                    className={`p-3 rounded-2xl ${
                      selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-200'}`}>
                      {title || id || toYouTubeWatchUrl(l.url)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {formatPublishedAt(l.publishedAt)}
                    </p>
                  </div>

                  {isPlayingThis && (
                    <div className="flex gap-[2px] h-3" aria-hidden="true">
                      <div className="w-[2px] h-full bg-indigo-500 animate-bounce-voice" />
                      <div className="w-[2px] h-full bg-indigo-500 animate-bounce-voice" style={{ animationDelay: '0.1s' }} />
                      <div className="w-[2px] h-full bg-indigo-500 animate-bounce-voice" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
