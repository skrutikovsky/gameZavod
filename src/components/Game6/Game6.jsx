import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_SIZE, TARGET_ZONE_PERCENT, SHAKE_AMOUNT } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const Game6 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleInput,
    setCanvasRef,
    initRound,
    canvasRef,
    shakeOffsetRef,
  } = useGame6({ onLevelComplete });

  const requestRef = useRef(null);

  // Отрисовка игры
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    // Рисуем фон (темный цех как в Game5)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Рисуем скилл чек если активен
    if (gameState.skillCheckActive || gameState.showFailAnimation) {
      const skillCheckRadius = SKILL_CHECK_SIZE / 2;
      
      // Позиция скилл чека с учетом смещения и тряски
      let centerX = (gameState.skillCheckPosition.x / 100) * width;
      let centerY = (gameState.skillCheckPosition.y / 100) * height;
      
      // Добавляем тряску если нужно
      if (gameState.isShaking && gameState.skillCheckActive) {
        centerX += shakeOffsetRef.current.x * SKILL_CHECK_SIZE;
        centerY += shakeOffsetRef.current.y * SKILL_CHECK_SIZE;
      }

      // Цвет круга (красный при провале, иначе обычный)
      const circleColor = gameState.showFailAnimation ? '#ff4444' : '#ffffff';
      const zoneColor = gameState.showFailAnimation ? '#ff6666' : '#ffffff';
      const arrowColor = gameState.showFailAnimation ? '#ff0000' : '#00ff00';

      // Рисуем основной круг
      ctx.beginPath();
      ctx.arc(centerX, centerY, skillCheckRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      ctx.strokeStyle = circleColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Рисуем белую зону попадания (только если не провал)
      if (!gameState.showFailAnimation) {
        const zoneSizeDegrees = TARGET_ZONE_PERCENT * gameState.zoneSizeMultiplier;
        const zoneStartRad = (gameState.targetZoneStart - 90) * Math.PI / 180; // -90 чтобы 0 был сверху
        const zoneEndRad = (gameState.targetZoneStart + zoneSizeDegrees - 90) * Math.PI / 180;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, skillCheckRadius, zoneStartRad, zoneEndRad);
        ctx.closePath();
        ctx.fillStyle = zoneColor;
        ctx.fill();
      }

      // Рисуем стрелку
      const arrowAngleRad = (gameState.arrowAngle - 90) * Math.PI / 180; // -90 чтобы 0 был сверху
      const arrowLength = skillCheckRadius * 0.7;
      const arrowTipX = centerX + Math.cos(arrowAngleRad) * arrowLength;
      const arrowTipY = centerY + Math.sin(arrowAngleRad) * arrowLength;

      // Стрелка
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.strokeStyle = arrowColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Наконечник стрелки
      ctx.beginPath();
      ctx.arc(arrowTipX, arrowTipY, 6, 0, Math.PI * 2);
      ctx.fillStyle = arrowColor;
      ctx.fill();
    }

  }, [gameState, shakeOffsetRef]);

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

  // Обработчик нажатия клавиш (пробел)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleInput]);

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
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      startGame();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [startGame]);

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  return (
    <div 
      className="game-container relative w-full h-screen overflow-hidden cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
      
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        multiplier={1}
        boxesFixed={0}
        comboCount={0}
        gameTime={0}
        formatTime={() => ''}
        onBack={onBack}
        isGame3={true}
        isGame4={true}
        isGame5={true}
        round={gameState.round}
        itemsOnBoard={gameState.skillCheckActive ? 1 : 0}
      />
      
      {/* Инструкция */}
      {!gameState.skillCheckActive && !gameState.showFailAnimation && gameState.score === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center z-20 pointer-events-none">
          <p className="text-2xl font-bold mb-2">Нажми Пробел или ЛКМ когда стрелка в белой зоне</p>
          <p className="text-lg opacity-80">Белая зона = 300 очков</p>
        </div>
      )}
    </div>
  );
};

export default Game6;
