import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 100; // Размер коробки (уменьшили)
const HAND_TOUCH_OFFSET = 50; // Расстояние касания
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 2;
const BASE_SPAWN_RATE = 800; // Увеличили интервал спавна (было 1500, теперь 800мс)
const BELT_LENGTH = 1200; // Увеличили длину ленты

export function useGame() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    lives: INITIAL_LIVES,
    boxesFixed: 0,
    gameTime: 0,
    multiplier: 1,
    comboCount: 0,
    maxMultiplier: 1,
    conveyorSpeed: BASE_CONVEYOR_SPEED,
    spawnRate: BASE_SPAWN_RATE,
    handPosition: 'left',
    boxes: [],
    lastSpawnTime: 0
  });

  const boxesRef = useRef([]);
  const lastBoxYRef = useRef(-BOX_SIZE - 50); // Последняя позиция Y спавнутой коробки

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    lastBoxYRef.current = -BOX_SIZE - 50;
    setGameState({
      isRunning: false,
      score: 0,
      lives: INITIAL_LIVES,
      boxesFixed: 0,
      gameTime: 0,
      multiplier: 1,
      comboCount: 0,
      maxMultiplier: 1,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      spawnRate: BASE_SPAWN_RATE,
      handPosition: 'left',
      boxes: [],
      lastSpawnTime: 0
    });
  }, []);

  const moveHand = useCallback((position) => {
    setGameState(prev => ({
      ...prev,
      handPosition: position
    }));
  }, []);

  const spawnBox = useCallback(() => {
    const randomType = Math.random();
    let boxType;

    if (randomType < 0.3) {
      boxType = 'straight';
    } else if (randomType < 0.65) {
      boxType = 'tilted-left';
    } else {
      boxType = 'tilted-right';
    }

    // Спавним коробку только если последняя коробка отошла достаточно далеко
    const minY = boxesRef.current.length > 0 
      ? Math.min(...boxesRef.current.map(b => b.y))
      : 0;
    
    // Минимальное расстояние между коробками
    const minDistance = BOX_SIZE + 30;
    
    if (minY < minDistance) {
      return null; // Не спавним, слишком близко к предыдущей коробке
    }

    const newBox = {
      id: Date.now() + Math.random(),
      type: boxType,
      y: -BOX_SIZE, // Начинаем чуть выше видимой области
      fixed: false,
      checked: false
    };

    boxesRef.current = [...boxesRef.current, newBox];
    
    setGameState(prev => ({
      ...prev,
      boxes: boxesRef.current,
      lastSpawnTime: prev.lastSpawnTime
    }));

    return newBox;
  }, []);

  const fixBox = useCallback((boxId, handPosition) => {
    setGameState(prev => {
      const box = boxesRef.current.find(b => b.id === boxId);
      if (!box || box.fixed || box.checked) {
        return prev;
      }

      // Проверяем, правильно ли расположена рука для этой коробки
      // tilted-left нужно исправлять справа (right)
      // tilted-right нужно исправлять слева (left)
      const correctHand = box.type === 'tilted-left' ? 'right' : 'left';
      
      if (handPosition !== correctHand) {
        return prev;
      }

      boxesRef.current = boxesRef.current.map(b =>
        b.id === boxId
          ? { ...b, fixed: true, checked: true, type: 'straight' }
          : b
      );

      const newComboCount = prev.comboCount + 1;
      let newMultiplier = 1;

      if (newComboCount >= 30) {
        newMultiplier = 2;
      } else if (newComboCount >= 10) {
        newMultiplier = 1.5;
      }

      return {
        ...prev,
        boxes: boxesRef.current,
        boxesFixed: prev.boxesFixed + 1,
        comboCount: newComboCount,
        multiplier: newMultiplier,
        maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
        score: prev.score + Math.floor(100 * newMultiplier)
      };
    });
  }, []);

  const loseLife = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      lives: prev.lives - 1,
      comboCount: 0,
      multiplier: 1
    }));
  }, []);

  const updateBoxes = useCallback((beltHeight, deltaTime) => {
    setGameState(prev => {
      // Зона исправления - где рука может исправить коробку
      const fixZoneStart = beltHeight - 200;
      const fixZoneEnd = beltHeight - 50;
      
      let livesLost = 0;
      let boxesFixedThisUpdate = 0;

      const updatedBoxes = boxesRef.current
        .map(box => {
          const newY = box.y + prev.conveyorSpeed;

          // Проверяем, находится ли коробка в зоне исправления
          if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.checked) {
            if (newY >= fixZoneStart && newY <= fixZoneEnd) {
              const correctHand = box.type === 'tilted-left' ? 'right' : 'left';

              // Если рука в правильном положении, автоматически исправляем коробку
              if (prev.handPosition === correctHand) {
                const newComboCount = prev.comboCount + 1;
                let newMultiplier = 1;

                if (newComboCount >= 30) {
                  newMultiplier = 2;
                } else if (newComboCount >= 10) {
                  newMultiplier = 1.5;
                }

                boxesFixedThisUpdate++;

                return {
                  ...box,
                  y: newY,
                  fixed: true,
                  checked: true,
                  type: 'straight'
                };
              }
            }
          }

          return { ...box, y: newY };
        })
        .filter(box => {
          // Коробка уходит за пределы ленты
          if (box.y > beltHeight) {
            // Только непоправленные наклонные коробки снимают жизни
            if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.checked) {
              livesLost++;
            }
            return false;
          }
          return true;
        });

      boxesRef.current = updatedBoxes;

      let newLives = prev.lives - livesLost;
      let gameOver = false;

      if (newLives <= 0) {
        newLives = 0;
        gameOver = true;
      }

      return {
        ...prev,
        boxes: boxesRef.current,
        lives: newLives,
        boxesFixed: prev.boxesFixed + boxesFixedThisUpdate,
        comboCount: livesLost > 0 ? 0 : prev.comboCount,
        multiplier: livesLost > 0 ? 1 : prev.multiplier,
        isRunning: !gameOver
      };
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    boxesRef.current = [];
    lastBoxYRef.current = -BOX_SIZE - 50;
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      lastSpawnTime: performance.now(),
      boxes: []
    }));
  }, [resetGame]);

  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);
  
  // Остановить игру при достижении цели (для уровней)
  const completeLevel = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  return {
    gameState,
    setGameState,
    moveHand,
    fixBox,
    loseLife,
    updateBoxes,
    spawnBox,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BOX_SIZE,
    BELT_LENGTH
  };
}
