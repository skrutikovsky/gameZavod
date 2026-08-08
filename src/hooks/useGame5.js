import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const ICE_CREAM_WIDTH = 200; // Ширина мороженого в пикселях
export const ICE_CREAM_HEIGHT = 350; // Высота мороженого в пикселях
export const STICK_WIDTH = 20; // Ширина палочки
export const STICK_HEIGHT = 150; // Высота палочки
export const STICK_FALL_SPEED = 5; // Скорость падения палочки (пикселей за кадр)
export const CONVEYOR_SPEED = 2; // Скорость движения конвейера
export const SPAWN_MIN_INTERVAL = 1500; // Минимальный интервал спавна мороженого (мс)
export const SPAWN_MAX_INTERVAL = 3000; // Максимальный интервал спавна мороженого (мс)
export const TUNNEL_WIDTH_PERCENT = 15; // Ширина туннелей в процентах от экрана
export const CONVEYOR_Y_PERCENT = 50; // Позиция конвейера по вертикали (%)

// Зоны попадания на мороженом
export const HIT_ZONE_CENTER = 0.20; // Центральные 20% - 500 очков
export const HIT_ZONE_MIDDLE = 0.70; // Следующие 70% - 300 очков
// Оставшиеся 15% по краям (7.5% с каждой стороны) - промах

export function useGame5({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    iceCreams: [], // Массив мороженых: { id, x, y, hasStick, stickX }
    sticks: [], // Массив падающих палочек: { id, x, y }
    lastSpawnTime: 0,
    nextSpawnInterval: 0
  });

  const gameStateRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(0);
  const spawnTimeoutRef = useRef(null);

  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = useCallback(() => {
    if (spawnTimeoutRef.current) {
      clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = null;
    }
    
    setGameState({
      isRunning: false,
      score: 0,
      iceCreams: [],
      sticks: [],
      lastSpawnTime: 0,
      nextSpawnInterval: 0
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    
    const nextInterval = SPAWN_MIN_INTERVAL + Math.random() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      iceCreams: [],
      sticks: [],
      lastSpawnTime: performance.now(),
      nextSpawnInterval: nextInterval
    }));
    
    lastTimeRef.current = performance.now();
  }, [resetGame]);

  const stopGame = useCallback(() => {
    if (spawnTimeoutRef.current) {
      clearTimeout(spawnTimeoutRef.current);
      spawnTimeoutRef.current = null;
    }
    
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  // Спавн нового мороженого
  const spawnIceCream = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || !state.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const conveyorY = rect.height * CONVEYOR_Y_PERCENT / 100;
    const iceCreamTopY = conveyorY - ICE_CREAM_HEIGHT / 2;

    // Спавним мороженое слева за пределами видимой области
    const newIceCream = {
      id: Date.now() + Math.random(),
      x: -ICE_CREAM_WIDTH, // Начинаем за левым краем
      y: iceCreamTopY,
      hasStick: false,
      stickX: 0
    };

    setGameState(prev => ({
      ...prev,
      iceCreams: [...prev.iceCreams, newIceCream]
    }));

    // Планируем следующий спавн
    const nextInterval = SPAWN_MIN_INTERVAL + Math.random() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
    setGameState(prev => ({
      ...prev,
      lastSpawnTime: performance.now(),
      nextSpawnInterval: nextInterval
    }));
  }, []);

  // Бросок палочки
  const dropStick = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || !state.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    
    // Палочка появляется из аппарата по центру сверху
    const newStick = {
      id: Date.now() + Math.random(),
      x: centerX - STICK_WIDTH / 2,
      y: 50 // Начальная позиция сверху
    };

    setGameState(prev => ({
      ...prev,
      sticks: [...prev.sticks, newStick]
    }));
  }, []);

  // Обработка нажатия пробела
  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      dropStick();
    }
  }, [dropStick]);

  // Основной игровой цикл
  const updateLoop = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || !state.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const conveyorY = rect.height * CONVEYOR_Y_PERCENT / 100;
    const now = performance.now();

    // Проверка спавна нового мороженого
    if (now - state.lastSpawnTime > state.nextSpawnInterval) {
      spawnIceCream();
    }

    // Обновление позиций мороженых
    let updatedIceCreams = state.iceCreams.map(iceCream => ({
      ...iceCream,
      x: iceCream.x + CONVEYOR_SPEED
    }));

    // Удаляем мороженое, ушедшее за правый край
    updatedIceCreams = updatedIceCreams.filter(iceCream => iceCream.x < rect.width);

    // Обновление позиций палочек и проверка столкновений
    let updatedSticks = [];
    let scoreGain = 0;

    state.sticks.forEach(stick => {
      const newY = stick.y + STICK_FALL_SPEED;
      const stickBottom = newY + STICK_HEIGHT;

      // Проверяем столкновение с мороженым
      let hitIceCream = false;
      let stickInserted = false;

      for (let iceCream of updatedIceCreams) {
        if (iceCream.hasStick) continue; // Уже есть палочка

        // Проверяем перекрытие по Y - палочка должна достичь уровня конвейера
        const iceCreamTop = iceCream.y;
        const iceCreamBottom = iceCream.y + ICE_CREAM_HEIGHT;
        const conveyorTop = conveyorY - 20; // Верхняя граница конвейера

        // Палочка попадает в мороженое когда её низ достигает верхней части мороженого
        if (stickBottom >= iceCreamTop && stick.y <= iceCreamBottom) {
          // Проверяем перекрытие по X
          const stickCenterX = stick.x + STICK_WIDTH / 2;
          
          if (stickCenterX >= iceCream.x && stickCenterX <= iceCream.x + ICE_CREAM_WIDTH) {
            // Палочка попала в зону мороженого по X!
            hitIceCream = true;

            // Вычисляем зону попадания относительно ширины мороженого
            const relativeX = (stickCenterX - iceCream.x) / ICE_CREAM_WIDTH;
            
            // Зоны попадания:
            // 0-15% (левый край) - промах
            // 15-40% (левая средняя зона) - 300 очков
            // 40-60% (центр 20%) - 500 очков
            // 60-85% (правая средняя зона) - 300 очков
            // 85-100% (правый край) - промах
            
            const leftEdge = 0.15; // 15% от левого края
            const rightEdge = 0.85; // 15% от правого края
            const centerStart = 0.40; // Начало центральной зоны (20%)
            const centerEnd = 0.60; // Конец центральной зоны

            if (relativeX >= centerStart && relativeX <= centerEnd) {
              // Центральные 20% - 500 очков
              scoreGain += 500;
              stickInserted = true;
            } else if (relativeX >= leftEdge && relativeX <= rightEdge) {
              // Средние 70% (исключая центр) - 300 очков
              scoreGain += 300;
              stickInserted = true;
            }
            // Иначе - промах (крайние 15%), палочка не вставляется и продолжает падать

            // Если попали в рабочую зону (не промах), вставляем палочку
            if (stickInserted) {
              iceCream.hasStick = true;
              iceCream.stickX = stick.x;
            }
            break;
          }
        }
      }

      // Если палочка не попала в мороженое или был промах - продолжаем падение
      if (!hitIceCream || !stickInserted) {
        if (newY < rect.height) {
          updatedSticks.push({
            ...stick,
            y: newY
          });
        }
      }
    });

    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      iceCreams: updatedIceCreams,
      sticks: updatedSticks,
      score: prev.score + scoreGain
    }));

    requestRef.current = requestAnimationFrame(updateLoop);
  }, [spawnIceCream]);

  // Запуск игрового цикла
  useEffect(() => {
    if (gameState.isRunning) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(updateLoop);
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
  }, [gameState.isRunning, updateLoop]);

  // Обработчик клавиатуры
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' && gameState.isRunning) {
        e.preventDefault();
        dropStick();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState.isRunning, dropStick]);

  const setCanvas = useCallback((ref) => {
    canvasRef.current = ref;
  }, []);

  return {
    gameState,
    setGameState,
    startGame,
    stopGame,
    resetGame,
    dropStick,
    handleKeyDown,
    setCanvas,
    canvasRef,
    ICE_CREAM_WIDTH,
    ICE_CREAM_HEIGHT,
    STICK_WIDTH,
    STICK_HEIGHT,
    STICK_FALL_SPEED,
    CONVEYOR_SPEED,
    TUNNEL_WIDTH_PERCENT,
    CONVEYOR_Y_PERCENT,
    HIT_ZONE_CENTER,
    HIT_ZONE_MIDDLE
  };
}
