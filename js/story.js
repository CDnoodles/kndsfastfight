import { G } from './gameState.js';
import { STORY_POOLS, BOSS_POOLS, getDifficulty } from './config.js';
import { addLog, renderAll, renderDynamicArea, clearDynamicArea, fmt } from './ui.js';
import { startBossFight } from './battle.js';

// 工具：随机选取
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.sort(() => Math.random() - 0.5);

// ----- 周目缩放（指数增长：Boss 属性按 K^w 缩放，与玩家训练/事件的复利对齐） -----
function weekScale(week) {
    const w = week - 1;
    const K = 1.18;   // 每周约 +18%，根据玩家总增长率调参
    const factor = Math.pow(K, w);
    return {
        maxHp: factor,
        atk:   factor,
        matk:  factor,
        def:   factor,
        speed: 1 + 0.05 * w     // 速度保持线性，避免先手混乱
    };
}

// 按当前周目缩放 Boss 属性；速度封顶为玩家当前速度的 1.5 倍，避免永远后手
// 再叠加难度倍率（法攻与物攻共用 atkMult，速度不受难度影响）
function scaleBossForWeek(template) {
    const s = weekScale(G.week);
    const d = getDifficulty(G.difficulty);
    const b = template.base;
    const speedCap = G.player.base.speed * 1.5;
    return {
        ...template,
        base: {
            maxHp: Math.round(b.maxHp * s.maxHp * d.hpMult),
            atk:   Math.round(b.atk   * s.atk   * d.atkMult),
            matk:  Math.round(b.matk  * s.matk  * d.atkMult),
            def:   Math.round(b.def   * s.def   * d.defMult),
            speed: Math.round(Math.min(b.speed * s.speed, speedCap) * 10) / 10
        }
    };
}

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
    // 从池中随机取3个（如果池子大于3，打乱后取前3；否则取全部），并按周目缩放
    const shuffled = shuffle([...pool]);
    const candidates = shuffled.slice(0, 3).map(scaleBossForWeek);

    // 血量是全局资源，低血进 Boss 有被击杀风险，给出提示
    const hpPct = G.player.current.hp / G.player.base.maxHp;
    const lowHpWarn = hpPct < 0.5
        ? `<p style="margin:4px 0 12px; color:#e74c3c; font-weight:700;">⚠️ 当前生命仅剩 ${Math.round(hpPct * 100)}%（${fmt(Math.floor(G.player.current.hp))}/${fmt(G.player.base.maxHp)}），此战风险极高！</p>`
        : '';

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">⚔️ 选择你的对手</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">第 ${G.week} 周目 · 第 ${G.day} 天，Boss 出现了！选择一位挑战：</p>
            ${lowHpWarn}
            <div class="story-choices">
    `;
    candidates.forEach((boss, idx) => {
        // 一句话介绍 + 简要属性
        const intro = boss.intro ? `<span style="font-weight:normal;font-size:12px;opacity:0.9;color:#ffe08a;">${boss.intro}</span><br>` : '';
        const stats = `HP ${fmt(boss.base.maxHp)} | 物攻 ${fmt(boss.base.atk)} | 法攻 ${fmt(boss.base.matk)} | 防御 ${fmt(boss.base.def)}`;
        html += `<button class="btn primary" data-boss-idx="${idx}">${boss.name}<br>${intro}<span style="font-weight:normal;font-size:12px;opacity:0.75;">${stats}</span></button>`;
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

// 触发剧情事件（从池中随机抽取一个事件，两个极端选项 + 放弃）
export function triggerStory(stageIndex) {
    const pool = STORY_POOLS[stageIndex];
    const event = pick(pool);

    G.phase = 'story';
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
    renderAll();

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">📖 ${event.title}</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">${event.desc}</p>
            <div class="story-choices">
    `;
    event.choices.forEach((c, idx) => {
        html += `<button class="btn primary" data-story-idx="${idx}">${c.label}<br><span style="font-weight:normal;font-size:12px;opacity:0.8;">${c.desc}</span></button>`;
    });
    // 第三个选项：放弃该事件
    html += `<button class="btn" data-story-idx="2" style="background:#444;">🚪 放弃该事件<br><span style="font-weight:normal;font-size:12px;opacity:0.8;">不承担任何风险</span></button>`;
    html += `</div></div>`;
    renderDynamicArea(html);

    document.querySelectorAll('[data-story-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.storyIdx);
            if (idx < 2) {
                // 应用极端选项（增益 + 减益）
                const choice = event.choices[idx];
                const beforeMaxHp = G.player.base.maxHp;
                const beforeMaxMp = G.player.base.maxMp;
                choice.effect(G);
                // 上限变化时按比例同步当前值（保持血量/法力占比，避免线性膨胀）
                if (beforeMaxHp > 0) G.player.current.hp = G.player.current.hp * (G.player.base.maxHp / beforeMaxHp);
                if (beforeMaxMp > 0) G.player.current.mp = G.player.current.mp * (G.player.base.maxMp / beforeMaxMp);
                // 按属性类型重新取整 + 保底（避免比例减益把属性减成负数或 0）
                const b = G.player.base;
                b.maxHp = Math.max(30, Math.round(b.maxHp));
                b.maxMp = Math.max(15, Math.round(b.maxMp));
                b.atk = Math.max(1, Math.round(b.atk));
                b.matk = Math.max(1, Math.round(b.matk));
                b.def = Math.max(0, Math.round(b.def * 10) / 10);
                b.speed = Math.max(1, Math.round(b.speed * 10) / 10);
                b.mpRegen = Math.max(1, Math.round(b.mpRegen * 10) / 10);
                // HP/MP 修正到合法区间
                G.player.current.hp = Math.max(1, Math.min(G.player.current.hp, b.maxHp));
                G.player.current.mp = Math.max(0, Math.min(G.player.current.mp, b.maxMp));
                addLog(`📖 剧情选择：${choice.label} → ${choice.desc}`, 'highlight');
            } else {
                addLog('📖 你选择放弃该事件，保持现状。', 'highlight');
            }

            clearDynamicArea();
            G.day++;
            if (G.day > 30) {
                // 兜底：还有 Boss 未打则强制触发最终 Boss，否则直接推进周目
                if (!G.bossDefeated[2]) {
                    showBossSelection(2);
                } else {
                    import('./gameState.js').then(m => {
                        m.startNextWeek();
                        renderAll();
                        import('./training.js').then(t => t.generateDailyTraining());
                    });
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
    });
}