import React, { useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import { Box } from '../UI/Box';
import { Hand } from '../UI/Hand';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const Game = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    moveHand,
    updateBoxes,
    spawnBox,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BOX_SIZE,
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y
  } = useGame();

  const gameContainerRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(0);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Проверка на победу (для уровней) - останавливаем игру при достижении цели
  useEffect(() => {
    if (level && gameState.boxesFixed >= 10 && gameState.isRunning) {
      completeLevel();
    }
  }, [gameState.boxesFixed, gameState.isRunning, level, completeLevel]);

  const gameLoop = (time) => {
    if (!gameState.isRunning) return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Спавн коробок с учетом времени и расстояния между ними
    if (time - lastSpawnRef.current > gameState.spawnRate) {
      spawnBox();
      lastSpawnRef.current = time;
    }

    updateBoxes(deltaTime);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState.isRunning) {
      lastTimeRef.current = performance.now();
      lastSpawnRef.current = performance.now();
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
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'Ф') {
      moveHand('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'В') {
      moveHand('right');
    }
  };

  const handleTouchMove = (e) => {
    const containerRect = gameContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const centerX = containerRect.left + containerRect.width / 2;
    const touchX = e.touches[0].clientX;
    
    if (touchX < centerX) {
      moveHand('left');
    } else {
      moveHand('right');
    }
  };

  const handleRestart = () => {
    resetGame();
    startGame();
  };

  const isGameOver = gameState.lives <= 0;

  // Форматирование времени
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
      onKeyDown={handleKeyDown}
      onTouchMove={handleTouchMove}
      tabIndex={0}
    >
      {/* Кнопка назад в меню */}
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-40 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
      >
        ←
      </button>
      
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
        
        {/* Коробки */}
        {gameState.boxes.map((box) => (
          <Box
            key={box.id}
            type={box.type}
            y={box.y}
            fixed={box.fixed}
            size={BOX_SIZE}
          />
        ))}
      </div>

      {/* Рука */}
      <Hand position={gameState.handPosition} />

      {/* Статистика игры */}
      <GameStats
        score={gameState.score}
        lives={gameState.lives}
        boxesFixed={gameState.boxesFixed}
        multiplier={gameState.multiplier}
        comboCount={gameState.comboCount}
        gameTime={gameState.gameTime}
        formatTime={formatTime}
      />

      {/* Модальное окно конца игры */}
      {isGameOver && (
        <Modal
          title="Игра окончена!"
          message={`Время: ${formatTime(gameState.gameTime)}\nСчёт: ${gameState.score}\nИсправлено коробок: ${gameState.boxesFixed}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Рестарт
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              Выйти в выбор уровней
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Сообщение о победе для уровней */}
      {level && gameState.boxesFixed >= 10 && !isGameOver && (
        <Modal
          title="Уровень пройден!"
          message={`Время: ${formatTime(gameState.gameTime)}\nСчёт: ${gameState.score}\nИсправлено коробок: ${gameState.boxesFixed}`}
        >
          <div className="space-y-4">
            <Button onClick={() => onLevelComplete(level)} variant="success">
              Продолжить
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Game;
