import { initGameState } from './gameState.js';
import { renderAll, addLog } from './ui.js';
import { playerAction } from './battle.js';
import { showCharacterCreation } from './characterCreation.js';

// 绑定战斗按钮
document.getElementById('btnPhysical').addEventListener('click', () => playerAction('physical'));
document.getElementById('btnMagic').addEventListener('click', () => playerAction('magic'));
document.getElementById('btnDefend').addEventListener('click', () => playerAction('defend'));

// 启动游戏
export function restartGame() {
    initGameState();
    renderAll();
    addLog('🌟 欢迎来到勇者养成！', 'highlight');
    // 先进入角色创建（职业 → 天赋 → 成长值），完成后再进入第1天训练
    showCharacterCreation();
}

// 初始化
restartGame();

// 暴露 restart 给其他模块（如结算重新开始）
window.restartGame = restartGame;
