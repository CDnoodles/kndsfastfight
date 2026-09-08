import { G } from './gameState.js';
import { PROFESSIONS, TALENTS, GROWTH_LEVELS } from './config.js';
import { renderAll, addLog, renderDynamicArea, clearDynamicArea } from './ui.js';
import { generateDailyTraining } from './training.js';

// 工具：随机选取 / 洗牌
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => arr.slice().sort(() => Math.random() - 0.5);

// 属性按类型取整：整数属性取整，小数属性保留1位
const roundStat = (k, v) => {
    if (k === 'speed' || k === 'mpRegen' || k === 'def') return Math.round(v * 10) / 10;
    return Math.round(v);
};

// 应用职业修正到基础属性
function applyProfession(professionId) {
    const prof = PROFESSIONS.find(p => p.id === professionId);
    if (!prof) return;
    const mods = prof.mods;
    const base = G.player.base;
    for (let key in mods) {
        if (base[key] !== undefined) {
            base[key] = roundStat(key, base[key] * (1 + mods[key]));
        }
    }
    // 保证血量法力为正（保底）
    base.maxHp = Math.max(60, base.maxHp);
    base.maxMp = Math.max(30, base.maxMp);
    base.atk = Math.max(1, base.atk);
    base.matk = Math.max(1, base.matk);
    base.def = Math.max(0, base.def);
    base.speed = Math.max(1, base.speed);
    // 更新当前值
    G.player.current.hp = base.maxHp;
    G.player.current.mp = base.maxMp;
    G.player.profession = professionId;
}

// 显示职业选择（三选一）
export function showCharacterCreation() {
    G.phase = 'characterCreation';
    G.player.profession = null;
    G.player.talent = null;
    G.player.growth = null;
    renderAll();
    document.getElementById('btnPhysical').disabled = true;
    document.getElementById('btnMagic').disabled = true;
    document.getElementById('btnDefend').disabled = true;

    const candidatesProf = shuffle([...PROFESSIONS]).slice(0, 3);

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">🎭 选择你的职业</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">随机出现了三个职业，选择其中一个：</p>
            <div class="story-choices">
    `;
    candidatesProf.forEach((prof, idx) => {
        const modStr = Object.entries(prof.mods)
            .map(([k, v]) => `${profModLabel(k)} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`)
            .join('  ');
        html += `<button class="btn primary" data-prof-idx="${idx}">${prof.name}<br><span style="font-weight:normal;font-size:12px;opacity:0.8;">${prof.desc}<br>${modStr}</span></button>`;
    });
    html += `</div></div>`;
    renderDynamicArea(html);

    document.querySelectorAll('[data-prof-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.profIdx);
            const selectedProf = candidatesProf[idx];
            applyProfession(selectedProf.id);
            addLog(`🎭 选择了职业：${selectedProf.name}（${selectedProf.passive}）`, 'highlight');
            renderAll();
            clearDynamicArea();
            showTalentSelection();
        });
    });
}

// 属性名 → 中文标签
function profModLabel(k) {
    const map = {
        maxHp: '血量', atk: '物攻', maxMp: '法力', mpRegen: '回蓝',
        matk: '法攻', def: '防御', speed: '速度'
    };
    return map[k] || k;
}

// 天赋选择（三选一）
function showTalentSelection() {
    const candidatesTalent = shuffle([...TALENTS]).slice(0, 3);

    let html = `
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">✨ 选择你的天赋</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">选择一种特殊能力，它将伴随你的冒险：</p>
            <div class="story-choices">
    `;
    candidatesTalent.forEach((talent, idx) => {
        html += `<button class="btn primary" data-talent-idx="${idx}">${talent.name}<br><span style="font-weight:normal;font-size:12px;opacity:0.8;">${talent.desc}</span></button>`;
    });
    html += `</div></div>`;
    renderDynamicArea(html);

    document.querySelectorAll('[data-talent-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.talentIdx);
            const selectedTalent = candidatesTalent[idx];
            G.player.talent = selectedTalent.id;
            addLog(`✨ 获得了天赋：${selectedTalent.name}`, 'highlight');
            renderAll();
            clearDynamicArea();
            showGrowthDraw();
        });
    });
}

// 按权重抽取成长值档位
function rollGrowth() {
    const total = GROWTH_LEVELS.reduce((s, l) => s + l.weight, 0);
    let r = Math.random() * total;
    for (const l of GROWTH_LEVELS) {
        r -= l.weight;
        if (r <= 0) return l;
    }
    return GROWTH_LEVELS[4]; // 兜底
}

// 成长值抽奖界面（点击抽取 → 显示结果 → 开始游戏）
function showGrowthDraw() {
    let html = `
        <div class="panel" style="border-color:#f1c40f; text-align:center;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">🌱 抽取你的成长值</h3>
            <p style="margin:4px 0 12px; opacity:0.9;">成长值将放大你每天训练获得的属性。</p>
            <button class="btn primary" id="btnRollGrowth" style="flex:none;">🎲 抽取成长值</button>
        </div>
    `;
    renderDynamicArea(html);

    document.getElementById('btnRollGrowth').addEventListener('click', () => {
        const level = rollGrowth();
        G.player.growth = { value: level.value, label: level.label, desc: level.desc };
        addLog(`🌱 成长值抽中：【${level.label}】x${level.value}（${level.desc}）`, 'highlight');
        renderAll();

        let html2 = `
            <div class="panel" style="border-color:#f1c40f; text-align:center;">
                <h3 style="margin:0 0 8px; color:#f1c40f;">🌱 你的成长值</h3>
                <p style="margin:4px 0 12px; font-size:26px; font-weight:700; color:#f0e68c;">
                    ${level.label} <span style="font-size:18px; opacity:0.8;">x${level.value}</span>
                </p>
                <p style="margin:0 0 16px; opacity:0.85;">${level.desc} —— 训练成长速度 x${level.value}</p>
                <button class="btn primary" id="btnStartAdventure" style="flex:none;">🚀 开始冒险</button>
            </div>
        `;
        renderDynamicArea(html2);

        document.getElementById('btnStartAdventure').addEventListener('click', finishCharacterCreation);
    });
}

// 完成创建，开始第1天训练
function finishCharacterCreation() {
    G.phase = 'training';
    renderAll();
    addLog('📅 第1天：开始训练吧！');
    generateDailyTraining();
}
