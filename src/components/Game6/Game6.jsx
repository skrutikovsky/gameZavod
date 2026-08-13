import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_RADIUS, TARGET_ZONE_DEGREES, ARROW_ROTATION_SPEED, POINTS_SUCCESS, SHAKE_AMPLITUDE, SHAKE_SPEED, ROTATION_CLOCKWISE } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const Game6 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleAction,
    setCanvasRef,
    initRound,
    canvasRef,
  } = useGame6({ onLevelComplete });

  const requestRef = useRef(null);
  const bgCanvasRef = useRef(null);

  // Кэширование фона
  const cacheBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Создаем оффскрин канвас для кэширования фона
    if (!bgCanvasRef.current || bgCanvasRef.current.width !== width || bgCanvasRef.current.height !== height) {
      bgCanvasRef.current = document.createElement('canvas');
      bgCanvasRef.current.width = width;
      bgCanvasRef.current.height = height;
    }

    const bgCtx = bgCanvasRef.current.getContext('2d');

    // Рисуем фон (темный цех как в предыдущих играх)
    const bgGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    bgCtx.fillStyle = bgGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Декоративные элементы (как в Game5)
    // Верхняя панель
    const topPanelHeight = 60;
    const topPanelGradient = bgCtx.createLinearGradient(0, 0, 0, topPanelHeight);
    topPanelGradient.addColorStop(0, '#2a2a3e');
    topPanelGradient.addColorStop(1, '#1a1a2e');
    bgCtx.fillStyle = topPanelGradient;
    bgCtx.fillRect(0, 0, width, topPanelHeight);

    // Заклепки на верхней панели
    bgCtx.fillStyle = '#4a4a5a';
    for (let i = 30; i < width - 30; i += 80) {
      bgCtx.beginPath();
      bgCtx.arc(i, 30, 6, 0, Math.PI * 2);
      bgCtx.fill();
    }

    // Нижняя панель
    const bottomPanelHeight = 60;
    const bottomPanelGradient = bgCtx.createLinearGradient(0, height - bottomPanelHeight, 0, height);
    bottomPanelGradient.addColorStop(0, '#1a1a2e');
    bottomPanelGradient.addColorStop(1, '#2a2a3e');
    bgCtx.fillStyle = bottomPanelGradient;
    bgCtx.fillRect(0, height - bottomPanelHeight, width, bottomPanelHeight);

    // Заклепки на нижней панели
    bgCtx.fillStyle = '#4a4a5a';
    for (let i = 30; i < width - 30; i += 80) {
      bgCtx.beginPath();
      bgCtx.arc(i, height - 30, 6, 0, Math.PI * 2);
      bgCtx.fill();
    }

  }, []);

  // Отрисовка скилл чека
  const drawSkillCheck = useCallback((ctx, centerX, centerY) => {
    const { 
      skillCheckActive, 
      arrowAngle, 
      targetZoneStart, 
      zoneSizeMultiplier,
      isShaking,
      shakeOffset,
      skillCheckResult,
      redFlash
    } = gameState;

    if (!skillCheckActive && !skillCheckResult) return;

    // Применяем смещение тряски
    const offsetX = isShaking ? shakeOffset.x : 0;
    const offsetY = isShaking ? shakeOffset.y : 0;
    const actualCenterX = centerX + offsetX;
    const actualCenterY = centerY + offsetY;

    // Рисуем красный фон при провале
    if (redFlash) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Основной круг (темный фон)
    ctx.beginPath();
    ctx.arc(actualCenterX, actualCenterY, SKILL_CHECK_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a3e';
    ctx.fill();
    ctx.strokeStyle = '#4a4a5e';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Целевая зона (белый сектор)
    const zoneSize = TARGET_ZONE_DEGREES * zoneSizeMultiplier;
    const startRad = (targetZoneStart - 90) * Math.PI / 180; // -90 чтобы 0 был сверху
    const endRad = (targetZoneStart + zoneSize - 90) * Math.PI / 180;

    ctx.beginPath();
    ctx.moveTo(actualCenterX, actualCenterY);
    ctx.arc(actualCenterX, actualCenterY, SKILL_CHECK_RADIUS, startRad, endRad);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Стрелка
    const arrowRad = (arrowAngle - 90) * Math.PI / 180;
    const arrowLength = SKILL_CHECK_RADIUS - 10;
    const arrowX = actualCenterX + Math.cos(arrowRad) * arrowLength;
    const arrowY = actualCenterY + Math.sin(arrowRad) * arrowLength;

    // Линия стрелки
    ctx.beginPath();
    ctx.moveTo(actualCenterX, actualCenterY);
    ctx.lineTo(arrowX, arrowY);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Наконечник стрелки
    ctx.beginPath();
    ctx.arc(arrowX, arrowY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444';
    ctx.fill();

    // Центр круга
    ctx.beginPath();
    ctx.arc(actualCenterX, actualCenterY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#4a4a5e';
    ctx.fill();

    // Индикатор результата
    if (skillCheckResult === 'success') {
      ctx.beginPath();
      ctx.arc(actualCenterX, actualCenterY, SKILL_CHECK_RADIUS - 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (skillCheckResult === 'fail') {
      ctx.beginPath();
      ctx.arc(actualCenterX, actualCenterY, SKILL_CHECK_RADIUS - 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 5;
      ctx.stroke();
    }

  }, [gameState]);

  // Отрисовка игры
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    // Рисуем закэшированный фон
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0);
    } else {
      cacheBackground();
      return;
    }

    // Вычисляем позицию скилл чека
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Смещение от центра (если есть)
    const offsetX = gameState.skillCheckPosition.x * (width / 2);
    const offsetY = gameState.skillCheckPosition.y * (height / 2);
    
    const skillCheckX = centerX + offsetX;
    const skillCheckY = centerY + offsetY;

    // Рисуем скилл чек
    drawSkillCheck(ctx, skillCheckX, skillCheckY);

    // Отображаем очки
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Очки: ${gameState.score}`, 20, 40);

  }, [gameState, cacheBackground, drawSkillCheck]);

  // Игровой цикл для отрисовки
  useEffect(() => {
    const animate = () => {
      draw();
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [draw]);

  // Обработчик нажатия клавиш
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAction]);

  // Инициализация канваса
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          cacheBackground();
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      startGame();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [startGame, cacheBackground]);

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleCanvasClick = () => {
    handleAction();
  };

  return (
    <div className="game-container relative w-full h-full">
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-40 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
      >
        ←
      </button>

      <GameStats score={gameState.score} round={gameState.round} />

      <canvas
        ref={setCanvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-pointer"
      />

      {gameState.gameOver && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Игра окончена</h2>
            <p className="text-2xl text-white mb-6">Ваш счет: {gameState.score}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all"
              >
                Заново
              </button>
              <button
                onClick={onBack}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-all"
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game6;
