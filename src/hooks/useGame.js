import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 140; // Размер коробки
const HAND_POSITION_Y = 85; // Позиция руки в процентах от высоты экрана
const CHECK_LINE_Y = 78; // Невидимая линия проверки (чуть выше руки)
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.27; // Увеличено в 1.5 раза (было 0.18)
const BELT_WIDTH_PERCENT = 25; // Ширина конвейера в % от экрана
const BOX_GAP_PIXELS = 20; // Фиксированное расстояние между коробками в пикселях
const ACCELERATION_RATE = 1.02; // +2% за успех

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
    spawnRate: 0, // Будет рассчитан динамически
    handPosition: 'left', // 'left' или 'right'
    boxes: [],
    lastSpawnTime: 0,
    levelCompleteShown: false
  });
  
  const boxesRef = useRef([]);
  const gameStateRef = useRef(null); // Храним актуальное состояние
  const gameStartTimeRef = useRef(0);
  const errorAnimationRef = useRef(new Map()); // Храним тайминги анимаций ошибок
  
  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    gameStartTimeRef.current = 0;
    errorAnimationRef.current = new Map();
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
      spawnRate: 0,
      handPosition: 'left',
      boxes: [],
      lastSpawnTime: 0,
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

    // 3 варианта: влево, ровно, вправо с равной вероятностью
    if (randomType < 0.33) {
      boxType = 'tilted-left';
    } else if (randomType < 0.66) {
      boxType = 'straight';
    } else {
      boxType = 'tilted-right';
    }

    const newBox = {
      id: Date.now() + Math.random(),
      type: boxType,
      y: -20, // Начинаем чуть выше видимой области (в %)
      fixed: false,
      checked: false, // Проверена ли на линии
      missed: false, // Пропущена ли (ушла за экран)
      errorAnim: false, // Флаг анимации ошибки
      errorAnimStartTime: 0 // Время начала анимации ошибки
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
    // Эта функция больше не используется - логика перенесена в updateBoxes
  }, []);

  const loseLife = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      lives: prev.lives - 1,
      comboCount: 0,
      multiplier: 1
      // Скорость НЕ сбрасываем после провала
    }));
  }, []);

  const updateBoxes = useCallback((deltaTime) => {
    const currentState = gameStateRef.current;
    if (!currentState || !currentState.isRunning) return;
    
    let livesLost = 0;
    let boxesFixedThisUpdate = 0;
    let scoreGained = 0;
    let newComboCount = currentState.comboCount;
    let newMultiplier = currentState.multiplier;
    let newConveyorSpeed = currentState.conveyorSpeed;

    // Обновляем позиции всех коробок
    boxesRef.current.forEach(box => {
      box.y += currentState.conveyorSpeed;
    });

    // Проверяем коробки при пересечении линии проверки
    boxesRef.current.forEach(box => {
      // Пропускаем уже проверенные коробки
      if (box.checked) return;

      // Проверяем пересечение линии проверки (снизу вверх)
      if (box.y >= CHECK_LINE_Y) {
        box.checked = true;

        // Если коробка прямая - ничего не делаем, просто пропускаем (очки не начисляются)
        if (box.type === 'straight') {
          return;
        }

        // Наклонная коробка - проверяем положение руки
        const correctHand = box.type === 'tilted-left' ? 'left' : 'right';

        if (currentState.handPosition === correctHand) {
          // УСПЕХ: рука в правильном положении
          box.fixed = true;
          
          boxesFixedThisUpdate++;
          newComboCount = currentState.comboCount + boxesFixedThisUpdate;
          
          // Вычисляем множитель
          if (newComboCount >= 30) {
            newMultiplier = 2;
          } else if (newComboCount >= 10) {
            newMultiplier = 1.5;
          } else {
            newMultiplier = 1;
          }

          // Начисляем очки: 100 * множитель + 50 бонус за поворот
          const turnBonus = 50;
          scoreGained += Math.floor(100 * newMultiplier) + turnBonus;

          // Ускоряем конвейер на 2%
          newConveyorSpeed = currentState.conveyorSpeed * ACCELERATION_RATE;
        } else {
          // ОШИБКА: рука не в том положении
          // Сбрасываем комбо и множитель
          newComboCount = 0;
          newMultiplier = 1;
          
          // Теряем жизнь
          livesLost++;
          
          // Запускаем анимацию ошибки (увеличение на 15% и покраснение на 0.5 сек)
          box.errorAnim = true;
          box.errorAnimStartTime = Date.now();
          // Сохраняем оригинальный тип коробки для анимации
          box.originalType = box.type;
          
          // Скорость НЕ меняем после провала - оставляем текущую
          
          // Коробка остается наклонной и уйдет за экран
        }
      }
    });

    // Обрабатываем анимации ошибок (сбрасываем через 500мс)
    const now = Date.now();
    boxesRef.current.forEach(box => {
      if (box.errorAnim && box.errorAnimStartTime) {
        if (now - box.errorAnimStartTime > 500) {
          box.errorAnim = false;
          box.errorAnimStartTime = 0;
        }
      }
    });

    // Фильтруем коробки, ушедшие за экран
    boxesRef.current = boxesRef.current.filter(box => {
      if (box.y > 100) {
        return false;
      }
      return true;
    });

    let newLives = currentState.lives - livesLost;
    let gameOver = false;

    if (newLives <= 0) {
      newLives = 0;
      gameOver = true;
    }

    // Обновляем состояние один раз в конце
    setGameState(prev => ({
      ...prev,
      boxes: [...boxesRef.current], // Создаем новую ссылку для триггера ререндера
      lives: newLives,
      boxesFixed: prev.boxesFixed + boxesFixedThisUpdate,
      comboCount: newComboCount,
      multiplier: newMultiplier,
      maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
      score: prev.score + scoreGained,
      conveyorSpeed: newConveyorSpeed,
      isRunning: !gameOver,
      gameTime: Date.now() - gameStartTimeRef.current
    }));
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    boxesRef.current = [];
    gameStartTimeRef.current = Date.now();
    
    // Рассчитываем базовый интервал спавна на основе скорости конвейера и фиксированного расстояния
    // BOX_GAP_PIXELS = 20 пикселей между коробками (расстояние от края до края)
    // Расстояние между центрами коробок = BOX_SIZE + BOX_GAP_PIXELS
    const screenHeightPx = window.innerHeight || 800;
    const boxCenterDistancePercent = ((BOX_SIZE + BOX_GAP_PIXELS) / screenHeightPx) * 100;
    
    // Время между спавнами = расстояние / скорость
    // Скорость в % за мс = BASE_CONVEYOR_SPEED / 16.67 (при 60fps)
    const speedPerMs = BASE_CONVEYOR_SPEED / 16.67;
    const spawnIntervalMs = boxCenterDistancePercent / speedPerMs;
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      lastSpawnTime: performance.now(),
      boxes: [],
      gameTime: 0,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      spawnRate: spawnIntervalMs,
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
    HAND_POSITION_Y,
    BOX_GAP_PIXELS
  };
}
