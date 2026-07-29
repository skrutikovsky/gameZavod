import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 140; // Размер коробки - увеличен
const HAND_POSITION_Y = 85; // Позиция руки в процентах от высоты экрана (почти внизу)
const FIX_ZONE_Y_START = 70; // Зона исправления開始 (в %) - расширена зона
const FIX_ZONE_Y_END = 85; // Зона исправления конец (в %) - расширена зона
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.35; // Базовая скорость движения коробок (% в кадр) - уменьшено для более медленной игры
const BASE_SPAWN_RATE = 400; // Интервал спавна в мс
const BELT_WIDTH_PERCENT = 25; // Ширина конвейера в % от экрана
const SPEED_INCREASE_RATE = 0.02; // Увеличение скорости каждые 5 секунд
const MIN_SPAWN_RATE = 200; // Минимальный интервал спавна
const SPEED_INCREASE_INTERVAL = 5000; // Интервал увеличения скорости в мс (5 секунд)
const MIN_BOX_DISTANCE = 18; // Минимальное расстояние между коробками в %

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
    damagedBoxes: [], // Коробки, получившие урон
    levelCompleteShown: false // Флаг показа сообщения о прохождении уровня
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
      damagedBoxes: [],
      levelCompleteShown: false
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
      y: -20, // Начинаем чуть выше видимой области (в %)
      fixed: false,
      checked: false,
      missed: false // Флаг того, что коробка была пропущена
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

      // Проверяем, находится ли коробка в зоне исправления
      if (box.y < FIX_ZONE_Y_START || box.y > FIX_ZONE_Y_END) {
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

      // Начисляем очки за поворот коробки (бонус за действие)
      const turnBonus = 50;

      return {
        ...prev,
        boxes: boxesRef.current,
        boxesFixed: prev.boxesFixed + 1,
        comboCount: newComboCount,
        multiplier: newMultiplier,
        maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
        score: prev.score + Math.floor(100 * newMultiplier) + turnBonus,
        handPosition: handPosition // Сохраняем позицию руки для консистентности
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
      let scoreGained = 0;
      let newComboCount = prev.comboCount;
      let newMultiplier = prev.multiplier;
      const newDamagedBoxes = [];

      // Сначала проверяем и исправляем коробки в зоне исправления
      boxesRef.current.forEach(box => {
        // Проверяем только наклонные коробки которые еще не исправлены
        if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed) {
          // Проверяем находится ли коробка в зоне исправления
          if (box.y >= FIX_ZONE_Y_START && box.y <= FIX_ZONE_Y_END && !box.checked) {
            const correctHand = box.type === 'tilted-left' ? 'left' : 'right';

            // Если рука в правильном положении, исправляем коробку
            if (prev.handPosition === correctHand) {
              box.fixed = true;
              box.missed = true; // Помечаем как обработанную чтобы не снимать жизнь
              
              boxesFixedThisUpdate++;
              newComboCount = prev.comboCount + boxesFixedThisUpdate;
              
              if (newComboCount >= 30) {
                newMultiplier = 2;
              } else if (newComboCount >= 10) {
                newMultiplier = 1.5;
              } else {
                newMultiplier = 1;
              }

              const turnBonus = 50; // Бонус за поворот
              scoreGained += Math.floor(100 * newMultiplier) + turnBonus;
            }
            // Помечаем что коробка была проверена в этой зоне (независимо от результата)
            box.checked = true;
          }
        }
        
        // Прямые коробки просто помечаем как проверенные когда проходят зону
        if (box.type === 'straight' && !box.checked) {
          if (box.y >= FIX_ZONE_Y_START && box.y <= FIX_ZONE_Y_END) {
            box.checked = true;
            box.missed = true;
          }
        }
      });

      // Затем обновляем позиции всех коробок
      const updatedBoxes = boxesRef.current.map(box => {
        const newY = box.y + prev.conveyorSpeed;
        return { ...box, y: newY };
      });

      // Фильтруем коробки, ушедшие за экран
      const filteredBoxes = updatedBoxes.filter(box => {
        // Коробка уходит за пределы экрана (ниже 100%)
        if (box.y > 100) {
          // Только непоправленные наклонные коробки снимают жизни
          if ((box.type === 'tilted-left' || box.type === 'tilted-right') && !box.fixed && !box.missed) {
            livesLost++;
            // Добавляем в список поврежденных коробок для отображения
            newDamagedBoxes.push({
              ...box,
              damaged: true,
              damageTime: Date.now()
            });
            // Сбрасываем комбо при потере жизни
            newComboCount = 0;
            newMultiplier = 1;
          }
          return false;
        }
        return true;
      });

      boxesRef.current = filteredBoxes;
      damagedBoxesRef.current = newDamagedBoxes;

      let newLives = prev.lives - livesLost;
      let gameOver = false;

      if (newLives <= 0) {
        newLives = 0;
        gameOver = true;
      }

      // Увеличиваем скорость со временем
      const elapsedTime = Date.now() - gameStartTimeRef.current;
      const speedIncrease = Math.min(elapsedTime / SPEED_INCREASE_INTERVAL * SPEED_INCREASE_RATE, 1.5);
      const newConveyorSpeed = BASE_CONVEYOR_SPEED * (1 + speedIncrease);
      
      // Уменьшаем интервал спавна со временем (увеличиваем сложность)
      const spawnRateDecrease = Math.min(elapsedTime / SPEED_INCREASE_INTERVAL * 50, BASE_SPAWN_RATE - MIN_SPAWN_RATE);
      const newSpawnRate = Math.max(MIN_SPAWN_RATE, BASE_SPAWN_RATE - spawnRateDecrease);

      return {
        ...prev,
        boxes: boxesRef.current,
        damagedBoxes: newDamagedBoxes,
        lives: newLives,
        boxesFixed: prev.boxesFixed + boxesFixedThisUpdate,
        comboCount: newComboCount,
        multiplier: newMultiplier,
        maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
        score: prev.score + scoreGained,
        conveyorSpeed: newConveyorSpeed,
        spawnRate: newSpawnRate,
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
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      spawnRate: BASE_SPAWN_RATE,
      levelCompleteShown: false
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
