import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION, INNER_TRIGGER_RATIO, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y, generateHoles, isPointOverHole, WELD_BASE_RADIUS, MAX_WELD_DROPS } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';

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
  const bgCanvasRef = useRef(null);
  const metalSheetCachedRef = useRef(null);

  // Кэшируем константы для отрисовки
  const drawConstants = useMemo(() => ({
    sheetMargin: 40,
    seamWidth: BASE_GAP_WIDTH,
    weldBaseRadius: WELD_BASE_RADIUS
  }), [BASE_GAP_WIDTH]);

  useEffect(() => {
    startGame();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Предварительная отрисовка фона и металлического листа (статичные элементы)
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
    const { sheetMargin } = drawConstants;
    const sheetX = sheetMargin;
    const sheetY = sheetMargin;
    const sheetWidth = width - sheetMargin * 2;
    const sheetHeight = height - sheetMargin * 2;

    // Рисуем фон (темный цех)
    const bgGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    bgCtx.fillStyle = bgGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Рисуем лист металла с текстурой
    const metalGradient = bgCtx.createLinearGradient(sheetX, sheetY, sheetX + sheetWidth, sheetY + sheetHeight);
    metalGradient.addColorStop(0, '#5a6b7c');
    metalGradient.addColorStop(0.2, '#6d8299');
    metalGradient.addColorStop(0.5, '#7f94ab');
    metalGradient.addColorStop(0.8, '#6d8299');
    metalGradient.addColorStop(1, '#5a6b7c');
    
    bgCtx.fillStyle = metalGradient;
    bgCtx.fillRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    // Текстура металла (шлифованные линии)
    bgCtx.save();
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    bgCtx.lineWidth = 1;
    for (let i = 0; i < sheetHeight; i += 4) {
      bgCtx.beginPath();
      bgCtx.moveTo(sheetX, sheetY + i);
      bgCtx.lineTo(sheetX + sheetWidth, sheetY + i);
      bgCtx.stroke();
    }
    bgCtx.restore();

    // Края листа
    const edgeGradient = bgCtx.createLinearGradient(sheetX - 10, sheetY, sheetX + 10, sheetY);
    edgeGradient.addColorStop(0, '#2d3e50');
    edgeGradient.addColorStop(0.5, '#4a5d70');
    edgeGradient.addColorStop(1, '#2d3e50');
    
    bgCtx.fillStyle = edgeGradient;
    bgCtx.fillRect(sheetX - 10, sheetY, 10, sheetHeight);
    bgCtx.fillRect(sheetX + sheetWidth, sheetY, 10, sheetHeight);
    
    const topEdgeGradient = bgCtx.createLinearGradient(sheetX, sheetY - 10, sheetX, sheetY + 10);
    topEdgeGradient.addColorStop(0, '#2d3e50');
    topEdgeGradient.addColorStop(0.5, '#4a5d70');
    topEdgeGradient.addColorStop(1, '#2d3e50');
    
    bgCtx.fillStyle = topEdgeGradient;
    bgCtx.fillRect(sheetX - 10, sheetY - 10, sheetWidth + 20, 10);
    bgCtx.fillRect(sheetX - 10, sheetY + sheetHeight, sheetWidth + 20, 10);

    // Границы листа
    bgCtx.strokeStyle = '#3d4c5e';
    bgCtx.lineWidth = 4;
    bgCtx.strokeRect(sheetX - 10, sheetY - 10, sheetWidth + 20, sheetHeight + 20);
    
    bgCtx.strokeStyle = '#6b7d91';
    bgCtx.lineWidth = 2;
    bgCtx.strokeRect(sheetX, sheetY, sheetWidth, sheetHeight);
    
    metalSheetCachedRef.current = bgCanvasRef.current;
  }, [drawConstants]);

  // Отрисовка на канвасе
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.gapPath.length) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    // Рисуем закэшированный фон
    if (metalSheetCachedRef.current) {
      ctx.drawImage(metalSheetCachedRef.current, 0, 0);
    } else {
      // Если кэш еще не создан, кэшируем
      cacheBackground();
      return;
    }

    const { gapPath, weldPoints, cooledPoints, gapWidths } = gameState;
    const { sheetMargin, seamWidth } = drawConstants;
    const sheetX = sheetMargin;
    const sheetY = sheetMargin;
    const sheetWidth = width - sheetMargin * 2;
    const sheetHeight = height - sheetMargin * 2;

    // Рисуем разрыв (шов) с более контрастным видом
    // Тень внутри шва для объема - смещаем на половину ширины шва вверх/вниз
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();

    // Верхняя граница шва с неравномерной шириной
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gapWidths[i] || seamWidth;
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
      const w = gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
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
      const w = gapWidths[i] || seamWidth;
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
      const w = gapWidths[i] || seamWidth;
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
      const w = gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y - w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gapWidths[i] || seamWidth;
      const x = sheetX + p.x;
      const y = sheetY + p.y + w / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Предварительно создаем градиент для сварки (один раз)
    const weldGradientCache = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    weldGradientCache.addColorStop(0, 'rgb(255, 100, 0)');
    weldGradientCache.addColorStop(0.5, 'rgb(255, 80, 0)');
    weldGradientCache.addColorStop(1, 'rgb(200, 50, 0)');

    // Рисуем охлажденные точки сварки (с фильтрами для реалистичности)
    cooledPoints.forEach(dot => {
      // Используем фиксированный базовый радиус с учетом randomFactor
      const radius = drawConstants.weldBaseRadius * (dot.randomFactor || 1);

      // Сохраняем контекст для применения фильтра
      ctx.save();

      // Применяем полный grayscale фильтр
      ctx.filter = 'grayscale(1)';

      // Градиент для точки сварки (оранжевый цвет как у горячей) - без прозрачности
      const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
      gradient.addColorStop(0, 'rgb(255, 100, 0)');
      gradient.addColorStop(0.5, 'rgb(255, 80, 0)');
      gradient.addColorStop(1, 'rgb(200, 50, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Восстанавливаем контекст
      ctx.restore();
    });

    // Рисуем горячие точки сварки игрока (оранжевые с плавным угасанием в grayscale)
    weldPoints.forEach(dot => {
      // Используем фиксированный базовый радиус с учетом randomFactor
      const radius = drawConstants.weldBaseRadius * (dot.randomFactor || 1);

      // Вычисляем прогресс остывания (0..1 за 2 секунды)
      const elapsed = Date.now() - dot.timestamp;
      const coolProgress = Math.min(1, elapsed / FADE_DURATION);

      // Сохраняем контекст для применения фильтра
      ctx.save();

      // Применяем grayscale фильтр который усиливается со временем (от 0 до 1)
      ctx.filter = `grayscale(${coolProgress})`;

      // Градиент для точки сварки (горячий оранжевый цвет, без прозрачности)
      const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, radius);
      gradient.addColorStop(0, 'rgb(255, 100, 0)');
      gradient.addColorStop(0.5, 'rgb(255, 80, 0)');
      gradient.addColorStop(1, 'rgb(200, 50, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Восстанавливаем контекст
      ctx.restore();
    });

    // Рисуем сварочный аппарат с детализированной текстурой
    const gunX = gameState.weldingGunX - WELDING_GUN_WIDTH / 2;
    const gunY = gameState.weldingGunY - WELDING_GUN_HEIGHT + NOZZLE_OFFSET_Y;

    // --- ВЕРХНЯЯ ПОЛОВИНА (0-250px от верха аппарата): Механизмы и провода ---
    const topSectionX = gunX + 50;
    const topSectionY = gunY;
    const topSectionWidth = 300;
    const topSectionHeight = 250;

    // Градиент верхней части
    const gradientTop = ctx.createLinearGradient(topSectionX, topSectionY, topSectionX + topSectionWidth, topSectionY + topSectionHeight);
    gradientTop.addColorStop(0, '#555');
    gradientTop.addColorStop(0.2, '#888');
    gradientTop.addColorStop(0.5, '#aaa');
    gradientTop.addColorStop(0.8, '#888');
    gradientTop.addColorStop(1, '#555');
    ctx.fillStyle = gradientTop;
    ctx.fillRect(topSectionX, topSectionY, topSectionWidth, topSectionHeight);

    // Ребра жесткости
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const ribX = topSectionX + i * 60;
      ctx.beginPath();
      ctx.moveTo(ribX, topSectionY);
      ctx.lineTo(ribX, topSectionY + topSectionHeight);
      ctx.stroke();
    }

    // Провода и детали
    ctx.strokeStyle = '#d35400'; // Оранжевые провода
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gunX + 100, gunY + 50);
    ctx.bezierCurveTo(gunX + 150, gunY + 100, gunX + 250, gunY + 100, gunX + 300, gunY + 50);
    ctx.stroke();

    ctx.strokeStyle = '#2980b9'; // Синие провода
    ctx.beginPath();
    ctx.moveTo(gunX + 120, gunY + 80);
    ctx.bezierCurveTo(gunX + 180, gunY + 150, gunX + 220, gunY + 150, gunX + 280, gunY + 80);
    ctx.stroke();

    // Болты/заклепки
    ctx.fillStyle = '#333';
    for (let y = gunY + 40; y < gunY + 250; y += 50) {
      ctx.beginPath();
      ctx.arc(gunX + 80, y, 4, 0, Math.PI * 2);
      ctx.arc(gunX + 320, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- ПЕРЕХОДНОЙ МЕХАНИЗМ (250-375px от верха): Ширина 200px ---
    const transitionYStart = gunY + 250;
    const transitionYEnd = gunY + 375;
    const transitionWidth = 200;
    const transitionLeft = gunX + 100;

    // Градиент переходной части
    const gradientMid = ctx.createLinearGradient(transitionLeft, transitionYStart, transitionLeft + transitionWidth, transitionYEnd);
    gradientMid.addColorStop(0, '#7f8c8d');
    gradientMid.addColorStop(0.5, '#bdc3c7');
    gradientMid.addColorStop(1, '#7f8c8d');

    ctx.fillStyle = gradientMid;
    ctx.fillRect(transitionLeft, transitionYStart, transitionWidth, transitionYEnd - transitionYStart);

    // Детали переходника (болты по бокам)
    ctx.fillStyle = '#555';
    ctx.fillRect(transitionLeft - 10, transitionYStart + 20, 10, 40);
    ctx.fillRect(transitionLeft + transitionWidth, transitionYStart + 20, 10, 40);
    ctx.fillRect(transitionLeft - 10, transitionYEnd - 60, 10, 40);
    ctx.fillRect(transitionLeft + transitionWidth, transitionYEnd - 60, 10, 40);

    // --- НИЖНЯЯ ЧЕТВЕРТЬ (375-500px от верха): Тонкое сопло (игла/конус) ---
    const nozzleYStart = gunY + 375;
    const nozzleYEnd = gunY + 500;
    const nozzleTipWidth = 10; // Очень узкий кончик
    const nozzleBaseWidth = 50; // Основание сопла
    const centerX = gunX + WELDING_GUN_WIDTH / 2;

    // Рисуем конус сопла
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    // Левый край основания
    ctx.moveTo(centerX - nozzleBaseWidth / 2, nozzleYStart);
    // Правый край основания
    ctx.lineTo(centerX + nozzleBaseWidth / 2, nozzleYStart);
    // Правый край кончика
    ctx.lineTo(centerX + nozzleTipWidth / 2, nozzleYEnd);
    // Левый край кончика
    ctx.lineTo(centerX - nozzleTipWidth / 2, nozzleYEnd);
    ctx.closePath();
    ctx.fill();

    // Блик на сопле
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - nozzleBaseWidth / 4, nozzleYStart + 5);
    ctx.lineTo(centerX - nozzleTipWidth / 4, nozzleYEnd - 5);
    ctx.stroke();

    // Точка выхода сварки (на самом кончике сопла)
    const tipX = gameState.weldingGunX;
    const tipY = gameState.weldingGunY;

    // Визуальное отверстие сопла
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Кольцо вокруг отверстия (красное - горячее)
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
    ctx.stroke();

  }, [gameState, drawConstants, cacheBackground, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION]);

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
