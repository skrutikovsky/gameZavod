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
    floatingText,
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
      
      // Добавляем тряску если нужно (тряска длится пока скиллчек активен)
      if (gameState.isShaking && gameState.skillCheckActive) {
        // Тряска: случайное смещение на 5 пикселей в любую сторону
        const randomAngle = Math.random() * Math.PI * 2;
        const shakeDistance = SHAKE_AMOUNT; // 5 пикселей
        centerX += Math.cos(randomAngle) * shakeDistance;
        centerY += Math.sin(randomAngle) * shakeDistance;
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
        
        // Для зеркального режима отражаем зону по вертикали
        let zoneStartAngle = gameState.targetZoneStart;
        if (gameState.isMirrored) {
          // Зеркальное отражение по вертикали: 360 - угол
          zoneStartAngle = (360 - gameState.targetZoneStart - zoneSizeDegrees + 360) % 360;
        }
        
        // Для циферблата: 0 градусов = 12 часов (верх), угол растет по часовой стрелке
        const zoneStartRad = (zoneStartAngle - 90) * Math.PI / 180;
        const zoneEndRad = (zoneStartAngle + zoneSizeDegrees - 90) * Math.PI / 180;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, skillCheckRadius, zoneStartRad, zoneEndRad);
        ctx.closePath();
        ctx.fillStyle = zoneColor;
        ctx.fill();
        
        // Рисуем маркеры часов для наглядности циферблата
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let hour = 0; hour < 12; hour++) {
          const hourAngle = (hour * 30 - 90) * Math.PI / 180;
          const markerStart = skillCheckRadius * 0.85;
          const markerEnd = skillCheckRadius * 0.95;
          const x1 = centerX + Math.cos(hourAngle) * markerStart;
          const y1 = centerY + Math.sin(hourAngle) * markerStart;
          const x2 = centerX + Math.cos(hourAngle) * markerEnd;
          const y2 = centerY + Math.sin(hourAngle) * markerEnd;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // Рисуем стрелку
      const arrowAngleRad = (gameState.arrowAngle - 90) * Math.PI / 180; // -90 чтобы 0 был сверху (12 часов)
      const arrowLength = skillCheckRadius * 0.7;
      const arrowTipX = centerX + Math.cos(arrowAngleRad) * arrowLength;
      const arrowTipY = centerY + Math.sin(arrowAngleRad) * arrowLength;

      // Стрелка - более красивый спрайт (градиентная с наконечником)
      const arrowGradient = ctx.createLinearGradient(centerX, centerY, arrowTipX, arrowTipY);
      arrowGradient.addColorStop(0, gameState.showFailAnimation ? '#cc0000' : '#00cc00');
      arrowGradient.addColorStop(1, gameState.showFailAnimation ? '#ff6666' : '#66ff66');
      
      // Основная линия стрелки
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.strokeStyle = arrowGradient;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Наконечник стрелки (треугольный)
      const tipAngle = Math.atan2(arrowTipY - centerY, arrowTipX - centerX);
      const tipSize = 10;
      ctx.beginPath();
      ctx.moveTo(arrowTipX, arrowTipY);
      ctx.lineTo(
        arrowTipX - tipSize * Math.cos(tipAngle - Math.PI / 6),
        arrowTipY - tipSize * Math.sin(tipAngle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowTipX - tipSize * Math.cos(tipAngle + Math.PI / 6),
        arrowTipY - tipSize * Math.sin(tipAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = arrowColor;
      ctx.fill();
      
      // Центр циферблата (декоративный элемент)
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Рисуем floating text (+300 очков)
    if (floatingText) {
      const elapsed = Date.now() - floatingText.startTime;
      if (elapsed < 500) {
        const progress = elapsed / 500;
        const opacity = 1 - progress;
        const yOffset = progress * 30; // 30 пикселей вверх
        
        ctx.save();
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textX = floatingText.x;
        const textY = floatingText.y - yOffset;
        
        // Обводка текста для лучшей читаемости
        ctx.strokeText(floatingText.text, textX, textY);
        ctx.fillText(floatingText.text, textX, textY);
        ctx.restore();
      }
    }

  }, [gameState, shakeOffsetRef, floatingText]);

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
          <p className="text-lg opacity-80">Белая зона = 300 очков | Зона спавна: с 4 до 10 часов</p>
          <p className="text-md opacity-60 mt-2">Провал если нажал вне белой зоны</p>
        </div>
      )}
    </div>
  );
};

export default Game6;
