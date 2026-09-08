import { INITIAL_BASE } from './config.js';

export let G = {};

// 工具函数：随机
const rand = (min, max) => Math.random() * (max - min) + min;

// 初始化游戏状态
export function initGameState() {
    const base = { ...INITIAL_BASE };
    // 随机浮动
    for (let k of Object.keys(base)) {
        let v = base[k] * (0.7 + Math.random() * 0.6);
        if (k === 'maxHp' || k === 'maxMp') v = Math.round(v);
        else if (k === 'speed' || k === 'mpRegen' || k === 'def') v = Math.round(v * 10) / 10;
        else v = Math.round(v);
        base[k] = v;
    }
    // 保底值
    base.maxHp = Math.max(60, base.maxHp);
    base.atk = Math.max(8, base.atk);
    base.maxMp = Math.max(30, base.maxMp);
    base.mpRegen = Math.max(1, base.mpRegen);
    base.matk = Math.max(10, base.matk);
    base.def = Math.max(2, base.def);
    base.speed = Math.max(4, base.speed);

    G = {
        day: 1,
        phase: 'training',
        player: {
            base: { ...base },
            current: { hp: base.maxHp, mp: base.maxMp, progress: 0 },
            buffs: [],
            isDefending: false,
            alive: true,
            profession: null,        // 职业ID
            talent: null,            // 天赋ID
            growth: null,            // 成长值档位 { value, label, desc }
            talentFlags: {           // 一次性触发的记录
                unyieldingUsed: false
            },
            combatBuffs: {           // 战斗中产生的临时状态
                escalationStacks: 0
            }
        },
        enemy: null,
        bossDefeated: [false, false, false],
        currentStage: undefined,
        gameOver: false,
        victory: false,
        trainingLog: [],
        inAction: false,
        battleActive: false,
        waitingForPlayer: false
    };
}

// 重置游戏（用于重新开始）
export function resetGame() {
    initGameState();
}