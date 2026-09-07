import { G } from './gameState.js';
import { STORY_POOLS, BOSS_POOLS } from './config.js';
import { addLog, renderAll, renderDynamicArea, clearDynamicArea } from './ui.js';
import { startBossFight, endGame } from './battle.js';

// 工具：随机选取
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.sort(() => Math.random() - 0.5);

// 检查当天是否触发事件（Boss或剧情）
export function checkDayEvents() {
    // Boss 触发：每10天
    if (G.day % 10 === 0 && G.day <= 30) {
        const stageIndex = (G.day / 10) - 1;
        if (!G.bossDefeated[stageIndex]) {
            showBossSelection(stageIndex);
            return;
        }
    }
    // 剧情触发：每5天但不是10的倍数
    if (G.day % 5 === 0 && G.day % 10 !== 0) {
        const stageIndex = (G.day - 5) / 10;
        triggerStory(stageIndex);
        return;
    }
    // 否则进入训练
    G.phase = 'training';
}

// 显示 Boss 三选一界面
export function showBossSelection(stageIndex) {
    G.phase = 'boss'; // 临时置为 boss 以禁用训练按钮
    renderAll();
    // 禁用战斗按钮（选择阶段还不能战斗）
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;

    const pool = BOSS_POOLS[stageIndex];
    // 从池中随机取3个（如果池子大于3，打乱后取前3；否则取全部）
    const shuffled = shuffle([...pool]);
    const candidates = shuffled.slice(0, 3);

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">⚔️ 选择你的对手</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">第 ${G.day} 天，Boss 出现了！选择一位挑战：</p>
            <div class="story-choices">
    `;
    candidates.forEach((boss, idx) => {
        // 简要显示属性
        const stats = `HP ${boss.base.maxHp} | 物攻 ${boss.base.atk} | 法攻 ${boss.base.matk} | 防御 ${boss.base.def}`;
        html += `<button class="btn primary" data-boss-idx="${idx}">${boss.name}<br><span style="font-weight:normal;font-size:12px;opacity:0.8;">${stats}</span></button>`;
    });
    html += `</div></div>`;
    renderDynamicArea(html);

    // 绑定选择事件
    document.querySelectorAll('[data-boss-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.bossIdx);
            const selectedBoss = candidates[idx];
            clearDynamicArea();
            // 记录当前阶段索引，用于战斗结束后标记
            G.currentStage = stageIndex;
            // 开始战斗
            startBossFight(selectedBoss);
        });
    });
}

// 触发剧情事件（随机抽取，玩家不选择，效果直接生效）
export function triggerStory(stageIndex) {
    const pool = STORY_POOLS[stageIndex];
    const event = pick(pool);

    G.phase = 'story';
    // 立即生效（玩家不选择）
    event.effect(G);
    addLog(`📖 事件：${event.title} → ${event.reward}`, 'highlight');

    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
    renderAll();

    const html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">📖 ${event.title}</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">${event.desc}</p>
            <p style="margin:4px 0 16px; color:#2ecc71; font-weight:600;">获得：${event.reward}</p>
            <button class="btn primary" id="btnStoryContinue">继续 ➜</button>
        </div>
    `;
    renderDynamicArea(html);

    document.getElementById('btnStoryContinue').addEventListener('click', () => {
        clearDynamicArea();
        G.day++;
        if (G.day > 30) {
            // 如果超过30天，检查是否还有Boss未打，若有则强制触发最终Boss（阶段2）
            if (!G.bossDefeated[2]) {
                showBossSelection(2);
            } else {
                endGame(true);
            }
            return;
        }
        checkDayEvents();
        renderAll();
        if (G.phase === 'training') {
            import('./training.js').then(module => {
                module.generateDailyTraining();
            });
        }
    });
}