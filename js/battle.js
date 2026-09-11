import { G, startNextWeek } from './gameState.js';
import { PROFESSIONS, TALENTS, getDifficulty } from './config.js';
import { addLog, renderAll, clearDynamicArea, fmt, saveHistory } from './ui.js';

// ----- 工具函数 -----
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ----- 伤害计算（尺度无关：减伤只取决于 def/atk 比值，双方同倍缩放时手感恒定）-----
const DEF_K = 1.0;   // 调参：>1 防御更弱，<1 防御更强
export function calcDamage(attack, defense) {
    const reduction = defense / (defense + attack * DEF_K);
    let base = attack * (1 - reduction);
    const variance = 0.9 + Math.random() * 0.2;
    return Math.max(1, base * variance); // 返回浮点数，应用/显示时再取整
}

// ----- 玩家进攻增益（职业 + 天赋），返回浮点伤害 -----
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
    return Math.max(1, damage); // 返回浮点数，应用时再取整
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
    // 牧师被动：每回合恢复 6% 最大HP 与 6% 最大MP
    if (p.profession === 'priest') {
        const heal = Math.max(1, Math.floor(p.base.maxHp * 0.06));
        p.current.hp = Math.min(p.base.maxHp, p.current.hp + heal);
        p.current.mp = Math.min(p.base.maxMp, p.current.mp + p.base.maxMp * 0.06);
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
            enemy.current.mp = Math.min(enemy.base.maxMp, (enemy.current.mp || 0) + pv.value);
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
// 僵局检测：双方血量签名长时间不变 → 提示玩家可主动结算
let stuckTime = 0;
let lastHpSignature = null;
let stuckWarned = false;

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
    // 敌人 MP 上限（仅作展示，敌人不消耗 MP）
    bossBase.maxMp = 50;
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

    // 玩家状态：HP 是全局资源，跨战斗继承，这里不回满；MP 开局回满
    G.player.current.mp = G.player.base.maxMp;
    G.player.current.progress = 0;
    G.player.alive = true;
    G.player.isDefending = false;
    // 每场战斗重置叠层（愈战愈勇）与临时 debuff
    G.player.combatBuffs.escalationStacks = 0;
    G.player.buffs = [];
    // 重置僵局检测
    stuckTime = 0;
    lastHpSignature = null;
    stuckWarned = false;

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

// ----- 推进到下一周目（通关第 30 天 Boss 后调用） -----
// 保留职业/天赋/成长与已成长属性，仅重置周目进度（HP 为全局资源，跨周目继承）
export function advanceWeek() {
    startNextWeek();                       // week++, day=1, bossDefeated 重置（HP 不回满）
    const clearedWeek = G.week - 1;        // startNextWeek 已自增，减 1 即刚通关的周目
    G.phase = 'training';
    document.getElementById('enemyPanel').style.display = 'none';
    addLog(`🌀 恭喜通关第 ${clearedWeek} 周目！进入第 ${G.week} 周目。`, 'highlight');
    renderAll();
    import('./training.js').then(module => module.generateDailyTraining());
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
    G.totalBossDefeated++;   // 累计击败数（全局统计，用于结算）

    // ----- 战后恢复：血量是全局资源，按已损失 HP 的比例回复 -----
    // 第 10/20 天 Boss → 回损失生命的 20%；第 30 天 Boss → 回损失生命的 40%
    const isFinalBoss = G.day >= 30;
    const healRatio = isFinalBoss ? 0.40 : 0.20;
    const lostHp = G.player.base.maxHp - G.player.current.hp;
    if (lostHp > 0) {
        const healAmount = Math.floor(lostHp * healRatio);
        if (healAmount > 0) {
            G.player.current.hp = Math.min(G.player.base.maxHp, G.player.current.hp + healAmount);
            addLog(`💚 战后恢复 ${fmt(healAmount)} 点生命（已损失生命的 ${Math.round(healRatio * 100)}%）`, 'heal');
        }
    }

    // 通关本周目（第 30 天 Boss）→ 进入下一周目
    if (isFinalBoss) {
        advanceWeek();
        return;
    }

    addLog('🎉 Boss战胜利！继续训练。', 'highlight');
    G.phase = 'training';
    G.enemy = null;
    document.getElementById('enemyPanel').style.display = 'none';
    G.player.current.mp = G.player.base.maxMp;
    G.player.current.progress = 0;
    G.player.isDefending = false;
    G.inAction = false;

    G.day++;
    if (G.day > 30) {
        // 兜底：还有 Boss 未打则交由 checkDayEvents 触发，否则直接推进周目
        if (!G.bossDefeated[2]) {
            import('./story.js').then(module => {
                module.checkDayEvents(); // 会再次进入 showBossSelection
            });
        } else {
            advanceWeek();
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

        // 僵局检测：任一方血量变化即重置计时（回血也算变化）
        // 注意：上面的 enemyAction() 可能已结束战斗并清空 G.enemy，必须先判空
        if (G.enemy && G.enemy.alive && G.player.alive) {
            const sig = `${G.enemy.current.hp}|${G.player.current.hp}`;
            if (sig !== lastHpSignature) {
                lastHpSignature = sig;
                stuckTime = 0;
                stuckWarned = false;
            } else {
                stuckTime += delta;
                if (stuckTime >= 10 && !stuckWarned) {
                    stuckWarned = true;
                    addLog('⏳ 战斗陷入僵局，你可以点击「🏳️ 主动结算」结束本局。', 'highlight');
                }
            }
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
        addLog(`⚔️ 物理攻击，造成 ${Math.floor(damage)} 点伤害`, 'damage');
    } else if (type === 'magic') {
        G.player.current.mp -= magicCost;
        // 法术无视防御
        const baseMagicDamage = G.player.base.matk * 1.2;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, baseMagicDamage * variance);
        damage = applyOffensiveBuffs(damage, 'magic');
        G.player.isDefending = false;
        addLog(`🔮 法术攻击，造成 ${Math.floor(damage)} 点伤害`, 'damage');
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

    // 恢复MP（mpRegen 表示每回合恢复 maxMp 的百分比）
    G.player.current.mp = Math.min(G.player.base.maxMp, G.player.current.mp + G.player.base.maxMp * (G.player.base.mpRegen / 100));
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
        addLog(`👹 ${enemy.name} 物理攻击，造成 ${Math.floor(damage)} 点伤害`, 'damage');
    } else {
        // 法术无视防御
        const baseMagicDamage = enemy.base.matk * 1.3 * boost;
        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(1, baseMagicDamage * variance);
        addLog(`👹 ${enemy.name} 释放法术，造成 ${Math.floor(damage)} 点伤害`, 'damage');
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
    enemy.current.mp = Math.min(enemy.base.maxMp, (enemy.current.mp || 0) + 1);
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

// ----- 主动结算（战斗中随时可结束本局并记录成绩） -----
export function activeSettlement() {
    if (G.phase !== 'boss' || !G.battleActive) return;
    if (!confirm('确定要主动结算吗？本局将立即结束，并按当前成绩记录战绩。')) return;
    if (battleLoopId) {
        cancelAnimationFrame(battleLoopId);
        battleLoopId = null;
    }
    G.battleActive = false;
    G.waitingForPlayer = false;
    G.inAction = false;
    endGame(false, 'surrender');
}

// ----- 游戏结束（结算） -----
// resultType: 'normal'（战败/胜利）| 'surrender'（主动结算）
export function endGame(victory, resultType = 'normal') {
    G.gameOver = true;
    G.victory = victory;
    G.phase = 'settlement';
    G.battleActive = false;
    G.waitingForPlayer = false;
    G.inAction = false;
    if (battleLoopId) {
        cancelAnimationFrame(battleLoopId);
        battleLoopId = null;
    }
    document.getElementById('enemyPanel').style.display = 'none';
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;
    renderAll();

    // ----- 成绩统计 -----
    const weeksCleared = G.week - 1;              // 完整通关的周目数
    const currentDay = G.day;
    const totalDays = Math.max(0, weeksCleared * 30 + currentDay - 1);
    const bossCount = G.totalBossDefeated;
    const diff = getDifficulty(G.difficulty);

    // 得分 = 基础分 × 难度倍率（基础分由周目 / Boss 数 / 天数加权）
    const baseScore = weeksCleared * 1000 + bossCount * 200 + totalDays * 5;
    const score = Math.max(0, Math.floor(baseScore * diff.scoreMult));

    // 评级由得分推导（难度已计入得分，高难度更易拿到高评级）
    let grade = 'C';
    if (score >= 17000) grade = 'SSS';
    else if (score >= 12000) grade = 'SS';
    else if (score >= 8000) grade = 'S';
    else if (score >= 4500) grade = 'A';
    else if (score >= 1500) grade = 'B';

    // ----- 结果类型与标题 -----
    const resultKind = resultType === 'surrender' ? 'surrender' : (victory ? 'victory' : 'defeat');
    const titleMap = {
        victory:   '🎉 无尽之路登顶！',
        surrender: '🏳️ 你主动结束了这场冒险',
        defeat:    '💀 无尽之路终止...'
    };

    // ----- 玩家最终数值 -----
    const b = G.player.base;
    const stats = [
        { label: '血量上限', value: fmt(b.maxHp) },
        { label: '法力上限', value: fmt(b.maxMp) },
        { label: '物攻', value: fmt(b.atk) },
        { label: '法攻', value: fmt(b.matk) },
        { label: '防御', value: fmt(b.def) },
        { label: '速度', value: fmt(b.speed) },
        { label: '回蓝', value: b.mpRegen.toFixed(1) + '%' }
    ];
    const statsHtml = stats
        .map(s => `<div class="stat-item"><span class="label">${s.label}</span><span class="value">${s.value}</span></div>`)
        .join('');

    // ----- 身份（职业 / 天赋 / 成长） -----
    const prof = PROFESSIONS.find(p => p.id === G.player.profession);
    const tal = TALENTS.find(t => t.id === G.player.talent);
    const identity = [
        prof ? `🎭 ${prof.name}` : '',
        tal ? `✨ ${tal.name}` : '',
        G.player.growth ? `🌱 成长 x${G.player.growth.value} · ${G.player.growth.label}` : ''
    ].filter(Boolean).join('　');

    // ----- 存入历史战绩（localStorage，最多 50 条） -----
    saveHistory({
        date: new Date().toLocaleString('zh-CN', { hour12: false }),
        difficulty: diff.id,
        difficultyName: diff.name,
        weeksCleared,
        totalDays,
        bossCount,
        score,
        grade,
        result: resultKind,
        profession: prof ? prof.name : '',
        talent: tal ? tal.name : '',
        growth: G.player.growth ? `🌱 x${G.player.growth.value} · ${G.player.growth.label}` : '',
        stats: {
            maxHp: b.maxHp, maxMp: b.maxMp, atk: b.atk,
            matk: b.matk, def: b.def, speed: b.speed
        }
    });

    const html = `
        <div class="settlement">
            <h2>${titleMap[resultKind]}</h2>
            <p style="margin:6px 0; font-size:17px;">
                到达：<span class="text-gold"><b>第 ${G.week} 周目</b></span> · 第 ${currentDay} 天
            </p>
            <p style="margin:4px 0 4px; opacity:0.9;">难度：<b>${diff.name}</b>（得分 ×${diff.scoreMult}）</p>
            <p style="margin:4px 0 12px; opacity:0.9;">${identity}</p>

            <p style="margin:0 0 8px; opacity:0.8;">—— 最终数值 ——</p>
            <div class="stat-grid">${statsHtml}</div>

            <div style="margin-top:14px; line-height:1.9;">
                <p style="margin:0;">完整通关：<b class="text-gold">${weeksCleared}</b> 周目</p>
                <p style="margin:0;">累计击败 Boss：<b class="text-gold">${bossCount}</b> 个</p>
                <p style="margin:0;">总坚持天数：<b class="text-gold">${totalDays}</b> 天</p>
            </div>

            <p style="margin:16px 0 0;">最终得分：<span class="text-gold" style="font-size:30px;">${fmt(score)}</span></p>
            <p style="margin:2px 0 0;">最终评分：<span class="text-gold" style="font-size:34px;">${grade}</span></p>
            <button class="btn primary" id="btnRestart" style="margin-top:16px;">🔄 重新开始</button>
        </div>
    `;
    document.getElementById('dynamicArea').innerHTML = html;
    document.getElementById('btnRestart').addEventListener('click', () => {
        import('./main.js').then(m => m.restartGame());
    });
    addLog(`🏁 无尽之路结束（第 ${G.week} 周目 · ${diff.name}），得分 ${fmt(score)}，评分 ${grade}`, 'highlight');
}