import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 100; // Размер коробки в пикселях
const HAND_POSITION_Y = 78; // Позиция руки в процентах от высоты экрана
const HAND_POSITION_X = 25; // Позиция руки по горизонтали (слева) в %
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.25; // Базовая скорость конвейера
const BELT_WIDTH_PERCENT = 25; // Ширина конвейера в % от экрана
const MAX_BOXES_ON_BELT = 8; // Максимальное количество коробок на ленте
const HAND_STOP_LINE_Y = 78; // Позиция невидимой линии остановки (в процентах)

export function useGame2() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    lives: INITIAL_LIVES,
    boxesFixed: 0,
    containersClosed: 0,
    gameTime: 0,
    multiplier: 1,
    comboCount: 0,
    maxMultiplier: 1,
    conveyorSpeed: BASE_CONVEYOR_SPEED,
    handActive: false,
    boxes: [],
    container: null,
    containerSpawning: false,
    beltStopped: false,
    levelCompleteShown: false
  });
  
  const boxesRef = useRef([]);
  const gameStateRef = useRef(null);
  const gameStartTimeRef = useRef(0);
  const conveyorSpeedRef = useRef(BASE_CONVEYOR_SPEED);
  const lastSpawnTimeRef = useRef(0);
  const containerCapacityRef = useRef(5);
  const containerCountRef = useRef(0);

  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    gameStartTimeRef.current = 0;
    conveyorSpeedRef.current = BASE_CONVEYOR_SPEED;
    lastSpawnTimeRef.current = 0;
    containerCapacityRef.current = 5;
    containerCountRef.current = 0;

    setGameState({
      isRunning: false,
      score: 0,
      lives: INITIAL_LIVES,
      boxesFixed: 0,
      containersClosed: 0,
      gameTime: 0,
      multiplier: 1,
      comboCount: 0,
      maxMultiplier: 1,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      handActive: false,
      boxes: [],
      container: null,
      containerSpawning: false,
      beltStopped: false,
      levelCompleteShown: false
    });
  }, []);

  const setHandActive = useCallback((active) => {
    setGameState(prev => ({
      ...prev,
      handActive: active
    }));
  }, []);

  const spawnBox = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState || currentState.beltStopped) return null;

    // Проверка на переполнение ленты
    if (boxesRef.current.length >= MAX_BOXES_ON_BELT) {
      setGameState(prev => ({
        ...prev,
        beltStopped: true
      }));
      return null;
    }

    const newBox = {
      id: Date.now() + Math.random(),
      y: -20,
      stopped: false
    };

    boxesRef.current = [...boxesRef.current, newBox];

    setGameState(prev => ({
      ...prev,
      boxes: boxesRef.current
    }));

    return newBox;
  }, []);

  const updateBoxes = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState || !currentState.isRunning) return;

    let livesLost = 0;
    let boxesFixedThisUpdate = 0;
    let scoreGained = 0;
    let newComboCount = currentState.comboCount;
    let newMultiplier = currentState.multiplier;
    let currentSpeed = conveyorSpeedRef.current;
    
    // Позиция невидимой линии остановки (стена от руки)
    const handStopLineY = HAND_STOP_LINE_Y;
    const isHandBlocking = currentState.handActive;

    // Вычисляем высоту коробки в процентах от высоты экрана
    const screenHeightPx = window.innerHeight || 800;
    const boxHeightPercent = (BOX_SIZE / screenHeightPx) * 100;

    // Сортируем коробки по позиции Y (сверху вниз)
    boxesRef.current.sort((a, b) => a.y - b.y);
    
    // Сначала сбрасываем статус stopped у всех коробок
    boxesRef.current.forEach(box => {
      box.stopped = false;
    });
    
    // Если рука активна - проверяем остановку на невидимой линии
    if (isHandBlocking) {
      // Находим самую нижнюю коробку, которая ещё НЕ прошла линию полностью
      // То есть её нижняя часть находится выше или на линии
      let firstBoxAboveLineIndex = -1;
      for (let i = boxesRef.current.length - 1; i >= 0; i--) {
        const box = boxesRef.current[i];
        const boxBottom = box.y + boxHeightPercent;
        
        // Если низ коробки выше или на линии - эта коробка может быть остановлена
        if (boxBottom <= handStopLineY + 0.1) {
          firstBoxAboveLineIndex = i;
          break;
        }
      }
      
      // Если есть коробки выше линии, останавливаем их
      if (firstBoxAboveLineIndex >= 0) {
        // Проходим от найденной коробки вверх и останавливаем все коробки
        for (let i = firstBoxAboveLineIndex; i >= 0; i--) {
          const box = boxesRef.current[i];
          
          if (i === firstBoxAboveLineIndex) {
            // Самая нижняя из коробок выше линии
            const boxBottom = box.y + boxHeightPercent;
            
            // Если коробка достигла или пересекла линию - останавливаем её на линии
            if (boxBottom >= handStopLineY) {
              // Коробка достигла линии - останавливаем на линии
              box.stopped = true;
              // Устанавливаем позицию так чтобы низ коробки был на линии
              box.y = handStopLineY - boxHeightPercent;
            }
            // Иначе коробка продолжает падать пока не достигнет линии
          } else {
            // Остальные коробки останавливаются над коробкой ниже
            const boxBelow = boxesRef.current[i + 1];
            // Только если коробка ниже остановлена
            if (boxBelow.stopped) {
              const boxBelowTop = boxBelow.y;
              const boxBottom = box.y + boxHeightPercent;
              
              // Если коробка достигла или пересекла коробку ниже - останавливаем
              if (boxBottom >= boxBelowTop) {
                box.stopped = true;
                box.y = boxBelowTop - boxHeightPercent;
              }
              // Иначе коробка продолжает падать
            }
          }
        }
      }
      // Все коробки ниже линии (с индексом > firstBoxAboveLineIndex) продолжают падение
    }
    
    // Двигаем все не остановленные коробки
    boxesRef.current.forEach(box => {
      if (!box.stopped) {
        box.y += currentSpeed;
      }
    });

    // Проверяем переполнение: если есть остановленная коробка у люка (верхняя часть)
    const boxAtSpawn = boxesRef.current.some(box => box.stopped && box.y < 20);
    if (boxAtSpawn && boxesRef.current.length >= MAX_BOXES_ON_BELT) {
      if (!currentState.beltStopped) {
        setGameState(prev => ({
          ...prev,
          beltStopped: true
        }));
      }
    } else if (currentState.beltStopped && !boxAtSpawn) {
      setGameState(prev => ({
        ...prev,
        beltStopped: false
      }));
    }

    // Спавн контейнера когда нет активного (только если рука не блокирует)
    if (!isHandBlocking && !currentState.container && !currentState.containerSpawning) {
      setGameState(prev => ({
        ...prev,
        containerSpawning: true
      }));

      setTimeout(() => {
        containerCountRef.current = 0;
        setGameState(prev => ({
          ...prev,
          containerSpawning: false,
          container: {
            y: 88,
            count: 0,
            capacity: containerCapacityRef.current
          }
        }));
      }, 1000);
    }

    // Проверяем коробки, достигшие контейнера
    boxesRef.current = boxesRef.current.filter(box => {
      if (box.y > 95) {
        // Коробка достигла зоны контейнера
        // Проверяем состояние контейнера
        if (currentState.containerSpawning || !currentState.container) {
          // Контейнер на перезарядке или отсутствует - коробка промахивается, отнимаем жизнь
          livesLost++;
          return false;
        } else {
          // Контейнер активен - коробка успешно попадает в него
          containerCountRef.current++;
          boxesFixedThisUpdate++;
          
          setGameState(prev => ({
            ...prev,
            container: prev.container ? {
              ...prev.container,
              count: containerCountRef.current
            } : null
          }));

          // Проверка на заполнение контейнера
          if (containerCountRef.current >= containerCapacityRef.current) {
            // Контейнер заполнен - сразу отправляем на перезарядку
            scoreGained += 100 * newMultiplier;
            newComboCount++;
            
            if (newComboCount >= 30) {
              newMultiplier = 2;
            } else if (newComboCount >= 10) {
              newMultiplier = 1.5;
            } else {
              newMultiplier = 1;
            }

            setGameState(prev => ({
              ...prev,
              containersClosed: prev.containersClosed + 1,
              container: null,
              containerSpawning: true
            }));

            containerCapacityRef.current = Math.min(containerCapacityRef.current + 1, 10);
            currentSpeed = currentSpeed * 1.02;
            conveyorSpeedRef.current = currentSpeed;
            
            // Запускаем таймер перезарядки
            setTimeout(() => {
              containerCountRef.current = 0;
              setGameState(prev => ({
                ...prev,
                containerSpawning: false,
                container: {
                  y: 88,
                  count: 0,
                  capacity: containerCapacityRef.current
                }
              }));
            }, 1000);
          }
          return false;
        }
      }
      return true;
    });

    // Обновляем жизни
    let newLives = currentState.lives - livesLost;
    if (newLives < 0) newLives = 0;

    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      boxes: [...boxesRef.current],
      comboCount: newComboCount,
      multiplier: newMultiplier,
      maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
      score: prev.score + scoreGained,
      lives: newLives,
      conveyorSpeed: currentSpeed,
      gameTime: Date.now() - gameStartTimeRef.current
    }));
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    boxesRef.current = [];
    gameStartTimeRef.current = Date.now();

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      boxes: [],
      gameTime: 0,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      levelCompleteShown: false
    }));
  }, [resetGame]);

  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  const completeLevel = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  return {
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
    HAND_STOP_LINE_Y,
    conveyorSpeedRef,
    lastSpawnTimeRef
  };
}
