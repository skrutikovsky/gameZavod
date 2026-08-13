import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_RADIUS, TARGET_ZONE_SIZE } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const Game6 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handlePress,
    setCanvasRef,
    canvasRef,
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

    // Рисуем фон (темный с градиентом)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Центр игрового поля
    const centerX = width / 2;
    const centerY = height / 2;

    // Если есть активный скилл чек - рисуем его
    if (gameState.currentSkillCheck) {
      const { 
        angle, 
        targetStart, 
        targetEnd, 
        sizeMultiplier, 
        isShaking, 
        shakeOffset,
        positionOffset,
        isStopped,
        failed
      } = gameState.currentSkillCheck;

      // Позиция скилл чека с учетом смещения
      const skillCheckX = centerX + positionOffset.x + shakeOffset.x;
      const skillCheckY = centerY + positionOffset.y + shakeOffset.y;

      // Радиус с учетом модификатора размера
      const actualRadius = SKILL_CHECK_RADIUS * sizeMultiplier;

      // Рисуем основной круг (темный фон)
      ctx.beginPath();
      ctx.arc(skillCheckX, skillCheckY, actualRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fill();
      
      // Цвет обводки зависит от состояния (красный при промахе)
      ctx.strokeStyle = failed ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = failed ? 5 : 3;
      ctx.stroke();

      // Рисуем целевую зону (белая, 10% круга)
      const targetStartRad = (targetStart - 90) * Math.PI / 180; // -90 чтобы 0 был сверху
      const targetEndRad = (targetEnd - 90) * Math.PI / 180;
      
      ctx.beginPath();
      ctx.moveTo(skillCheckX, skillCheckY);
      ctx.arc(skillCheckX, skillCheckY, actualRadius, targetStartRad, targetEndRad, false);
      ctx.closePath();
      ctx.fillStyle = failed ? 'rgba(255, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.8)';
      ctx.fill();

      // Рисуем стрелку
      const arrowAngleRad = (angle - 90) * Math.PI / 180; // -90 чтобы 0 был сверху
      const arrowLength = actualRadius * 0.8;
      const arrowX = skillCheckX + Math.cos(arrowAngleRad) * arrowLength;
      const arrowY = skillCheckY + Math.sin(arrowAngleRad) * arrowLength;

      // Линия стрелки
      ctx.beginPath();
      ctx.moveTo(skillCheckX, skillCheckY);
      ctx.lineTo(arrowX, arrowY);
      ctx.strokeStyle = failed ? '#ff0000' : '#ff4444';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Наконечник стрелки
      ctx.beginPath();
      ctx.arc(arrowX, arrowY, 6, 0, Math.PI * 2);
      ctx.fillStyle = failed ? '#ff0000' : '#ff4444';
      ctx.fill();

      // Рисуем индикатор направления (небольшая стрелочка на краю круга)
      if (!isStopped) {
        const directionIndicatorAngle = gameState.currentSkillCheck.direction === 1 ? 45 : -45;
        const indicatorRad = (directionIndicatorAngle - 90) * Math.PI / 180;
        const indicatorX = skillCheckX + Math.cos(indicatorRad) * (actualRadius + 15);
        const indicatorY = skillCheckY + Math.sin(indicatorRad) * (actualRadius + 15);
        
        ctx.beginPath();
        ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
        ctx.fillStyle = gameState.currentSkillCheck.direction === 1 ? '#44ff44' : '#ff4444';
        ctx.fill();
        
        // Текст направления
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gameState.currentSkillCheck.direction === 1 ? 'CW' : 'CCW', indicatorX, indicatorY + 25);
      }
    }

    // Рисуем обратную связь (успех/промах)
    if (gameState.feedbackState !== 'none') {
      ctx.fillStyle = gameState.feedbackState === 'success' 
        ? 'rgba(0, 255, 0, 0.3)' 
        : 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);
      
      // Текст обратной связи
      ctx.fillStyle = gameState.feedbackState === 'success' ? '#00ff00' : '#ff0000';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        gameState.feedbackState === 'success' ? '+300' : 'MISS',
        centerX,
        centerY - 50
      );
    }

    // Рисуем счет в центре снизу
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Счёт: ${gameState.score}`, centerX, height - 50);

  }, [gameState]);

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

  // Обработчик клика мышью
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (e.button === 0) { // ЛКМ
        e.preventDefault();
        handlePress();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handlePress]);

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
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* Статистика игры */}
      <GameStats
        score={gameState.score}
        multiplier={1}
        boxesFixed={0}
        comboCount={0}
        onBack={onBack}
        isGame3={true}
        round={1}
        itemsOnBoard={0}
      />
      
      {/* Канвас для рендеринга игры */}
      <canvas
        ref={setCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
      />
      
      {/* Инструкция */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 text-white/70 text-center text-sm">
        <p>Нажми ПРОБЕЛ или ЛКМ когда стрелка в белом секторе</p>
      </div>
    </div>
  );
};

export default Game6;
