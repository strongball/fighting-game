// 鍵盤輸入：支持兩種操作方式
// 方式1: WASD/方向鍵移動，J 攻擊，K 技能1，L 技能2，; 大絕
// 方式2: 方向鍵移動，A 攻擊，S 技能1，D 技能2，F 大絕

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
};

export function createInput(controlScheme = 'wasd-jkl') {
  const keyboardKeys = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false };
  const touchKeys = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false, aim: null };
  let enabled = false;
  let currentScheme = controlScheme;
  let keyMap = KEY_MAPS[currentScheme];

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
      currentScheme = scheme;
      keyMap = KEY_MAPS[scheme];
      for (const k in keyboardKeys) keyboardKeys[k] = false;
      for (const k in touchKeys) {
        if (k === 'aim') touchKeys[k] = null;
        else touchKeys[k] = false;
      }
    },
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
