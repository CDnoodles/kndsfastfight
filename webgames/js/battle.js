import { G } from './gameState.js';
import { addLog, renderAll, clearDynamicArea } from './ui.js';

// ----- 工具函数 -----
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ----- 伤害计算 -----
export function calcDamage(attack, defense) {
    const reduction = defense / (defense + 100);
    let base = attack * (1 - reduction);
    const variance = 0.9 + Math.random() * 0.2;
    return Math.max(1, Math.floor(base * variance));
}

// ----- 战斗循环变量 -----
let lastTimestamp = 0;
let battleLoopId = null;

// ----- 开始Boss战 -----
// export function startBossFight(index) {
//     G.phase = 'boss';
//     G.battleActive = true;
//     G.waitingForPlayer = false;
//     G.inAction = false;

//     const template = BOSS_TEMPLATES[index];
//     const bossBase = { ...template.base };
//     // 根据指数略微缩放（动态难度）
//     const scale = 0.8 + index * 0.4;
//     for (let k of Object.keys(bossBase)) {
//         if (k === 'maxHp') bossBase[k] = Math.round(bossBase[k] * scale);
//         else if (k === 'speed') bossBase[k] = Math.round(bossBase[k] * (0.8 + Math.random() * 0.4));
//         else bossBase[k] = Math.round(bossBase[k] * scale);
//     }
//     const enemy = {
//         name: template.name,
//         base: bossBase,
//         current: { hp: bossBase.maxHp, mp: 50, progress: 0 },
//         alive: true,
//         isDefending: false
//     };
//     G.enemy = enemy;

//     // 玩家满状态
//     G.player.current.hp = G.player.base.maxHp;
//     G.player.current.mp = G.player.base.maxMp;
//     G.player.current.progress = 0;
//     G.player.alive = true;
//     G.player.isDefending = false;

//     document.getElementById('enemyPanel').style.display = 'block';
//     document.getElementById('enemyName').innerText = enemy.name;
//     addLog(`⚔️ Boss战开始！${enemy.name} 出现了！`, 'highlight');
//     renderAll();
//     // 启用战斗按钮
//     document.getElementById('btnPhysical').disabled = false;
//     document.getElementById('btnMagic').disabled = false;
//     document.getElementById('btnDefend').disabled = false;
//     clearDynamicArea();

//     // 启动战斗循环
//     if (battleLoopId) cancelAnimationFrame(battleLoopId);
//     lastTimestamp = 0;
//     battleLoopId = requestAnimationFrame(battleTick);
// }

export function startBossFight(bossTemplate) {
    G.phase = 'boss';
    G.battleActive = true;
    G.waitingForPlayer = false;
    G.inAction = false;

    // 从模板创建敌人，可加随机波动
    const bossBase = { ...bossTemplate.base };
    // 轻微随机浮动（±10%），增加变化
    for (let k of Object.keys(bossBase)) {
        if (k === 'speed') {
            bossBase[k] = Math.round(bossBase[k] * (0.9 + Math.random() * 0.2) * 10) / 10;
        } else {
            bossBase[k] = Math.round(bossBase[k] * (0.9 + Math.random() * 0.2));
        }
    }
    const enemy = {
        name: bossTemplate.name,
        base: bossBase,
        current: { hp: bossBase.maxHp, mp: 50, progress: 0 },
        alive: true,
        isDefending: false
    };
    G.enemy = enemy;

    // 玩家满状态
    G.player.current.hp = G.player.base.maxHp;
    G.player.current.mp = G.player.base.maxMp;
    G.player.current.progress = 0;
    G.player.alive = true;
    G.player.isDefending = false;

    document.getElementById('enemyPanel').style.display = 'block';
    document.getElementById('enemyName').innerText = enemy.name;
    addLog(`⚔️ Boss战开始！${enemy.name} 出现了！`, 'highlight');
    renderAll();
    document.getElementById('btnPhysical').disabled = false;
    document.getElementById('btnMagic').disabled = false;
    document.getElementById('btnDefend').disabled = false;
    clearDynamicArea();

    // 启动战斗循环
    if (battleLoopId) cancelAnimationFrame(battleLoopId);
    lastTimestamp = 0;
    battleLoopId = requestAnimationFrame(battleTick);
}

// ----- Boss胜利（标记阶段） -----
function endBossVictory() {
    G.battleActive = false;
    G.waitingForPlayer = false;
    G.inAction = false;

    // 标记当前阶段已击败（使用 G.currentStage）
    if (G.currentStage !== undefined) {
        G.bossDefeated[G.currentStage] = true;
        G.currentStage = undefined;
    } else {
        // 兼容旧逻辑
        const idx = (G.day / 10) - 1;
        if (idx >= 0 && idx < 3) G.bossDefeated[idx] = true;
    }

    if (G.day >= 30) {
        endGame(true);
        return;
    }

    addLog('🎉 Boss战胜利！继续训练。', 'highlight');
    G.phase = 'training';
    G.enemy = null;
    document.getElementById('enemyPanel').style.display = 'none';
    G.player.current.hp = G.player.base.maxHp;
    G.player.current.mp = G.player.base.maxMp;
    G.player.current.progress = 0;
    G.player.isDefending = false;
    G.inAction = false;

    G.day++;
    if (G.day > 30) {
        if (!G.bossDefeated[2]) {
            // 触发最终Boss选择
            import('./story.js').then(module => {
                module.checkDayEvents(); // 会再次进入 showBossSelection
            });
        } else {
            endGame(true);
        }
        return;
    }
    // 检查后续事件
    import('./story.js').then(module => {
        module.checkDayEvents();
    });
    renderAll();
    if (G.phase === 'training') {
        import('./training.js').then(module => {
            module.generateDailyTraining();
        });
    }
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
}

// ----- 战斗循环 -----
function battleTick(timestamp) {
    if (!G.battleActive) {
        battleLoopId = null;
        return;
    }

    const delta = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016;
    lastTimestamp = timestamp;

    if (!G.inAction && !G.waitingForPlayer && G.player.alive && G.enemy && G.enemy.alive) {
        G.player.current.progress += G.player.base.speed * delta * 10;
        G.enemy.current.progress += G.enemy.base.speed * delta * 10;

        if (G.player.current.progress >= 100) {
            G.player.current.progress = 100;
            G.waitingForPlayer = true;
        } else if (G.enemy.current.progress >= 100) {
            enemyAction();
        }
    }

    renderAll();

    if (G.battleActive) {
        battleLoopId = requestAnimationFrame(battleTick);
    } else {
        battleLoopId = null;
    }
}

// ----- 玩家行动 -----
export function playerAction(type) {
    if (G.phase !== 'boss' || !G.battleActive) return;
    if (G.inAction || !G.waitingForPlayer) return;
    if (!G.player.alive || !G.enemy || !G.enemy.alive) return;

    if (type === 'magic' && G.player.current.mp < 15) {
        addLog('❌ 法力不足！', 'damage');
        return;
    }

    G.inAction = true;
    G.waitingForPlayer = false;
    G.player.current.progress = 0;
    const enemy = G.enemy;
    let damage = 0;

    if (type === 'physical') {
        damage = calcDamage(G.player.base.atk, enemy.base.def);
        G.player.isDefending = false;
        addLog(`⚔️ 物理攻击，造成 ${damage} 点伤害`, 'damage');
    } else if (type === 'magic') {
        G.player.current.mp -= 15;
        // 法术无视防御
        const baseMagicDamage = G.player.base.matk * 1.2;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, Math.floor(baseMagicDamage * variance));
        G.player.isDefending = false;
        addLog(`🔮 法术攻击，造成 ${damage} 点伤害`, 'damage');
    } else if (type === 'defend') {
        G.player.isDefending = true;
        addLog('🛡️ 进入防御姿态', 'heal');
    }

    if (damage > 0 && enemy.isDefending) {
        damage = Math.floor(damage * 0.4);
        addLog('🛡️ 敌人防御姿态减免伤害！', 'heal');
    }

    if (damage > 0) {
        const actual = Math.max(1, Math.floor(damage));
        enemy.current.hp -= actual;
        if (enemy.current.hp <= 0) {
            enemy.current.hp = 0;
            enemy.alive = false;
            addLog(`💀 ${enemy.name} 被击败！`, 'highlight');
            G.inAction = false;
            endBossVictory();
            return;
        }
    }

    // 恢复MP
    G.player.current.mp = Math.min(G.player.base.maxMp, G.player.current.mp + G.player.base.mpRegen);

    G.inAction = false;
    renderAll();

    if (G.enemy && G.enemy.alive && G.enemy.current.progress >= 100) {
        enemyAction();
    }
}

// ----- 敌人AI行动 -----
function enemyAction() {
    if (G.inAction) return;
    if (!G.enemy || !G.enemy.alive) return;

    G.inAction = true;
    const enemy = G.enemy;
    const player = G.player;
    enemy.current.progress = 0;

    let action = 'attack';
    if (enemy.current.hp < enemy.base.maxHp * 0.2 && Math.random() < 0.4) {
        action = 'defend';
    } else if (Math.random() < 0.15 && player.current.hp < player.base.maxHp * 0.3) {
        action = 'magic';
    }

    let damage = 0;
    if (action === 'attack') {
        damage = calcDamage(enemy.base.atk, player.base.def);
        addLog(`👹 ${enemy.name} 物理攻击，造成 ${damage} 点伤害`, 'damage');
    } else if (action === 'magic') {
        // 法术无视防御
        const baseMagicDamage = enemy.base.matk * 1.3;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, Math.floor(baseMagicDamage * variance));
        addLog(`👹 ${enemy.name} 释放法术，造成 ${damage} 点伤害`, 'damage');
    } else {
        enemy.isDefending = true;
        addLog(`🛡️ ${enemy.name} 防御`, 'heal');
        G.inAction = false;
        G.waitingForPlayer = false;
        renderAll();
        return;
    }

    if (damage > 0) {
        let actual = Math.max(1, Math.floor(damage));
        if (player.isDefending) {
            actual = Math.floor(actual * 0.4);
            addLog(`🛡️ 防御姿态减免伤害！`, 'heal');
        }
        player.current.hp -= actual;
        if (player.current.hp <= 0) {
            player.current.hp = 0;
            player.alive = false;
            addLog(`💀 勇者被击败...`, 'damage');
            G.inAction = false;
            G.waitingForPlayer = false;
            endBossDefeat();
            return;
        }
    }

    enemy.isDefending = false;
    enemy.current.mp = Math.min(50, (enemy.current.mp || 0) + 1);

    G.inAction = false;
    G.waitingForPlayer = false;
    renderAll();
}

// ----- Boss失败 -----
function endBossDefeat() {
    G.battleActive = false;
    G.waitingForPlayer = false;
    addLog('💀 你在Boss战中落败...', 'damage');
    endGame(false);
}

// ----- 游戏结束（结算） -----
export function endGame(victory) {
    G.gameOver = true;
    G.victory = victory;
    G.phase = 'settlement';
    G.battleActive = false;
    G.waitingForPlayer = false;
    document.getElementById('enemyPanel').style.display = 'none';
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
    renderAll();

    const totalDays = G.day - 1;
    const bossCount = G.bossDefeated.filter(Boolean).length;
    let grade = 'C';
    if (victory && bossCount === 3) grade = 'S';
    else if (victory && bossCount === 2) grade = 'A';
    else if (victory) grade = 'B';

    const html = `
        <div class="settlement">
            <h2>${victory ? '🎉 冒险胜利！' : '💀 冒险失败...'}</h2>
            <p>坚持天数：${totalDays} 天</p>
            <p>击败Boss：${bossCount} / 3</p>
            <p>最终评分：<span class="text-gold" style="font-size:28px;">${grade}</span></p>
            <button class="btn primary" id="btnRestart" style="margin-top:16px;">🔄 重新开始</button>
        </div>
    `;
    document.getElementById('dynamicArea').innerHTML = html;
    document.getElementById('btnRestart').addEventListener('click', () => {
        import('./gameState.js').then(module => {
            module.initGameState();
            import('./main.js').then(m => m.restartGame());
        });
    });
    addLog(`🏁 游戏结束，评分 ${grade}`, 'highlight');
}