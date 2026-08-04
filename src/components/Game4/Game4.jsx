import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame4, BASE_GAP_WIDTH, WELD_SIZE_RATIO, MAX_WELD_POINTS, FADE_DURATION, INNER_TRIGGER_RATIO, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

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
    FADE_DURATION,
    WELDING_GUN_WIDTH,
    WELDING_GUN_HEIGHT,
    NOZZLE_OFFSET_Y
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
    
    // Тень внутри шва для объема - смещаем на половину ширины шва вверх/вниз
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
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

    // Рисуем охлажденные точки сварки
    cooledPoints.forEach(dot => {
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
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
      const radius = (dot.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
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

    // Рисуем границы листа (объемные)
    ctx.strokeStyle = '#3d4c5e';
    ctx.lineWidth = 4;
    ctx.strokeRect(sheetX - 10, sheetY - 10, sheetWidth + 20, sheetHeight + 20);
    
    // Внутренняя рамка
    ctx.strokeStyle = '#6b7d91';
    ctx.lineWidth = 2;
    ctx.strokeRect(sheetX, sheetY, sheetWidth, sheetHeight);

    // Рисуем сварочный аппарат
    const gunX = gameState.weldingGunX - WELDING_GUN_WIDTH / 2;
    const gunY = gameState.weldingGunY - WELDING_GUN_HEIGHT + NOZZLE_OFFSET_Y;
    
    // Создаем градиент для корпуса аппарата
    const gunGradient = ctx.createLinearGradient(gunX, gunY, gunX + WELDING_GUN_WIDTH, gunY + WELDING_GUN_HEIGHT);
    gunGradient.addColorStop(0, '#4a5d70');
    gunGradient.addColorStop(0.3, '#6d8299');
    gunGradient.addColorStop(0.7, '#5a6b7c');
    gunGradient.addColorStop(1, '#3d4c5e');
    
    ctx.fillStyle = gunGradient;
    ctx.fillRect(gunX, gunY, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT);
    
    // Добавляем детали корпуса (ребра жесткости)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = gunY + (i * WELDING_GUN_HEIGHT / 4);
      ctx.beginPath();
      ctx.moveTo(gunX + 20, y);
      ctx.lineTo(gunX + WELDING_GUN_WIDTH - 20, y);
      ctx.stroke();
    }
    
    // Рисуем боковые панели
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(gunX + 10, gunY + 20, 30, WELDING_GUN_HEIGHT - 40);
    ctx.fillRect(gunX + WELDING_GUN_WIDTH - 40, gunY + 20, 30, WELDING_GUN_HEIGHT - 40);
    
    // Рисуем сопло в нижней части по центру
    const nozzleX = gunX + WELDING_GUN_WIDTH / 2;
    const nozzleY = gunY + WELDING_GUN_HEIGHT - NOZZLE_OFFSET_Y;
    const nozzleRadius = 15;
    
    // Градиент для сопла (металлический блеск)
    const nozzleGradient = ctx.createRadialGradient(nozzleX, nozzleY, 0, nozzleX, nozzleY, nozzleRadius);
    nozzleGradient.addColorStop(0, '#8a9aab');
    nozzleGradient.addColorStop(0.5, '#6d8299');
    nozzleGradient.addColorStop(1, '#4a5d70');
    
    ctx.fillStyle = nozzleGradient;
    ctx.beginPath();
    ctx.arc(nozzleX, nozzleY, nozzleRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Отверстие сопла (точка откуда появляется шов)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(nozzleX, nozzleY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Блик на сопле
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(nozzleX - 3, nozzleY - 3, 2, 0, Math.PI * 2);
    ctx.fill();

  }, [gameState, BASE_GAP_WIDTH, WELD_SIZE_RATIO, FADE_DURATION, WELDING_GUN_WIDTH, WELDING_GUN_HEIGHT, NOZZLE_OFFSET_Y]);

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
