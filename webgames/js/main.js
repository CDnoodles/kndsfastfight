import { G, initGameState } from './gameState.js';
import { renderAll, addLog } from './ui.js';
import { generateDailyTraining } from './training.js';
import { playerAction } from './battle.js';
import { checkDayEvents } from './story.js';

// 绑定战斗按钮
document.getElementById('btnPhysical').addEventListener('click', () => playerAction('physical'));
document.getElementById('btnMagic').addEventListener('click', () => playerAction('magic'));
document.getElementById('btnDefend').addEventListener('click', () => playerAction('defend'));

// 启动游戏
export function restartGame() {
    initGameState();
    renderAll();
    addLog('🌟 新的冒险开始！属性已随机生成。', 'highlight');
    addLog('📅 第1天：开始训练吧！');
    // 检查第一天是否需要触发事件（实际上第一天没有）
    checkDayEvents();
    if (G.phase === 'training') {
        generateDailyTraining();
    }
}

// 初始化
restartGame();

// 暴露 restart 给其他模块（如结算重新开始）
window.restartGame = restartGame;