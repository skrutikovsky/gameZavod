import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, MAX_WELD_POINTS, FADE_DURATION, INNER_TRIGGER_RATIO, MAX_SPEED } from '../../hooks/useGame4';
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
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </>
        )}
      </div>
      
      <style>{`
        @keyframes spark0 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-20px, -15px) scale(0); opacity: 0; }
        }
        @keyframes spark1 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(20px, -10px) scale(0); opacity: 0; }
        }
        @keyframes spark2 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(15px, 20px) scale(0); opacity: 0; }
        }
        @keyframes spark3 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-10px, 25px) scale(0); opacity: 0; }
        }
        @keyframes spark4 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-25px, 5px) scale(0); opacity: 0; }
        }
        @keyframes spark5 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(25px, 10px) scale(0); opacity: 0; }
        }
        @keyframes spark6 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(10px, -20px) scale(0); opacity: 0; }
        }
        @keyframes spark7 {
          0% { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(-15px, -25px) scale(0); opacity: 0; }
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

    // Рисуем фон (темный цех)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Рисуем лист металла с более реалистичной текстурой
    const metalGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY + sheetHeight);
    metalGradient.addColorStop(0, '#5a6b7c');
    metalGradient.addColorStop(0.2, '#6d8299');
    metalGradient.addColorStop(0.5, '#7f94ab');
    metalGradient.addColorStop(0.8, '#6d8299');
    metalGradient.addColorStop(1, '#5a6b7c');
    
    ctx.fillStyle = metalGradient;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    // Добавляем текстуру металла (шлифованные линии)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < sheetHeight; i += 4) {
      ctx.beginPath();
      ctx.moveTo(sheetX, sheetY + i);
      ctx.lineTo(sheetX + sheetWidth, sheetY + i);
      ctx.stroke();
    }
    
    // Добавляем случайные царапины для реализма
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const scratchX = sheetX + Math.random() * sheetWidth;
      const scratchY = sheetY + Math.random() * sheetHeight;
      const scratchLen = 20 + Math.random() * 40;
      const scratchAngle = Math.random() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(scratchX, scratchY);
      ctx.lineTo(scratchX + Math.cos(scratchAngle) * scratchLen, scratchY + Math.sin(scratchAngle) * scratchLen);
      ctx.stroke();
    }
    ctx.restore();

    // Рисуем края листа с разрезом (более темные и объемные)
    const edgeGradient = ctx.createLinearGradient(sheetX - 10, sheetY, sheetX + 10, sheetY);
    edgeGradient.addColorStop(0, '#2d3e50');
    edgeGradient.addColorStop(0.5, '#4a5d70');
    edgeGradient.addColorStop(1, '#2d3e50');
    
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(sheetX - 10, sheetY, 10, sheetHeight);
    ctx.fillRect(sheetX + sheetWidth, sheetY, 10, sheetHeight);
    
    // Верхний и нижний край
    const topEdgeGradient = ctx.createLinearGradient(sheetX, sheetY - 10, sheetX, sheetY + 10);
    topEdgeGradient.addColorStop(0, '#2d3e50');
    topEdgeGradient.addColorStop(0.5, '#4a5d70');
    topEdgeGradient.addColorStop(1, '#2d3e50');
    
    ctx.fillStyle = topEdgeGradient;
    ctx.fillRect(sheetX - 10, sheetY - 10, sheetWidth + 20, 10);
    ctx.fillRect(sheetX - 10, sheetY + sheetHeight, sheetWidth + 20, 10);

    // Рисуем разрыв (шов) с более контрастным видом
    const seamWidth = BASE_GAP_WIDTH;
    
    // Тень внутри шва для объема
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    
    // Верхняя граница шва с неравномерной шириной
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2 - 3;
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
      const y = sheetY + p.y + w / 2 + 3;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Основная область шва (темная с красноватым оттенком раскаленного металла)
    const seamGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY);
    seamGradient.addColorStop(0, '#2a2a2a');
    seamGradient.addColorStop(0.5, '#3a3a3a');
    seamGradient.addColorStop(1, '#2a2a2a');
    
    ctx.fillStyle = seamGradient;
    ctx.beginPath();
    
    // Верхняя граница шва
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
    
    // Нижняя граница шва
    for (let i = gapPath.length - 1; i >= 0; i--) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Края разреза (светлые, как свежий металл)
    ctx.strokeStyle = '#8a9aab';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    ctx.beginPath();
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Рисуем охлажденные точки сварки (серые с металлическим блеском)
    cooledPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
      // Градиент для охлажденной сварки
      const cooledGradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
      cooledGradient.addColorStop(0, '#9ca3af');
      cooledGradient.addColorStop(0.4, '#6b7280');
      cooledGradient.addColorStop(0.7, '#4b5563');
      cooledGradient.addColorStop(1, '#374151');
      
      ctx.fillStyle = cooledGradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Блик на охлажденной сварке
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x - radius/3, y - radius/3, radius/4, 0, Math.PI * 2);
      ctx.stroke();
      
      // Темная обводка для контраста
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Рисуем горячие точки сварки игрока (оранжевые со свечением и эффектом остывания)
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
      const grayscaleValue = coolProgress;
      ctx.filter = `grayscale(${grayscaleValue})`;
      
      // Внешнее свечение (только для горячих точек)
      if (coolProgress < 0.5) {
        const glowIntensity = 20 * (1 - coolProgress * 2);
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = glowIntensity;
      }
      
      // Градиент для точки сварки (горячий оранжевый цвет)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      // Плавно угасающий градиент без бликов
      gradient.addColorStop(0, `rgba(255, 100, 0, ${1 - coolProgress})`);
      gradient.addColorStop(0.5, `rgba(255, 80, 0, ${0.8 * (1 - coolProgress)})`);
      gradient.addColorStop(1, `rgba(200, 50, 0, ${0.6 * (1 - coolProgress)})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Обводка для контраста с фоном
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, 69, 0, ${1 - coolProgress})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Восстанавливаем контекст без фильтра
      ctx.restore();
    });

    // Рисуем границы листа (объемные)
    ctx.strokeStyle = '#3d4c5e';
    ctx.lineWidth = 4;
    ctx.strokeRect(sheetX - 10, sheetY - 10, sheetWidth + 20, sheetHeight + 20);
    
    // Внутренняя рамка
    ctx.strokeStyle = '#6b7d91';
    ctx.lineWidth = 2;
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
    // Обновляем позицию мыши для курсора-сварки (используем координаты канваса)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setGameState(prev => ({
        ...prev,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top
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
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Скорость</span>
            <span className={`text-2xl font-bold ${gameState.speedPercent >= 100 ? 'text-red-400' : gameState.speedPercent >= 80 ? 'text-yellow-400' : 'text-green-400'}`}>
              {gameState.speedPercent}%
            </span>
            <span className="text-xs opacity-60 ml-1">({Math.round(gameState.currentSpeed)}px/s)</span>
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
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Скорость (макс {MAX_SPEED}px/s)</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-100 ${gameState.speedPercent >= 100 ? 'bg-red-500' : gameState.speedPercent >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${gameState.speedPercent}%` }}
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
        <p className="text-sm opacity-80 mt-1">
          ⚠️ Двигай курсор медленно (не быстрее {MAX_SPEED}px/s) иначе сварка не работает
        </p>
      </div>
    </div>
  );
};

export default Game4;
