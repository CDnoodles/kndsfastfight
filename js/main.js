import { initGameState } from './gameState.js';
import { renderAll, addLog } from './ui.js';
import { playerAction, activeSettlement } from './battle.js';
import { showMainMenu } from './mainMenu.js';

// 绑定战斗按钮
document.getElementById('btnPhysical').addEventListener('click', () => playerAction('physical'));
document.getElementById('btnMagic').addEventListener('click', () => playerAction('magic'));
document.getElementById('btnDefend').addEventListener('click', () => playerAction('defend'));
// 主动结算：常驻绑定一次（renderAll 每帧都会调用，不能在里面绑事件）
document.getElementById('btnSettle').addEventListener('click', activeSettlement);

// 启动游戏
export function restartGame() {
    initGameState();
    renderAll();
    addLog('🌟 欢迎来到勇者养成！', 'highlight');
    // 主界面 → 选择难度 → 角色创建（职业 → 天赋 → 成长值）→ 第1天训练
    showMainMenu();
}

// 初始化
restartGame();

// 暴露 restart 给其他模块（如结算重新开始）
window.restartGame = restartGame;
