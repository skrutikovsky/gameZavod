import React, { useEffect, useRef } from 'react';
import { useGame2 } from '../../hooks/useGame2';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const BOX_SIZE = 100; // Размер коробки в пикселях

const Game2 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    moveHand,
    setHandActive,
    spawnBox,
    updateBoxes,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y,
    conveyorSpeedRef,
    lastSpawnTimeRef
  } = useGame2();

  const gameContainerRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  const gameLoop = (time) => {
    if (!gameState.isRunning) return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Спавн коробок с фиксированным интервалом
    const currentSpeed = conveyorSpeedRef.current;
    const screenHeightPx = window.innerHeight || 800;
    const boxCenterDistancePercent = ((BOX_SIZE + 10) / screenHeightPx) * 100;
    const speedPerMs = currentSpeed / 16.67;
    const currentSpawnRate = boxCenterDistancePercent / speedPerMs;

    // Не спавним новые коробки если лента остановлена
    if (!gameState.beltStopped && time - lastSpawnTimeRef.current > currentSpawnRate) {
      spawnBox();
      lastSpawnTimeRef.current = time;
    }

    updateBoxes();

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState.isRunning) {
      lastTimeRef.current = performance.now();
      lastSpawnTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState.isRunning, gameState.beltStopped]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'Ф' || e.key === 'ф') {
      moveHand('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'В' || e.key === 'в') {
      moveHand('right');
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      setHandActive(true);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      setHandActive(false);
      // Сбрасываем stopped у всех коробок при отпускании руки
      // Это будет обработано в хуке при следующем обновлении
    }
  };

  useEffect(() => {
    const container = gameContainerRef.current;
    if (container) {
      container.focus();
      container.addEventListener('keydown', handleKeyDown);
      container.addEventListener('keyup', handleKeyUp);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
        container.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [moveHand, setHandActive]);

  useEffect(() => {
    if (gameState.isRunning && gameContainerRef.current) {
      gameContainerRef.current.focus();
    }
  }, [gameState.isRunning]);

  // Обработка мыши
  const handleMouseDown = () => {
    setHandActive(true);
  };

  const handleMouseUp = () => {
    setHandActive(false);
  };

  const handleTouchStart = () => {
    setHandActive(true);
  };

  const handleTouchEnd = () => {
    setHandActive(false);
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const isGameOver = gameState.lives <= 0;

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        lives={gameState.lives}
        boxesFixed={gameState.containersClosed}
        multiplier={gameState.multiplier}
        comboCount={gameState.comboCount}
        gameTime={gameState.gameTime}
        formatTime={formatTime}
        onBack={onBack}
      />
      
      {/* Конвейерная лента - вертикальная по центру */}
      <div 
        className="conveyor-belt absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0"
        style={{
          width: `${BELT_WIDTH_PERCENT}%`
        }}
      >
        {/* Лючок сверху */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-gray-700 to-gray-800 border-b-4 border-gray-600">
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-gray-900"></div>
        </div>
        
        {/* Контейнер внизу */}
        {gameState.container && !gameState.containerSpawning && (
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 bg-blue-600 rounded-lg flex items-center justify-center border-4 border-blue-800 shadow-lg"
            style={{
              top: `${gameState.container.y}%`,
              width: '80%',
              height: '80px',
            }}
          >
            <span className="text-white text-3xl font-bold">
              {gameState.container.count} / {gameState.container.capacity}
            </span>
          </div>
        )}
        
        {/* Индикатор появления контейнера */}
        {gameState.containerSpawning && (
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 bg-gray-500/50 rounded-lg flex items-center justify-center border-4 border-gray-600 animate-pulse"
            style={{
              top: `${88}%`,
              width: '80%',
              height: '80px',
            }}
          >
            <span className="text-white text-xl font-bold">...</span>
          </div>
        )}
        
        {/* Коробки */}
        {gameState.boxes.map((box) => (
          <div
            key={box.id}
            className={`absolute left-1/2 transform -translate-x-1/2 bg-yellow-600 rounded-md border-2 border-yellow-800 shadow-md ${box.stopped ? 'opacity-80' : ''}`}
            style={{
              top: `${box.y}%`,
              width: `${BOX_SIZE}px`,
              height: `${BOX_SIZE}px`,
            }}
          />
        ))}
      </div>

      {/* Рука */}
      <div 
        className={`absolute transition-all duration-100 ${gameState.handPosition === 'left' ? 'left-[35%]' : 'left-[55%]'}`}
        style={{
          top: `${HAND_POSITION_Y}%`,
        }}
      >
        <div className={`w-24 h-24 bg-red-500 rounded-full border-4 border-red-700 shadow-lg flex items-center justify-center ${gameState.handActive ? 'scale-110 bg-red-600' : ''}`}>
          <span className="text-white text-2xl">🖐️</span>
        </div>
      </div>

      {/* Модальное окно конца игры */}
      {isGameOver && (
        <Modal
          title="Игра окончена!"
          message={`Время: ${formatTime(gameState.gameTime)}\nСчёт: ${gameState.score}\nЗакрыто контейнеров: ${gameState.containersClosed}`}
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
      
      {/* Индикатор остановки ленты */}
      {gameState.beltStopped && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-red-500/90 text-white px-6 py-4 rounded-lg shadow-lg text-center">
          <h2 className="text-xl font-bold">⚠️ Лента переполнена!</h2>
          <p className="text-sm mt-2">Отпустите руку чтобы продолжить</p>
        </div>
      )}
    </div>
  );
};

export default Game2;
