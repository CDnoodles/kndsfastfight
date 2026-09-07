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

// 各项属性每天训练的增长范围 [min, max]
export const GROWTH_RANGES = {
    maxHp: [8, 18],
    atk: [1, 4],
    maxMp: [3, 8],
    mpRegen: [0.4, 1.2],
    matk: [1, 4],
    def: [0.8, 2.2],
    speed: [0.3, 1.0]
};

// 初始基础属性（玩家出生属性）
export const INITIAL_BASE = {
    maxHp: 100,
    atk: 15,
    maxMp: 50,
    mpRegen: 3,
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
// 每个 Boss 模板包含 id, name, base 属性（与玩家属性同结构）
export const BOSS_POOLS = [
    // 阶段 0（第10天）—— 较弱
    [
        { id: 'goblin_king', name: '👺 哥布林王', base: { maxHp: 80, atk: 15, matk: 10, def: 4, speed: 7 } },
        { id: 'forest_troll', name: '🌳 森林巨魔', base: { maxHp: 100, atk: 18, matk: 8, def: 6, speed: 5 } },
        { id: 'shadow_wolf', name: '🐺 影狼', base: { maxHp: 70, atk: 20, matk: 5, def: 3, speed: 12 } },
        { id: 'skeleton_lord', name: '💀 骷髅领主', base: { maxHp: 90, atk: 14, matk: 14, def: 5, speed: 8 } },
        { id: 'harpy', name: '🦅 鹰身女妖', base: { maxHp: 75, atk: 12, matk: 18, def: 3, speed: 11 } }
    ],
    // 阶段 1（第20天）—— 中等
    [
        { id: 'stone_golem', name: '🗿 石傀儡', base: { maxHp: 150, atk: 22, matk: 8, def: 12, speed: 4 } },
        { id: 'vampire', name: '🧛 吸血鬼', base: { maxHp: 120, atk: 20, matk: 20, def: 7, speed: 10 } },
        { id: 'dark_knight', name: '⚫ 暗黑骑士', base: { maxHp: 140, atk: 28, matk: 12, def: 10, speed: 8 } },
        { id: 'ice_wraith', name: '❄️ 冰霜幽灵', base: { maxHp: 110, atk: 16, matk: 26, def: 6, speed: 9 } },
        { id: 'chimera', name: '🔥 奇美拉', base: { maxHp: 160, atk: 24, matk: 24, def: 8, speed: 7 } }
    ],
    // 阶段 2（第30天）—— 强大
    [
        { id: 'dragon_lord', name: '🐉 龙领主', base: { maxHp: 250, atk: 35, matk: 30, def: 15, speed: 10 } },
        { id: 'demon_overlord', name: '👿 恶魔霸主', base: { maxHp: 280, atk: 40, matk: 25, def: 12, speed: 9 } },
        { id: 'lich_king', name: '🧙 巫妖王', base: { maxHp: 220, atk: 20, matk: 45, def: 10, speed: 11 } },
        { id: 'titan', name: '🌋 泰坦', base: { maxHp: 320, atk: 30, matk: 15, def: 20, speed: 6 } },
        { id: 'void_entity', name: '🌀 虚空实体', base: { maxHp: 260, atk: 32, matk: 32, def: 14, speed: 12 } }
    ]
];

// ----- 剧情事件池（按阶段分组，stage 0: 第5天, stage 1: 第15天, stage 2: 第25天） -----
// 每个事件：title 标题、desc 描述、reward 奖励说明、effect 应用效果（玩家不选择，随机触发直接生效）
export const STORY_POOLS = [
    // 阶段 0（第5天）
    [
        { title: '隐士的力量', desc: '你遇到一位隐居的武者，他传授你力量的诀窍。', reward: '攻击+4，血量+10', effect: (G) => { G.player.base.atk += 4; G.player.base.maxHp += 10; } },
        { title: '隐士的魔力', desc: '你遇到一位隐居的武者，他传授你魔力的诀窍。', reward: '法攻+4，法力+8', effect: (G) => { G.player.base.matk += 4; G.player.base.maxMp += 8; } },
        { title: '隐士的坚韧', desc: '你遇到一位隐居的武者，他传授你坚韧的诀窍。', reward: '防御+3，速度+0.5', effect: (G) => { G.player.base.def += 3; G.player.base.speed += 0.5; } }
    ],
    // 阶段 1（第15天）
    [
        { title: '力量药水', desc: '神秘商人向你兜售一瓶力量药水。', reward: '攻击+6，防御-1', effect: (G) => { G.player.base.atk += 6; G.player.base.def -= 1; } },
        { title: '智慧药水', desc: '神秘商人向你兜售一瓶智慧药水。', reward: '法攻+6，法力+10，回蓝+1', effect: (G) => { G.player.base.matk += 6; G.player.base.maxMp += 10; G.player.base.mpRegen += 1; } },
        { title: '敏捷药水', desc: '神秘商人向你兜售一瓶敏捷药水。', reward: '速度+2，防御-2', effect: (G) => { G.player.base.speed += 2; G.player.base.def -= 2; } }
    ],
    // 阶段 2（第25天）
    [
        { title: '火焰祝福', desc: '古神遗迹中的火焰祭坛赐予你祝福。', reward: '攻击+5，法攻+5', effect: (G) => { G.player.base.atk += 5; G.player.base.matk += 5; } },
        { title: '寒冰祝福', desc: '古神遗迹中的寒冰祭坛赐予你祝福。', reward: '防御+4，血量+20', effect: (G) => { G.player.base.def += 4; G.player.base.maxHp += 20; } },
        { title: '雷霆祝福', desc: '古神遗迹中的雷霆祭坛赐予你祝福。', reward: '速度+2.5，回蓝+2', effect: (G) => { G.player.base.speed += 2.5; G.player.base.mpRegen += 2; } }
    ]
];