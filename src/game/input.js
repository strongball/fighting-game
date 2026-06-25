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
  // lookYaw=水平視角(=aim)。lookPitch=俯仰角，已「鎖定」：由 camera 進入各模式時設成固定值
  //（近景稍俯視、第一人稱平視），滑鼠/搖桿只能左右轉、不能上下 —— 避免上下擺動造成的暈眩。
  let lookYaw = 0, lookPitch = 0;
  let pointerLocked = false;
  let mouseBasic = false;             // 滑鼠左鍵 = 普通攻擊
  const LOOK_SENS = 0.0024;
  // 行動端「轉視角」搖桿：水平偏移量 -1..1，於 getView() 依實時 dt 連續積分（按住即持續左右轉）
  let lookStickX = 0;
  let lastLookTs = 0;                  // 上次積分時間戳；停手歸零以重置 dt 基準
  const LOOK_TOUCH_YAW = 2.8;         // 滿偏每秒左右旋轉弧度
  let viewCfg = getViewSettings();    // 視角靈敏度（由設定面板即時更新）
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
    lookStickX = 0; lastLookTs = 0;
  });

  // ---- 滑鼠：Pointer Lock 下控視角 + 左鍵普攻（mode 1/2 才生效）----
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = !!document.pointerLockElement;
    if (!pointerLocked) mouseBasic = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!enabled || viewMode === 0 || !pointerLocked) return;
    const sens = LOOK_SENS * (viewCfg.sensitivity || 1);
    lookYaw += e.movementX * sens;            // 滑鼠左右 → 視角左右轉（俯仰已鎖定，忽略上下移動）
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
      lookStickX = 0; lastLookTs = 0;
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
    // 設定視角模式（0 一般 / 1 近景三人稱 / 2 第一人稱）。視角模式 keymap = 原操作方式 ∪ chase：
    // 保留原本技能鍵（如 wasd-jkl 的 J/K/L/;），再疊上 chase（WASD 相對移動 + 1234 + 滑鼠），
    // chase 後蓋確保 WASD 維持移動 → 原配置與 1/2/3/4 兩套出招鍵並存。
    setViewMode(m) {
      m = m | 0; if (m < 0 || m > 2) m = 0;
      if (m === viewMode) return viewMode;
      const wasNormal = viewMode === 0;
      viewMode = m;
      if (m !== 0 && wasNormal) { prevScheme = currentScheme; currentScheme = 'chase'; keyMap = { ...(KEY_MAPS[prevScheme] || {}), ...KEY_MAPS['chase'] }; }
      else if (m === 0) { currentScheme = KEY_MAPS[prevScheme] ? prevScheme : 'wasd-jkl'; keyMap = KEY_MAPS[currentScheme]; mouseBasic = false; }
      for (const k in keyboardKeys) keyboardKeys[k] = false;
      return viewMode;
    },
    setLook(yaw, pitch) { if (typeof yaw === 'number') lookYaw = yaw; if (typeof pitch === 'number') lookPitch = pitch; },
    // 行動端「轉視角」搖桿：只取水平分量（俯仰已鎖定，僅左右轉）。死區內視為放開。
    setTouchLook(dx) {
      if (Math.abs(dx) < 0.12) { lookStickX = 0; return; }
      lookStickX = Math.max(-1, Math.min(1, dx));
    },
    // 每幀（draw）呼叫一次：依實時 dt 積分觸控搖桿造成的「左右」視角變化（按住即持續轉；俯仰固定不動）。
    getView() {
      if (viewMode !== 0 && lookStickX !== 0) {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let dt = lastLookTs ? (now - lastLookTs) / 1000 : 0;
        if (dt > 0.05) dt = 0.05;              // 背景分頁回來時限制單幀跳動
        lastLookTs = now;
        const sens = viewCfg.sensitivity || 1;
        lookYaw += lookStickX * LOOK_TOUCH_YAW * sens * dt;          // 右推 → 視角右轉
      } else {
        lastLookTs = 0;                        // 放開：重置 dt 基準，避免下次按住瞬跳
      }
      return { mode: viewMode, yaw: lookYaw, pitch: lookPitch, locked: pointerLocked };
    },
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
        // 移動相對視角：W/前推=前進、S/後拉=後退、A·D/左右=平移；鍵盤(WASD)與行動端移動搖桿並用。
        // 旋轉 lookYaw 後量化回 8 向世界布林。（行動端 touchKeys.aim 在此忽略，朝向一律取 lookYaw。）
        const mUp = keyboardKeys.up || touchKeys.up;
        const mDown = keyboardKeys.down || touchKeys.down;
        const mLeft = keyboardKeys.left || touchKeys.left;
        const mRight = keyboardKeys.right || touchKeys.right;
        const fwd = (mUp ? 1 : 0) - (mDown ? 1 : 0);
        const strafe = (mRight ? 1 : 0) - (mLeft ? 1 : 0);
        const cy = Math.cos(lookYaw), sy = Math.sin(lookYaw);
        let wx = cy * fwd - sy * strafe;   // 世界 +x = 右
        let wy = sy * fwd + cy * strafe;   // 世界 +y = 下（朝鏡頭）
        let U = false, D = false, L = false, R = false;
        const d = Math.hypot(wx, wy);
        if (d > 0.001) { wx /= d; wy /= d; R = wx > 0.38; L = wx < -0.38; D = wy > 0.38; U = wy < -0.38; }
        return {
          up: U, down: D, left: L, right: R,
          basic: keyboardKeys.basic || mouseBasic || touchKeys.basic,
          skill1: keyboardKeys.skill1 || touchKeys.skill1,
          skill2: keyboardKeys.skill2 || touchKeys.skill2,
          ultimate: keyboardKeys.ultimate || touchKeys.ultimate,
          evade: keyboardKeys.evade || touchKeys.evade,
          item1: keyboardKeys.item1 || touchKeys.item1,
          item2: keyboardKeys.item2 || touchKeys.item2,
          aim: lookYaw, // 近景第三人稱：朝向直接由滑鼠/搖桿視角決定
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
