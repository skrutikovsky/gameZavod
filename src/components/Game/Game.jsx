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
    BELT_LENGTH
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

    updateBoxes(BELT_LENGTH, deltaTime);

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

  const handleMouseMove = (e) => {
    const containerRect = gameContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const centerX = containerRect.left + containerRect.width / 2;
    
    if (e.clientX < centerX) {
      moveHand('left');
    } else {
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
  
  // Для мини-игры показываем кнопку "Назад в меню" всегда
  const showBackButton = !level || isGameOver;

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Кнопка назад в меню (видима только в мини-игре) */}
      {showBackButton && !isGameOver && (
        <button
          onClick={onBack}
          className="absolute top-20 left-5 z-40 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
        >
          ←
        </button>
      )}
      
      {/* Конвейерная лента */}
      <div 
        className="conveyor-belt absolute left-1/2 transform -translate-x-1/2"
        style={{
          width: '400px',
          height: `${BELT_LENGTH}px`,
          top: '0'
        }}
      >
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
      />

      {/* Модальное окно конца игры */}
      {isGameOver && (
        <Modal
          title="Игра окончена!"
          message={`Счет: ${gameState.score}\nИсправлено коробок: ${gameState.boxesFixed}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Играть снова
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              Меню уровней
            </Button>
            <Button onClick={onBack} variant="outline">
              Главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Сообщение о победе для уровней */}
      {level && gameState.boxesFixed >= 10 && !isGameOver && (
        <Modal
          title="Уровень пройден!"
          message={`Счет: ${gameState.score}\nИсправлено коробок: ${gameState.boxesFixed}`}
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
