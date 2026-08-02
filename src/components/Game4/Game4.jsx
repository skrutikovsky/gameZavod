import React, { useEffect, useRef, useState } from 'react';
import { useGame4 } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    stopGame,
    resetGame,
    handleWelding,
    checkRoundComplete,
    nextRound,
    getWeldTypeName,
    getWeldInstruction,
    seamPointsRef,
    patternPointsRef,
    METAL_SHEET_WIDTH_PERCENT,
    METAL_SHEET_HEIGHT_PERCENT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
    POINTS_FOR_TYPES
  } = useGame4();

  const gameContainerRef = useRef(null);
  const isMousePressedRef = useRef(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Проверка завершения раунда
  useEffect(() => {
    if (gameState.isRunning && !gameState.roundComplete) {
      checkRoundComplete();
    }
  }, [gameState.seamFillPercent, gameState.isRunning, gameState.roundComplete]);

  const handleMouseDown = (e) => {
    isMousePressedRef.current = true;
    handleWelding(e.clientX, e.clientY, true);
  };

  const handleMouseUp = () => {
    isMousePressedRef.current = false;
  };

  const handleMouseMove = (e) => {
    setCursorPosition({ x: e.clientX, y: e.clientY });
    
    if (isMousePressedRef.current) {
      handleWelding(e.clientX, e.clientY, true);
    }
  };

  const handleMouseEnter = () => {
    setShowCursor(true);
  };

  const handleMouseLeave = () => {
    setShowCursor(false);
    isMousePressedRef.current = false;
  };

  const handleTouchStart = (e) => {
    isMousePressedRef.current = true;
    const touch = e.touches[0];
    handleWelding(touch.clientX, touch.clientY, true);
  };

  const handleTouchEnd = () => {
    isMousePressedRef.current = false;
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    setCursorPosition({ x: touch.clientX, y: touch.clientY });
    
    if (isMousePressedRef.current) {
      handleWelding(touch.clientX, touch.clientY, true);
    }
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleNextRound = () => {
    nextRound();
  };

  const handleFinishGame = () => {
    onLevelComplete(level);
  };

  const isGameOver = gameState.gameOver;

  // Отрисовка листа металла
  const renderMetalSheet = () => {
    const seamPoints = seamPointsRef.current;
    const patternPoints = patternPointsRef.current;
    const weldDots = gameState.weldDots;

    return (
      <div className="relative w-full h-full">
        {/* Лист металла */}
        <div 
          className="absolute bg-gradient-to-br from-gray-400 to-gray-600 border-4 border-gray-700 shadow-2xl"
          style={{
            width: `${METAL_SHEET_WIDTH_PERCENT}%`,
            height: `${METAL_SHEET_HEIGHT_PERCENT}%`,
            left: `${(100 - METAL_SHEET_WIDTH_PERCENT) / 2}%`,
            top: '80px'
          }}
        >
          {/* Текстура металла */}
          <div className="absolute inset-0 opacity-30" 
               style={{
                 backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
               }}
          />
          
          {/* Разрыв (шов) */}
          {seamPoints.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Область шва */}
              <path
                d={generateSmoothPath(seamPoints, SEAM_WIDTH / 2)}
                fill="none"
                stroke="#1a1a2e"
                strokeWidth={SEAM_WIDTH}
                strokeLinecap="round"
                opacity="0.5"
              />
              
              {/* Пунктирная линия паттерна */}
              {patternPoints.length > 0 && (
                <path
                  d={generateSmoothPath(patternPoints, 0)}
                  fill="none"
                  stroke="#ff6b6b"
                  strokeWidth="3"
                  strokeDasharray="8,8"
                  strokeLinecap="round"
                  opacity="0.8"
                />
              )}
              
              {/* Точки сварки */}
              {weldDots.map((dot) => (
                <circle
                  key={dot.id}
                  cx={dot.x - parseFloat(((100 - METAL_SHEET_WIDTH_PERCENT) / 2 * window.innerWidth) / 100)}
                  cy={dot.y - 80}
                  r={WELD_DOT_RADIUS}
                  fill="#ffa500"
                  stroke="#ff8c00"
                  strokeWidth="2"
                  opacity="0.9"
                />
              ))}
            </svg>
          )}
        </div>
      </div>
    );
  };

  // Генерация плавного пути по точкам
  const generateSmoothPath = (points, halfWidth) => {
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden bg-gray-900"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      tabIndex={0}
      style={{
        cursor: showCursor ? 'none' : 'default'
      }}
    >
      {/* Кастомный курсор - сварочный аппарат */}
      {showCursor && (
        <div
          className="fixed pointer-events-none z-50 transition-transform duration-75"
          style={{
            left: cursorPosition.x,
            top: cursorPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative">
            {/* Основной корпус сварочного аппарата */}
            <div className="w-16 h-20 bg-gradient-to-b from-orange-600 to-orange-800 rounded-lg shadow-lg border-2 border-orange-900">
              {/* Дисплей */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-10 h-6 bg-black rounded border border-gray-600">
                <div className="w-full h-full flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${isMousePressedRef.current ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
                </div>
              </div>
              {/* Кабель */}
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-3 h-8 bg-gray-800 rounded"></div>
              {/* Горелка */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-10 bg-gradient-to-b from-gray-700 to-gray-900 rounded-b-lg">
                {/* Сопло */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-3 bg-copper-600 rounded-b-lg" style={{ backgroundColor: '#b87333' }}></div>
              </div>
            </div>
            {/* Искра при нажатии */}
            {isMousePressedRef.current && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                <div className="w-8 h-8 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Статистика игры */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-4 py-3 bg-black/60 text-white text-xl w-full z-30 backdrop-blur-sm border-b border-white/20">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-xl font-bold transition-all mr-4 flex-shrink-0"
        >
          ←
        </button>
        
        <div className="flex-1 flex justify-center gap-6 flex-wrap">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Счёт</span>
            <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">{gameState.score}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Раунд</span>
            <span className="text-2xl font-bold text-blue-400 drop-shadow-lg">{gameState.round}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Тип сварки</span>
            <span className="text-2xl font-bold text-purple-400 drop-shadow-lg">{getWeldTypeName(gameState.currentWeldType)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Заполнение</span>
            <span className="text-2xl font-bold text-green-400 drop-shadow-lg">{gameState.seamFillPercent.toFixed(1)}%</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Качество</span>
            <span className={`text-2xl font-bold drop-shadow-lg ${
              gameState.qualityPercent >= 80 ? 'text-green-400' : 
              gameState.qualityPercent >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>{gameState.qualityPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Инструкция */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-6 py-3 rounded-lg backdrop-blur-sm z-20">
        <p className="text-lg font-semibold">
          {getWeldInstruction(gameState.currentWeldType)}
        </p>
        <p className="text-sm opacity-80 mt-1">
          Очки за тип: {POINTS_FOR_TYPES[gameState.currentWeldType]}
        </p>
      </div>

      {/* Игровое поле */}
      {renderMetalSheet()}

      {/* Модальное окно результата раунда */}
      {gameState.showRoundResult && (
        <Modal
          title={`Раунд ${gameState.round} завершен!`}
          message={`Заполнение: ${gameState.seamFillPercent.toFixed(1)}%\nКачество: ${gameState.qualityPercent.toFixed(1)}%\nОчки: ${gameState.roundScore}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={handleFinishGame} variant="success">
              Завершить игру
            </Button>
          </div>
        </Modal>
      )}

      {/* Модальное окно конца игры */}
      {isGameOver && (
        <Modal
          title="Игра окончена!"
          message={`Общий счёт: ${gameState.score}\nРаундов пройдено: ${gameState.round}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Рестарт
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Game4;
