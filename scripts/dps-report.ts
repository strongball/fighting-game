import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { measureAll } from '../test/dpsLab';
import { CHARACTERS } from '../src/game/characters.js';

const SLOT_LABEL: Record<string, string> = {
  basic: '普攻', skill1: '技能1', skill2: '技能2', ultimate: '大招', evade: '閃避',
  summon: '召喚物', dot: 'DoT', reflect: '反傷', other: '其他',
};

function leaderboardMd(rows: any[], title: string): string {
  let md = `## ${title}\n\n`;
  md += `| 排名 | 角色 | DPS | 總傷 | 最高擊 | 爆擊 | 技能佔比 |\n`;
  md += `| --- | --- | --- | --- | --- | --- | --- |\n`;
  rows.forEach((r, i) => {
    const mix = r.perSkill.slice(0, 5)
      .map((p: any) => `${SLOT_LABEL[p.slot] || p.slot} ${(p.pct * 100).toFixed(0)}%`).join(' ');
    md += `| ${i + 1} | ${r.name} | ${r.dps} | ${r.total} | ${r.maxHit} | ${r.critCount}× | ${mix} |\n`;
  });
  return md;
}

function detailMd(rows: any[]): string {
  let md = '';
  for (const r of rows) {
    md += `### ${r.name} ${r.mode}/${r.dummy}靶  ${r.seconds}s\n\n`;
    md += `| 項目 | 數值 |\n| --- | --- |\n`;
    md += `| DPS | ${r.dps} |\n`;
    md += `| 總傷 | ${r.total} |\n`;
    md += `| 最高擊 | ${r.maxHit} |\n`;
    md += `| 爆擊 | ${r.critCount}× |\n`;
    md += `| 技能使用 | ${Object.entries(r.skillUses || {}).filter(([, v]: any) => v > 0).map(([k, v]: any) => `${SLOT_LABEL[k] || k} ${v}次`).join('、') || '-'} |\n`;
    md += `\n| 技能 | 傷害 | DPS | 佔比 |\n| --- | --- | --- | --- |\n`;
    for (const ps of r.perSkill) {
      const label = SLOT_LABEL[ps.slot] || ps.slot;
      const bar = '█'.repeat(Math.round(ps.pct * 20));
      md += `| ${label} | ${Math.round(ps.dmg)} | ${ps.dps.toFixed(1)} | ${(ps.pct * 100).toFixed(1)}% ${bar} |\n`;
    }
    md += '\n';
  }
  return md;
}

const START = Date.now();

console.log('\n  持續輸出 / 中性木人...');
const sustainedRows = measureAll({ seconds: 20, mode: 'sustained', dummy: 'neutral' });
console.log('  爆發輸出 / 中性木人...');
const burstRows = measureAll({ seconds: 12, mode: 'burst', dummy: 'neutral' });
console.log('  持續輸出 / Boss木人...');
const bossRows = measureAll({ seconds: 20, mode: 'sustained', dummy: 'boss' });

const elapsed = ((Date.now() - START) / 1000).toFixed(1);
const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');

let report = `# DPS 傷害報表\n\n`;
report += `> 產生時間：${ts} ｜ 耗時：${elapsed}s ｜ 角色數：${CHARACTERS.length}\n\n`;
report += `## 測試模式說明\n\n`;
report += `| 模式 | 說明 |\n| --- | --- |\n`;
report += `| sustained | 自然回魔/CD、20 秒持續輸出 |\n`;
report += `| burst | freeMana 連發、12 秒爆發輸出 |\n`;
report += `| 中性木人 | hitR=18（玩家大小）無減傷天賦 |\n`;
report += `| Boss 木人 | hitR=90（中型 Boss）走 Boss 傷害修正路徑 |\n\n`;
report += `---\n\n`;
report += leaderboardMd(sustainedRows, '持續輸出 · 中性木人（sustained / neutral / 20s）');
report += `\n`;
report += leaderboardMd(burstRows, '爆發輸出 · 中性木人（burst / neutral / 12s）');
report += `\n`;
report += leaderboardMd(bossRows, '持續輸出 · Boss 木人（sustained / boss / 20s）');
report += `\n---\n\n`;
report += `## 各角色詳細數據\n\n`;
report += detailMd(sustainedRows);
report += detailMd(burstRows);
report += detailMd(bossRows);

const outPath = resolve(import.meta.dirname, '..', 'DPS_REPORT.md');
writeFileSync(outPath, report, 'utf-8');
console.log(`\n  ✅ 已寫入 ${outPath} (${elapsed}s)\n`);
