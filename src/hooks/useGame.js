import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 140; // Размер коробки
const HAND_POSITION_Y = 85; // Позиция руки в процентах от высоты экрана
const STOP_LINE_Y = 85; // Стоп-линия (где должна остановиться нижняя часть коробки)
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
    handPosition: 'left', // 'left' или 'right'
    boxes: [],
    levelCompleteShown: false
  });
  
  const boxesRef = useRef([]);
  const gameStateRef = useRef(null); // Храним актуальное состояние
  const gameStartTimeRef = useRef(0);
  const errorAnimationRef = useRef(new Map()); // Храним тайминги анимаций ошибок
  const conveyorSpeedRef = useRef(BASE_CONVEYOR_SPEED); // Актуальная скорость в рефе
  const lastSpawnTimeRef = useRef(0); // Время последнего спавна
  const spawnIntervalRef = useRef(0); // Текущий интервал спавна
  
  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    gameStartTimeRef.current = 0;
    errorAnimationRef.current = new Map();
    conveyorSpeedRef.current = BASE_CONVEYOR_SPEED;
    lastSpawnTimeRef.current = 0;
    spawnIntervalRef.current = 0;
    
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
      handPosition: 'left',
      boxes: [],
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
      boxes: boxesRef.current
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
    // Используем скорость из рефа, чтобы она была актуальной
    let currentSpeed = conveyorSpeedRef.current;

    // Рассчитываем высоту коробки в процентах экрана
    const screenHeightPx = window.innerHeight || 800;
    const boxHeightPercent = (BOX_SIZE / screenHeightPx) * 100;

    // Обрабатываем каждую коробку по порядку (от старой к новой)
    boxesRef.current.forEach((box, index) => {
      // Пропускаем уже зафиксированные коробки - они не двигаются
      if (box.fixed) return;
      
      // Пропускаем коробки, которые уже ушли за экран
      if (box.missed) return;

      // Двигаем коробку вниз
      box.y += currentSpeed;

      // Нижняя часть коробки = box.y + boxHeightPercent
      const boxBottom = box.y + boxHeightPercent;

      // Находим самую верхнюю зафиксированную коробку среди ВСЕХ предыдущих коробок
      // (тех, что идут перед текущей в массиве)
      let effectiveStopY = STOP_LINE_Y;
      for (let i = 0; i < index; i++) {
        const prevBox = boxesRef.current[i];
        if (prevBox.fixed && prevBox.y < effectiveStopY) {
          effectiveStopY = prevBox.y - boxHeightPercent;
        }
      }

      // Проверяем, достигла ли нижняя часть коробки эффективной стоп-линии
      // И коробка еще НЕ была проверена в этом кадре
      if (boxBottom >= effectiveStopY && !box.checked) {
        box.checked = true;

        // Если коробка прямая - ничего не делаем, просто пропускаем (очки не начисляются)
        // Коробка продолжит движение и уйдет за экран
        if (box.type === 'straight') {
          return;
        }

        // Наклонная коробка - проверяем положение руки
        const correctHand = box.type === 'tilted-left' ? 'left' : 'right';

        if (currentState.handPosition === correctHand) {
          // УСПЕХ: рука в правильном положении
          // Останавливаем коробку так, чтобы её нижняя часть была на эффективной стоп-линии
          // ВАЖНО: устанавливаем позицию точно, без телепортации
          box.y = effectiveStopY - boxHeightPercent;
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
          currentSpeed = currentSpeed * ACCELERATION_RATE;
          conveyorSpeedRef.current = currentSpeed; // Сохраняем в реф
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
          
          // Коробка НЕ фиксируется, продолжает падать и уйдет за экран
          // Помечаем как missed, чтобы не обрабатывать повторно
          box.missed = true;
        }
      }
      
      // Проверяем, ушла ли коробка за экран (для нефиксированных)
      if (!box.fixed && box.y > 100) {
        box.missed = true;
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

    // Фильтруем коробки, ушедшие за экран (только те, что помечены как missed)
    boxesRef.current = boxesRef.current.filter(box => {
      // Фиксированные коробки остаются
      if (box.fixed) {
        return true;
      }
      // Нефиксированные удаляем, если ушли за экран
      if (box.missed && box.y > 100) {
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
      conveyorSpeed: currentSpeed, // Обновляем скорость в состоянии для UI
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
    
    // Сохраняем интервал в реф для использования в gameLoop
    spawnIntervalRef.current = spawnIntervalMs;
    lastSpawnTimeRef.current = performance.now();
    
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
    BOX_GAP_PIXELS,
    conveyorSpeedRef,
    lastSpawnTimeRef,
    spawnIntervalRef
  };
}
