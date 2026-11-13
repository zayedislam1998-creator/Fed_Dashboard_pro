import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceMemoPlayerProps {
  audioUrl: string;
}

export const VoiceMemoPlayer: React.FC<VoiceMemoPlayerProps> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSpeedToggle = () => {
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-black/10 dark:bg-white/10 backdrop-blur-xs max-w-xs w-full text-inherit">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Circle Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs hover:scale-105 transition-transform cursor-pointer"
        aria-label={isPlaying ? 'Pause voice memo' : 'Play voice memo'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Progress & Wave Bar */}
      <div className="flex-1 min-w-0 space-y-1">
        <div
          className="relative h-1.5 w-full bg-black/15 dark:bg-white/20 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            if (audioRef.current && duration > 0) {
              audioRef.current.currentTime = clickPos * duration;
            }
          }}
        >
          <div
            className="h-full bg-current rounded-full transition-all duration-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-75 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <span className="flex items-center gap-0.5">
            <Mic className="w-2.5 h-2.5" />
            <span>{formatSeconds(duration || 0)}</span>
          </span>
        </div>
      </div>

      {/* Speed Multiplier Pill */}
      <button
        type="button"
        onClick={handleSpeedToggle}
        className="px-1.5 py-0.5 rounded-lg bg-black/10 dark:bg-white/15 text-[10px] font-bold hover:bg-black/20 dark:hover:bg-white/25 transition-colors cursor-pointer shrink-0"
      >
        {playbackRate}x
      </button>
    </div>
  );
};
