import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const SKILL_CHECK_SIZE = 200; // Размер скилл чека в пикселях (диаметр круга)
export const TARGET_ZONE_PERCENT = 20; // 20% белая зона попадания (увеличено в 2 раза)
export const ARROW_SPEED = 270; // Скорость вращения стрелки (градусов в секунду) (увеличено в 1.5 раза)
export const SHAKE_AMOUNT = 0.5; // Амплитуда тряски (землетрясение)
export const SHAKE_SPEED = 20; // Скорость тряски (Гц) (увеличена для хаотичности)

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
  const shakeOffsetRef = useRef({ x: 0, y: 0 }); // Смещение для тряски

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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
    
    // Запускаем первый скилл чек сразу (без задержки)
    spawnSkillCheck();
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

    // Для циферблата: стрелка всегда начинает с 12 часов (0 градусов)
    // Зона для попадания спавнится случайно в диапазоне от 2 часов (60°) до 10 часов (300°)
    // Это означает зону от 60° до 300° (против часовой стрелки от 2 до 10 часов через верх)
    // Но так как у нас зона имеет размер, мы спавним её начало в этом диапазоне
    const minZoneAngle = 60; // 2 часа
    const maxZoneAngle = 300; // 10 часов
    const randomTargetZoneStart = minZoneAngle + Math.random() * (maxZoneAngle - minZoneAngle);

    setGameState(prev => ({
      ...prev,
      skillCheckActive: true,
      arrowAngle: 0, // Стрелка всегда начинается с 12 часов (0 градусов)
      targetZoneStart: randomTargetZoneStart, // Случайная позиция зоны в диапазоне 2-10 часов
      isClockwise: true, // Всегда по часовой стрелке
      showFailAnimation: false,
      skillCheckPosition: { x: positionX, y: positionY },
      isShaking: isShaking,
      zoneSizeMultiplier: zoneSizeMultiplier,
      lastSkillCheckTime: Date.now(),
    }));
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

    // Проверка на провал: если стрелка ушла дальше чем на 1 час (30 градусов) от конца зоны
    // Зона заканчивается на zoneEnd, если стрелка больше чем zoneEnd + 30 - это провал
    const failMargin = 30; // 1 час = 30 градусов
    let failed = false;
    
    // Если стрелка прошла зону и ушла дальше чем на 30 градусов от её конца
    if (!hit) {
      // Вычисляем расстояние от конца зоны до стрелки (по часовой стрелке)
      let distanceFromZoneEnd = (normalizedArrowAngle - zoneEnd + 360) % 360;
      // Если расстояние меньше 180 (стрелка еще не сделала полный круг) и больше failMargin
      if (distanceFromZoneEnd < 180 && distanceFromZoneEnd > failMargin) {
        failed = true;
      }
    }

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
    } else if (failed) {
      // ПРОВАЛ: стрелка ушла слишком далеко от зоны
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
        
        // Новый скилл чек через 1 секунду
        setTimeout(() => {
          spawnSkillCheck();
        }, 1000);
      }, 300); // Пара долей секунд (300мс)
    }
    // Если не попал но и не провалил (стрелка еще не дошла до зоны или в пределах margin) - ничего не делаем, ждем следующего клика
  }, [spawnSkillCheck]);

  // Основной игровой цикл
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    // Обновляем угол стрелки если скилл чек активен
    if (state.skillCheckActive) {
      const direction = state.isClockwise ? 1 : -1;
      const newAngle = (state.arrowAngle + direction * ARROW_SPEED * deltaTime) % 360;
      
      // Обновляем тряску если нужно (землетрясение - более хаотичное движение)
      if (state.isShaking) {
        const shakeTime = Date.now();
        // Используем комбинацию синусов для более хаотичного движения землетрясения
        shakeOffsetRef.current = {
          x: (Math.sin(shakeTime * SHAKE_SPEED * Math.PI / 1000) + 
              Math.sin(shakeTime * SHAKE_SPEED * 1.7 * Math.PI / 1000) * 0.5) * SHAKE_AMOUNT,
          y: (Math.cos(shakeTime * SHAKE_SPEED * Math.PI / 1000) + 
              Math.cos(shakeTime * SHAKE_SPEED * 1.3 * Math.PI / 1000) * 0.5) * SHAKE_AMOUNT,
        };
      } else {
        shakeOffsetRef.current = { x: 0, y: 0 };
      }

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
