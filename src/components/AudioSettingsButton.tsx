// 音效設定按鈕：固定在右上角的齒輪鈕，點擊開啟面板調整「背景音樂」與「音效」音量（含靜音）。
// 全域掛在 App 最上層，因此選單/大廳/遊戲中/結算頁都能使用（遊戲內外皆可調）。

import { useEffect, useState } from 'react';
import {
  getAudioSettings,
  subscribeAudioSettings,
  updateAudioSettings,
  type AudioSettings,
} from '../utils/audioSettings';
import {
  getViewSettings,
  subscribeViewSettings,
  updateViewSettings,
  type ViewSettings,
} from '../utils/viewSettings';
import {
  getCameraView,
  subscribeCameraView,
  requestCameraMode,
  type CameraView,
  type CameraMode,
} from '../utils/cameraView';
import {
  getJoystickSettings,
  subscribeJoystickSettings,
  updateJoystickSettings,
  type JoystickSettings,
} from '../utils/joystickSettings';

// 是否為觸控裝置（＝遊戲內會畫出虛擬搖桿的條件，與 render3d/hud.js、controller/camera.ts 一致）。
// 觸控能力在執行期不會改變，模組載入時判定一次即可。
const IS_TOUCH = typeof window !== 'undefined'
  && (('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0));

interface AudioSettingsButtonProps {
  canLeave?: boolean;       // 是否顯示「離開遊戲」（在選單頁已是最前面，不顯示）
  onLeave?: () => void;     // 離開：斷線並重新載入回到主選單（建房／加房）
}

export function AudioSettingsButton({ canLeave, onLeave }: AudioSettingsButtonProps = {}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AudioSettings>(getAudioSettings());
  const [viewCfg, setViewCfg] = useState<ViewSettings>(getViewSettings());
  const [cameraView, setCameraView] = useState<CameraView>(getCameraView());
  const [joystickCfg, setJoystickCfg] = useState<JoystickSettings>(getJoystickSettings());

  useEffect(() => subscribeAudioSettings(setSettings), []);
  useEffect(() => subscribeViewSettings(setViewCfg), []);
  useEffect(() => subscribeCameraView(setCameraView), []);
  useEffect(() => subscribeJoystickSettings(setJoystickCfg), []);

  // ESC 開/關設定（戰鬥中也能用；開啟時解除滑鼠鎖定，讓游標可操作面板）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      setOpen((v) => {
        const next = !v;
        if (next && document.pointerLockElement) document.exitPointerLock();
        return next;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        className="settings-fab"
        title="設定（Esc）"
        aria-label="設定"
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>

      {open && (
        <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-head">
              <h3>設定</h3>
              <button className="settings-close" aria-label="關閉" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            <VolumeRow
              label="背景音樂"
              volume={settings.musicVolume}
              muted={settings.musicMuted}
              onVolume={(v) => updateAudioSettings({ musicVolume: v, musicMuted: false })}
              onToggleMute={() => updateAudioSettings({ musicMuted: !settings.musicMuted })}
            />
            <VolumeRow
              label="音效"
              volume={settings.sfxVolume}
              muted={settings.sfxMuted}
              onVolume={(v) => updateAudioSettings({ sfxVolume: v, sfxMuted: false })}
              onToggleMute={() => updateAudioSettings({ sfxMuted: !settings.sfxMuted })}
            />
            {cameraView.active && (
              <CameraViewRow mode={cameraView.mode} onMode={requestCameraMode} />
            )}
            <SensitivityRow
              sensitivity={viewCfg.sensitivity}
              onSensitivity={(v) => updateViewSettings({ sensitivity: v })}
            />
            <AutoAimRow
              enabled={viewCfg.autoAim}
              onToggle={(v) => updateViewSettings({ autoAim: v })}
            />
            {/* 搖桿模式／大小／全螢幕：僅觸控裝置顯示（桌機無虛擬搖桿、全螢幕含鎖橫向僅手機需要） */}
            {IS_TOUCH && (
              <>
                <JoystickModeRow
                  mode={joystickCfg.mode}
                  onMode={(m) => updateJoystickSettings({ mode: m })}
                />
                <JoystickScaleRow
                  scale={joystickCfg.scale}
                  onScale={(v) => updateJoystickSettings({ scale: v })}
                />
                <FullscreenRow />
              </>
            )}

            {canLeave && onLeave && (
              <div className="settings-leave">
                <button
                  className="btn danger"
                  onClick={() => {
                    if (window.confirm('確定要離開遊戲並回到主選單嗎？')) onLeave();
                  }}
                >
                  🚪 離開遊戲
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface VolumeRowProps {
  label: string;
  volume: number;
  muted: boolean;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}

function VolumeRow({ label, volume, muted, onVolume, onToggleMute }: VolumeRowProps) {
  const pct = Math.round((muted ? 0 : volume) * 100);
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">{label}</span>
        <span className="settings-pct">{pct}%</span>
      </div>
      <div className="settings-row-ctrl">
        <button
          className="settings-mute"
          aria-label={muted ? '解除靜音' : '靜音'}
          onClick={onToggleMute}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

interface CameraViewRowProps {
  mode: CameraMode;
  onMode: (m: CameraMode) => void;
}

// 視角切換（戰鬥中）：遠景 / 近景第三人稱 / 第一人稱。等同鍵盤 V 循環，但行動端無鍵盤，靠此切換。
function CameraViewRow({ mode, onMode }: CameraViewRowProps) {
  const opts: { m: CameraMode; label: string }[] = [
    { m: 0, label: '遠景' },
    { m: 1, label: '第三人稱' },
    { m: 2, label: '第一人稱' },
  ];
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">
          視角<span style={{ color: '#7b8a97', fontSize: '11px', marginLeft: '6px' }}>戰鬥中・鍵盤 V</span>
        </span>
      </div>
      <div className="settings-seg">
        {opts.map((o) => (
          <button
            key={o.m}
            className={`settings-seg-btn${mode === o.m ? ' active' : ''}`}
            aria-pressed={mode === o.m}
            onClick={() => onMode(o.m)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SensitivityRowProps {
  sensitivity: number;
  onSensitivity: (v: number) => void;
}

// 視角靈敏度：控制近景/第一人稱「左右轉」的速度（滑鼠與行動端轉視角搖桿共用）。俯仰已鎖定，故無上下反轉選項。
function SensitivityRow({ sensitivity, onSensitivity }: SensitivityRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">視角靈敏度<span style={{ color: '#7b8a97', fontSize: '11px', marginLeft: '6px' }}>左右轉</span></span>
        <span className="settings-pct">{sensitivity.toFixed(1)}×</span>
      </div>
      <div className="settings-row-ctrl">
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={sensitivity}
          onChange={(e) => onSensitivity(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

interface AutoAimRowProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}

// 自動瞄準：出招時把朝向微吸附到前方錐形內的敵人（俯視角難瞄的輔助）。預設開。
function AutoAimRow({ enabled, onToggle }: AutoAimRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">自動瞄準<span style={{ color: '#7b8a97', fontSize: '11px', marginLeft: '6px' }}>出招吸附前方敵人・按住右鍵鎖定</span></span>
      </div>
      <div className="settings-seg">
        <button
          className={`settings-seg-btn${enabled ? ' active' : ''}`}
          aria-pressed={enabled}
          onClick={() => onToggle(true)}
        >
          開
        </button>
        <button
          className={`settings-seg-btn${!enabled ? ' active' : ''}`}
          aria-pressed={!enabled}
          onClick={() => onToggle(false)}
        >
          關
        </button>
      </div>
    </div>
  );
}

interface JoystickModeRowProps {
  mode: 'fixed' | 'floating';
  onMode: (m: 'fixed' | 'floating') => void;
}

function JoystickModeRow({ mode, onMode }: JoystickModeRowProps) {
  const opts: { m: 'fixed' | 'floating'; label: string }[] = [
    { m: 'fixed', label: 'Fixed' },
    { m: 'floating', label: 'Floating' },
  ];
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">搖桿模式<span style={{ color: '#7b8a97', fontSize: '11px', marginLeft: '6px' }}>手機用</span></span>
      </div>
      <div className="settings-seg">
        {opts.map((o) => (
          <button
            key={o.m}
            className={`settings-seg-btn${mode === o.m ? ' active' : ''}`}
            aria-pressed={mode === o.m}
            onClick={() => onMode(o.m)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface JoystickScaleRowProps {
  scale: number;
  onScale: (v: number) => void;
}

function JoystickScaleRow({ scale, onScale }: JoystickScaleRowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">搖桿大小</span>
        <span className="settings-pct">{scale.toFixed(1)}×</span>
      </div>
      <div className="settings-row-ctrl">
        <input
          type="range"
          min={0.6}
          max={2.0}
          step={0.1}
          value={scale}
          onChange={(e) => onScale(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

function FullscreenRow() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          try {
            orientation.unlock();
          } catch (err) {
            console.warn('Failed to unlock orientation:', err);
          }
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => {
          const orientation = screen.orientation as any;
          if (orientation && typeof orientation.lock === 'function') {
            orientation.lock('landscape').catch((err: any) => {
              console.warn('Failed to lock orientation to landscape:', err);
            });
          }
        })
        .catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="settings-row">
      <div className="settings-row-top">
        <span className="settings-label">畫面設定</span>
        <span className="settings-pct">{isFullscreen ? '全螢幕' : '視窗'}</span>
      </div>
      <div className="settings-row-ctrl">
        <button
          className="btn primary"
          style={{ width: '100%', padding: '8px 12px', fontSize: '13px', margin: '4px 0 0' }}
          onClick={handleToggle}
        >
          {isFullscreen ? '🖥 退出全螢幕' : '🖥 進入全螢幕'}
        </button>
      </div>
    </div>
  );
}
