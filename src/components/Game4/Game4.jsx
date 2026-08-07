import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION, INNER_TRIGGER_RATIO, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y, generateHoles, isPointOverHole, WELD_BASE_RADIUS, MAX_WELD_DROPS } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';

// Оптимизация: кэшируем константы отрисовки
const SHEET_MARGIN = 40;
const METAL_GRADIENT_STOPS = [
  { pos: 0, color: '#5a6b7c' },
  { pos: 0.2, color: '#6d8299' },
  { pos: 0.5, color: '#7f94ab' },
  { pos: 0.8, color: '#6d8299' },
  { pos: 1, color: '#5a6b7c' }
];
const BG_GRADIENT_STOPS = [
  { pos: 0, color: '#1a1a2e' },
  { pos: 1, color: '#16213e' }
];
const SEAM_GRADIENT_STOPS = [
  { pos: 0, color: '#2a2a2a' },
  { pos: 0.5, color: '#3a3a3a' },
  { pos: 1, color: '#2a2a2a' }
];
const WELD_COLORS = [
  { pos: 0, color: 'rgb(255, 100, 0)' },
  { pos: 0.5, color: 'rgb(255, 80, 0)' },
  { pos: 1, color: 'rgb(200, 50, 0)' }
];

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
    BASE_GAP_WIDTH,
    WELD_SIZE_RATIO,
    FADE_DURATION,
    WELDING_GUN_WIDTH,
    WELDING_GUN_HEIGHT,
    NOZZLE_OFFSET_Y,
    weldCountRef,
    lastWeldPointRef,
    lastTimeRef
  } = useGame4({ onLevelComplete });
  
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const gradientCacheRef = useRef({});

  // Оптимизация: создаем градиенты один раз при изменении размеров канваса
  const createGradients = useCallback((ctx, width, height) => {
    const cache = gradientCacheRef.current;
    
    if (!cache.bg || cache.bgWidth !== width || cache.bgHeight !== height) {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      BG_GRADIENT_STOPS.forEach(stop => bgGradient.addColorStop(stop.pos, stop.color));
      cache.bg = bgGradient;
      cache.bgWidth = width;
      cache.bgHeight = height;
    }
    
    const sheetX = SHEET_MARGIN;
    const sheetY = SHEET_MARGIN;
    const sheetWidth = width - SHEET_MARGIN * 2;
    const sheetHeight = height - SHEET_MARGIN * 2;
    
    if (!cache.metal || cache.metalX !== sheetX || cache.metalY !== sheetY) {
      const metalGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY + sheetHeight);
      METAL_GRADIENT_STOPS.forEach(stop => metalGradient.addColorStop(stop.pos, stop.color));
      cache.metal = metalGradient;
      cache.metalX = sheetX;
      cache.metalY = sheetY;
    }
    
    if (!cache.seam || cache.seamWidth !== sheetWidth) {
      const seamGradient = ctx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY);
      SEAM_GRADIENT_STOPS.forEach(stop => seamGradient.addColorStop(stop.pos, stop.color));
      cache.seam = seamGradient;
      cache.seamWidth = sheetWidth;
    }
    
    return cache;
  }, []);

  // Отрисовка на канвасе с оптимизацией
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.gapPath.length) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Оптимизация: отключаем альфа-канал фона
    const { width, height } = canvas;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    const { gapPath, weldPoints, cooledPoints } = gameState;
    
    // Параметры листа металла
    const sheetX = SHEET_MARGIN;
    const sheetY = SHEET_MARGIN;
    const sheetWidth = width - SHEET_MARGIN * 2;
    const sheetHeight = height - SHEET_MARGIN * 2;

    // Создаем/получаем кэшированные градиенты
    const gradients = createGradients(ctx, width, height);

    // Рисуем фон (темный цех)
    ctx.fillStyle = gradients.bg;
    ctx.fillRect(0, 0, width, height);

    // Рисуем лист металла
    ctx.fillStyle = gradients.metal;
    ctx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    // Оптимизация: рисуем текстуру металла только если нужно
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < sheetHeight; i += 4) {
      ctx.moveTo(sheetX, sheetY + i);
      ctx.lineTo(sheetX + sheetWidth, sheetY + i);
    }
    ctx.stroke();
    ctx.restore();

    // Рисуем края листа с разрезом
    ctx.fillStyle = '#2d3e50';
    ctx.fillRect(sheetX - 10, sheetY, 10, sheetHeight);
    ctx.fillRect(sheetX + sheetWidth, sheetY, 10, sheetHeight);
    ctx.fillRect(sheetX - 10, sheetY - 10, sheetWidth + 20, 10);
    ctx.fillRect(sheetX - 10, sheetY + sheetHeight, sheetWidth + 20, 10);

    // Рисуем разрыв (шов)
    const seamWidth = BASE_GAP_WIDTH;
    
    // Тень внутри шва
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    
    // Верхняя граница шва
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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
    
    // Основная область шва
    ctx.fillStyle = gradients.seam;
    ctx.beginPath();
    
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    for (let i = gapPath.length - 1; i >= 0; i--) {
      const p = gapPath[i];
      const w = gameState.gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
      ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
    
    // Края разреза
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

    // Оптимизация: рисуем охлажденные точки без filter (он медленный)
    cooledPoints.forEach(dot => {
      const radius = WELD_BASE_RADIUS * (dot.randomFactor || 1);
      
      // Градиент для точки сварки (без filter, используем grayscale цвета напрямую)
      const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
      WELD_COLORS.forEach(stop => gradient.addColorStop(stop.pos, stop.color));
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Рисуем горячие точки сварки игрока
    const now = Date.now();
    weldPoints.forEach(dot => {
      const radius = WELD_BASE_RADIUS * (dot.randomFactor || 1);
      
      // Вычисляем прогресс остывания (0..1 за 2 секунды)
      const elapsed = now - dot.timestamp;
      const coolProgress = Math.min(1, elapsed / FADE_DURATION);
      
      // Оптимизация: вместо filter меняем цвета градиента
      const intensity = 1 - coolProgress * 0.5; // От полного цвета до 50% насыщенности
      const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
      gradient.addColorStop(0, `rgb(${255 * intensity}, ${100 * intensity}, 0)`);
      gradient.addColorStop(0.5, `rgb(${255 * intensity}, ${80 * intensity}, 0)`);
      gradient.addColorStop(1, `rgb(${200 * intensity}, ${50 * intensity}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Рисуем границы листа
    ctx.strokeStyle = '#3d4c5e';
    ctx.lineWidth = 4;
    ctx.strokeRect(sheetX - 10, sheetY - 10, sheetWidth + 20, sheetHeight + 20);
    
    ctx.strokeStyle = '#6b7d91';
    ctx.lineWidth = 2;
    ctx.strokeRect(sheetX, sheetY, sheetWidth, sheetHeight);

    // Рисуем сварочный аппарат (упрощенная отрисовка для производительности)
    const gunX = gameState.weldingGunX - WELDING_GUN_WIDTH / 2;
    const gunY = gameState.weldingGunY - WELDING_GUN_HEIGHT + NOZZLE_OFFSET_Y;
    
    // Верхняя часть аппарата
    ctx.fillStyle = '#888';
    ctx.fillRect(gunX + 50, gunY, 300, 250);
    
    // Ребра жесткости
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const ribX = gunX + 50 + i * 60;
      ctx.beginPath();
      ctx.moveTo(ribX, gunY);
      ctx.lineTo(ribX, gunY + 250);
      ctx.stroke();
    }
    
    // Провода (упрощенно)
    ctx.strokeStyle = '#d35400';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gunX + 100, gunY + 50);
    ctx.bezierCurveTo(gunX + 150, gunY + 100, gunX + 250, gunY + 100, gunX + 300, gunY + 50);
    ctx.stroke();
    
    ctx.strokeStyle = '#2980b9';
    ctx.beginPath();
    ctx.moveTo(gunX + 120, gunY + 80);
    ctx.bezierCurveTo(gunX + 180, gunY + 150, gunX + 220, gunY + 150, gunX + 280, gunY + 80);
    ctx.stroke();
    
    // Болты
    ctx.fillStyle = '#333';
    for (let y = gunY + 40; y < gunY + 250; y += 50) {
      ctx.beginPath();
      ctx.arc(gunX + 80, y, 4, 0, Math.PI * 2);
      ctx.arc(gunX + 320, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Переходная часть
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(gunX + 100, gunY + 250, 200, 125);
    
    // Сопло (конус)
    const nozzleYStart = gunY + 375;
    const nozzleYEnd = gunY + 500;
    const centerX = gunX + WELDING_GUN_WIDTH / 2;
    
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.moveTo(centerX - 25, nozzleYStart);
    ctx.lineTo(centerX + 25, nozzleYStart);
    ctx.lineTo(centerX + 5, nozzleYEnd);
    ctx.lineTo(centerX - 5, nozzleYEnd);
    ctx.closePath();
    ctx.fill();
    
    // Отверстие сопла
    const tipX = gameState.weldingGunX;
    const tipY = gameState.weldingGunY;
    
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
    ctx.stroke();

  }, [gameState, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y, createGradients]);

  // Игровой цикл для отрисовки (оптимизация: старт только при изменении gameState)
  useEffect(() => {
    startGame();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

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
    // Позиция мыши теперь используется только как целевая точка для сопла
    // Само сопло двигается внутри handleMouseMove с ограничением скорости
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

  const handleRestartLevel = () => {
    // Полный сброс игры с инициализацией нового раунда с тем же разрывом
    if (weldCountRef) {
      weldCountRef.current = 0;
    }
    if (lastWeldPointRef) {
      lastWeldPointRef.current = null;
    }
    if (lastTimeRef) {
      lastTimeRef.current = null;
    }
    
    // Сохраняем текущий round и gapPath для повторного использования
    const currentRound = gameState.round;
    const currentGapPath = gameState.gapPath;
    const currentGapWidths = gameState.gapWidths;
    const currentHoles = gameState.holes;
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      round: currentRound,
      weldCoverage: 0,
      weldUsed: 0,
      gapPath: currentGapPath,
      gapWidths: currentGapWidths,
      holes: currentHoles,
      weldPoints: [],
      cooledPoints: [],
      gameOver: false,
      roundComplete: false,
      weldingGunX: window.innerWidth / 2,
      weldingGunY: 40 + NOZZLE_OFFSET_Y,
      mouseX: window.innerWidth / 2,
      mouseY: 40
    }));
  };

  // Проверяем можно ли показать кнопку "Следующий лист"
  const canShowNextSheet = gameState.roundComplete && !gameState.gameOver;
  // Проверяем можно ли показать кнопку "Рестарт" (сварка кончилась и покрытие < 95%)
  const canShowRestart = gameState.weldUsed >= MAX_WELD_DROPS && gameState.weldCoverage < 95 && !gameState.roundComplete;
  
  const isRoundComplete = gameState.roundComplete;
  const isGameOver = gameState.gameOver;

  return (
    <div 
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseLeave}
    >
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
      
      {/* Индикатор прогресса сварки */}
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
            <span className="text-2xl font-bold text-blue-400">{gameState.weldUsed}/{MAX_WELD_DROPS}</span>
          </div>
          <div className="text-center">
            <span className="text-xs opacity-80 uppercase tracking-wider block">Очки</span>
            <span className="text-2xl font-bold text-yellow-400">{gameState.score}</span>
          </div>
        </div>
        
        {/* Прогресс бар заполнения шва */}
        <div className="mt-3 flex gap-8">
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Покрытие шва</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${gameState.weldCoverage >= 95 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-yellow-500'}`}
                style={{ width: `${gameState.weldCoverage}%` }}
              />
            </div>
          </div>
          
          {/* Прогресс бар количества сварки */}
          <div className="flex-1">
            <div className="text-xs opacity-60 mb-1">Оставшаяся сварка</div>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-cyan-500"
                style={{ width: `${((MAX_WELD_DROPS - gameState.weldUsed) / MAX_WELD_DROPS) * 100}%` }}
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
      
      {/* Кнопка "Следующий лист" - показывается когда покрытие >= 95% */}
      {canShowNextSheet && (
        <button
          onClick={handleNextRound}
          className="absolute top-24 left-8 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg z-30 transition-all transform hover:scale-105 border-2 border-green-400"
        >
          📋 Следующий лист
        </button>
      )}
      
      {/* Кнопка "Рестарт" - показывается когда сварка кончилась и покрытие < 95% */}
      {canShowRestart && (
        <button
          onClick={handleRestartLevel}
          className="absolute top-24 left-8 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg z-30 transition-all transform hover:scale-105 border-2 border-red-400"
        >
          🔄 Рестарт
        </button>
      )}
      
      {/* Подсказка внизу экрана */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-6 py-3 text-white text-center z-20 border border-white/20">
        <p className="text-lg">
          🔥 Наведи курсор на лист и зажми ЛКМ чтобы начать сварку
        </p>
        <p className="text-sm opacity-80 mt-1">
          Сварочный аппарат следует за курсором. Сопло не может выйти за пределы листа металла!
        </p>
      </div>
    </div>
  );
};

export default Game4;
