// 鍵盤輸入：支持兩種操作方式
// 方式1: WASD/方向鍵移動，J 攻擊，K 技能1，L 技能2，; 大絕
// 方式2: 方向鍵移動，A 攻擊，S 技能1，D 技能2，F 大絕

import { getViewSettings, subscribeViewSettings } from '../utils/viewSettings';

const KEY_MAPS = {
  'wasd-jkl': {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyJ: 'basic',
    KeyK: 'skill1',
    KeyL: 'skill2',
    Semicolon: 'ultimate',
    Space: 'evade',
    KeyU: 'item1',
    KeyI: 'item2',
  },
  'arrows-asdf': {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyA: 'basic',
    KeyS: 'skill1',
    KeyD: 'skill2',
    KeyF: 'ultimate',
    Space: 'evade',
    KeyQ: 'item1',
    KeyE: 'item2',
  },
  'wasd-ijkl': {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyJ: 'basic',
    KeyK: 'skill1',
    KeyL: 'skill2',
    KeyI: 'ultimate',
    Space: 'evade',
    KeyU: 'item1',
    KeyO: 'item2',
  },
  // 近景第三人稱：WASD 相對視角移動（於 get() 旋轉量化）、滑鼠控視角、左鍵=普攻、1234=招式
  'chase': {
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    Digit1: 'basic',
    Digit2: 'skill1',
    Digit3: 'skill2',
    Digit4: 'ultimate',
    Space: 'evade',
    KeyQ: 'item1',
    KeyE: 'item2',
  },
};

export function createInput(controlScheme = 'wasd-jkl') {
  const keyboardKeys = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false };
  const touchKeys = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false, aim: null };
  let enabled = false;
  let currentScheme = controlScheme;
  let keyMap = KEY_MAPS[currentScheme];

  // ---- 視角模式狀態：滑鼠控視角 + Pointer Lock（mode 1/2 才啟用）----
  let viewMode = 0;                   // 0=一般遠景 1=近景第三人稱 2=第一人稱
  let prevScheme = controlScheme;     // 退出視角模式時還原的操作方式
  let lookYaw = 0, lookPitch = 0;     // lookYaw=水平(=aim)；lookPitch：+ 仰視 / - 俯視（兩模式一致）
  let pointerLocked = false;
  let mouseBasic = false;             // 滑鼠左鍵 = 普通攻擊
  const LOOK_SENS = 0.0024, PITCH_MIN = -1.2, PITCH_MAX = 1.2;
  let viewCfg = getViewSettings();    // 滑鼠靈敏度 / 反轉 Y（由設定面板即時更新）
  subscribeViewSettings((s) => { viewCfg = s; });

  function setKey(code, down) {
    const action = keyMap[code];
    if (action) keyboardKeys[action] = down;
    return !!action;
  }

  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if (setKey(e.code, true)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (!enabled) return;
    if (setKey(e.code, false)) e.preventDefault();
  });
  // 失焦時清空，避免卡鍵
  window.addEventListener('blur', () => {
    for (const k in keyboardKeys) keyboardKeys[k] = false;
    for (const k in touchKeys) {
      if (k === 'aim') touchKeys[k] = null;
      else touchKeys[k] = false;
    }
    mouseBasic = false;
  });

  // ---- 滑鼠：Pointer Lock 下控視角 + 左鍵普攻（mode 1/2 才生效）----
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (!pointerLocked) mouseBasic = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!enabled || viewMode === 0 || !pointerLocked) return;
    const sens = LOOK_SENS * (viewCfg.sensitivity || 1);
    lookYaw += e.movementX * sens;            // 滑鼠右移 → 視角右轉
    lookPitch += (viewCfg.invertY ? e.movementY : -e.movementY) * sens; // 上移=仰視（反轉 Y 則相反）
    if (lookPitch > PITCH_MAX) lookPitch = PITCH_MAX;
    else if (lookPitch < PITCH_MIN) lookPitch = PITCH_MIN;
  });
  document.addEventListener('mousedown', (e) => {
    if (!enabled || viewMode === 0 || !pointerLocked) return;
    if (e.button === 0) mouseBasic = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseBasic = false;
  });

  return {
    enable() { enabled = true; },
    disable() {
      enabled = false;
      for (const k in keyboardKeys) keyboardKeys[k] = false;
      for (const k in touchKeys) {
        if (k === 'aim') touchKeys[k] = null;
        else touchKeys[k] = false;
      }
    },
    setScheme(scheme) {
      if (viewMode !== 0) { prevScheme = KEY_MAPS[scheme] ? scheme : prevScheme; return; } // 視角模式中只記住，退出時還原
      currentScheme = scheme;
      keyMap = KEY_MAPS[scheme];
      for (const k in keyboardKeys) keyboardKeys[k] = false;
      for (const k in touchKeys) {
        if (k === 'aim') touchKeys[k] = null;
        else touchKeys[k] = false;
      }
    },
    // 設定視角模式（0 一般 / 1 近景三人稱 / 2 第一人稱）：1/2 共用 'chase' keymap（相對視角 WASD + 滑鼠 + 1234）
    setViewMode(m) {
      m = m | 0; if (m < 0 || m > 2) m = 0;
      if (m === viewMode) return viewMode;
      const wasNormal = viewMode === 0;
      viewMode = m;
      if (m !== 0 && wasNormal) { prevScheme = currentScheme; currentScheme = 'chase'; keyMap = KEY_MAPS['chase']; }
      else if (m === 0) { currentScheme = KEY_MAPS[prevScheme] ? prevScheme : 'wasd-jkl'; keyMap = KEY_MAPS[currentScheme]; mouseBasic = false; }
      for (const k in keyboardKeys) keyboardKeys[k] = false;
      return viewMode;
    },
    setLook(yaw, pitch) { if (typeof yaw === 'number') lookYaw = yaw; if (typeof pitch === 'number') lookPitch = pitch; },
    getView() { return { mode: viewMode, yaw: lookYaw, pitch: lookPitch, locked: pointerLocked }; },
    getViewMode() { return viewMode; },
    setTouchDirection(dx, dy) {
      const dist = Math.hypot(dx, dy);
      if (dist > 0.15) {
        const nx = dx / dist;
        const ny = dy / dist;
        touchKeys.aim = Math.atan2(dy, dx);
        touchKeys.left = nx < -0.38;
        touchKeys.right = nx > 0.38;
        touchKeys.up = ny < -0.38;
        touchKeys.down = ny > 0.38;
      } else {
        touchKeys.left = false;
        touchKeys.right = false;
        touchKeys.up = false;
        touchKeys.down = false;
        touchKeys.aim = null;
      }
    },
    setTouchAction(action, pressed) {
      if (action in touchKeys) {
        touchKeys[action] = pressed;
      }
    },
    get() {
      if (viewMode !== 0) {
        // WASD 視為相對視角：W 前進 / S 後退 / A·D 平移；旋轉 lookYaw 後量化回 8 向世界布林
        const fwd = (keyboardKeys.up ? 1 : 0) - (keyboardKeys.down ? 1 : 0);
        const strafe = (keyboardKeys.right ? 1 : 0) - (keyboardKeys.left ? 1 : 0);
        const cy = Math.cos(lookYaw), sy = Math.sin(lookYaw);
        let wx = cy * fwd - sy * strafe;   // 世界 +x = 右
        let wy = sy * fwd + cy * strafe;   // 世界 +y = 下（朝鏡頭）
        let U = false, D = false, L = false, R = false;
        const d = Math.hypot(wx, wy);
        if (d > 0.001) { wx /= d; wy /= d; R = wx > 0.38; L = wx < -0.38; D = wy > 0.38; U = wy < -0.38; }
        return {
          up: U, down: D, left: L, right: R,
          basic: keyboardKeys.basic || mouseBasic,
          skill1: keyboardKeys.skill1,
          skill2: keyboardKeys.skill2,
          ultimate: keyboardKeys.ultimate,
          evade: keyboardKeys.evade,
          item1: keyboardKeys.item1,
          item2: keyboardKeys.item2,
          aim: lookYaw, // 近景第三人稱：朝向直接由滑鼠視角決定
        };
      }
      return {
        up: keyboardKeys.up || touchKeys.up,
        down: keyboardKeys.down || touchKeys.down,
        left: keyboardKeys.left || touchKeys.left,
        right: keyboardKeys.right || touchKeys.right,
        basic: keyboardKeys.basic || touchKeys.basic,
        skill1: keyboardKeys.skill1 || touchKeys.skill1,
        skill2: keyboardKeys.skill2 || touchKeys.skill2,
        ultimate: keyboardKeys.ultimate || touchKeys.ultimate,
        evade: keyboardKeys.evade || touchKeys.evade,
        item1: keyboardKeys.item1 || touchKeys.item1,
        item2: keyboardKeys.item2 || touchKeys.item2,
        aim: touchKeys.aim, // 人類玩家以移動方向轉向；魔王 AI 則合成 aim 角度
      };
    },
  };
}

export const EMPTY_INPUT = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false, aim: null };
