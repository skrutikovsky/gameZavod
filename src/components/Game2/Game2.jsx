import React, { useEffect, useRef } from 'react';
import { useGame2, HAND_STOP_LINE_Y } from '../../hooks/useGame2.js';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const BOX_SIZE = 120; // Размер коробки в пикселях (увеличен для квадратной формы)

const Game2 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setHandActive,
    spawnBox,
    updateBoxes,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y,
    HAND_POSITION_X,
    LEVER_POSITION_X,
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
    if (time - lastSpawnTimeRef.current > currentSpawnRate) {
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
  }, [gameState.isRunning]);

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      setHandActive(true);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      setHandActive(false);
    }
  };

  useEffect(() => {
    const container = gameContainerRef.current;
    if (container) {
      // Гарантированно устанавливаем фокус с небольшой задержкой
      const focusTimeout = setTimeout(() => {
        container.focus({ preventScroll: true });
      }, 100);
      
      container.addEventListener('keydown', handleKeyDown);
      container.addEventListener('keyup', handleKeyUp);
      
      // Также устанавливаем фокус при клике на контейнер
      const handleClick = () => {
        container.focus();
      };
      container.addEventListener('click', handleClick);
      
      return () => {
        clearTimeout(focusTimeout);
        container.removeEventListener('keydown', handleKeyDown);
        container.removeEventListener('keyup', handleKeyUp);
        container.removeEventListener('click', handleClick);
      };
    }
  }, [setHandActive]);

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
            className={`absolute left-1/2 transform -translate-x-1/2 rounded-lg flex items-center justify-center border-4 shadow-lg ${gameState.containerErrorAnim ? 'container-error-anim bg-blue-600 border-blue-800' : 'bg-blue-600 border-blue-800'}`}
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
            className="absolute left-1/2 transform -translate-x-1/2 bg-yellow-600 shadow-md border-2 border-yellow-800 flex items-center justify-center"
            style={{
              top: `${box.y}%`,
              width: `${BOX_SIZE}px`,
              height: `${BOX_SIZE}px`,
            }}
          >
            {box.isInChainGroup && (
              <div className="text-white text-2xl font-bold">🔗</div>
            )}
          </div>
        ))}
        
        {/* Видимая линия остановки */}
        <div 
          className="absolute left-0 right-0 border-t-4 border-dashed border-red-500 opacity-70"
          style={{
            top: `${HAND_STOP_LINE_Y}%`
          }}
        >
          <span className="absolute right-2 -top-5 text-xs text-red-500 font-bold">STOP</span>
        </div>
      </div>

      {/* Рычаг вместо руки - визуальный индикатор слева от конвейера */}
      <div 
        className="absolute"
        style={{
          left: `${LEVER_POSITION_X}%`,
          top: `${HAND_POSITION_Y}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        {/* Основание рычага */}
        <div className="relative w-16 h-24">
          {/* База */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-4 bg-gray-700 rounded"></div>
          {/* Стойка */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-3 h-12 bg-gray-600 rounded"></div>
          {/* Поворотная часть */}
          <div 
            className={`absolute bottom-14 left-1/2 transform -translate-x-1/2 origin-bottom transition-transform duration-150 ${gameState.handActive ? 'rotate-[-30deg]' : 'rotate-[30deg]'}`}
          >
            {/* Ручка рычага */}
            <div className="w-4 h-16 bg-red-600 rounded-full border-2 border-red-800 shadow-lg flex items-center justify-center">
              {/* Шар на конце */}
              <div className="absolute -top-3 w-6 h-6 bg-red-500 rounded-full border-2 border-red-700 shadow-md"></div>
            </div>
          </div>
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
      
    </div>
  );
};

export default Game2;
