import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const SKILL_CHECK_SIZE = 200; // Размер скилл чека в пикселях (диаметр круга)
export const TARGET_ZONE_PERCENT = 20; // 20% белая зона попадания (увеличено в 2 раза)
export const ARROW_SPEED = 270; // Скорость вращения стрелки (градусов в секунду) (увеличено в 1.5 раза)
export const SHAKE_AMOUNT = 5; // Амплитуда тряски в пикселях (землетрясение)
export const SHAKE_DURATION = 0.3; // Длительность тряски в секундах

// Шансы
export const CHANCE_CLOCKWISE = 0.85; // 85% по часовой стрелке
export const CHANCE_OFFSET_CORNER = 0.20; // 20% смещение к углу
export const CHANCE_SHAKE = 0.10; // 10% тряска
export const CHANCE_SIZE_MODIFIER = 0.05; // 5% изменение размера зоны

export function useGame6({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    skillCheckActive: false,
    arrowAngle: 0, // Угол стрелки в градусах (0 = верх, по часовой стрелке)
    targetZoneStart: 0, // Начало белой зоны в градусах
    isClockwise: true, // Направление вращения
    showFailAnimation: false, // Показывать ли анимацию провала
    skillCheckPosition: { x: 50, y: 50 }, // Позиция скилл чека в % от центра (50,50 = центр)
    isShaking: false, // Трясется ли скилл чек
    zoneSizeMultiplier: 1, // Множитель размера зоны (0.5, 1, или 2)
    lastSkillCheckTime: 0,
    gameOver: false,
  });

  const gameStateRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const lastTimeRef = useRef(null);
  const shakeOffsetRef = useRef({ x: 0, y: 0 }); // Смещение для тряски в пикселях
  const shakeTimeoutRef = useRef(null); // Таймаут для сброса тряски

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Создание нового скилл чека
  const spawnSkillCheck = useCallback(() => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Определяем позицию (20% шанс смещения к углу)
    let positionX = 50; // Центр по умолчанию
    let positionY = 50;
    
    if (Math.random() < CHANCE_OFFSET_CORNER) {
      // Смещение к одному из 4 углов - но на середине линии между центром и углом (25% вместо 50%)
      const corner = Math.floor(Math.random() * 4);
      const offset = 25; // 25% смещение (середина между центром и углом)
      
      switch(corner) {
        case 0: // Верхний левый
          positionX = 50 - offset;
          positionY = 50 - offset;
          break;
        case 1: // Верхний правый
          positionX = 50 + offset;
          positionY = 50 - offset;
          break;
        case 2: // Нижний левый
          positionX = 50 - offset;
          positionY = 50 + offset;
          break;
        case 3: // Нижний правый
          positionX = 50 + offset;
          positionY = 50 + offset;
          break;
      }
    }

    // Определяем размер зоны (5% шанс изменения)
    let zoneSizeMultiplier = 1;
    const sizeRoll = Math.random();
    if (sizeRoll < CHANCE_SIZE_MODIFIER) {
      zoneSizeMultiplier = 0.5; // Уменьшенная зона
    } else if (sizeRoll < CHANCE_SIZE_MODIFIER * 2) {
      zoneSizeMultiplier = 2; // Увеличенная зона
    }

    // Определяем тряску (10% шанс)
    const isShaking = Math.random() < CHANCE_SHAKE;
    
    // Если тряска активна, запускаем таймер на сброс через 0.3с
    if (isShaking && shakeTimeoutRef.current) {
      clearTimeout(shakeTimeoutRef.current);
    }
    if (isShaking) {
      shakeTimeoutRef.current = setTimeout(() => {
        shakeOffsetRef.current = { x: 0, y: 0 };
      }, SHAKE_DURATION * 1000);
    }

    // Для циферблата: стрелка всегда начинает с 12 часов (0 градусов)
    // Зона для попадания спавнится случайно в диапазоне от 4 часов (120°) до 10 часов (300°)
    const minZoneAngle = 120; // 4 часа
    const maxZoneAngle = 300; // 10 часов
    const randomTargetZoneStart = minZoneAngle + Math.random() * (maxZoneAngle - minZoneAngle);

    setGameState(prev => ({
      ...prev,
      skillCheckActive: true,
      arrowAngle: 0, // Стрелка всегда начинается с 12 часов (0 градусов)
      targetZoneStart: randomTargetZoneStart, // Случайная позиция зоны в диапазоне 4-10 часов
      isClockwise: true, // Всегда по часовой стрелке
      showFailAnimation: false,
      skillCheckPosition: { x: positionX, y: positionY },
      isShaking: isShaking,
      zoneSizeMultiplier: zoneSizeMultiplier,
      lastSkillCheckTime: Date.now(),
    }));
  }, []);

  // Инициализация нового раунда
  const initRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      skillCheckActive: false,
      arrowAngle: 0,
      targetZoneStart: 60, // Зона спавна с 2 часов (60 градусов) до 10 часов (300 градусов)
      isClockwise: true, // Всегда по часовой стрелке для циферблата
      showFailAnimation: false,
      skillCheckPosition: { x: 50, y: 50 },
      isShaking: false,
      zoneSizeMultiplier: 1,
      lastSkillCheckTime: 0,
      gameOver: false,
    }));
    
    // Запускаем первый скилл чек сразу (без задержки) - вызываем после обновления стейта
    setTimeout(() => {
      const state = gameStateRef.current;
      if (state?.isRunning) {
        spawnSkillCheck();
      }
    }, 0);
  }, [spawnSkillCheck]);

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
    lastTimeRef.current = null;
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      skillCheckActive: false,
      arrowAngle: 0,
      targetZoneStart: 0,
      isClockwise: true,
      showFailAnimation: false,
      skillCheckPosition: { x: 50, y: 50 },
      isShaking: false,
      zoneSizeMultiplier: 1,
      lastSkillCheckTime: 0,
      gameOver: false,
    });
  }, []);

  // Обработка нажатия (пробел или ЛКМ)
  const handleInput = useCallback(() => {
    const state = gameStateRef.current;
    if (!state?.isRunning || !state.skillCheckActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Нормализуем угол стрелки (0-360)
    let normalizedArrowAngle = state.arrowAngle % 360;
    if (normalizedArrowAngle < 0) normalizedArrowAngle += 360;

    // Вычисляем размер зоны с учетом множителя
    const zoneSize = TARGET_ZONE_PERCENT * state.zoneSizeMultiplier;
    
    // Проверяем попадание в белую зону
    // Зона начинается с targetZoneStart и идет по часовой стрелке
    let zoneEnd = (state.targetZoneStart + zoneSize) % 360;
    
    let hit = false;
    
    if (zoneEnd > state.targetZoneStart) {
      // Зона не пересекает 0 градусов
      hit = normalizedArrowAngle >= state.targetZoneStart && normalizedArrowAngle <= zoneEnd;
    } else {
      // Зона пересекает 0 градусов
      hit = normalizedArrowAngle >= state.targetZoneStart || normalizedArrowAngle <= zoneEnd;
    }

    // Проверка на провал: любая попытка нажать когда стрелка НЕ в зоне - это провал
    // Это соответствует требованию "любая попытка пройти скилл чек когда стрелка не находится в зоне прохождения скилл чека ведет к провалу"
    let failed = !hit;

    if (hit) {
      // ПОПАДАНИЕ: +300 очков, скилл чек исчезает сразу
      setGameState(prev => ({
        ...prev,
        score: prev.score + 300,
        skillCheckActive: false,
        showFailAnimation: false,
      }));
      
      // Новый скилл чек без задержки (сразу)
      spawnSkillCheck();
    } else {
      // ПРОВАЛ: стрелка не в зоне
      setGameState(prev => ({
        ...prev,
        skillCheckActive: false,
        showFailAnimation: true,
      }));
      
      // Показываем анимацию провала briefly
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          showFailAnimation: false,
        }));
        
        // Новый скилл чек сразу (без задержки)
        spawnSkillCheck();
      }, 300); // Пара долей секунд (300мс) для показа анимации
    }
  }, [spawnSkillCheck]);

  // Основной игровой цикл
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    // Обновляем угол стрелки если скилл чек активен
    if (state.skillCheckActive) {
      const direction = state.isClockwise ? 1 : -1;
      const newAngle = (state.arrowAngle + direction * ARROW_SPEED * deltaTime) % 360;

      setGameState(prev => ({
        ...prev,
        arrowAngle: newAngle,
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
    handleInput,
    setCanvasRef,
    initRound,
    canvasRef,
    shakeOffsetRef,
  };
}
