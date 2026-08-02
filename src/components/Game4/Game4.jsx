import React, { useEffect, useRef, useState } from 'react';
import { useGame4 } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    canvasRef,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    startGame,
    stopGame,
    nextRound,
    resetGame,
    WELD_TYPES,
    QUALITY_THRESHOLD
  } = useGame4();

  const gameContainerRef = useRef(null);
  const cursorRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState({ x: -100, y: -100 });

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Обработчики мыши для контейнера
  const onMouseDown = (e) => {
    handleMouseDown();
  };

  const onMouseUp = (e) => {
    handleMouseUp();
  };

  const onMouseMove = (e) => {
    // Обновляем позицию курсора
    setCursorPosition({ x: e.clientX, y: e.clientY });
    handleMouseMove(e.clientX, e.clientY);
  };

  // Обработчики touch для мобильных
  const onTouchStart = (e) => {
    e.preventDefault();
    handleMouseDown();
  };

  const onTouchEnd = (e) => {
    e.preventDefault();
    handleMouseUp();
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleMouseMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const handleNextRound = () => {
    nextRound();
  };

  const isGameOver = gameState.roundComplete && gameState.score >= 5000; // Условие завершения игры

  // Автоматический переход к следующему раунду
  useEffect(() => {
    if (gameState.roundComplete && !isGameOver) {
      const timer = setTimeout(() => {
        nextRound();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [gameState.roundComplete, isGameOver, nextRound]);

  // Показываем модальное окно при завершении раунда
  const showRoundCompleteModal = gameState.roundComplete;

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      style={{ cursor: 'none' }}
    >
      {/* Статистика игры */}
      <GameStats
        score={gameState.score}
        lives={3}
        multiplier={1}
        boxesFixed={gameState.round}
        comboCount={0}
        gameTime={0}
        formatTime={() => ''}
        onBack={onBack}
        round={gameState.round}
        itemsOnBoard={Math.round(gameState.weldProgress)}
        isGame3={true}
      />

      {/* Canvas для рендеринга игры */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{
          cursor: 'none'
        }}
      />

      {/* Курсор-сварочный аппарат */}
      <div 
        ref={cursorRef}
        className="pointer-events-none fixed z-50"
        style={{
          left: `${cursorPosition.x}px`,
          top: `${cursorPosition.y}px`,
          transform: 'translate(-50%, -50%)',
          width: '60px',
          height: '60px'
        }}
      >
        {/* Визуализация сварочного аппарата */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Корпус аппарата */}
          <rect x="20" y="30" width="50" height="40" fill="#4a5568" stroke="#2d3748" strokeWidth="3"/>
          <rect x="25" y="35" width="40" height="30" fill="#718096"/>
          
          {/* Рукоятка */}
          <rect x="60" y="40" width="30" height="15" fill="#2d3748" rx="3"/>
          
          {/* Сопло */}
          <polygon points="15,45 25,47 25,53 15,55" fill="#a0aec0"/>
          
          {/* Искра при сварке */}
          {gameState.isWelding && (
            <>
              <circle cx="10" cy="50" r="5" fill="#ffff00" opacity="0.8">
                <animate attributeName="r" values="3;6;3" dur="0.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.2s" repeatCount="indefinite"/>
              </circle>
              <circle cx="8" cy="48" r="3" fill="#ffffff" opacity="0.6">
                <animate attributeName="r" values="2;4;2" dur="0.15s" repeatCount="indefinite"/>
              </circle>
            </>
          )}
        </svg>
      </div>

      {/* Индикатор качества и прогресса */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-4 rounded-xl backdrop-blur-sm border border-white/20">
        <div className="flex flex-col items-center gap-2">
          <div className="text-lg font-bold">
            Тип шва: <span className="text-yellow-400">{gameState.currentWeldType?.name || '...'}</span>
          </div>
          <div className="flex gap-8 text-sm">
            <div>
              <span className="opacity-70">Заполнение:</span>{' '}
              <span className={`font-bold ${gameState.weldProgress >= 100 ? 'text-green-400' : 'text-blue-400'}`}>
                {gameState.weldProgress.toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="opacity-70">Качество паттерна:</span>{' '}
              <span className={`font-bold ${gameState.patternProgress >= 70 ? 'text-green-400' : 'text-purple-400'}`}>
                {gameState.patternProgress.toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="opacity-70">Итоговое качество:</span>{' '}
              <span className={`font-bold ${gameState.qualityPercent >= 85 ? 'text-green-400' : gameState.qualityPercent >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {gameState.qualityPercent.toFixed(0)}%
              </span>
            </div>
          </div>
          {/* Прогресс бар заполнения */}
          <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden mt-2">
            <div 
              className={`h-full transition-all duration-300 ${
                gameState.weldProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${gameState.weldProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Модальное окно завершения раунда */}
      {showRoundCompleteModal && (
        <Modal
          title="Раунд завершен!"
          message={`Качество сварки: ${gameState.qualityPercent.toFixed(0)}%\nОчки за раунд: ${Math.round((gameState.currentWeldType?.basePoints || 1000) * (gameState.qualityPercent / 100))}`}
        >
          <div className="space-y-4">
            <Button onClick={handleNextRound} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}

      {/* Подсказка в начале */}
      {!gameState.isWelding && gameState.weldProgress === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center bg-black/60 px-6 py-4 rounded-xl backdrop-blur-sm pointer-events-none">
          <p className="text-xl font-bold mb-2">Зажми ЛКМ и веди вдоль пунктирной линии</p>
          <p className="text-sm opacity-80">Следуй паттерну для максимального качества!</p>
        </div>
      )}
    </div>
  );
};

export default Game4;
