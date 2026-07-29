import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 100; // Размер коробки в пикселях
const HAND_POSITION_Y = 85; // Позиция руки в процентах от высоты экрана
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.25; // Базовая скорость конвейера
const BELT_WIDTH_PERCENT = 25; // Ширина конвейера в % от экрана
const MAX_BOXES_ON_BELT = 8; // Максимальное количество коробок на ленте

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
    handPosition: 'left', // 'left' или 'right'
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
  const handPositionRef = useRef('left');

  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
    handPositionRef.current = gameState.handPosition;
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
      handPosition: 'left',
      handActive: false,
      boxes: [],
      container: null,
      containerSpawning: false,
      beltStopped: false,
      levelCompleteShown: false
    });
  }, []);

  const moveHand = useCallback((position) => {
    setGameState(prev => ({
      ...prev,
      handPosition: position
    }));
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
    
    // Определяем позицию руки (в процентах от высоты)
    const handY = HAND_POSITION_Y;
    const handX = handPositionRef.current === 'left' ? 35 : 55; // позиции руки
    const beltCenterX = 50; // центр конвейера
    const boxHalfWidthPercent = 12.5; // половина ширины конвейера (25% / 2)
    
    // Проверяем, находится ли рука над конвейером
    const isHandOverBelt = Math.abs(handX - beltCenterX) <= boxHalfWidthPercent;
    const isHandBlocking = currentState.handActive && isHandOverBelt;

    // Сортируем коробки по позиции Y (сверху вниз)
    boxesRef.current.sort((a, b) => a.y - b.y);
    
    // Если рука активна и над конвейером, она действует как физический барьер
    if (isHandBlocking) {
      // Находим первую коробку, которая достигла позиции руки
      let firstBoxAtHand = null;
      for (let i = 0; i < boxesRef.current.length; i++) {
        const box = boxesRef.current[i];
        // Коробка достигает руки, если её низ достиг позиции руки
        const boxBottom = box.y + 10; // примерно низ коробки в %
        if (boxBottom >= handY && !box.stopped) {
          box.stopped = true;
          if (!firstBoxAtHand) {
            firstBoxAtHand = box;
          }
        }
      }
      
      // Если есть коробка, остановленная рукой, все коробки выше неё тоже останавливаются (цепочка)
      if (firstBoxAtHand) {
        for (let i = 0; i < boxesRef.current.length; i++) {
          const box = boxesRef.current[i];
          if (box.y < firstBoxAtHand.y) {
            box.stopped = true;
          }
        }
      }
    } else {
      // Рука не блокирует - все коробки двигаются
      boxesRef.current.forEach(box => {
        box.stopped = false;
      });
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
      }, 1500);
    }

    // Проверяем коробки, достигшие контейнера
    boxesRef.current = boxesRef.current.filter(box => {
      if (box.y > 95) {
        // Коробка достигла зоны контейнера
        if (currentState.container && !isHandBlocking) {
          // Успешно попала в контейнер
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
            // Контейнер заполнен
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
              containerSpawning: false
            }));

            containerCapacityRef.current = Math.min(containerCapacityRef.current + 1, 10);
            currentSpeed = currentSpeed * 1.02;
            conveyorSpeedRef.current = currentSpeed;
          }
        }
        return false;
      }
      return true;
    });

    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      boxes: [...boxesRef.current],
      comboCount: newComboCount,
      multiplier: newMultiplier,
      maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
      score: prev.score + scoreGained,
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
    moveHand,
    setHandActive,
    spawnBox,
    updateBoxes,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y,
    conveyorSpeedRef,
    lastSpawnTimeRef
  };
}
