import React, { useEffect, useRef, useCallback } from 'react';
import { useGame4 } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    startWelding,
    weldMove,
    stopWelding,
    nextRound,
    WELD_TYPES,
    METAL_SHEET_WIDTH,
    METAL_SHEET_HEIGHT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
    canvasRef,
  } = useGame4();

  const gameContainerRef = useRef(null);
  const canvasInnerRef = useRef(null);

  useEffect(() => {
    startGame();
  }, [startGame]);

  // Обработчики мыши для сварки
  const handleMouseDown = useCallback((e) => {
    if (gameState.isRoundComplete) return;
    
    const rect = canvasInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startWelding(x, y);
  }, [gameState.isRoundComplete, startWelding]);

  const handleMouseMove = useCallback((e) => {
    if (!gameState.isWelding || gameState.isRoundComplete) return;
    
    const rect = canvasInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    weldMove(x, y);
  }, [gameState.isWelding, gameState.isRoundComplete, weldMove]);

  const handleMouseUp = useCallback(() => {
    stopWelding();
  }, [stopWelding]);

  // Обработчики тача для мобильных
  const handleTouchStart = useCallback((e) => {
    if (gameState.isRoundComplete) return;
    
    const rect = canvasInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    startWelding(x, y);
  }, [gameState.isRoundComplete, startWelding]);

  const handleTouchMove = useCallback((e) => {
    if (!gameState.isWelding || gameState.isRoundComplete) return;
    
    const rect = canvasInnerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    weldMove(x, y);
  }, [gameState.isWelding, gameState.isRoundComplete, weldMove]);

  const handleTouchEnd = useCallback(() => {
    stopWelding();
  }, [stopWelding]);

  // Отрисовка на канвасе
  useEffect(() => {
    const canvas = canvasInnerRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Очистка
    ctx.clearRect(0, 0, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
    
    // Рисуем лист металла
    const gradient = ctx.createLinearGradient(0, 0, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
    gradient.addColorStop(0, '#8B8B8B');
    gradient.addColorStop(0.5, '#A9A9A9');
    gradient.addColorStop(1, '#7B7B7B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
    
    // Добавляем текстуру металла
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      const y = Math.random() * METAL_SHEET_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(METAL_SHEET_WIDTH, y);
      ctx.stroke();
    }
    
    // Рисуем шов (разрыв)
    if (gameState.seamPoints.length > 0) {
      // Границы шва
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = SEAM_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(gameState.seamPoints[0].x, gameState.seamPoints[0].y);
      gameState.seamPoints.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      
      // Внутренняя часть шва (темная)
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = SEAM_WIDTH - 4;
      ctx.stroke();
      
      // Рисуем пунктирную линию паттерна
      if (gameState.patternDots.length > 0) {
        ctx.fillStyle = gameState.currentWeldType?.id === 1 ? '#FFD700' : 
                        gameState.currentWeldType?.id === 2 ? '#00BFFF' : '#FF69B4';
        
        gameState.patternDots.forEach((dot, idx) => {
          if (idx % 2 === 0) { // Пунктир
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    }
    
    // Рисуем точки сварки
    gameState.weldDots.forEach(dot => {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, WELD_DOT_RADIUS, 0, Math.PI * 2);
      
      if (dot.isInSeam) {
        // Точка в шве - яркий оранжевый цвет сварки
        const grad = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, WELD_DOT_RADIUS);
        grad.addColorStop(0, '#FFFF00');
        grad.addColorStop(0.5, '#FFA500');
        grad.addColorStop(1, '#FF4500');
        ctx.fillStyle = grad;
      } else {
        // Точка вне шва - тусклый красный
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      }
      
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    
    // Рисуем курсор-сварочный аппарат при наведении
    // (реализуется через CSS cursor)
  }, [gameState.seamPoints, gameState.patternDots, gameState.weldDots, gameState.currentWeldType, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT, SEAM_WIDTH, WELD_DOT_RADIUS]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleNextRound = () => {
    nextRound();
  };

  const handleMainMenu = () => {
    onGameOver();
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden bg-gradient-to-b from-gray-800 to-gray-900"
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.totalScore}
        round={gameState.round}
        itemsOnBoard={null}
        gameTime={undefined}
        formatTime={formatTime}
        onBack={onBack}
        isGame3={true}
      />
      
      {/* Информация о текущем типе сварки */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl text-white z-20 border border-white/20">
        <div className="text-center">
          <div className="text-lg font-bold text-yellow-400">
            Тип сварки: {gameState.currentWeldType?.name || 'Загрузка...'}
          </div>
          <div className="text-sm text-gray-300 mt-1">
            {gameState.currentWeldType?.description}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Базовые очки: {gameState.currentWeldType?.points}
          </div>
        </div>
      </div>
      
      {/* Индикаторы прогресса */}
      <div className="absolute top-40 left-1/2 transform -translate-x-1/2 flex gap-4 z-20">
        <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg text-white border border-white/20">
          <div className="text-xs text-gray-400">Покрытие шва</div>
          <div className="text-xl font-bold text-green-400">{gameState.seamCoverage.toFixed(1)}%</div>
        </div>
        <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg text-white border border-white/20">
          <div className="text-xs text-gray-400">Качество паттерна</div>
          <div className="text-xl font-bold text-blue-400">{gameState.patternQuality.toFixed(1)}%</div>
        </div>
      </div>
      
      {/* Игровое поле с металлом */}
      <div className="absolute inset-0 flex items-center justify-center pt-32">
        <div 
          ref={canvasInnerRef}
          className="relative shadow-2xl rounded-lg overflow-hidden cursor-none"
          style={{
            width: METAL_SHEET_WIDTH,
            height: METAL_SHEET_HEIGHT,
            cursor: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <canvas
            ref={canvasRef}
            width={METAL_SHEET_WIDTH}
            height={METAL_SHEET_HEIGHT}
            className="block"
          />
          
          {/* Курсор-сварочный аппарат */}
          {gameState.isWelding && (
            <div 
              className="pointer-events-none absolute z-30"
              style={{
                left: -20,
                top: -20,
                transform: `translate(${gameState.weldDots.length > 0 ? gameState.weldDots[gameState.weldDots.length - 1].x : 0}px, ${gameState.weldDots.length > 0 ? gameState.weldDots[gameState.weldDots.length - 1].y : 0}px)`,
              }}
            >
              {/* Визуализация сварочного аппарата */}
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-600 rounded-full shadow-lg border-2 border-yellow-300 flex items-center justify-center">
                <div className="w-6 h-6 bg-yellow-200 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Инструкция */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 text-white text-center z-20">
        <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
          <p className="text-lg font-semibold">
            Зажмите ЛКМ и ведите вдоль шва
          </p>
          <p className="text-sm text-gray-300 mt-1">
            Следуйте пунктирной линии для максимального качества
          </p>
        </div>
      </div>
      
      {/* Модальное окно завершения раунда */}
      {gameState.isRoundComplete && (
        <Modal
          title="Раунд завершен!"
          message={`Покрытие шва: ${gameState.seamCoverage.toFixed(1)}%
Качество паттерна: ${gameState.patternQuality.toFixed(1)}%
Заработано очков: ${Math.round((gameState.currentWeldType?.points || 0) * (gameState.patternQuality / 100))}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={handleMainMenu} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Game4;
