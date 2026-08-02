import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, MAX_WELD_POINTS, FADE_DURATION, INNER_TRIGGER_RATIO } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

// Компонент лазерной точки курсора
const LaserCursor = ({ x, y, isWelding }) => {
  if (x === undefined || y === undefined) return null;
  
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Лазерная точка */}
      <div 
        className="relative"
        style={{
          width: '10px',
          height: '10px',
        }}
      >
        {/* Основная красная точка */}
        <div 
          className="absolute rounded-full"
          style={{
            width: '10px',
            height: '10px',
            background: 'radial-gradient(circle, #ff0000 0%, #cc0000 50%, #880000 100%)',
            boxShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000',
          }}
        />
        
        {/* Искры при зажатой ЛКМ */}
        {isWelding && (
          <>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: `${2 + Math.random() * 3}px`,
                  height: `${2 + Math.random() * 3}px`,
                  background: ['#ffd700', '#ffaa00', '#ff6600', '#ffffff'][Math.floor(Math.random() * 4)],
                  boxShadow: '0 0 5px currentColor',
                  animation: `spark${i} 0.3s ease-out infinite`,
                  left: '5px',
                  top: '5px',
                }}
              />
            ))}
          </>
        )}
      </div>
      
      <style>{`
        @keyframes spark0 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-20px, -15px) scale(0); opacity: 0; }
        }
        @keyframes spark1 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(20px, -10px) scale(0); opacity: 0; }
        }
        @keyframes spark2 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(15px, 20px) scale(0); opacity: 0; }
        }
        @keyframes spark3 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-10px, 25px) scale(0); opacity: 0; }
        }
        @keyframes spark4 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-25px, 5px) scale(0); opacity: 0; }
        }
        @keyframes spark5 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(25px, 10px) scale(0); opacity: 0; }
        }
        @keyframes spark6 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(10px, -20px) scale(0); opacity: 0; }
        }
        @keyframes spark7 {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-15px, -25px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    setCanvasRef,
    initRound,
    MAX_WELD_POINTS,
    BASE_GAP_WIDTH,
    WELD_SIZE_RATIO,
    FADE_DURATION
  } = useGame4();
  
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    startGame();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Отрисовка на канвасе
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.gapPath.length) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    const { gapPath, weldPoints, cooledPoints } = gameState;
    
    // Параметры листа металла
    const sheetMargin = 40;
    const sheetX = sheetMargin;
    const sheetY = sheetMargin;
    const sheetWidth = width - sheetMargin * 2;
    const sheetHeight = height - sheetMargin * 2;

    // Рисуем лист металла
    const metalGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY + sheetHeight);
    metalGradient.addColorStop(0, '#7f8c8d');
    metalGradient.addColorStop(0.5, '#95a5a6');
    metalGradient.addColorStop(1, '#7f8c8d');
    
    ctx.fillStyle = metalGradient;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    // Добавляем текстуру металла
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < sheetHeight; i += 3) {
      ctx.beginPath();
      ctx.moveTo(sheetX, sheetY + i);
      ctx.lineTo(sheetX + sheetWidth, sheetY + i);
      ctx.stroke();
    }

    // Рисуем разрыв (шов)
    const seamWidth = BASE_GAP_WIDTH;
    
    // Область шва
    ctx.fillStyle = 'rgba(50, 50, 50, 0.4)';
    ctx.beginPath();
    
    // Верхняя граница шва с неравномерной шириной
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Нижняя граница шва (в обратном направлении) с неравномерной шириной
    for (let i = gapPath.length - 1; i >= 0; i--) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();

    // Рисуем охлажденные точки сварки (серые)
    cooledPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Темная обводка для охлажденных точек
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Рисуем горячие точки сварки игрока (оранжевые со свечением и эффектом остывания через grayscale)
    weldPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
      // Вычисляем прогресс остывания (0..1 за 2 секунды)
      const elapsed = Date.now() - dot.timestamp;
      const coolProgress = Math.min(1, elapsed / FADE_DURATION);
      
      // Сохраняем контекст для применения фильтра
      ctx.save();
      
      // Применяем grayscale фильтр который усиливается со временем
      // В начале (coolProgress=0) фильтр не применяется, в конце (coolProgress=1) полный ЧБ
      const grayscaleValue = coolProgress;
      ctx.filter = `grayscale(${grayscaleValue})`;
      
      // Градиент для точки сварки (горячий оранжевый цвет)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      if (coolProgress < 0.3) {
        // Горячее состояние - яркие цвета
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffaa00');
        gradient.addColorStop(0.7, '#ff6600');
        gradient.addColorStop(1, '#cc3300');
      } else if (coolProgress < 0.7) {
        // Среднее состояние - постепенно тускнеет
        const t = (coolProgress - 0.3) / 0.4;
        const r1 = 255 - t * 55;
        const g1 = 170 - t * 100;
        const b1 = 0;
        gradient.addColorStop(0, `rgb(255, ${Math.floor(g1)}, 0)`);
        gradient.addColorStop(0.5, `rgb(${Math.floor(r1)}, ${Math.floor(g1 * 0.6)}, 0)`);
        gradient.addColorStop(1, `rgb(${Math.floor(r1 * 0.6)}, 50, 0)`);
      } else {
        // Почти остывшее - темные цвета
        gradient.addColorStop(0, '#888888');
        gradient.addColorStop(0.5, '#666666');
        gradient.addColorStop(1, '#444444');
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Добавляем свечение которое уменьшается со временем
      const glowIntensity = Math.max(0, 20 * (1 - coolProgress));
      ctx.shadowColor = coolProgress < 0.5 ? '#ff6600' : 'transparent';
      ctx.shadowBlur = glowIntensity;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Восстанавливаем контекст без фильтра
      ctx.restore();
    });

    // Рисуем границы листа
    ctx.strokeStyle = '#5d6d7e';
    ctx.lineWidth = 3;
    ctx.strokeRect(sheetX, sheetY, sheetWidth, sheetHeight);

  }, [gameState, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION]);

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

  // Обработчики событий мыши
  const handleCanvasMouseDown = (e) => {
    handleMouseDown();
    handleMouseMove(e);
  };

  const handleCanvasMouseMove = (e) => {
    // Обновляем позицию мыши для курсора-сварки
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setGameState(prev => ({
        ...prev,
        mouseX: e.clientX,
        mouseY: e.clientY
      }));
    }
    handleMouseMove(e);
  };

  const handleCanvasMouseUp = () => {
    handleMouseUp();
  };

  const handleCanvasMouseLeave = () => {
    handleMouseUp();
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleNextRound = () => {
    nextRound();
  };

  const handleGameOver = () => {
    onGameOver();
  };

  const isRoundComplete = gameState.roundComplete;
  const isGameOver = gameState.gameOver;
  const weldPercent = Math.round((gameState.weldUsed / MAX_WELD_POINTS) * 100);

  return (
    <div 
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseLeave}
      style={{
        cursor: 'none'
      }}
    >
      {/* Лазерный курсор */}
      <LaserCursor x={gameState.mouseX} y={gameState.mouseY} isWelding={gameState.isRunning && gameState.weldPoints.length > 0} />
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        lives={3}
        boxesFixed={gameState.round}
        multiplier={1}
        comboCount={0}
        gameTime={0}
        formatTime={(ms) => '0:00'}
        onBack={onBack}
        isGame4={true}
        round={gameState.round}
        itemsOnBoard={gameState.weldCoverage}
      />
      
      {/* Индикатор прогресса и лимита сварки */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-4 text-white z-20 border border-white/20">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Заполнение шва</span>
            <span className={`text-2xl font-bold ${gameState.weldCoverage >= 95 ? 'text-green-400' : 'text-white'}`}>
              {gameState.weldCoverage}%
            </span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Сварка</span>
            <span className={`text-2xl font-bold ${weldPercent >= 90 ? 'text-red-400' : weldPercent >= 70 ? 'text-yellow-400' : 'text-green-400'}`}>
              {weldPercent}%
            </span>
            <span className="text-xs opacity-60 ml-1">({gameState.weldUsed}/{MAX_WELD_POINTS})</span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Очки</span>
            <span className="text-2xl font-bold text-yellow-400">{gameState.score}</span>
          </div>
        </div>
        
        {/* Прогресс бар заполнения шва */}
        <div className="mt-3 flex gap-4">
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Покрытие шва</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${gameState.weldCoverage >= 95 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}
                style={{ width: `${gameState.weldCoverage}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Использовано сварки</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${weldPercent >= 90 ? 'bg-red-500' : weldPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${weldPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Канвас для отрисовки */}
      <canvas
        ref={(ref) => {
          canvasRef.current = ref;
          setCanvasRef(ref);
        }}
        className="absolute inset-0 w-full h-full"
        width={window.innerWidth}
        height={window.innerHeight}
      />
      
      {/* Модальное окно победы в раунде */}
      {isRoundComplete && (
        <Modal
          title="Шов заварен!"
          message={`Качество сварки: ${gameState.weldCoverage}%\nОчки за раунд: ${Math.round(1000 * (gameState.weldCoverage / 100))}\nОбщий счет: ${gameState.score}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={handleGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Модальное окно проигрыша */}
      {isGameOver && (
        <Modal
          title="Сварка закончилась!"
          message={`Не удалось заполнить шов.\nИспользовано: ${gameState.weldUsed} точек\nПокрытие: ${gameState.weldCoverage}%\nОбщий счет: ${gameState.score}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Попробовать снова
            </Button>
            <Button onClick={handleGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Подсказка внизу экрана */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-3 text-white text-center z-20 border border-white/20">
        <p className="text-lg">
          🔥 Зажми ЛКМ и веди вдоль разрыва чтобы заварить шов
        </p>
        <p className="text-sm opacity-80 mt-1">
          Сварка остывает через 2 секунды и становится серой. Можно наваривать на остывшую сварку!
        </p>
      </div>
    </div>
  );
};

export default Game4;
