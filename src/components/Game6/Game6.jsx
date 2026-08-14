import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_SIZE, TARGET_ZONE_PERCENT, SHAKE_AMOUNT, CHANCE_MOVING_ZONE, ARROW_SPEED } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const MODIFIER_DESCRIPTIONS = {
  slow: 'Медленная стрелка (x0.5)',
  fast: 'Быстрая стрелка (x2)',
  large: 'Большой датчик (x1.5)',
  small: 'Маленький датчик (x0.75)',
  shake: 'Тряска',
  mirror: 'Зеркало',
  moving: 'Движущаяся зона',
  bounce: 'Отскок'
};

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
    activeModifiers,
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
      const skillCheckRadius = (SKILL_CHECK_SIZE / 2) * gameState.skillCheckSizeMultiplier;
      
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

      // Цвет круга (красный при провале, иначе обычный) - стилизация под датчик напряжения/силы тока
      const circleColor = gameState.showFailAnimation ? '#ff4444' : '#4a9eff'; // Голубой как вольтметр
      const zoneColor = gameState.showFailAnimation ? '#ff6666' : '#ffffff';
      const arrowColor = gameState.showFailAnimation ? '#ff0000' : '#ffaa00'; // Оранжевый как индикатор

      // Рисуем основной круг с градиентом как у настоящего датчика
      const circleGradient = ctx.createRadialGradient(centerX, centerY, skillCheckRadius * 0.8, centerX, centerY, skillCheckRadius);
      circleGradient.addColorStop(0, 'rgba(20, 30, 50, 0.8)');
      circleGradient.addColorStop(1, 'rgba(10, 15, 25, 0.9)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, skillCheckRadius, 0, Math.PI * 2);
      ctx.fillStyle = circleGradient;
      ctx.fill();
      
      // Металлическая рамка датчика
      const frameGradient = ctx.createLinearGradient(centerX - skillCheckRadius, centerY - skillCheckRadius, centerX + skillCheckRadius, centerY + skillCheckRadius);
      frameGradient.addColorStop(0, '#666');
      frameGradient.addColorStop(0.5, '#aaa');
      frameGradient.addColorStop(1, '#666');
      
      ctx.strokeStyle = frameGradient;
      ctx.lineWidth = 6;
      ctx.stroke();
      
      // Внутренняя обводка
      ctx.beginPath();
      ctx.arc(centerX, centerY, skillCheckRadius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
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

      // Рисуем стрелку - стилизация под стрелку аналогового датчика
      const arrowAngleRad = (gameState.arrowAngle - 90) * Math.PI / 180; // -90 чтобы 0 был сверху (12 часов)
      const arrowLength = skillCheckRadius * 0.75;
      const arrowTipX = centerX + Math.cos(arrowAngleRad) * arrowLength;
      const arrowTipY = centerY + Math.sin(arrowAngleRad) * arrowLength;

      // Тень под стрелкой
      ctx.save();
      ctx.translate(2, 2);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      // Основная линия стрелки - тонкая как у настоящего датчика
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(arrowTipX, arrowTipY);
      ctx.strokeStyle = gameState.showFailAnimation ? '#ff3333' : '#ff4444'; // Красная как у вольтметра
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Наконечник стрелки (треугольный)
      const tipAngle = Math.atan2(arrowTipY - centerY, arrowTipX - centerX);
      const tipSize = 12;
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
      ctx.fillStyle = gameState.showFailAnimation ? '#ff0000' : '#ff6600';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Центр циферблата - декоративная заглушка вала
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      const centerGradient = ctx.createRadialGradient(centerX - 2, centerY - 2, 0, centerX, centerY, 10);
      centerGradient.addColorStop(0, '#ccc');
      centerGradient.addColorStop(1, '#666');
      ctx.fillStyle = centerGradient;
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Рисуем искры при отскоке
      if (gameState.sparks && gameState.sparks.length > 0) {
        gameState.sparks.forEach(spark => {
          const sparkAge = (Date.now() - spark.startTime) / 1000;
          const sparkLife = spark.life;
          const opacity = 1 - (sparkAge / sparkLife);
          
          if (opacity > 0) {
            // Рисуем искру как яркую точку с хвостом
            const grad = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, 6);
            grad.addColorStop(0, `rgba(255, 255, 200, ${opacity})`);
            grad.addColorStop(0.5, `rgba(255, 200, 100, ${opacity * 0.8})`);
            grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Хвост искры
            const tailLength = 15 * (1 - sparkAge / sparkLife);
            const tailAngle = Math.atan2(-spark.vy, -spark.vx);
            ctx.beginPath();
            ctx.moveTo(spark.x, spark.y);
            ctx.lineTo(
              spark.x + Math.cos(tailAngle) * tailLength,
              spark.y + Math.sin(tailAngle) * tailLength
            );
            ctx.strokeStyle = `rgba(255, 200, 100, ${opacity * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      }
      
      // Рисуем искры тряски
      if (gameState.shakeSparks && gameState.shakeSparks.length > 0) {
        gameState.shakeSparks.forEach(spark => {
          const sparkAge = (Date.now() - spark.startTime) / 1000;
          const sparkLife = spark.life;
          const opacity = 1 - (sparkAge / sparkLife);
          
          if (opacity > 0) {
            // Рисуем искру как яркую точку с хвостом
            const grad = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, 4);
            grad.addColorStop(0, `rgba(255, 255, 150, ${opacity})`);
            grad.addColorStop(0.5, `rgba(255, 180, 80, ${opacity * 0.7})`);
            grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // Хвост искры
            const tailLength = 10 * (1 - sparkAge / sparkLife);
            const tailAngle = Math.atan2(-spark.vy, -spark.vx);
            ctx.beginPath();
            ctx.moveTo(spark.x, spark.y);
            ctx.lineTo(
              spark.x + Math.cos(tailAngle) * tailLength,
              spark.y + Math.sin(tailAngle) * tailLength
            );
            ctx.strokeStyle = `rgba(255, 180, 80, ${opacity * 0.5})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }
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
          <p className="text-sm opacity-50 mt-2 text-yellow-300">Внимание: возможен отскок стрелки и движущиеся зоны!</p>
        </div>
      )}

      {/* Легенда модификаторов справа */}
      <div className="absolute top-20 right-4 bg-black/70 p-3 rounded-lg text-white text-xs z-30 pointer-events-none">
        <h3 className="font-bold mb-2 text-sm border-b border-gray-600 pb-1">Модификаторы:</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">S</span>
            <span>Медленная стрелка (x0.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">F</span>
            <span>Быстрая стрелка (x2)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">L</span>
            <span>Большой датчик (x1.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">M</span>
            <span>Маленький датчик (x0.75)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">T</span>
            <span>Тряска</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">Z</span>
            <span>Зеркало</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">D</span>
            <span>Движущаяся зона</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold">O</span>
            <span>Отскок (30%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game6;
