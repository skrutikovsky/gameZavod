import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_RADIUS, WHITE_SECTOR_ANGLE, SUCCESS_SCORE } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const Game6 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleSpacePress,
    handleInput,
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

    // Рисуем фон (темный цех/стол)
    const bgGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    bgCtx.fillStyle = bgGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Добавляем текстуру стола/поверхности
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    bgCtx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      bgCtx.beginPath();
      bgCtx.moveTo(i, 0);
      bgCtx.lineTo(i, height);
      bgCtx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, i);
      bgCtx.lineTo(width, i);
      bgCtx.stroke();
    }

  }, []);

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

    // Рисуем скилл чек если активен
    if (gameState.skillCheckActive) {
      const centerX = (gameState.skillCheckPosition.x / 100) * width + gameState.shakeOffset.x;
      const centerY = (gameState.skillCheckPosition.y / 100) * height + gameState.shakeOffset.y;
      const radius = SKILL_CHECK_RADIUS * gameState.targetSizeMultiplier;

      // Внешний круг (граница)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Белый сектор (зона попадания)
      const whiteSectorStartRad = (gameState.whiteSectorStart * Math.PI) / 180;
      const whiteSectorEndRad = ((gameState.whiteSectorStart + WHITE_SECTOR_ANGLE * gameState.targetSizeMultiplier) * Math.PI) / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, whiteSectorStartRad, whiteSectorEndRad);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Стрелка
      const arrowAngleRad = (gameState.arrowAngle * Math.PI) / 180;
      const arrowLength = radius * 0.8;
      const arrowTipX = centerX + Math.cos(arrowAngleRad) * arrowLength;
      const arrowTipY = centerY + Math.sin(arrowAngleRad) * arrowLength;
      const arrowBaseX = centerX + Math.cos(arrowAngleRad) * (radius * 0.2);
      const arrowBaseY = centerY + Math.sin(arrowAngleRad) * (radius * 0.2);

      // Линия стрелки
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Наконечник стрелки
      ctx.beginPath();
      ctx.arc(arrowTipX, arrowTipY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();

      // Красная вспышка при провале
      if (gameState.redFlashActive) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
      }
    }

  }, [gameState, cacheBackground]);

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
        handleSpacePress();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSpacePress]);

  // Обработчик клика мыши (ЛКМ)
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (e.button === 0) { // ЛКМ
        handleInput();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleInput]);

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

  return (
    <div 
      ref={canvasRef}
      className="game-container relative w-full h-screen overflow-hidden cursor-crosshair"
      tabIndex={0}
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        round={gameState.round}
        isGame3={true}
        onBack={onBack}
      />
      
      {/* Подсказка управления */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm">
        Нажми Пробел или ЛКМ чтобы остановить стрелку
      </div>
    </div>
  );
};

export default Game6;
