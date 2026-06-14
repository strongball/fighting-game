// 音乐管理器：根据游戏阶段控制背景音乐的播放与切换
/// <reference types="vite/client" />

export type MusicTrack = 'lobby' | 'game';

interface AudioManager {
  currentTrack: MusicTrack | null;
  audio: HTMLAudioElement | null;
  playMusic: (track: MusicTrack) => void;
  stopMusic: () => void;
  setVolume: (volume: number) => void;
}

let instance: AudioManager | null = null;

// import.meta.env.BASE_URL 由 Vite 注入，對應 vite.config.ts 的 base（'/fighting-game/'）
const BASE = import.meta.env.BASE_URL;
const MUSIC_PATHS: Record<MusicTrack, string> = {
  lobby: `${BASE}assets/music/room_pick.mp3`,
  game: `${BASE}assets/music/playing_background.mp3`,
};

export function getAudioManager(): AudioManager {
  if (!instance) {
    instance = {
      currentTrack: null,
      audio: null,

      playMusic(track: MusicTrack) {
        // 如果已在播放同一首音乐，不需要重新开始
        if (this.currentTrack === track && this.audio && !this.audio.paused) {
          return;
        }

        // 停止当前音乐
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }

        // 创建或获取音乐元素
        if (!this.audio) {
          this.audio = new Audio();
          this.audio.loop = true; // 循环播放
          this.audio.volume = 0.2; // 默认音量 50%
        }

        // 切换音乐源并播放
        this.audio.src = MUSIC_PATHS[track];
        this.audio.play().catch((err) => {
          console.warn(`无法播放音乐 ${track}:`, err);
        });

        this.currentTrack = track;
      },

      stopMusic() {
        if (this.audio) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }
        this.currentTrack = null;
      },

      setVolume(volume: number) {
        if (this.audio) {
          this.audio.volume = Math.max(0, Math.min(1, volume));
        }
      },
    };
  }

  return instance;
}
