import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame4 } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    resetGame,
    canvasRef,
    WELD_TYPES,
    METAL_SHEET_WIDTH,
    METAL_SHEET_HEIGHT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
  } = useGame4();

  const gameContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    startGame();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [startGame]);

  // Отслеживание позиции курсора
  const handleContainerMouseMove = useCallback((e) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
    handleMouseMove(e);
  }, [handleMouseMove]);

  const handleContainerMouseDown = useCallback((e) => {
    handleMouseDown(e);
  }, [handleMouseDown]);

  const handleContainerMouseUp = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  const handleContainerMouseLeave = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // Отрисовка игрового поля
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const render = () => {
      // Очистка холста
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Вычисляем позицию листа металла по центру
      const metalLeft = (canvas.width - METAL_SHEET_WIDTH) / 2;
      const metalTop = (canvas.height - METAL_SHEET_HEIGHT) / 2;
      
      // Рисуем лист металла
      ctx.fillStyle = '#6b7280'; // gray-500
      ctx.fillRect(metalLeft, metalTop, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
      
      // Добавляем текстуру металла (градиент)
      const gradient = ctx.createLinearGradient(metalLeft, metalTop, metalLeft + METAL_SHEET_WIDTH, metalTop + METAL_SHEET_HEIGHT);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(metalLeft, metalTop, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
      
      // Рисуем шов (разрыв)
      if (gameState.seamPath && gameState.seamPath.length > 0) {
        // Область шва
        ctx.beginPath();
        
        // Верхняя граница шва
        for (let i = 0; i < gameState.seamPath.length; i++) {
          const point = gameState.seamPath[i];
          const x = metalLeft + point.x;
          const y = metalTop + point.y - SEAM_WIDTH / 2;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        // Нижняя граница шва (в обратном порядке)
        for (let i = gameState.seamPath.length - 1; i >= 0; i--) {
          const point = gameState.seamPath[i];
          const x = metalLeft + point.x;
          const y = metalTop + point.y + SEAM_WIDTH / 2;
          
          ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.fillStyle = '#374151'; // gray-700 - цвет разрыва
        ctx.fill();
        
        // Рисуем пунктирную линию паттерна
        if (gameState.patternPath && gameState.patternPath.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = '#fbbf24'; // amber-400
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]); // пунктир
      
          for (let i = 0; i < gameState.patternPath.length; i++) {
            const point = gameState.patternPath[i];
            const x = metalLeft + point.x;
            const y = metalTop + point.y;
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          
          ctx.stroke();
          ctx.setLineDash([]); // сброс пунктира
        }
      }
      
      // Рисуем точки сварки
      if (gameState.weldDots && gameState.weldDots.length > 0) {
        for (const dot of gameState.weldDots) {
          const x = metalLeft + dot.x;
          const y = metalTop + dot.y;
          
          // Градиент для точки сварки (эффект свечения)
          const weldGradient = ctx.createRadialGradient(x, y, 0, x, y, WELD_DOT_RADIUS);
          weldGradient.addColorStop(0, '#fcd34d'); // amber-300 - центр
          weldGradient.addColorStop(0.5, '#f59e0b'); // amber-500
          weldGradient.addColorStop(1, '#b45309'); // amber-700 - край
          
          ctx.beginPath();
          ctx.arc(x, y, WELD_DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = weldGradient;
          ctx.fill();
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.seamPath, gameState.patternPath, gameState.weldDots, METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT, SEAM_WIDTH, WELD_DOT_RADIUS]);

  // Получение текущего типа сварки
  const currentWeldType = WELD_TYPES.find(t => t.id === gameState.weldType);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Переход к следующему раунду
  const handleNextRound = () => {
    nextRound();
  };

  // Возврат в меню
  const handleToMenu = () => {
    resetGame();
    onGameOver();
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden bg-gray-900"
      onMouseMove={handleContainerMouseMove}
      onMouseDown={handleContainerMouseDown}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseLeave}
      style={{
        cursor: gameState.isWelding ? 'none' : 'default',
      }}
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        round={gameState.round}
        itemsOnBoard={gameState.weldQuality}
        gameTime={undefined}
        formatTime={formatTime}
        onBack={onBack}
        isGame3={true}
      />
      
      {/* Холст для отрисовки игры */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute inset-0"
      />
      
      {/* Индикатор типа сварки */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20">
        <div className="text-center">
          <div className="text-sm opacity-80 uppercase tracking-wider">Тип сварки</div>
          <div className="text-xl font-bold text-yellow-400">{currentWeldType?.name}</div>
          <div className="text-xs opacity-70 mt-1">{currentWeldType?.description}</div>
        </div>
      </div>
      
      {/* Индикатор качества заполнения */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20">
        <div className="text-center">
          <div className="text-sm opacity-80 uppercase tracking-wider">Качество шва</div>
          <div className={`text-2xl font-bold ${gameState.weldQuality >= 100 ? 'text-green-400' : 'text-yellow-400'}`}>
            {gameState.weldQuality}%
          </div>
          {/* Прогресс бар */}
          <div className="w-48 h-3 bg-gray-700 rounded-full mt-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${gameState.weldQuality >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(100, gameState.weldQuality)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Подсказка внизу */}
      {!gameState.isRoundComplete && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 text-sm">
          Зажмите ЛКМ и ведите вдоль шва для сварки
        </div>
      )}
      
      {/* Модальное окно завершения раунда */}
      {gameState.isRoundComplete && (
        <Modal
          title={`Раунд ${gameState.round} завершен!`}
          message={`Качество шва: ${gameState.weldQuality}%\nОчки за раунд: ${Math.round((currentWeldType?.points || 1000) * (gameState.weldQuality / 100))}\nОбщий счет: ${gameState.score}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={handleToMenu} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Кастомный курсор - сварочный аппарат */}
      {gameState.isWelding && (
        <div 
          className="fixed pointer-events-none z-[100]"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Визуализация сварочного аппарата */}
          <div className="relative">
            {/* Основной корпус */}
            <div className="w-12 h-16 bg-gradient-to-b from-orange-500 to-orange-700 rounded-lg shadow-lg border-2 border-orange-800">
              {/* Сопло */}
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-4 h-6 bg-gray-800 rounded-b-md"></div>
            </div>
            {/* Искры */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-8 h-8">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-3 bg-yellow-400 rounded-full animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.1}s`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game4;
