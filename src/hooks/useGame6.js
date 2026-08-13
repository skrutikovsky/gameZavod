import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const SKILL_CHECK_RADIUS = 100; // Радиус круга скилл чека
export const TARGET_ZONE_SIZE = 0.10; // 10% белая зона попадания
export const ARROW_SPEED = 2; // Скорость вращения стрелки (радиан в секунду)
export const BASE_SPAWN_DELAY_SUCCESS = 500; // Задержка перед новым скилл чеком при успехе (мс)
export const BASE_SPAWN_DELAY_FAIL = 1000; // Задержка перед новым скилл чеком при провале (мс)

// Hook для логики игры 6 - Skill Check как в Dead by Light
export function useGame6({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    skillCheck: null, // { angle, rotationDirection, x, y, targetStartAngle, targetEndAngle, isShaking, sizeMultiplier, isActive }
    gameOver: false,
    roundComplete: false,
    lastCheckTime: 0,
    nextSpawnDelay: BASE_SPAWN_DELAY_SUCCESS,
  });

  const gameStateRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastTimeRef.current = performance.now();

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      skillCheck: null,
      roundComplete: false,
      gameOver: false,
      lastCheckTime: 0,
      nextSpawnDelay: BASE_SPAWN_DELAY_SUCCESS,
    }));

    // Спавним первый скилл чек сразу
    spawnSkillCheck(canvas);
  }, []);

  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      gameOver: false
    }));
    initRound();
  }, [initRound]);

  const resetGame = useCallback(() => {
    lastTimeRef.current = performance.now();
    setGameState({
      isRunning: false,
      score: 0,
      skillCheck: null,
      gameOver: false,
      roundComplete: false,
      lastCheckTime: 0,
      nextSpawnDelay: BASE_SPAWN_DELAY_SUCCESS,
    });
  }, []);

  // Генерация параметров скилл чека
  const generateSkillCheckParams = useCallback((canvas) => {
    const { width, height } = canvas;
    
    // Базовая позиция - центр
    let centerX = width / 2;
    let centerY = height / 2;
    
    // 20% шанс смещения к одному из углов на 50% размера круга
    const offsetChance = Math.random();
    if (offsetChance < 0.20) {
      const corner = Math.floor(Math.random() * 4); // 0: topLeft, 1: topRight, 2: bottomLeft, 3: bottomRight
      const offsetX = SKILL_CHECK_RADIUS * 0.5;
      const offsetY = SKILL_CHECK_RADIUS * 0.5;
      
      switch (corner) {
        case 0: // Top Left
          centerX -= offsetX;
          centerY -= offsetY;
          break;
        case 1: // Top Right
          centerX += offsetX;
          centerY -= offsetY;
          break;
        case 2: // Bottom Left
          centerX -= offsetX;
          centerY += offsetY;
          break;
        case 3: // Bottom Right
          centerX += offsetX;
          centerY += offsetY;
          break;
      }
    }
    
    // Направление вращения: 85% по часовой, 15% против часовой
    const rotationDirection = Math.random() < 0.85 ? 1 : -1;
    
    // Позиция белой зоны (случайная)
    const targetStartAngle = Math.random() * Math.PI * 2;
    const targetEndAngle = targetStartAngle + (TARGET_ZONE_SIZE * Math.PI * 2);
    
    // 10% шанс что скилл чек будет трястись
    const isShaking = Math.random() < 0.10;
    
    // 5% шанс увеличенного размера, 5% шанс уменьшенного размера
    let sizeMultiplier = 1;
    const sizeChance = Math.random();
    if (sizeChance < 0.05) {
      sizeMultiplier = 2; // Увеличенный в 2 раза
    } else if (sizeChance > 0.95) {
      sizeMultiplier = 0.5; // Уменьшенный в 2 раза
    }
    
    return {
      angle: 0, // Начальный угол стрелки
      rotationDirection,
      x: centerX,
      y: centerY,
      targetStartAngle,
      targetEndAngle,
      isShaking,
      sizeMultiplier,
      isActive: true,
      shakeOffset: { x: 0, y: 0 },
    };
  }, []);

  // Спавн нового скилл чека
  const spawnSkillCheck = useCallback((canvas) => {
    const skillCheckParams = generateSkillCheckParams(canvas);
    
    setGameState(prev => ({
      ...prev,
      skillCheck: skillCheckParams,
      lastCheckTime: Date.now(),
    }));
  }, [generateSkillCheckParams]);

  // Обработка нажатия (пробел или ЛКМ)
  const handleAction = useCallback(() => {
    if (!gameStateRef.current?.isRunning || !gameStateRef.current?.skillCheck?.isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = gameStateRef.current;
    const skillCheck = state.skillCheck;
    
    // Нормализуем угол стрелки (0 to 2*PI)
    let normalizedArrowAngle = skillCheck.angle % (Math.PI * 2);
    if (normalizedArrowAngle < 0) normalizedArrowAngle += Math.PI * 2;
    
    // Нормализуем границы целевой зоны
    let normalizedTargetStart = skillCheck.targetStartAngle % (Math.PI * 2);
    if (normalizedTargetStart < 0) normalizedTargetStart += Math.PI * 2;
    let normalizedTargetEnd = skillCheck.targetEndAngle % (Math.PI * 2);
    if (normalizedTargetEnd < 0) normalizedTargetEnd += Math.PI * 2;
    
    // Проверяем попадание в белую зону
    let isHit = false;
    
    // Если зона не пересекает границу 0/2PI
    if (normalizedTargetStart < normalizedTargetEnd) {
      isHit = normalizedArrowAngle >= normalizedTargetStart && normalizedArrowAngle <= normalizedTargetEnd;
    } else {
      // Зона пересекает границу 0/2PI (например от 350° до 10°)
      isHit = normalizedArrowAngle >= normalizedTargetStart || normalizedArrowAngle <= normalizedTargetEnd;
    }
    
    if (isHit) {
      // Попадание! +300 очков
      setGameState(prev => ({
        ...prev,
        score: prev.score + 300,
        skillCheck: null, // Сразу убираем скилл чек
        nextSpawnDelay: BASE_SPAWN_DELAY_SUCCESS,
      }));
      
      // Спавним новый через полсекунды
      setTimeout(() => {
        if (canvasRef.current && gameStateRef.current?.isRunning) {
          spawnSkillCheck(canvasRef.current);
        }
      }, BASE_SPAWN_DELAY_SUCCESS);
    } else {
      // Промах - скилл чек становится красным и исчезает через короткое время
      setGameState(prev => ({
        ...prev,
        skillCheck: { ...prev.skillCheck, isActive: false }, // Деактивируем но оставляем для анимации
        nextSpawnDelay: BASE_SPAWN_DELAY_FAIL,
      }));
      
      // Спавним новый через секунду
      setTimeout(() => {
        if (canvasRef.current && gameStateRef.current?.isRunning) {
          spawnSkillCheck(canvasRef.current);
        }
      }, BASE_SPAWN_DELAY_FAIL);
    }
  }, [spawnSkillCheck]);

  // Основной игровой цикл
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Обновляем позицию стрелки если скилл чек активен
    if (state.skillCheck && state.skillCheck.isActive) {
      let updatedSkillCheck = { ...state.skillCheck };
      
      // Вращаем стрелку
      updatedSkillCheck.angle += updatedSkillCheck.rotationDirection * ARROW_SPEED * deltaTime;
      
      // Обновляем тряску если она включена
      if (updatedSkillCheck.isShaking) {
        const shakeAmount = (SKILL_CHECK_RADIUS * updatedSkillCheck.sizeMultiplier) / 3;
        updatedSkillCheck.shakeOffset = {
          x: (Math.random() - 0.5) * 2 * shakeAmount,
          y: (Math.random() - 0.5) * 2 * shakeAmount,
        };
      } else {
        updatedSkillCheck.shakeOffset = { x: 0, y: 0 };
      }
      
      setGameState(prev => ({
        ...prev,
        skillCheck: updatedSkillCheck,
      }));
    }
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
    handleAction,
    setCanvasRef,
    initRound,
    canvasRef,
  };
}
