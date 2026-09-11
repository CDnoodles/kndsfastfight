import { G } from './gameState.js';
import { ATTR_NAMES, GROWTH_RATES, ATTR_LABELS, getDifficulty } from './config.js';
import { addLog, renderAll, renderDynamicArea, fmt } from './ui.js';
import { checkDayEvents, showBossSelection } from './story.js';
import { advanceWeek } from './battle.js';

// 工具：随机选取
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// 休息（放弃训练）单次回复的最大生命比例（基础值，再乘难度系数）
// 基础 3%：两个 Boss 之间约 10 天，全部放弃训练恰好回 30% 血
const REST_HEAL_RATIO = 0.03;

// 当前难度下的休息回复比例（高难度下调，见 config.js restHealMult）
function restHealRatio() {
    return REST_HEAL_RATIO * getDifficulty(G.difficulty).restHealMult;
}

let currentTrainingAttr = null;

// 生成今日训练属性
export function generateDailyTraining() {
    currentTrainingAttr = pick(ATTR_NAMES);
    const label = ATTR_LABELS[currentTrainingAttr] || currentTrainingAttr;
    const rate = GROWTH_RATES[currentTrainingAttr] || [0, 0];
    // 成长值系数（与 doTraining 保持一致）
    const growth = (G.player.growth && G.player.growth.value) || 1;
    const toPct = v => Math.round(v * growth * 1000) / 10; // 转成百分比，保留1位小数
    if (G.phase === 'training') {
        // 明确把「训练」与「休息」并列为今天的两个选项
        const healPreview = Math.floor(G.player.base.maxHp * restHealRatio());
        document.getElementById('extraInfo').innerText =
            `📈 今日训练：${label}（预计 +${toPct(rate[0])}%~+${toPct(rate[1])}%）　或　😴 休息回复 ${fmt(healPreview)} HP`;
    }
    // 渲染训练按钮
    renderTrainingButtons();
}

// 渲染训练按钮（动态区域）
export function renderTrainingButtons() {
    const healPreview = Math.floor(G.player.base.maxHp * restHealRatio());
    renderDynamicArea(`
        <div style="display:flex; gap:12px; margin-top:10px;">
            <button class="btn success" id="btnDoTraining">🏋️ 开始训练</button>
            <button class="btn" id="btnSkipDay" style="background:#444;">😴 休息（回复 ${fmt(healPreview)} HP）</button>
        </div>
    `);
    document.getElementById('btnDoTraining').addEventListener('click', doTraining);
    document.getElementById('btnSkipDay').addEventListener('click', skipDay);
}

// 执行训练
export function doTraining() {
    if (G.phase !== 'training' || G.day > 30) return;
    const attr = currentTrainingAttr;
    const rate = GROWTH_RATES[attr] || [0, 0];
    // 成长值系数：放大学到的属性（未创建角色时默认 1）
    const growth = (G.player.growth && G.player.growth.value) || 1;
    const pct = (Math.random() * (rate[1] - rate[0]) + rate[0]) * growth;

    const old = G.player.base[attr];
    // 乘法增长：当前值 × (1 + pct)，保留2位小数，永不降为0
    const newVal = Math.max(0.01, Math.round(old * (1 + pct) * 100) / 100);
    G.player.base[attr] = newVal;
    // current.hp/mp 按比例同步（不用 += new-old，避免线性膨胀）
    if (attr === 'maxHp' && old > 0) G.player.current.hp = G.player.current.hp * (newVal / old);
    else if (attr === 'maxMp' && old > 0) G.player.current.mp = G.player.current.mp * (newVal / old);
    // 恢复少量HP/MP（百分比，避免线性膨胀）
    if (G.phase !== 'boss') {
        G.player.current.hp = Math.min(G.player.base.maxHp, G.player.current.hp + G.player.base.maxHp * 0.02);
        G.player.current.mp = Math.min(G.player.base.maxMp, G.player.current.mp + G.player.base.maxMp * 0.03);
    }
    G.trainingLog.push({ day: G.day, attr, gain: newVal - old });
    addLog(`🏋️ 训练 ${ATTR_LABELS[attr]}，${attr==='maxHp'||attr==='maxMp'?'上限':''}+${Math.round(pct * 1000) / 10}%`);

    G.day++;
    if (G.day > 30) {
        // 兜底：还有 Boss 未打则触发最终 Boss，否则直接推进周目
        if (!G.bossDefeated[2]) showBossSelection(2);
        else advanceWeek();
        return;
    }
    checkDayEvents();
    renderAll();
    if (G.phase === 'training') {
        generateDailyTraining();
    }
}

// 休息（放弃今日训练）——与 doTraining 完全对称：同样只推进 1 天
export function skipDay() {
    if (G.phase !== 'training') return;

    // 放弃今日训练 → 休息，恢复最大生命的一定比例
    // 注意：与「训练」完全对等 —— 同样只推进 1 天，不会跳过后续天数
    const ratio = restHealRatio();
    const healAmount = Math.floor(G.player.base.maxHp * ratio);
    if (healAmount > 0 && G.player.current.hp < G.player.base.maxHp) {
        G.player.current.hp = Math.min(G.player.base.maxHp, G.player.current.hp + healAmount);
        addLog(`💚 你选择休息，恢复 ${fmt(healAmount)} 点生命（最大生命的 ${Math.round(ratio * 1000) / 10}%）`, 'heal');
    }

    G.day++;
    if (G.day > 30) {
        // 兜底：还有 Boss 未打则触发最终 Boss，否则直接推进周目
        if (!G.bossDefeated[2]) showBossSelection(2);
        else advanceWeek();
        return;
    }
    checkDayEvents();
    renderAll();
    if (G.phase === 'training') {
        generateDailyTraining();
    }
}
