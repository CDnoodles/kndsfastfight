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

// ----- 玩家进攻增益（职业 + 天赋），返回整数伤害 -----
function applyOffensiveBuffs(damage, type) {
    const p = G.player;
    // 嗜血天赋：每损失 10% 血量，+5% 伤害
    if (p.talent === 'bloodthirsty') {
        const lostPercent = 1 - p.current.hp / p.base.maxHp;
        const bonus = Math.floor(lostPercent / 0.1) * 0.05;
        damage *= (1 + bonus);
    }
    // 愈战愈勇天赋：每层 +5% 伤害
    if (p.talent === 'escalation') {
        const stacks = p.combatBuffs.escalationStacks || 0;
        damage *= (1 + stacks * 0.05);
    }
    // 法师被动：法术伤害额外 +20%
    if (p.profession === 'mage' && type === 'magic') {
        damage *= 1.2;
    }
    // 刺客被动：物理攻击 20% 暴击（200% 伤害）
    if (p.profession === 'assassin' && type === 'physical') {
        if (Math.random() < 0.2) {
            damage *= 2;
            addLog('💥 暴击！造成双倍伤害！', 'highlight');
        }
    }
    return Math.max(1, Math.floor(damage));
}

// ----- 玩家受击减益（职业 + 天赋），返回最终应扣 HP -----
// 若战斗因反击击杀 Boss 而结束，返回 null（调用方需中止）
function applyDefensiveBuffs(damage) {
    const p = G.player;
    let d = Math.max(0, damage);

    // 骑士被动：30% 格挡减伤 50%
    if (p.profession === 'knight' && Math.random() < 0.3) {
        d = Math.floor(d * 0.5);
        addLog('🛡️ 骑士格挡！减免50%伤害', 'heal');
    }
    // 魔法护盾天赋：至多抵消本次伤害的 20%，消耗等量 MP（1 MP 抵 1 点，蓝不够则只抵消能付起的部分）
    if (p.talent === 'magic_shield' && p.current.mp > 0) {
        const absorb = Math.min(p.current.mp, Math.floor(d * 0.2));
        p.current.mp -= absorb;
        d -= absorb;
        if (absorb > 0) addLog(`💧 魔法护盾抵消 ${absorb} 点伤害(20%)`, 'heal');
    }
    // 反击天赋：受击 25% 概率反击 50% 物理伤害
    if (p.talent === 'counter' && G.enemy && G.enemy.alive && Math.random() < 0.25) {
        const counterDmg = Math.max(1, Math.floor(p.base.atk * 0.5));
        G.enemy.current.hp -= counterDmg;
        addLog(`⚡ 反击造成 ${counterDmg} 点伤害`, 'damage');
        if (G.enemy.current.hp <= 0) {
            G.enemy.current.hp = 0;
            G.enemy.alive = false;
            addLog(`💀 ${G.enemy.name} 被反击击杀！`, 'highlight');
            G.inAction = false;
            G.waitingForPlayer = false;
            endBossVictory();
            return null;
        }
    }
    // 不屈意志天赋：首次致命伤害保留 1 HP
    if (p.talent === 'unyielding' && !p.talentFlags.unyieldingUsed) {
        if (p.current.hp - d <= 0) {
            p.talentFlags.unyieldingUsed = true;
            d = p.current.hp - 1;
            addLog('🛡️ 不屈意志触发！保留1HP', 'heal');
        }
    }
    return Math.max(0, d);
}

// ----- 回合被动恢复（行动后调用） -----
function applyRegeneration() {
    const p = G.player;
    // 战士被动：每回合恢复 2% 最大HP（至少2点）
    if (p.profession === 'warrior') {
        const heal = Math.max(2, Math.floor(p.base.maxHp * 0.02));
        p.current.hp = Math.min(p.base.maxHp, p.current.hp + heal);
    }
    // 牧师被动：每回合恢复 6% 最大HP 与 3 MP
    if (p.profession === 'priest') {
        const heal = Math.max(1, Math.floor(p.base.maxHp * 0.06));
        p.current.hp = Math.min(p.base.maxHp, p.current.hp + heal);
        p.current.mp = Math.min(p.base.maxMp, p.current.mp + 3);
    }
    // 再生天赋：每回合恢复 5% 最大HP
    if (p.talent === 'regeneration') {
        const heal = Math.max(1, Math.floor(p.base.maxHp * 0.05));
        p.current.hp = Math.min(p.base.maxHp, p.current.hp + heal);
    }
}

// ----- 玩家当前速度（含减速 debuff） -----
function playerSpeed() {
    const p = G.player;
    let s = p.base.speed;
    if (p.buffs) {
        for (const b of p.buffs) {
            if (b.type === 'speed_reduce') s -= b.value;
        }
    }
    return Math.max(1, s);
}

// ----- 敌人每回合被动（回血 / MP恢复 / 免疫切换等） -----
function applyEnemyPassive(enemy) {
    const pv = enemy.passive;
    const st = enemy.aiState;
    if (!pv) return;
    switch (pv.type) {
        case 'regen': {
            const heal = Math.max(1, Math.floor(enemy.base.maxHp * pv.value));
            enemy.current.hp = Math.min(enemy.base.maxHp, enemy.current.hp + heal);
            if (heal > 0) addLog(`🌿 ${enemy.name} 恢复了 ${heal} 点生命`, 'heal');
            break;
        }
        case 'defend_bonus': {
            // 泰坦额外附带每回合回血
            if (pv.regen) {
                const heal = Math.max(1, Math.floor(enemy.base.maxHp * pv.regen));
                enemy.current.hp = Math.min(enemy.base.maxHp, enemy.current.hp + heal);
                if (heal > 0) addLog(`🌋 ${enemy.name} 恢复了 ${heal} 点生命`, 'heal');
            }
            break;
        }
        case 'mp_regen': {
            enemy.current.mp = Math.min(50, (enemy.current.mp || 0) + pv.value);
            break;
        }
        case 'immunity_cycle': {
            st.cycleCount = (st.cycleCount || 0) + 1;
            if (st.cycleCount >= pv.duration) {
                st.cycleCount = 0;
                if (st.immunityType === 'physical') {
                    st.immunityType = 'magic';
                    addLog('🌀 虚空实体切换到【法术免疫】！', 'highlight');
                } else {
                    st.immunityType = 'physical';
                    addLog('🌀 虚空实体切换到【物理免疫】！', 'highlight');
                }
            }
            break;
        }
    }
}

// ----- 玩家减速 debuff 回合递减（每次玩家行动后触发） -----
function tickPlayerDebuffs() {
    const p = G.player;
    if (!p.buffs || p.buffs.length === 0) return;
    p.buffs = p.buffs.filter(b => {
        if (b.type === 'speed_reduce') {
            b.duration -= 1;
            if (b.duration <= 0) {
                addLog('💨 你的速度恢复了', 'heal');
                return false;
            }
        }
        return true;
    });
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
        intro: bossTemplate.intro,
        base: bossBase,
        current: { hp: bossBase.maxHp, mp: 50, progress: 0 },
        alive: true,
        isDefending: false,
        ai: bossTemplate.ai,
        passive: bossTemplate.passive || null,
        special: bossTemplate.special || null,
        aiState: {
            cycleCount: 0,      // 龙领主(cycle_boost) / 虚空实体(immunity_cycle) 计数
            immunityType: null, // 'physical' | 'magic' | null
            reviveUsed: false   // 奇美拉(two_lives)
        }
    };
    G.enemy = enemy;

    // 玩家满状态
    G.player.current.hp = G.player.base.maxHp;
    G.player.current.mp = G.player.base.maxMp;
    G.player.current.progress = 0;
    G.player.alive = true;
    G.player.isDefending = false;
    // 每场战斗重置叠层（愈战愈勇）与临时 debuff
    G.player.combatBuffs.escalationStacks = 0;
    G.player.buffs = [];

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
    // 奇美拉：两条命，首次倒地后以弱化姿态复活一次
    const enemy = G.enemy;
    if (enemy && enemy.special && enemy.special.type === 'two_lives' && !enemy.aiState.reviveUsed) {
        enemy.aiState.reviveUsed = true;
        const reviveHp = Math.max(1, Math.floor(enemy.base.maxHp * enemy.special.reviveHpRatio));
        enemy.current.hp = reviveHp;
        enemy.alive = true;
        enemy.current.progress = 0;
        enemy.isDefending = false;
        G.inAction = false;
        G.waitingForPlayer = false;
        addLog(`🔥 奇美拉复活了！以 ${reviveHp} 点生命卷土重来！`, 'highlight');
        renderAll();
        return;
    }

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
        G.player.current.progress += playerSpeed() * delta * 10;
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

    // 牧师被动：法术消耗 -3（最低3点）
    const magicCost = G.player.profession === 'priest' ? Math.max(3, 15 - 3) : 15;
    if (type === 'magic' && G.player.current.mp < magicCost) {
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
        damage = applyOffensiveBuffs(damage, 'physical');
        G.player.isDefending = false;
        addLog(`⚔️ 物理攻击，造成 ${damage} 点伤害`, 'damage');
    } else if (type === 'magic') {
        G.player.current.mp -= magicCost;
        // 法术无视防御
        const baseMagicDamage = G.player.base.matk * 1.2;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, Math.floor(baseMagicDamage * variance));
        damage = applyOffensiveBuffs(damage, 'magic');
        G.player.isDefending = false;
        addLog(`🔮 法术攻击，造成 ${damage} 点伤害`, 'damage');
    } else if (type === 'defend') {
        G.player.isDefending = true;
        addLog('🛡️ 进入防御姿态', 'heal');
    }

    // 虚空实体：免疫对应类型的伤害
    if (damage > 0 && enemy.aiState && enemy.aiState.immunityType) {
        const imm = enemy.aiState.immunityType;
        if ((imm === 'physical' && type === 'physical') || (imm === 'magic' && type === 'magic')) {
            damage = 0;
            addLog(`🌀 虚空实体免疫了你的${type === 'physical' ? '物理' : '法术'}攻击！`, 'heal');
        }
    }

    if (damage > 0 && enemy.isDefending) {
        damage = Math.floor(damage * 0.4);
        // 石傀儡 / 泰坦：防御时额外减伤
        const pv = enemy.passive;
        if (pv && pv.type === 'defend_bonus') {
            damage = Math.floor(damage * (1 - pv.value));
            addLog(`🛡️ ${enemy.name} 防御强化，伤害进一步被削减！`, 'heal');
        } else {
            addLog('🛡️ 敌人防御姿态减免伤害！', 'heal');
        }
    }

    if (damage > 0) {
        const actual = Math.max(1, Math.floor(damage));
        enemy.current.hp -= actual;
        // 愈战愈勇：攻击命中叠层（最多5层）
        if (G.player.talent === 'escalation') {
            G.player.combatBuffs.escalationStacks = Math.min(5, (G.player.combatBuffs.escalationStacks || 0) + 1);
            addLog(`🔥 愈战愈勇叠层 ${G.player.combatBuffs.escalationStacks}/5`, 'highlight');
        }
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
    // 回合被动恢复
    applyRegeneration();
    // 减速 debuff 回合递减
    tickPlayerDebuffs();

    G.inAction = false;
    renderAll();

    if (G.enemy && G.enemy.alive && G.enemy.current.progress >= 100) {
        enemyAction();
    }
}

// ----- 敌人AI行动 -----
// 依据 Boss 的 ai 权重（attack/magic/defend）随机选择行动；未配置时使用默认值。
// 同时按 passive/special 触发各自的特殊机制。
function enemyAction() {
    if (G.inAction) return;
    if (!G.enemy || !G.enemy.alive) return;

    G.inAction = true;
    const enemy = G.enemy;
    const player = G.player;
    const pv = enemy.passive;
    const st = enemy.aiState;
    enemy.current.progress = 0;

    // ----- 每回合被动（回血 / MP恢复 / 免疫切换等） -----
    applyEnemyPassive(enemy);

    // ----- 根据AI权重选择行动 -----
    const ai = enemy.ai || { attack: 0.6, magic: 0.2, defend: 0.2 }; // 默认值
    const wAtk = Math.max(0, ai.attack || 0);
    const wMag = Math.max(0, ai.magic || 0);
    const wDef = Math.max(0, ai.defend || 0);
    const total = wAtk + wMag + wDef;

    let action, attackType = 'physical';
    if (total <= 0) {
        action = 'attack'; // 三项权重全为0时，兜底为物理攻击
    } else {
        const roll = Math.random() * total;
        if (roll < wAtk) action = 'attack';
        else if (roll < wAtk + wMag) { action = 'attack'; attackType = 'magic'; }
        else action = 'defend';
    }

    if (action === 'defend') {
        enemy.isDefending = true;
        addLog(`🛡️ ${enemy.name} 防御`, 'heal');
        G.inAction = false;
        G.waitingForPlayer = false;
        renderAll();
        return;
    }

    // ----- 计算伤害 -----
    // 龙领主：每 3 次攻击强化一次 +30%
    let boost = 1;
    if (pv && pv.type === 'cycle_boost') {
        st.cycleCount = (st.cycleCount || 0) + 1;
        if (st.cycleCount >= 3) {
            boost = 1 + pv.value;
            st.cycleCount = 0;
            addLog(`🐉 龙领主力量涌动！本次攻击 +${Math.round(pv.value * 100)}%`, 'highlight');
        }
    }

    let damage = 0;
    if (attackType === 'physical') {
        damage = calcDamage(enemy.base.atk * boost, player.base.def);
        // 恶魔霸主：物理攻击 20% 概率暴击
        if (pv && pv.type === 'crit_chance' && Math.random() < pv.chance) {
            damage *= 2;
            addLog(`💥 ${enemy.name} 暴击！`, 'damage');
        }
        addLog(`👹 ${enemy.name} 物理攻击，造成 ${damage} 点伤害`, 'damage');
    } else {
        // 法术无视防御
        const baseMagicDamage = enemy.base.matk * 1.3 * boost;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, Math.floor(baseMagicDamage * variance));
        addLog(`👹 ${enemy.name} 释放法术，造成 ${damage} 点伤害`, 'damage');
    }

    if (damage > 0) {
        let actual = Math.max(1, Math.floor(damage));
        if (player.isDefending) {
            actual = Math.floor(actual * 0.4);
            addLog(`🛡️ 防御姿态减免伤害！`, 'heal');
        }
        // 职业/天赋受击减益（骑士格挡、魔法护盾、反击、不屈意志）
        actual = applyDefensiveBuffs(actual);
        if (actual === null) {
            return; // 反击击杀了 Boss，战斗已由 endBossVictory 收尾
        }
        player.current.hp -= actual;

        // 冰霜幽灵：攻击命中时概率降速
        if (pv && pv.type === 'slow_debuff' && actual > 0 && Math.random() < pv.chance) {
            player.buffs = player.buffs || [];
            player.buffs.push({ type: 'speed_reduce', value: pv.value, duration: pv.duration });
            addLog(`❄️ 冰霜幽灵降低了你的速度（-${pv.value}，持续${pv.duration}回合）`, 'damage');
        }
        // 吸血鬼：攻击吸血
        if (pv && pv.type === 'lifesteal' && actual > 0) {
            const heal = Math.max(1, Math.floor(actual * pv.value));
            enemy.current.hp = Math.min(enemy.base.maxHp, enemy.current.hp + heal);
            addLog(`🧛 吸血鬼吸取了 ${heal} 点生命`, 'heal');
        }

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
    // 回合被动恢复
    applyRegeneration();

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