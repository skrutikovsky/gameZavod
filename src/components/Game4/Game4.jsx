import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, MAX_WELD_POINTS, FADE_DURATION } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

// Компонент сварочного аппарата
const WeldingTorch = ({ x, y }) => {
  if (x === undefined || y === undefined) return null;
  
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-10%, -10%)',
        width: '60px',
        height: '60px'
      }}
    >
      {/* Сварочный аппарат - вид сверху */}
      <svg viewBox="0 0 60 60" className="w-full h-full drop-shadow-lg">
        {/* Рукоятка */}
        <rect x="5" y="25" width="25" height="12" fill="#4a5568" stroke="#2d3748" strokeWidth="2" rx="2"/>
        <rect x="8" y="27" width="20" height="8" fill="#718096" opacity="0.5"/>
        
        {/* Корпус горелки */}
        <path d="M28 28 L45 20 L48 25 L32 35 Z" fill="#e53e3e" stroke="#c53030" strokeWidth="2"/>
        <path d="M30 30 L44 23 L46 26 L32 34 Z" fill="#fc8181" opacity="0.6"/>
        
        {/* Сопло */}
        <circle cx="48" cy="23" r="5" fill="#fbbf24" stroke="#d97706" strokeWidth="2"/>
        <circle cx="48" cy="23" r="3" fill="#f59e0b"/>
        <circle cx="48" cy="23" r="1.5" fill="#78350f"/>
        
        {/* Искра/пламя на кончике сопла */}
        <circle cx="53" cy="23" r="4" fill="#ff6b35" opacity="0.8">
          <animate attributeName="r" values="3;5;3" dur="0.3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0.9;0.6" dur="0.3s" repeatCount="indefinite"/>
        </circle>
        <circle cx="54" cy="23" r="2" fill="#ffd23f">
          <animate attributeName="r" values="1.5;2.5;1.5" dur="0.2s" repeatCount="indefinite"/>
        </circle>
        
        {/* Кабель */}
        <path d="M5 31 Q-10 35, -15 50" stroke="#2d3748" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <path d="M7 31 Q-8 35, -13 50" stroke="#4a5568" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );
};

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
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

    // Рисуем горячие точки сварки игрока (оранжевые со свечением)
    weldPoints.forEach(dot => {
      const x = sheetX + dot.x;
      const y = sheetY + dot.y;
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
      // Вычисляем прозрачность на основе времени остывания
      const elapsed = Date.now() - dot.timestamp;
      const fadeProgress = Math.min(1, elapsed / FADE_DURATION);
      const alpha = 1 - fadeProgress * 0.5; // Плавно переходим к 50% прозрачности
      
      // Градиент для точки сварки (эффект нагрева с плавным угасанием)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 107, 53, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(247, 147, 30, ${alpha})`);
      gradient.addColorStop(1, `rgba(255, 210, 63, ${alpha * 0.8})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Добавляем свечение которое уменьшается со временем
      const glowIntensity = Math.max(0, 15 * (1 - fadeProgress));
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = glowIntensity;
      ctx.fill();
      ctx.shadowBlur = 0;
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
      {/* Сварочный аппарат как курсор */}
      <WeldingTorch mouseX={gameState.mouseX} mouseY={gameState.mouseY} />
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
