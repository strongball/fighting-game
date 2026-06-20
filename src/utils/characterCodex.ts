// 解析「角色圖鑑.md」作為角色技能說明的單一資料來源。
// 透過 Vite 的 ?raw 匯入原始 Markdown，前端在載入時解析一次並 memoize。
// 日後只要編輯該 .md：dev 期 HMR 自動更新、build 期重新讀取，UI 不需維護第二份重複資料。
//
// 解析對象的固定結構（見 角色圖鑑.md）：
//   ## <emoji> <id>. <名稱>
//   **角色定位**：…
//   > <角色描述>
//   **⚡ 合作建議**：…
//   ### 🌟 天賦被動：<天賦名>
//   > <天賦說明>
//   ### 技能列表
//   | 按鍵 | 技能名稱 | 類型 | 冷卻 | 魔力消耗 | 說明 |
//   | J | **橫掃** | 近戰 | 0.55s | — | … |

import codexRaw from '../../角色圖鑑.md?raw';

export type SkillSlot = 'basic' | 'skill1' | 'skill2' | 'ultimate';

export interface CodexSkill {
  slot: SkillSlot;
  name: string;
  type: string;     // 類型，如 近戰／衝鋒／投射物
  cooldown: string; // 冷卻，如 "0.55s" 或 "—"
  mana: string;     // 魔力消耗，如 "25" 或 "—"
  explain: string;  // 說明（使用者要看的核心文字）
}

export interface CodexEntry {
  id: number;
  name: string;
  role?: string;        // 角色定位
  description?: string; // 角色描述（引文）
  synergy?: string;     // 合作建議
  talent?: { name: string; desc: string };
  skills: CodexSkill[];
}

// 圖鑑按鍵 → 技能槽位（圖鑑統一以 J/K/L/; 表示）
const KEY_TO_SLOT: Record<string, SkillSlot> = {
  J: 'basic',
  K: 'skill1',
  L: 'skill2',
  ';': 'ultimate',
};

const CHAR_HEADING = /^##\s+\S+\s+(\d+)\.\s+(.+?)\s*$/;
const ANY_H2 = /^##\s/;

// 去除粗體標記與前後空白
function clean(s: string): string {
  return s.replace(/\*\*/g, '').trim();
}

function parseEntry(id: number, name: string, lines: string[]): CodexEntry {
  const entry: CodexEntry = { id, name, skills: [] };
  let seenTalentHeading = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let m: RegExpMatchArray | null;

    if ((m = line.match(/角色定位\*\*：\s*(.+)/))) {
      entry.role = clean(m[1]);
      continue;
    }
    if ((m = line.match(/合作建議\*\*：\s*(.+)/))) {
      entry.synergy = clean(m[1]);
      continue;
    }
    // 天賦標題：### 🌟 天賦被動：<名稱>
    if (line.startsWith('#') && (m = line.match(/天賦被動：\s*(.+)/))) {
      entry.talent = { name: clean(m[1]), desc: '' };
      seenTalentHeading = true;
      continue;
    }
    // 引文：天賦標題前 → 角色描述；天賦標題後 → 天賦說明
    if (line.startsWith('>')) {
      const quote = clean(line.replace(/^>\s?/, ''));
      if (!seenTalentHeading) {
        if (!entry.description) entry.description = quote;
      } else if (entry.talent && !entry.talent.desc) {
        entry.talent.desc = quote;
      }
      continue;
    }
    // 技能表列
    if (line.startsWith('|')) {
      const cells = line.split('|').map((c) => c.trim());
      if (cells[0] === '') cells.shift();
      if (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (cells.length < 6) continue;
      const slot = KEY_TO_SLOT[cells[0]];
      if (!slot) continue; // 跳過表頭與分隔列
      entry.skills.push({
        slot,
        name: clean(cells[1]),
        type: clean(cells[2]),
        cooldown: clean(cells[3]),
        mana: clean(cells[4]),
        explain: clean(cells[5]),
      });
    }
  }

  return entry;
}

function buildIndex(): Map<number, CodexEntry> {
  const index = new Map<number, CodexEntry>();
  try {
    const lines = codexRaw.split(/\r?\n/);
    let id = -1;
    let name = '';
    let buffer: string[] = [];

    const flush = () => {
      if (id >= 0) index.set(id, parseEntry(id, name, buffer));
    };

    for (const line of lines) {
      const heading = line.match(CHAR_HEADING);
      if (heading) {
        flush();
        id = Number(heading[1]);
        name = heading[2].trim();
        buffer = [];
      } else if (ANY_H2.test(line)) {
        // 其他 h2（如「角色屬性總覽」「按鍵說明」）→ 結束目前角色段落
        flush();
        id = -1;
        buffer = [];
      } else if (id >= 0) {
        buffer.push(line);
      }
    }
    flush();
  } catch {
    // 解析失敗時回傳空索引，由 UI fallback 至程式內既有欄位。
    return new Map();
  }
  return index;
}

let cached: Map<number, CodexEntry> | null = null;

export function getCodexEntry(id: number): CodexEntry | null {
  if (!cached) cached = buildIndex();
  return cached.get(id) ?? null;
}
