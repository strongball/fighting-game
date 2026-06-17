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
  },
};

export function createInput(controlScheme = 'wasd-jkl') {
  const keys = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false };
  let enabled = false;
  let currentScheme = controlScheme;
  let keyMap = KEY_MAPS[currentScheme];

  function setKey(code, down) {
    const action = keyMap[code];
    if (action) keys[action] = down;
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
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  return {
    enable() { enabled = true; },
    disable() { enabled = false; for (const k in keys) keys[k] = false; },
    setScheme(scheme) {
      currentScheme = scheme;
      keyMap = KEY_MAPS[scheme];
      for (const k in keys) keys[k] = false;
    },
    get() {
      return {
        up: keys.up, down: keys.down, left: keys.left, right: keys.right,
        basic: keys.basic, skill1: keys.skill1, skill2: keys.skill2, ultimate: keys.ultimate,
        evade: keys.evade,
        aim: null, // 人類玩家以移動方向轉向；魔王 AI 則合成 aim 角度
      };
    },
  };
}

export const EMPTY_INPUT = { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, aim: null };
