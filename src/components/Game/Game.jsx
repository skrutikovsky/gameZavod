import React, { useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import { Box } from '../UI/Box';
import { Hand } from '../UI/Hand';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const BOX_SIZE = 240; // Увеличенный размер коробки (в 2 раза больше)
const HAND_TOUCH_OFFSET = 60; // Увеличенное расстояние касания (в 2 раза больше)

const Game = ({ level, onGameOver, onBack }) => {
  const {
    gameState,
    moveHand,
    updateBoxes,
    spawnBox,
    startGame,
    stopGame,
    resetGame
  } = useGame();

  const gameContainerRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(0);

  const beltHeight = 600;

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

    if (time - gameState.lastSpawnTime > gameState.spawnRate) {
      const newBox = spawnBox();
      // Добавляем новую коробку в массив
    }

    updateBoxes(beltHeight, deltaTime);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState.isRunning) {
      lastTimeRef.current = performance.now();
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
  }, [gameState.isRunning, gameState.lastSpawnTime]);

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

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Конвейерная лента */}
      <div 
        className="conveyor-belt absolute left-1/2 transform -translate-x-1/2"
        style={{
          width: '400px',
          height: `${beltHeight}px`,
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
    </div>
  );
};

export default Game;
