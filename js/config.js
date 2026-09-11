// 属性名称列表
export const ATTR_NAMES = ['maxHp', 'atk', 'maxMp', 'mpRegen', 'matk', 'def', 'speed'];

// 属性显示标签
export const ATTR_LABELS = {
    maxHp: '血量',
    atk: '物攻',
    maxMp: '法力',
    mpRegen: '回蓝',
    matk: '法攻',
    def: '防御',
    speed: '速度'
};

// 各项属性每天训练的百分比增长 [min, max]（对当前值乘 1+pct）
export const GROWTH_RATES = {
    maxHp:   [0.015, 0.035],
    atk:     [0.015, 0.035],
    maxMp:   [0.015, 0.035],
    mpRegen: [0.015, 0.035],
    matk:    [0.015, 0.035],
    def:     [0.015, 0.035],
    speed:   [0.010, 0.025]
};

// 初始基础属性（玩家出生属性）
// 乘法体系下 mpRegen 表示「每回合恢复 maxMp 的百分比」，6 = 6%
export const INITIAL_BASE = {
    maxHp: 100,
    atk: 15,
    maxMp: 50,
    mpRegen: 6,
    matk: 20,
    def: 5,
    speed: 8
};

// // ----- Boss 模板（新增怪物只需在此添加） -----
// export const BOSS_TEMPLATES = [
//     {
//         id: 'stone_giant',
//         name: '👹 石巨人',
//         base: { maxHp: 120, atk: 18, matk: 12, def: 8, speed: 6 }
//     },
//     {
//         id: 'shadow_dragon',
//         name: '🐉 暗影龙',
//         base: { maxHp: 180, atk: 25, matk: 22, def: 6, speed: 10 }
//     },
//     {
//         id: 'void_emperor',
//         name: '👾 最终魔王·虚空',
//         base: { maxHp: 240, atk: 30, matk: 28, def: 10, speed: 12 }
//     }
// ];

// ----- Boss 池，按阶段分组（stage 0: 第10天, stage 1: 第20天, stage 2: 第30天） -----
// 每个 Boss 模板包含：
//   id / name / intro（选Boss时的一句话介绍）/ base 属性 / ai 权重
//   ai：攻击/法术/防御 三个权重，不用加和为 1（运行时自动归一化），为 0 表示永不使用该行动。
//   passive：被动（每回合或攻击时触发），可选，见 battle.js 的 applyEnemyPassive/enemyAction。
//   special：特殊机制（如两条命），可选，见 battle.js 的 endBossVictory。
export const BOSS_POOLS = [
    // 阶段 0（第10天）—— 较弱
    [
        {
            id: 'goblin_king',
            name: '👺 哥布林王',
            intro: '挥舞大刀的哥布林首领，偶尔举盾防御。',
            base: { maxHp: 80, atk: 15, matk: 10, def: 4, speed: 7 },
            ai: { attack: 0.7, magic: 0, defend: 0.3 }
        },
        {
            id: 'forest_troll',
            name: '🌳 森林巨魔',
            intro: '皮糙肉厚的巨魔，会缓慢恢复伤势。',
            base: { maxHp: 100, atk: 18, matk: 8, def: 6, speed: 5 },
            ai: { attack: 1, magic: 0, defend: 0 },
            passive: { type: 'regen', value: 0.05 }       // 每回合恢复 5% 最大HP
        },
        {
            id: 'shadow_wolf',
            name: '🐺 影狼',
            intro: '行动迅捷的影狼，攻速极快但身体脆弱。',
            base: { maxHp: 60, atk: 20, matk: 5, def: 3, speed: 12 },
            ai: { attack: 1, magic: 0, defend: 0 }
        },
        {
            id: 'skeleton_lord',
            name: '💀 骷髅领主',
            intro: '骷髅领主，善用暗影法术。',
            base: { maxHp: 90, atk: 14, matk: 14, def: 5, speed: 8 },
            ai: { attack: 0.2, magic: 0.6, defend: 0.2 }
        },
        {
            id: 'harpy',
            name: '🦅 鹰身女妖',
            intro: '鹰身女妖，几乎只会用法术攻击。',
            base: { maxHp: 75, atk: 12, matk: 18, def: 3, speed: 11 },
            ai: { attack: 0.1, magic: 0.9, defend: 0 }
        }
    ],
    // 阶段 1（第20天）—— 中等
    [
        {
            id: 'stone_golem',
            name: '🗿 石傀儡',
            intro: '石傀儡，防御极高但行动迟缓。',
            base: { maxHp: 180, atk: 38, matk: 8, def: 15, speed: 3 },
            ai: { attack: 0.6, magic: 0, defend: 0.4 },
            passive: { type: 'defend_bonus', value: 0.2 } // 防御时额外减伤 20%
        },
        {
            id: 'vampire',
            name: '🧛 吸血鬼',
            intro: '吸血鬼，攻击时会吸取你的生命。',
            base: { maxHp: 120, atk: 20, matk: 20, def: 7, speed: 10 },
            ai: { attack: 0.5, magic: 0.5, defend: 0 },
            passive: { type: 'lifesteal', value: 0.2 }    // 攻击恢复伤害的 20%
        },
        {
            id: 'dark_knight',
            name: '⚫ 暗黑骑士',
            intro: '暗黑骑士，重击凶猛但身体脆弱。',
            base: { maxHp: 90, atk: 32, matk: 12, def: 12, speed: 8 },
            ai: { attack: 0.8, magic: 0, defend: 0.2 }
        },
        {
            id: 'ice_wraith',
            name: '❄️ 冰霜幽灵',
            intro: '冰霜幽灵，攻击会冻结你的脚步。',
            base: { maxHp: 100, atk: 16, matk: 28, def: 6, speed: 9 },
            ai: { attack: 0.1, magic: 0.8, defend: 0.1 },
            passive: { type: 'slow_debuff', chance: 0.3, value: 2, duration: 3 } // 30% 概率降速 2，持续 3 回合
        },
        {
            id: 'chimera',
            name: '🔥 奇美拉',
            intro: '奇美拉，死后会以更弱的姿态复活一次。',
            base: { maxHp: 140, atk: 26, matk: 24, def: 8, speed: 7 },
            ai: { attack: 1, magic: 0, defend: 0 },
            special: { type: 'two_lives', reviveHpRatio: 0.4 } // 第一条命结束后以 40% HP 复活
        }
    ],
    // 阶段 2（第30天）—— 强大
    [
        {
            id: 'dragon_lord',
            name: '🐉 龙领主',
            intro: '龙领主，每三回合会爆发更强的力量。',
            base: { maxHp: 220, atk: 32, matk: 30, def: 14, speed: 10 },
            ai: { attack: 0.5, magic: 0.5, defend: 0 },
            passive: { type: 'cycle_boost', value: 0.3 }  // 每 3 次攻击强化一次 +30%
        },
        {
            id: 'demon_overlord',
            name: '👿 恶魔霸主',
            intro: '恶魔霸主，攻击有几率造成致命重击。',
            base: { maxHp: 260, atk: 40, matk: 22, def: 12, speed: 9 },
            ai: { attack: 0.8, magic: 0.2, defend: 0 },
            passive: { type: 'crit_chance', chance: 0.2 } // 物理攻击 20% 概率双倍伤害
        },
        {
            id: 'lich_king',
            name: '🧙 巫妖王',
            intro: '巫妖王，法术轰炸连绵不绝。',
            base: { maxHp: 200, atk: 20, matk: 48, def: 10, speed: 11 },
            ai: { attack: 0.1, magic: 0.9, defend: 0 },
            passive: { type: 'mp_regen', value: 5 }       // 每回合恢复 5 MP
        },
        {
            id: 'titan',
            name: '🌋 泰坦',
            intro: '泰坦，防御与回血兼备的持久噩梦。',
            base: { maxHp: 300, atk: 36, matk: 15, def: 22, speed: 5 },
            ai: { attack: 0.6, magic: 0, defend: 0.4 },
            passive: { type: 'defend_bonus', value: 0.5, regen: 0.02 } // 防御额外减伤 50% + 每回合回 2%
        },
        {
            id: 'void_entity',
            name: '🌀 虚空实体',
            intro: '虚空实体，会在物免与法免之间切换。',
            base: { maxHp: 240, atk: 30, matk: 32, def: 14, speed: 12 },
            ai: { attack: 0.5, magic: 0.5, defend: 0 },
            passive: { type: 'immunity_cycle', duration: 2 } // 每 2 回合在物免/法免间切换
        }
    ]
];

// ----- 剧情事件池（按阶段分组，stage 0: 第5天, stage 1: 第15天, stage 2: 第25天） -----
// 每个事件：title 标题、desc 描述、choices 两个极端选项（增益+减益）
// 效果为「按比例乘除」（无尽模式下每周目都会重复触发，固定加减会失衡）
// 第三个选项「放弃该事件」由 story.js 自动追加，不做任何改动
export const STORY_POOLS = [
    // 阶段 0（第5天）
    [
        {
            title: '隐士的交易',
            desc: '隐居的武者愿意用残酷的秘法交换你的某种资质。',
            choices: [
                { label: '⚔️ 狂暴之力', desc: '物攻 +15%，血量上限 -10%', effect: (G) => { G.player.base.atk *= 1.15; G.player.base.maxHp *= 0.90; } },
                { label: '🛡️ 磐石之躯', desc: '防御 +20%，物攻 -10%', effect: (G) => { G.player.base.def *= 1.20; G.player.base.atk *= 0.90; } }
            ]
        },
        {
            title: '神秘药水',
            desc: '一瓶来历不明的药水，可能脱胎换骨，也可能伤及根本。',
            choices: [
                { label: '🔮 魔力激增', desc: '法攻 +15%，法力上限 -10%', effect: (G) => { G.player.base.matk *= 1.15; G.player.base.maxMp *= 0.90; } },
                { label: '❤️ 生命灌注', desc: '血量上限 +15%，法攻 -10%', effect: (G) => { G.player.base.maxHp *= 1.15; G.player.base.matk *= 0.90; } }
            ]
        },
        {
            title: '古战场遗骸',
            desc: '你捡到一份残破兵书与一面破损护盾，只能取其一。',
            choices: [
                { label: '⚔️ 舍身剑术', desc: '物攻 +12%，防御 -8%', effect: (G) => { G.player.base.atk *= 1.12; G.player.base.def *= 0.92; } },
                { label: '🛡️ 铁壁心法', desc: '防御 +15%，物攻 -8%', effect: (G) => { G.player.base.def *= 1.15; G.player.base.atk *= 0.92; } }
            ]
        }
    ],
    // 阶段 1（第15天）
    [
        {
            title: '恶魔的契约',
            desc: '恶魔向你提出交易：以一项资质为代价，换取另一项极致。',
            choices: [
                { label: '⚔️ 极致力量', desc: '物攻 +20%，速度 -10%', effect: (G) => { G.player.base.atk *= 1.20; G.player.base.speed *= 0.90; } },
                { label: '💨 极致迅捷', desc: '速度 +15%，物攻 -15%', effect: (G) => { G.player.base.speed *= 1.15; G.player.base.atk *= 0.85; } }
            ]
        },
        {
            title: '血族馈赠',
            desc: '血族贵族愿赐你力量，但总要付出点代价。',
            choices: [
                { label: '❤️ 生命虹吸', desc: '血量上限 +20%，防御 -10%', effect: (G) => { G.player.base.maxHp *= 1.20; G.player.base.def *= 0.90; } },
                { label: '🔮 法力洪流', desc: '法力上限 +20%，血量上限 -10%', effect: (G) => { G.player.base.maxMp *= 1.20; G.player.base.maxHp *= 0.90; } }
            ]
        },
        {
            title: '元素试炼',
            desc: '祭坛上燃着火焰与寒冰两团元素，各附赠一份力量与代价。',
            choices: [
                { label: '🔥 火焰精华', desc: '法攻 +15%，防御 -8%', effect: (G) => { G.player.base.matk *= 1.15; G.player.base.def *= 0.92; } },
                { label: '❄️ 寒冰精华', desc: '防御 +15%，法攻 -8%', effect: (G) => { G.player.base.def *= 1.15; G.player.base.matk *= 0.92; } }
            ]
        }
    ],
    // 阶段 2（第25天）
    [
        {
            title: '古神凝视',
            desc: '古神的残念注视着你，赐予力量的同时也在索取。',
            choices: [
                { label: '⚔️ 泰坦之力', desc: '物攻 +20%，速度 -12%', effect: (G) => { G.player.base.atk *= 1.20; G.player.base.speed *= 0.88; } },
                { label: '💨 疾风之姿', desc: '速度 +18%，物攻 -15%', effect: (G) => { G.player.base.speed *= 1.18; G.player.base.atk *= 0.85; } }
            ]
        },
        {
            title: '深渊祭坛',
            desc: '祭坛流淌着暗影与圣光，两种力量只能择一。',
            choices: [
                { label: '🌑 暗影增幅', desc: '法攻 +20%，血量上限 -12%', effect: (G) => { G.player.base.matk *= 1.20; G.player.base.maxHp *= 0.88; } },
                { label: '✨ 圣光庇护', desc: '血量上限 +25%，法攻 -15%', effect: (G) => { G.player.base.maxHp *= 1.25; G.player.base.matk *= 0.85; } }
            ]
        },
        {
            title: '命运骰子',
            desc: '命运向你掷出骰子：押上一切，或固守本心。',
            choices: [
                { label: '🎲 孤注一掷', desc: '物攻 +15% 法攻 +15%，防御 -15%', effect: (G) => { G.player.base.atk *= 1.15; G.player.base.matk *= 1.15; G.player.base.def *= 0.85; } },
                { label: '🗿 稳如泰山', desc: '防御 +25%，物攻 -12% 法攻 -12%', effect: (G) => { G.player.base.def *= 1.25; G.player.base.atk *= 0.88; G.player.base.matk *= 0.88; } }
            ]
        }
    ]
];

// ----- 职业模板 -----
// mods：对基础属性的百分比修正（0.2 = +20%，-0.1 = -10%）
// passive：战斗被动，在 battle.js 中按 profession id 判断触发
export const PROFESSIONS = [
    {
        id: 'warrior',
        name: '⚔️ 战士',
        desc: '均衡的斗士，能打能抗。',
        mods: { maxHp: 0.2, atk: 0.15, def: 0.1 },
        passive: '每回合额外恢复 2% 最大HP'
    },
    {
        id: 'mage',
        name: '🔮 法师',
        desc: '强大的法术炮台，但身板脆弱。',
        mods: { matk: 0.3, maxMp: 0.2, mpRegen: 0.5 },
        passive: '法术伤害额外 +20%'
    },
    {
        id: 'assassin',
        name: '🗡️ 刺客',
        desc: '极速高伤，但血量较少。',
        mods: { speed: 0.5, atk: 0.2, maxHp: -0.1 },
        passive: '暴击率 +20%，暴击伤害 200%'
    },
    {
        id: 'knight',
        name: '🛡️ 骑士',
        desc: '坚实壁垒，攻弱守强。',
        mods: { def: 0.4, maxHp: 0.3, atk: -0.2 },
        passive: '受击时 30% 概率格挡，减伤 50%'
    },
    {
        id: 'priest',
        name: '✨ 牧师',
        desc: '圣光之力，持久续航。',
        mods: { matk: 0.2, mpRegen: 0.2, maxMp: 0.15 },
        passive: '每回合恢复 6% 最大HP 与 6% 最大MP，法术消耗 -3'
    }
];

// ----- 天赋模板 -----
export const TALENTS = [
    {
        id: 'bloodthirsty',
        name: '🩸 嗜血',
        desc: '每损失10%血量，伤害+5%',
    },
    {
        id: 'unyielding',
        name: '🛡️ 不屈意志',
        desc: '首次致命伤保留1HP（一次）',
    },
    {
        id: 'escalation',
        name: '🔥 愈战愈勇',
        desc: '每次攻击命中+5%伤害，最多5层',
    },
    {
        id: 'magic_shield',
        name: '💧 魔法护盾',
        desc: '受击时抵消20%伤害（消耗等量MP，1MP抵1点）',
    },
    {
        id: 'counter',
        name: '⚡ 反击',
        desc: '受击时25%概率反击50%伤害',
    },
    {
        id: 'regeneration',
        name: '🌿 再生',
        desc: '每回合恢复5%最大HP',
    }
];

// ----- 成长值档位（正态分布离散化） -----
export const GROWTH_LEVELS = [
    { value: 0.3, label: '废柴', desc: '天生废柴', weight: 1 },
    { value: 0.5, label: '羸弱', desc: '孱弱之躯', weight: 3 },
    { value: 0.7, label: '平庸', desc: '资质平平', weight: 10 },
    { value: 0.9, label: '普通', desc: '凡人之资', weight: 20 },
    { value: 1.0, label: '正常', desc: '中人之姿', weight: 30 },
    { value: 1.2, label: '良好', desc: '可塑之才', weight: 20 },
    { value: 1.5, label: '优秀', desc: '天赋异禀', weight: 10 },
    { value: 2.0, label: '卓越', desc: '绝世奇才', weight: 4 },
    { value: 2.5, label: '绝世', desc: '万中无一', weight: 1.5 },
    { value: 3.0, label: '天选', desc: '天选之子', weight: 0.5 }
];

// ----- 难度设定 -----
// hpMult / atkMult / defMult：Boss 属性倍率（>1 更难，atkMult 同时作用于物攻与法攻）
// scoreMult：结算得分倍率（难度越高，同样成绩得分越高）
// restHealMult：休息回血倍率（基础 3%，高难度下调 → 回血更慢、更难撑）
export const DIFFICULTIES = [
    {
        id: 'easy', name: '🌱 轻松', desc: 'Boss 大幅弱化，休息回血更快',
        hpMult: 0.70, atkMult: 0.70, defMult: 0.80, scoreMult: 0.6, restHealMult: 1.5
    },
    {
        id: 'normal', name: '⚔️ 普通', desc: '标准体验，成长与生存压力平衡',
        hpMult: 1.00, atkMult: 1.00, defMult: 1.00, scoreMult: 1.0, restHealMult: 1.0
    },
    {
        id: 'hard', name: '🔥 困难', desc: 'Boss 全面强化，血量为真·全局资源',
        hpMult: 1.60, atkMult: 1.35, defMult: 1.25, scoreMult: 1.8, restHealMult: 0.7
    },
    {
        id: 'hell', name: '💀 地狱', desc: '每一步都是生死抉择，休息杯水车薪',
        hpMult: 2.60, atkMult: 1.90, defMult: 1.60, scoreMult: 3.0, restHealMult: 0.4
    }
];

// 按 id 取难度配置（未指定 / 非法 id 时回退到「普通」）
export const getDifficulty = id => DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];