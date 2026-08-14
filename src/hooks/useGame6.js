import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const SKILL_CHECK_RADIUS = 100; // Радиус круга в пикселях
export const ARROW_LENGTH = SKILL_CHECK_RADIUS * 0.8; // Длина стрелки
export const WHITE_SECTOR_ANGLE = 36; // 10% от 360 градусов
export const ROTATION_SPEED = 2; // Скорость вращения (градусов в секунду)
export const SUCCESS_SCORE = 300; // Очки за попадание
export const SUCCESS_DELAY = 500; // Задержка перед следующим скилл чеком при успехе (мс)
export const FAIL_DELAY = 1000; // Задержка перед следующим скилл чеком при провале (мс)
export const RED_FLASH_DURATION = 300; // Длительность красной вспышки при провале (мс)

// Hook для логики игры 6
export function useGame6({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    gameOver: false,
    // Параметры скилл чека
    skillCheckActive: false,
    arrowAngle: 0, // Текущий угол стрелки (0-360)
    whiteSectorStart: 0, // Начальный угол белого сектора
    rotationDirection: 1, // 1 = по часовой, -1 = против часовой
    skillCheckPosition: { x: 50, y: 50 }, // Позиция в процентах (50,50 = центр)
    isShaking: false, // Трясется ли скилл чек
    shakeOffset: { x: 0, y: 0 }, // Смещение при тряске
    targetSizeMultiplier: 1, // Множитель размера зоны попадания (0.5, 1, или 2)
    lastSuccessTime: 0,
    redFlashActive: false, // Красная вспышка при провале
  });

  const gameStateRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(null);
  const nextSkillCheckTimeoutRef = useRef(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Генерация нового скилл чека
  const generateSkillCheck = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    // 85% шанс по часовой, 15% против
    const direction = Math.random() < 0.85 ? 1 : -1;

    // Случайный угол для белого сектора (0-360)
    const whiteSectorStart = Math.random() * 360;

    // 20% шанс смещения к одному из углов
    let positionX = 50;
    let positionY = 50;
    if (Math.random() < 0.20) {
      const cornerIndex = Math.floor(Math.random() * 4); // 0-3
      // Смещение 50% к углу (от центра к углу на 50% расстояния)
      const offsetX = cornerIndex === 0 || cornerIndex === 3 ? -25 : 25; // влево или вправо
      const offsetY = cornerIndex === 0 || cornerIndex === 1 ? -25 : 25; // вверх или вниз
      positionX = 50 + offsetX;
      positionY = 50 + offsetY;
    }

    // 10% шанс что будет трястись
    const isShaking = Math.random() < 0.10;

    // 5% шанс увеличенный размер, 5% уменьшенный, 90% нормальный
    let targetSizeMultiplier = 1;
    const sizeRoll = Math.random();
    if (sizeRoll < 0.05) {
      targetSizeMultiplier = 2; // Увеличен в 2 раза
    } else if (sizeRoll < 0.10) {
      targetSizeMultiplier = 0.5; // Уменьшен в 2 раза
    }

    setGameState(prev => ({
      ...prev,
      skillCheckActive: true,
      arrowAngle: 0,
      whiteSectorStart,
      rotationDirection: direction,
      skillCheckPosition: { x: positionX, y: positionY },
      isShaking,
      targetSizeMultiplier,
      redFlashActive: false,
    }));
  }, []);

  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastTimeRef.current = performance.now();

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      round: 1,
      gameOver: false,
      skillCheckActive: false,
      redFlashActive: false,
    }));

    // Первый скилл чек через небольшую задержку
    setTimeout(() => {
      generateSkillCheck();
    }, 500);
  }, [generateSkillCheck]);

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
    if (nextSkillCheckTimeoutRef.current) {
      clearTimeout(nextSkillCheckTimeoutRef.current);
    }
    lastTimeRef.current = null;
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      gameOver: false,
      skillCheckActive: false,
      arrowAngle: 0,
      whiteSectorStart: 0,
      rotationDirection: 1,
      skillCheckPosition: { x: 50, y: 50 },
      isShaking: false,
      shakeOffset: { x: 0, y: 0 },
      targetSizeMultiplier: 1,
      lastSuccessTime: 0,
      redFlashActive: false,
    });
  }, []);

  // Обработка нажатия (пробел или ЛКМ)
  const handleInput = useCallback(() => {
    const state = gameStateRef.current;
    if (!state?.isRunning || !state.skillCheckActive) return;

    const { arrowAngle, whiteSectorStart, targetSizeMultiplier } = state;
    
    // Нормализуем угол стрелки (0-360)
    const normalizedArrowAngle = ((arrowAngle % 360) + 360) % 360;
    
    // Вычисляем эффективный размер белого сектора с учетом множителя
    // При targetSizeMultiplier = 2, сектор становится 20% (72 градуса)
    // При targetSizeMultiplier = 0.5, сектор становится 5% (18 градусов)
    const effectiveSectorAngle = WHITE_SECTOR_ANGLE * targetSizeMultiplier;
    
    // Проверяем попадание в белый сектор
    // Белый сектор идет от whiteSectorStart до whiteSectorStart + effectiveSectorAngle
    let sectorEnd = whiteSectorStart + effectiveSectorAngle;
    
    // Обрабатываем случай когда сектор переходит через 360
    let isSuccess = false;
    
    if (sectorEnd <= 360) {
      // Сектор не переходит через 360
      isSuccess = normalizedArrowAngle >= whiteSectorStart && normalizedArrowAngle <= sectorEnd;
    } else {
      // Сектор переходит через 360 (например, 350-10)
      isSuccess = normalizedArrowAngle >= whiteSectorStart || 
                  normalizedArrowAngle <= (sectorEnd - 360);
    }

    if (isSuccess) {
      // Успех - добавляем очки и сразу скрываем скилл чек
      setGameState(prev => ({
        ...prev,
        score: prev.score + SUCCESS_SCORE,
        skillCheckActive: false,
        lastSuccessTime: Date.now(),
      }));

      // Новый скилл чек через 0.5 секунды
      nextSkillCheckTimeoutRef.current = setTimeout(() => {
        generateSkillCheck();
      }, SUCCESS_DELAY);
    } else {
      // Провал - красная вспышка и скрытие через короткое время
      setGameState(prev => ({
        ...prev,
        redFlashActive: true,
      }));

      // Скрываем скилл чек и красную вспышку через небольшую задержку
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          skillCheckActive: false,
          redFlashActive: false,
        }));

        // Новый скилл чек через 1 секунду
        nextSkillCheckTimeoutRef.current = setTimeout(() => {
          generateSkillCheck();
        }, FAIL_DELAY);
      }, RED_FLASH_DURATION);
    }
  }, [generateSkillCheck]);

  // Обработчик нажатия пробела
  const handleSpacePress = useCallback(() => {
    handleInput();
  }, [handleInput]);

  // Основной игровой цикл для обновления анимации
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    // Обновление угла стрелки если скилл чек активен
    if (state.skillCheckActive) {
      const angleChange = ROTATION_SPEED * deltaTime * state.rotationDirection;
      
      setGameState(prev => ({
        ...prev,
        arrowAngle: prev.arrowAngle + angleChange,
      }));
    }

    // Обновление тряски если активна
    if (state.isShaking && state.skillCheckActive) {
      // Быстрая тряска на 1/3 размера круга
      const shakeAmount = SKILL_CHECK_RADIUS / 3;
      const time = Date.now() / 50; // Быстрая частота
      const shakeX = Math.sin(time) * shakeAmount;
      const shakeY = Math.cos(time * 1.3) * shakeAmount;
      
      setGameState(prev => ({
        ...prev,
        shakeOffset: { x: shakeX, y: shakeY },
      }));
    } else if (state.skillCheckActive && !state.isShaking) {
      setGameState(prev => ({
        ...prev,
        shakeOffset: { x: 0, y: 0 },
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
      if (nextSkillCheckTimeoutRef.current) {
        clearTimeout(nextSkillCheckTimeoutRef.current);
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
    handleInput,
    setCanvasRef,
    initRound,
    canvasRef,
    generateSkillCheck,
  };
}
