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
  const levelCompleteNotifiedRef = useRef(false);

  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Проверка на достижение цели уровня (3000 очков) - показываем уведомление, но не останавливаем игру
  useEffect(() => {
    if (level && gameState.score >= 3000 && !gameState.levelCompleteShown && !levelCompleteNotifiedRef.current) {
      levelCompleteNotifiedRef.current = true;
      // Показываем уведомление о том, что уровень пройден, но игра продолжается
      // Можно добавить визуальный эффект или toast-уведомление
      console.log('Уровень пройден!可以继续 играть для улучшения счета.');
    }
  }, [gameState.score, gameState.levelCompleteShown, level]);

  const gameLoop = (time) => {
    if (!gameState.isRunning) return;

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // Динамический расчет интервала спавна на основе текущей скорости
    // Расстояние между коробками должно оставаться фиксированным (BOX_GAP_PIXELS)
    const screenHeightPx = window.innerHeight || 800;
    const boxCenterDistancePercent = ((BOX_SIZE + BOX_GAP_PIXELS) / screenHeightPx) * 100;
    const speedPerMs = gameState.conveyorSpeed / 16.67;
    const currentSpawnRate = boxCenterDistancePercent / speedPerMs;

    // Спавн коробок с учетом текущего интервала
    if (time - lastSpawnRef.current > currentSpawnRate) {
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
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'Ф' || e.key === 'ф') {
      moveHand('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'В' || e.key === 'в') {
      moveHand('right');
    }
  };

  useEffect(() => {
    const container = gameContainerRef.current;
    if (container) {
      container.focus();
      container.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [moveHand]);

  // Фокус на контейнер при старте игры для работы клавиатуры
  useEffect(() => {
    if (gameState.isRunning && gameContainerRef.current) {
      gameContainerRef.current.focus();
    }
  }, [gameState.isRunning]);

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
      onTouchMove={handleTouchMove}
      tabIndex={0}
    >
      {/* Статистика игры с кнопкой назад */}
      <GameStats
        score={gameState.score}
        lives={gameState.lives}
        boxesFixed={gameState.boxesFixed}
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
        
        {/* Коробки */}
        {gameState.boxes.map((box) => (
          <Box
            key={box.id}
            type={box.type}
            y={box.y}
            fixed={box.fixed}
            errorAnim={box.errorAnim}
            originalType={box.originalType}
            size={BOX_SIZE}
          />
        ))}
      </div>

      {/* Рука */}
      <Hand position={gameState.handPosition} />

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
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Уведомление о прохождении уровня - индикатор слева */}
      {level && gameState.score >= 3000 && !isGameOver && (
        <div className="absolute top-1/2 left-0 transform -translate-y-1/2 z-50 bg-green-500/90 text-white px-4 py-8 rounded-r-lg shadow-lg text-center writing-vertical-lr">
          <h2 className="text-xl font-bold">🎉 Уровень пройден! 🎉</h2>
        </div>
      )}
    </div>
  );
};

export default Game;
