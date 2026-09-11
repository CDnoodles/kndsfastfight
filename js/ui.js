import { G } from './gameState.js';
import { ATTR_NAMES, ATTR_LABELS, PROFESSIONS, TALENTS, GROWTH_LEVELS, getDifficulty } from './config.js';

// ----- 历史战绩本地缓存 -----
const HISTORY_KEY = 'game_history';
const HISTORY_MAX = 50;      // 最多保留 50 条，超出则丢弃最旧的

// 读取历史战绩（localStorage 不可用时返回空数组）
export function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

// 追加一条战绩（最新的在最前）
export function saveHistory(record) {
    try {
        const list = loadHistory();
        list.unshift(record);
        if (list.length > HISTORY_MAX) list.length = HISTORY_MAX;  // 截断尾部 = 丢弃最旧的
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
        // 隐私模式 / 配额满时静默忽略，不影响游戏正常进行
    }
}

// 通过 id 查找职业 / 天赋 / 成长档位
const findById = (arr, id) => arr.find(x => x.id === id);
const findGrowth = val => GROWTH_LEVELS.find(x => x.value === val);

// 数值格式化：大数缩写（B/M/K），避免后期超大数值溢出显示
export function fmt(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e4) return (v / 1e3).toFixed(2) + 'K';
    if (v >= 100) return Math.round(v).toString();
    if (v >= 1) return (Math.round(v * 10) / 10).toString();
    return v.toFixed(2);
}

// 生成 Boss 机制说明文字
function enemyMechanicText(e) {
    const parts = [];
    const pv = e.passive;
    const sp = e.special;
    if (pv) {
        switch (pv.type) {
            case 'regen': parts.push(`每回合恢复 ${Math.round(pv.value * 100)}% HP`); break;
            case 'defend_bonus':
                parts.push(`防御时额外减伤 ${Math.round(pv.value * 100)}%`);
                if (pv.regen) parts.push(`每回合恢复 ${Math.round(pv.regen * 100)}% HP`);
                break;
            case 'lifesteal': parts.push(`攻击吸血 ${Math.round(pv.value * 100)}%`); break;
            case 'slow_debuff': parts.push(`${Math.round(pv.chance * 100)}% 概率降你速度 ${pv.value}（${pv.duration}回合）`); break;
            case 'cycle_boost': parts.push(`每 3 次攻击强化 +${Math.round(pv.value * 100)}%`); break;
            case 'crit_chance': parts.push(`物理攻击 ${Math.round(pv.chance * 100)}% 概率暴击×2`); break;
            case 'mp_regen': parts.push(`每回合恢复 ${pv.value} MP`); break;
            case 'immunity_cycle': parts.push(`每 ${pv.duration} 回合切换物免/法免`); break;
        }
    }
    if (sp && sp.type === 'two_lives') parts.push(`两条命（复活 ${Math.round(sp.reviveHpRatio * 100)}% HP）`);
    if (parts.length === 0) return e.intro || '';
    return '机制：' + parts.join('，');
}

// ----- 日志 -----
export function addLog(msg, cls = '') {
    const box = document.getElementById('logBox');
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerText = msg;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 50) box.removeChild(box.firstChild);
}

// ----- 渲染所有UI -----
export function renderAll() {
    const p = G.player;
    const base = p.base;
    const cur = p.current;

    document.getElementById('dayDisplay').innerText = G.phase === 'menu'
        ? '🏠 主界面'
        : `第 ${G.week} 周目 · 第 ${G.day} 天`;
    const bossEl = document.getElementById('bossCountDisplay');
    if (bossEl) bossEl.innerText = `🏆 ${G.totalBossDefeated}`;
    const phaseLabels = {
        menu: '🏠 主界面',
        history: '📜 历史战绩',
        characterCreation: '🎭 创建角色',
        training: '🏋️ 训练',
        story: '📖 剧情',
        boss: '⚔️ 战斗',
        settlement: '🏁 结算'
    };
    document.getElementById('phaseLabel').innerText = phaseLabels[G.phase] || G.phase;

    // 当前难度
    const diffEl = document.getElementById('difficultyDisplay');
    if (diffEl) diffEl.innerText = getDifficulty(G.difficulty).name;

    // 主动结算按钮：仅战斗进行中显示（显隐在此控制，事件在 main.js 常驻绑定一次）
    const settleArea = document.getElementById('settleArea');
    if (settleArea) settleArea.style.display = (G.phase === 'boss' && G.battleActive) ? 'block' : 'none';

    // 职业 / 天赋 / 成长值展示
    const charInfo = document.getElementById('charInfo');
    if (charInfo) {
        const parts = [];
        if (p.profession) {
            const prof = findById(PROFESSIONS, p.profession);
            if (prof) parts.push(`🎭 ${prof.name}：${prof.passive}`);
        }
        if (p.talent) {
            const t = findById(TALENTS, p.talent);
            if (t) parts.push(`✨ ${t.name}：${t.desc}`);
        }
        if (p.growth) {
            const g = findGrowth(p.growth.value) || p.growth;
            parts.push(`🌱 成长 x${g.value} · ${g.label}`);
        }
        charInfo.innerHTML = parts.join('　');
    }

    // 玩家HP/MP
    document.getElementById('hpText').innerHTML = `❤️ ${fmt(Math.floor(cur.hp))}/${fmt(base.maxHp)}`;
    document.getElementById('hpBar').style.width = (cur.hp / base.maxHp * 100) + '%';
    document.getElementById('mpBar').style.width = (cur.mp / base.maxMp * 100) + '%';
    document.getElementById('progressBar').style.width = (cur.progress || 0) + '%';
    document.getElementById('progressLabel').innerText = `⏳ ${Math.floor(cur.progress || 0)}%`;

    // 属性网格
    const grid = document.getElementById('statGrid');
    let html = '';
    for (let k of ATTR_NAMES) {
        const val = base[k];
        const display = k === 'mpRegen' ? val.toFixed(1) + '%' : fmt(val);
        html += `<div class="stat-item"><span class="label">${ATTR_LABELS[k]}</span><span class="value">${display}</span></div>`;
    }
    grid.innerHTML = html;

    // 敌人面板
    if (G.enemy && G.enemy.alive) {
        const e = G.enemy;
        document.getElementById('enemyPanel').style.display = 'block';
        document.getElementById('enemyName').innerText = e.name;
        document.getElementById('enemyHpText').innerHTML = `❤️ ${fmt(Math.floor(e.current.hp))}/${fmt(e.base.maxHp)}`;
        document.getElementById('enemyHpBar').style.width = (e.current.hp / e.base.maxHp * 100) + '%';
        document.getElementById('enemyProgressBar').style.width = (e.current.progress || 0) + '%';
        document.getElementById('enemyProgressLabel').innerText = `⏳ ${Math.floor(e.current.progress || 0)}%`;
        const statusParts = [];
        if (e.isDefending) statusParts.push('🛡️ 防御中');
        if (e.aiState) {
            if (e.aiState.immunityType === 'physical') statusParts.push('🌀 物理免疫');
            if (e.aiState.immunityType === 'magic') statusParts.push('🌀 法术免疫');
            if (e.aiState.reviveUsed) statusParts.push('🔥 已复活一次');
            // 龙领主：显示强化进度
            if (e.passive && e.passive.type === 'cycle_boost') statusParts.push(`⚡ 强化进度 ${e.aiState.cycleCount || 0}/3`);
        }
        document.getElementById('enemyStatus').innerText = statusParts.join(' ');

        // 机制说明栏
        const infoEl = document.getElementById('enemyInfo');
        if (infoEl) infoEl.innerText = enemyMechanicText(e);

        // 渲染敌人属性网格（新增）
        const enemyGrid = document.getElementById('enemyStatGrid');
        if (enemyGrid) {
            const base = e.base;
            const attrs = [
                { key: 'atk', label: '物攻' },
                { key: 'matk', label: '法攻' },
                { key: 'def', label: '防御' },
                { key: 'speed', label: '速度' }
            ];
            let html = '';
            for (let a of attrs) {
                const val = base[a.key];
                html += `<div class="stat-item"><span class="label">${a.label}</span><span class="value">${fmt(val)}</span></div>`;
            }
            enemyGrid.innerHTML = html;
        }
    } else {
        document.getElementById('enemyPanel').style.display = 'none';
        // 隐藏敌人时清空网格
        const enemyGrid = document.getElementById('enemyStatGrid');
        if (enemyGrid) enemyGrid.innerHTML = '';
    }

    // 战斗按钮状态
    const canAct = G.phase === 'boss' && G.battleActive && G.player.alive && G.enemy && G.enemy.alive && G.waitingForPlayer && !G.inAction;
    document.getElementById('btnPhysical').disabled = !canAct;
    document.getElementById('btnMagic').disabled = !canAct;
    document.getElementById('btnDefend').disabled = !canAct;
    const magicCost = p.profession === 'priest' ? 12 : 15;
    document.getElementById('extraInfo').innerHTML = G.phase === 'boss' ? `🔮 法术消耗 ${magicCost} MP (当前${fmt(Math.floor(p.current.mp))})` : '';
}

// 动态区域渲染（用于训练/剧情/结算）
export function renderDynamicArea(html) {
    document.getElementById('dynamicArea').innerHTML = html;
}

// 清空动态区域
export function clearDynamicArea() {
    document.getElementById('dynamicArea').innerHTML = '';
}

// ----- 历史战绩页 -----
export function renderHistoryPage() {
    const list = loadHistory();
    const bestScore = list.reduce((m, r) => Math.max(m, r.score || 0), 0);
    const bestWeek  = list.reduce((m, r) => Math.max(m, r.weeksCleared || 0), 0);

    const resultText = r => r.result === 'surrender' ? '🏳️ 主动结算'
        : (r.result === 'victory' ? '🎉 胜利' : '💀 战败');
    const gradeColor = g => (g === 'SSS' || g === 'SS') ? '#f1c40f'
        : (g === 'S' || g === 'A') ? '#2ecc71' : '#aaa';

    let rows;
    if (list.length === 0) {
        rows = `<p style="opacity:0.7; margin:8px 0;">暂无战绩，去开启你的第一段冒险吧。</p>`;
    } else {
        rows = list.map(r => {
            // 最高分 / 最远周目 高亮（并列时都标出）
            const tags = [
                (bestScore > 0 && r.score === bestScore) ? '<span class="text-gold">🏅 最高分</span>' : '',
                (bestWeek > 0 && r.weeksCleared === bestWeek) ? '<span class="text-gold">🚩 最远周目</span>' : ''
            ].filter(Boolean).join('　');
            const s = r.stats || {};
            const statLine = `HP ${fmt(s.maxHp || 0)} · 物攻 ${fmt(s.atk || 0)} · 法攻 ${fmt(s.matk || 0)} · 防御 ${fmt(s.def || 0)} · 速度 ${fmt(s.speed || 0)}`;
            return `
                <div style="border-left:3px solid ${gradeColor(r.grade)}; padding:6px 10px; margin:8px 0; background:rgba(255,255,255,0.04);">
                    <div class="flex-between">
                        <span><b style="color:${gradeColor(r.grade)}; font-size:17px;">${r.grade}</b>　${r.difficultyName || r.difficulty}　${resultText(r)}</span>
                        <span class="text-gold"><b>${fmt(r.score || 0)}</b> 分</span>
                    </div>
                    <div style="font-size:13px; opacity:0.9; margin-top:3px;">
                        第 ${r.weeksCleared} 周目 · 共 ${r.totalDays} 天 · 击败 ${r.bossCount} 个 Boss
                        ${tags ? '<br>' + tags : ''}
                    </div>
                    <div style="font-size:12px; opacity:0.75; margin-top:2px;">${r.profession || ''}　${r.talent || ''}　${r.growth || ''}</div>
                    <div style="font-size:12px; opacity:0.6; margin-top:2px;">${statLine}</div>
                    <div style="font-size:11px; opacity:0.5; margin-top:2px;">${r.date || ''}</div>
                </div>
            `;
        }).join('');
    }

    renderDynamicArea(`
        <div class="panel" style="border-color:#f1c40f;">
            <h3 style="margin:0 0 8px; color:#f1c40f;">📜 历史战绩（${list.length}/${HISTORY_MAX}）</h3>
            ${rows}
            <button class="btn primary" id="btnBackToMenu" style="margin-top:12px;">⬅️ 返回主界面</button>
        </div>
    `);
    // 动态 import 回主界面，避免 ui.js ↔ mainMenu.js 形成静态循环依赖
    document.getElementById('btnBackToMenu').addEventListener('click', () => {
        import('./mainMenu.js').then(m => m.showMainMenu());
    });
}