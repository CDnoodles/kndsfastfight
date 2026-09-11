import { G } from './gameState.js';
import { DIFFICULTIES } from './config.js';
import { renderAll, addLog, renderDynamicArea, clearDynamicArea, fmt, loadHistory, renderHistoryPage } from './ui.js';
import { showCharacterCreation } from './characterCreation.js';

// 禁用战斗按钮（主界面/历史页不可战斗）
function disableBattleButtons() {
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
}

// 主界面：标题 + 难度选择 + 历史战绩入口
export function showMainMenu() {
    G.phase = 'menu';
    renderAll();
    disableBattleButtons();

    const history = loadHistory();
    const best = history.reduce((m, r) => Math.max(m, r.score || 0), 0);
    const bestLine = best > 0
        ? `<p style="margin:4px 0 12px; opacity:0.85;">🏅 历史最高分：<b class="text-gold">${fmt(best)}</b>　已记录 ${history.length} 场冒险</p>`
        : `<p style="margin:4px 0 12px; opacity:0.7;">还没有战绩记录，这将是你的第一次冒险。</p>`;

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h2 style="margin:0 0 4px; color:#f1c40f; text-align:center;">⚔️ 勇者养成</h2>
            <p style="margin:0 0 10px; text-align:center; opacity:0.85;">30 天一轮回 · 无尽周目 · 用成长换生存</p>
            ${bestLine}
            <p style="margin:8px 0 6px; opacity:0.9;">选择难度开始冒险：</p>
            <div class="story-choices diff-choices">
    `;

    DIFFICULTIES.forEach(d => {
        const tag = `Boss HP ×${d.hpMult}　攻 ×${d.atkMult}　防 ×${d.defMult}　休息回血 ×${d.restHealMult}　得分 ×${d.scoreMult}`;
        html += `<button class="btn primary" data-diff-id="${d.id}">${d.name}<br><span style="font-weight:normal;font-size:12px;opacity:0.85;">${d.desc}</span><br><span style="font-weight:normal;font-size:12px;opacity:0.7;">${tag}</span></button>`;
    });

    html += `</div>
            <button class="btn" id="btnHistory" style="margin-top:12px; background:#444;">📜 历史战绩</button>
        </div>`;
    renderDynamicArea(html);

    // 选定难度 → 进入角色创建
    document.querySelectorAll('[data-diff-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const diff = DIFFICULTIES.find(d => d.id === e.currentTarget.dataset.diffId);
            if (!diff) return;
            G.difficulty = diff.id;
            addLog(`🎯 已选择难度：${diff.name}`, 'highlight');
            clearDynamicArea();
            showCharacterCreation();
        });
    });

    document.getElementById('btnHistory').addEventListener('click', () => {
        G.phase = 'history';
        renderAll();
        renderHistoryPage();
    });
}
