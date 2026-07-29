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

    // Если рука активна, останавливаем коробки
    if (currentState.handActive) {
      boxesRef.current.forEach(box => {
        box.stopped = true;
      });
    } else {
      // Если рука не активна, возобновляем движение и спавним контейнер если нужно
      boxesRef.current.forEach(box => {
        if (box.stopped) {
          box.stopped = false;
          box.y += currentSpeed;
        } else {
          box.y += currentSpeed;
        }
      });

      // Спавн контейнера когда нет активного
      if (!currentState.container && !currentState.containerSpawning) {
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
    }

    // Проверяем коробки, достигшие контейнера
    boxesRef.current = boxesRef.current.filter(box => {
      if (box.y > 95) {
        // Коробка достигла зоны контейнера
        if (currentState.container && !currentState.handActive) {
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
