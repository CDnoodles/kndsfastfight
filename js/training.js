import { G } from './gameState.js';
import { ATTR_NAMES, GROWTH_RANGES, ATTR_LABELS } from './config.js';
import { addLog, renderAll, renderDynamicArea } from './ui.js';
import { checkDayEvents, showBossSelection } from './story.js';
import { endGame } from './battle.js';

// 工具：随机选取
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let currentTrainingAttr = null;

// 生成今日训练属性
export function generateDailyTraining() {
    currentTrainingAttr = pick(ATTR_NAMES);
    const label = ATTR_LABELS[currentTrainingAttr] || currentTrainingAttr;
    const range = GROWTH_RANGES[currentTrainingAttr] || [0, 0];
    // 成长值系数（与 doTraining 保持一致）
    const growth = (G.player.growth && G.player.growth.value) || 1;
    const fmt = v => {
        v *= growth;
        const isInt = currentTrainingAttr === 'maxHp' || currentTrainingAttr === 'maxMp' || currentTrainingAttr === 'atk' || currentTrainingAttr === 'matk';
        return isInt ? Math.max(1, Math.round(v)) : Math.max(0.1, Math.round(v * 10) / 10);
    };
    if (G.phase === 'training') {
        document.getElementById('extraInfo').innerText = `📈 今日训练：${label}  (预计 +${fmt(range[0])}~${fmt(range[1])})`;
    }
    // 渲染训练按钮
    renderTrainingButtons();
}

// 渲染训练按钮（动态区域）
export function renderTrainingButtons() {
    renderDynamicArea(`
        <div style="display:flex; gap:12px; margin-top:10px;">
            <button class="btn success" id="btnDoTraining">🏋️ 开始训练</button>
            <button class="btn" id="btnSkipDay" style="background:#444;">⏩ 跳过（不成长）</button>
        </div>
    `);
    document.getElementById('btnDoTraining').addEventListener('click', doTraining);
    document.getElementById('btnSkipDay').addEventListener('click', skipDay);
}

// 执行训练
export function doTraining() {
    if (G.phase !== 'training' || G.day > 30) return;
    const attr = currentTrainingAttr;
    const range = GROWTH_RANGES[attr] || [0, 0];
    // 成长值系数：放大学到的属性（未创建角色时默认 1）
    const growth = (G.player.growth && G.player.growth.value) || 1;
    let gain = Math.random() * (range[1] - range[0]) + range[0];
    gain *= growth;
    // 整数属性取整，小数属性保留1位（整数属性至少 +1，避免低成长值白训练一天）
    if (attr === 'maxHp' || attr === 'maxMp' || attr === 'atk' || attr === 'matk') gain = Math.max(1, Math.round(gain));
    else gain = Math.max(0.1, Math.round(gain * 10) / 10);

    const old = G.player.base[attr];
    G.player.base[attr] += gain;
    if (attr === 'maxHp') G.player.current.hp += G.player.base.maxHp - old;
    else if (attr === 'maxMp') G.player.current.mp += G.player.base.maxMp - old;
    // 恢复少量HP/MP
    if (G.phase !== 'boss') {
        G.player.current.hp = Math.min(G.player.base.maxHp, G.player.current.hp + 2);
        G.player.current.mp = Math.min(G.player.base.maxMp, G.player.current.mp + 1);
    }
    G.trainingLog.push({ day: G.day, attr, gain });
    addLog(`🏋️ 训练 ${ATTR_LABELS[attr]}，${attr==='maxHp'||attr==='maxMp'?'上限':''}+${gain}`);

    G.day++;
    if (G.day > 30) {
        if (!G.bossDefeated[2]) showBossSelection(2);
        else endGame(true);
        return;
    }
    checkDayEvents();
    renderAll();
    if (G.phase === 'training') {
        generateDailyTraining();
    }
}

// 跳过训练
export function skipDay() {
    if (G.phase !== 'training') return;
    G.day++;
    if (G.day > 30) {
        if (!G.bossDefeated[2]) showBossSelection(2);
        else endGame(true);
        return;
    }
    checkDayEvents();
    renderAll();
    if (G.phase === 'training') {
        generateDailyTraining();
    }
}
