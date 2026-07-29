import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 100; // Размер коробки
const HAND_POSITION_Y = 85; // Позиция руки в процентах от высоты экрана (почти внизу)
const FIX_ZONE_Y_START = 75; // Зона исправления開始 (в %)
const FIX_ZONE_Y_END = 82; // Зона исправления конец (в %)
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.15; // Скорость движения коробок (% в кадр)
const BASE_SPAWN_RATE = 1200; // Интервал спавна в мс
const BELT_WIDTH_PERCENT = 40; // Ширина конвейера в % от экрана

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
    handPosition: 'left', // 'left' или 'right'
    boxes: [],
    lastSpawnTime: 0,
    damagedBoxes: [] // Коробки, получившие урон
  });

  const boxesRef = useRef([]);
  const damagedBoxesRef = useRef([]);
  const gameStartTimeRef = useRef(0);

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    damagedBoxesRef.current = [];
    gameStartTimeRef.current = 0;
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
      lastSpawnTime: 0,
      damagedBoxes: []
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

    // Проверяем минимальное расстояние между коробками
    const minDistance = 15; // Минимальное расстояние в %
    const lowestBox = boxesRef.current.length > 0 
      ? Math.max(...boxesRef.current.map(b => b.y))
      : -100;
    
    if (lowestBox > minDistance) {
      return null; // Не спавним, слишком близко к предыдущей коробке
    }

    const newBox = {
      id: Date.now() + Math.random(),
      type: boxType,
      y: -10, // Начинаем чуть выше видимой области (в %)
      fixed: false,
      checked: false,
      damaged: false
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
      // tilted-left нужно исправлять когда рука слева (left)
      // tilted-right нужно исправлять когда рука справа (right)
      const correctHand = box.type === 'tilted-left' ? 'left' : 'right';
      
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

  const updateBoxes = useCallback((deltaTime) => {
    setGameState(prev => {
      let livesLost = 0;
      let boxesFixedThisUpdate = 0;
      const newDamagedBoxes = [];

      const updatedBoxes = boxesRef.current
        .map(box => {
          const newY = box.y + prev.conveyorSpeed;

          // Проверяем, находится ли коробка в зоне исправления
          if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.checked) {
            if (newY >= FIX_ZONE_Y_START && newY <= FIX_ZONE_Y_END) {
              const correctHand = box.type === 'tilted-left' ? 'left' : 'right';

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
          // Коробка уходит за пределы экрана (ниже 100%)
          if (box.y > 100) {
            // Только непоправленные наклонные коробки снимают жизни
            if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.checked) {
              livesLost++;
              // Добавляем в список поврежденных коробок для отображения
              newDamagedBoxes.push({
                ...box,
                damaged: true,
                damageTime: Date.now()
              });
            }
            return false;
          }
          return true;
        });

      boxesRef.current = updatedBoxes;
      damagedBoxesRef.current = newDamagedBoxes;

      let newLives = prev.lives - livesLost;
      let gameOver = false;

      if (newLives <= 0) {
        newLives = 0;
        gameOver = true;
      }

      // Увеличиваем скорость со временем
      const elapsedTime = Date.now() - gameStartTimeRef.current;
      const speedIncrease = Math.min(elapsedTime / 60000, 1.5); // Максимум +50% скорости за минуту
      const newConveyorSpeed = BASE_CONVEYOR_SPEED * (1 + speedIncrease);

      return {
        ...prev,
        boxes: boxesRef.current,
        damagedBoxes: newDamagedBoxes,
        lives: newLives,
        boxesFixed: prev.boxesFixed + boxesFixedThisUpdate,
        comboCount: livesLost > 0 ? 0 : prev.comboCount,
        multiplier: livesLost > 0 ? 1 : prev.multiplier,
        conveyorSpeed: newConveyorSpeed,
        isRunning: !gameOver,
        gameTime: elapsedTime
      };
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    boxesRef.current = [];
    damagedBoxesRef.current = [];
    gameStartTimeRef.current = Date.now();
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      lastSpawnTime: performance.now(),
      boxes: [],
      damagedBoxes: [],
      gameTime: 0,
      conveyorSpeed: BASE_CONVEYOR_SPEED
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
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y
  };
}
