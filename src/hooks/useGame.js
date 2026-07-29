import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 240; // Увеличенный размер коробки (в 2 раза больше)
const HAND_TOUCH_OFFSET = 120; // Увеличенное расстояние касания (в 2 раза больше)
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 2;
const BASE_SPAWN_RATE = 1500;

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

  const resetGame = useCallback(() => {
    boxesRef.current = [];
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

    const newBox = {
      id: Date.now() + Math.random(),
      type: boxType,
      y: 60,
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
      // Зона исправления - увеличена в 2 раза
      const fixZoneStart = beltHeight - 360; // Увеличено с 180 до 360
      const fixZoneEnd = beltHeight - 120;   // Увеличено с 60 до 120
      
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
          if (box.y > beltHeight - 20) {
            if (box.type === 'tilted-left' || box.type === 'tilted-right') {
              // Только непоправленные коробки снимают жизни
              if (!box.fixed && !box.checked) {
                livesLost++;
              }
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
    resetGame
  };
}
