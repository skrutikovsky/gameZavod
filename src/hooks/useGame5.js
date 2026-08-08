import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const ICE_CREAM_WIDTH = 200; // Ширина мороженки в пикселях
export const ICE_CREAM_HEIGHT = 350; // Высота мороженки в пикселях
export const STICK_WIDTH = 48; // Ширина палочки (увеличена в 2 раза от 24px)
export const STICK_HEIGHT = 300; // Высота палочки (увеличена в 2 раза от 150px)
export const STICK_FALL_SPEED = 400; // Скорость падения палочки (пикселей в секунду)
export const CONVEYOR_SPEED = 225; // Скорость конвейера (150 * 1.5 = 225 пикселей в секунду)
export const CENTER_ZONE = 0.20; // 20% центральная зона (500 очков)
export const GOOD_ZONE = 0.70; // 70% хорошая зона (300 очков)
export const MISS_ZONE = 0.15; // 15% от краев - промах
export const MIN_SPAWN_INTERVAL = 1000; // Минимальный интервал между мороженками (мс) - увеличено до 1 секунды
export const MAX_SPAWN_INTERVAL = 3000; // Максимальный интервал между мороженками (мс)
export const SPAWN_COOLDOWN = 500; // Минимальная задержка между нажатиями спавна (мс)
export const STICK_REGISTRATION_OFFSET = 0; // Смещение линии регистрации - 0, т.к. коллизия считается по точному касанию верхнего края мороженки

// Цвета для мороженок
export const ICE_CREAM_COLORS = [
  { top: '#ffb6c1', middle: '#ff69b4', bottom: '#ffb6c1', name: 'pink' },      // Розовое
  { top: '#ffe4b5', middle: '#ffa500', bottom: '#ffd700', name: 'orange' },     // Оранжевое
  { top: '#e6e6fa', middle: '#9370db', bottom: '#dda0dd', name: 'purple' },     // Фиолетовое
  { top: '#98fb98', middle: '#32cd32', bottom: '#90ee90', name: 'green' },      // Зеленое
  { top: '#87ceeb', middle: '#1e90ff', bottom: '#add8e6', name: 'blue' },       // Голубое
  { top: '#f5deb3', middle: '#d2691e', bottom: '#deb887', name: 'chocolate' },  // Шоколадное
  { top: '#fffacd', middle: '#ffff00', bottom: '#fff8dc', name: 'lemon' },      // Лимонное
  { top: '#ffc0cb', middle: '#dc143c', bottom: '#ff69b4', name: 'strawberry' }, // Клубничное
];

// Генерация случайного интервала для спавна мороженки
export const getRandomSpawnInterval = () => {
  return Math.random() * (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) + MIN_SPAWN_INTERVAL;
};

// Генерация случайного цвета для мороженки
export const getRandomIceCreamColor = () => {
  return ICE_CREAM_COLORS[Math.floor(Math.random() * ICE_CREAM_COLORS.length)];
};

// Hook для логики игры 5
export function useGame5({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    iceCreams: [], // Массив мороженок: { id, x, y, hasStick, stickX, points, color }
    fallingSticks: [], // Массив падающих палочек: { id, x, y }
    stuckSticks: [], // Массив палочек в мороженном: { id, iceCreamId, offsetX }
    lastSpawnTime: 0,
    nextSpawnInterval: 0,
    lastSpawnPressTime: 0, // Для защиты от спама нажатий
    gameOver: false,
    roundComplete: false,
  });

  const gameStateRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(null);
  const stickIdCounter = useRef(0);
  const iceCreamIdCounter = useRef(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = canvas;
    
    stickIdCounter.current = 0;
    iceCreamIdCounter.current = 0;
    lastTimeRef.current = performance.now();

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      iceCreams: [],
      fallingSticks: [],
      stuckSticks: [],
      lastSpawnTime: 0,
      nextSpawnInterval: getRandomSpawnInterval(),
      lastSpawnPressTime: 0,
      roundComplete: false,
      gameOver: false,
    }));
  }, []);

  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      round: 1,
      gameOver: false
    }));
    initRound();
  }, [initRound]);

  const resetGame = useCallback(() => {
    stickIdCounter.current = 0;
    iceCreamIdCounter.current = 0;
    lastTimeRef.current = performance.now();
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      iceCreams: [],
      fallingSticks: [],
      stuckSticks: [],
      lastSpawnTime: 0,
      nextSpawnInterval: 0,
      lastSpawnPressTime: 0,
      gameOver: false,
      roundComplete: false,
    });
  }, []);

  // Обработка нажатия пробела - уронить палочку
  const handleSpacePress = useCallback(() => {
    if (!gameStateRef.current?.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width } = canvas;
    
    // Защита от спама нажатий (минимальный интервал 500мс)
    const now = Date.now();
    if (now - gameStateRef.current.lastSpawnPressTime < SPAWN_COOLDOWN) {
      return;
    }
    
    // Палочка появляется по центру сверху
    const stickX = width / 2 - STICK_WIDTH / 2;
    const stickY = 50; // Начальная позиция над конвейером

    setGameState(prev => ({
      ...prev,
      lastSpawnPressTime: now,
      fallingSticks: [
        ...prev.fallingSticks,
        {
          id: `stick-${stickIdCounter.current++}`,
          x: stickX,
          y: stickY,
        }
      ]
    }));
  }, []);

  // Основной игровой цикл
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = canvas;
    const conveyorY = height / 2 - ICE_CREAM_HEIGHT / 2; // Позиция конвейера по вертикали

    let newScore = state.score;
    let iceCreamsUpdated = [...state.iceCreams];
    let fallingSticksUpdated = [...state.fallingSticks];
    let stuckSticksUpdated = [...state.stuckSticks];
    let lastSpawnTime = state.lastSpawnTime;
    let nextSpawnInterval = state.nextSpawnInterval;

    // Спавн новых мороженок
    if (lastSpawnTime === 0 || Date.now() - lastSpawnTime >= nextSpawnInterval) {
      // Спавним новую мороженку слева за пределами экрана
      iceCreamsUpdated.push({
        id: `icecream-${iceCreamIdCounter.current++}`,
        x: -ICE_CREAM_WIDTH, // Начинает за левым краем
        y: conveyorY,
        hasStick: false,
        points: 0,
        color: getRandomIceCreamColor(), // Случайный цвет для каждой мороженки
      });
      lastSpawnTime = Date.now();
      nextSpawnInterval = getRandomSpawnInterval();
    }

    // Обновление позиции мороженок (движение слева направо)
    iceCreamsUpdated = iceCreamsUpdated.map(icecream => ({
      ...icecream,
      x: icecream.x + CONVEYOR_SPEED * deltaTime,
    }));

    // Удаляем мороженки которые ушли за правый край
    iceCreamsUpdated = iceCreamsUpdated.filter(icecream => icecream.x < width);

    // Обновление падающих палочек
    fallingSticksUpdated = fallingSticksUpdated.map(stick => ({
      ...stick,
      y: stick.y + STICK_FALL_SPEED * deltaTime,
    }));

    // Проверка коллизий палочек с мороженками
    const sticksToRemove = [];
    
    fallingSticksUpdated.forEach(stick => {
      // Коллизия считается только по нижнему краю палочки в момент касания верхнего края мороженки
      // Нижний край палочки должен точно совпасть с верхним краем мороженки (conveyorY)
      const stickBottom = stick.y + STICK_HEIGHT;
      
      // Допуск для точного касания (в пикселях)
      const collisionTolerance = 5;
      
      // Коллизия засчитывается только когда нижний край палочки находится в пределах допуска от верхнего края мороженки
      // и палочка еще не прошла полностью мимо (верх палочки выше уровня конвейера)
      if (Math.abs(stickBottom - conveyorY) <= collisionTolerance && stick.y < conveyorY) {
        // Проверяем попадание в каждую мороженку
        for (let icecream of iceCreamsUpdated) {
          if (!icecream.hasStick) {
            const iceLeft = icecream.x;
            const iceRight = icecream.x + ICE_CREAM_WIDTH;
            
            // Центр палочки
            const stickCenter = stick.x + STICK_WIDTH / 2;
            
            // Проверяем горизонтальное попадание
            if (stickCenter >= iceLeft && stickCenter <= iceRight) {
              // Определяем зону попадания
              const relativePos = (stickCenter - iceLeft) / ICE_CREAM_WIDTH; // 0-1
              let points = 0;
              let isHit = false;

              // Центральная 20% зона (500 очков)
              if (relativePos >= 0.4 && relativePos <= 0.6) {
                points = 500;
                isHit = true;
              }
              // Хорошая 70% зона (300 очков) - от 15% до 85%
              else if (relativePos >= 0.15 && relativePos <= 0.85) {
                points = 300;
                isHit = true;
              }
              // Края по 15% - промах (палочка не втыкается)

              if (isHit) {
                // Палочка попадает в мороженое
                icecream.hasStick = true;
                icecream.points = points;
                newScore += points;
                
                // Вычисляем относительную позицию палочки (0-1) - где именно она упала
                // Сохраняем позицию X палочки относительно левой границы мороженки
                const absoluteOffsetX = stick.x - icecream.x;
                const relativeOffset = absoluteOffsetX / ICE_CREAM_WIDTH;
                
                // Палочка фиксируется в момент касания - её верх остается на уровне где произошло касание
                // В момент коллизии: stickBottom == conveyorY, значит stick.y == conveyorY - STICK_HEIGHT
                const stickTopAtCollision = stick.y;
                
                // Сохраняем относительную позицию прямо в объекте мороженки
                icecream.stuckStickOffset = relativeOffset;
                icecream.stickTopY = stickTopAtCollision; // Запоминаем Y позицию верха палочки
                
                // Сохраняем время вставки для анимации погружения
                icecream.stickInsertTime = Date.now();
                
                // Добавляем палочку в массив stuckSticks для совместимости
                stuckSticksUpdated.push({
                  id: stick.id,
                  iceCreamId: icecream.id,
                  offsetX: absoluteOffsetX,
                  relativeOffset: relativeOffset,
                  topY: stickTopAtCollision,
                });
                
                sticksToRemove.push(stick.id);
                break;
              }
            }
          }
        }
      }
      
      // Удаляем палочки которые ушли ниже конвейера (промах)
      if (stick.y > height) {
        sticksToRemove.push(stick.id);
      }
    });

    // Фильтруем удаленные палочки
    fallingSticksUpdated = fallingSticksUpdated.filter(stick => !sticksToRemove.includes(stick.id));

    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      score: newScore,
      iceCreams: iceCreamsUpdated,
      fallingSticks: fallingSticksUpdated,
      stuckSticks: stuckSticksUpdated,
      lastSpawnTime,
      nextSpawnInterval,
    }));

  }, []);

  // Игровой цикл
  useEffect(() => {
    const animate = (time) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      
      const deltaTime = (time - lastTimeRef.current) / 1000; // Конвертируем в секунды
      lastTimeRef.current = time;
      
      updateGame(deltaTime);
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [updateGame]);

  const setCanvasRef = useCallback((ref) => {
    canvasRef.current = ref;
  }, []);

  return {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleSpacePress,
    setCanvasRef,
    initRound,
    canvasRef,
  };
}
