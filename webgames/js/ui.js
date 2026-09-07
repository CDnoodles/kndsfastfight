import { G } from './gameState.js';
import { ATTR_NAMES, ATTR_LABELS } from './config.js';

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

    document.getElementById('dayDisplay').innerText = `第 ${G.day} 天`;
    const phaseLabels = {
        training: '🏋️ 训练',
        story: '📖 剧情',
        boss: '⚔️ 战斗',
        settlement: '🏁 结算'
    };
    document.getElementById('phaseLabel').innerText = phaseLabels[G.phase] || G.phase;

    // 玩家HP/MP
    document.getElementById('hpText').innerHTML = `❤️ ${Math.floor(cur.hp)}/${base.maxHp}`;
    document.getElementById('hpBar').style.width = (cur.hp / base.maxHp * 100) + '%';
    document.getElementById('mpBar').style.width = (cur.mp / base.maxMp * 100) + '%';
    document.getElementById('progressBar').style.width = (cur.progress || 0) + '%';
    document.getElementById('progressLabel').innerText = `⏳ ${Math.floor(cur.progress || 0)}%`;

    // 属性网格
    const grid = document.getElementById('statGrid');
    let html = '';
    for (let k of ATTR_NAMES) {
        let val = base[k];
        let display = val;
        if (k === 'maxHp' || k === 'maxMp' || k === 'atk' || k === 'matk') display = Math.round(val);
        else if (k === 'speed' || k === 'mpRegen' || k === 'def') display = val.toFixed(1);
        html += `<div class="stat-item"><span class="label">${ATTR_LABELS[k]}</span><span class="value">${display}</span></div>`;
    }
    grid.innerHTML = html;

    // 敌人面板
    if (G.enemy && G.enemy.alive) {
        const e = G.enemy;
        document.getElementById('enemyPanel').style.display = 'block';
        document.getElementById('enemyName').innerText = e.name;
        document.getElementById('enemyHpText').innerHTML = `❤️ ${Math.floor(e.current.hp)}/${e.base.maxHp}`;
        document.getElementById('enemyHpBar').style.width = (e.current.hp / e.base.maxHp * 100) + '%';
        document.getElementById('enemyProgressBar').style.width = (e.current.progress || 0) + '%';
        document.getElementById('enemyProgressLabel').innerText = `⏳ ${Math.floor(e.current.progress || 0)}%`;
        document.getElementById('enemyStatus').innerText = e.isDefending ? '🛡️ 防御中' : '';

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
                let val = base[a.key];
                let display = (a.key === 'speed') ? val.toFixed(1) : Math.round(val);
                html += `<div class="stat-item"><span class="label">${a.label}</span><span class="value">${display}</span></div>`;
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
    document.getElementById('extraInfo').innerHTML = G.phase === 'boss' ? `🔮 法术消耗 15 MP (当前${Math.floor(G.player.current.mp)})` : '';
}

// 动态区域渲染（用于训练/剧情/结算）
export function renderDynamicArea(html) {
    document.getElementById('dynamicArea').innerHTML = html;
}

// 清空动态区域
export function clearDynamicArea() {
    document.getElementById('dynamicArea').innerHTML = '';
}