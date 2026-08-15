import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const SKILL_CHECK_SIZE = 200; // Размер скилл чека в пикселях (диаметр круга)
export const TARGET_ZONE_PERCENT = 20; // 20% белая зона попадания (увеличено в 2 раза)
export const ARROW_SPEED = 270; // Скорость вращения стрелки (градусов в секунду) (увеличено в 1.5 раза)
export const SHAKE_AMOUNT = 5; // Амплитуда тряски в пикселях (землетрясение)
export const SHAKE_DURATION = 300; // Длительность тряски в миллисекундах

// Шансы
export const CHANCE_CLOCKWISE = 0.85; // 85% по часовой стрелке
export const CHANCE_OFFSET_CORNER = 0.20; // 20% смещение к углу
export const CHANCE_SHAKE = 0.10; // 10% тряска
export const CHANCE_SIZE_MODIFIER = 0.05; // 5% изменение размера зоны
export const CHANCE_MIRRORED = 0.10; // 10% зеркальное отражение
export const CHANCE_MOVING_ZONE = 0.15; // 15% шанс движущейся зоны
export const CHANCE_SLOW_ARROW = 0.10; // 10% медленная стрелка x0.5
export const CHANCE_FAST_ARROW = 0.10; // 10% быстрая стрелка x2
export const CHANCE_LARGE_SKILLCHECK = 0.10; // 10% большой скиллчек x1.5
export const CHANCE_SMALL_SKILLCHECK = 0.10; // 10% маленький скиллчек x0.75

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
    isMirrored: false, // Зеркальное отражение скиллчека
    floatingText: null, // Текст для всплывающих очков { text, x, y, startTime, color }
    zoneMoving: false, // Движущаяся зона
    zoneMoveDirection: 1, // Направление движения зоны (1 = по часовой, -1 = против)
    zoneMoveSpeed: 30, // Скорость движения зоны (градусов в секунду)
    sparks: [], // Массив искр [{x, y, vx, vy, life, startTime}]
    shakeSparks: [], // Массив искр тряски [{x, y, vx, vy, life, startTime}]
    arrowSpeedMultiplier: 1, // Множитель скорости стрелки (0.5, 1, 2)
    skillCheckSizeMultiplier: 1, // Множитель размера всего скиллчека (0.75, 1, 1.5)
    activeModifiers: [], // Список активных модификаторов для текущего скиллчека
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
    
    // Определяем зеркальное отражение (10% шанс)
    const isMirrored = Math.random() < CHANCE_MIRRORED;
    
    // Определяем движущуюся зону (15% шанс)
    const zoneMoving = Math.random() < CHANCE_MOVING_ZONE;
    const zoneMoveDirection = Math.random() < 0.5 ? 1 : -1; // Случайное направление

    // Определяем скорость стрелки (10% медленно x0.5, 10% быстро x2)
    let arrowSpeedMultiplier = 1;
    let skillCheckSizeMultiplier = 1;
    const activeModifiers = [];
    
    const arrowRoll = Math.random();
    if (arrowRoll < CHANCE_SLOW_ARROW) {
      arrowSpeedMultiplier = 0.5;
      activeModifiers.push('slow');
    } else if (arrowRoll < CHANCE_SLOW_ARROW + CHANCE_FAST_ARROW) {
      arrowSpeedMultiplier = 2;
      activeModifiers.push('fast');
    }
    
    // Определяем размер скиллчека (10% большой x1.5, 10% маленький x0.75)
    const sizeCheckRoll = Math.random();
    if (sizeCheckRoll < CHANCE_LARGE_SKILLCHECK) {
      skillCheckSizeMultiplier = 1.5;
      activeModifiers.push('large');
    } else if (sizeCheckRoll < CHANCE_LARGE_SKILLCHECK + CHANCE_SMALL_SKILLCHECK) {
      skillCheckSizeMultiplier = 0.75;
      activeModifiers.push('small');
    }

    // Добавляем модификаторы в список для отображения
    if (isShaking) activeModifiers.push('shake');
    if (isMirrored) activeModifiers.push('mirror');
    if (zoneMoving) activeModifiers.push('moving');

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
      isClockwise: !isMirrored, // Если зеркальное - стрелка едет против часовой стрелки
      showFailAnimation: false,
      skillCheckPosition: { x: positionX, y: positionY },
      isShaking: isShaking,
      zoneSizeMultiplier: zoneSizeMultiplier,
      lastSkillCheckTime: Date.now(),
      isMirrored: isMirrored,
      zoneMoving: zoneMoving,
      zoneMoveDirection: zoneMoveDirection,
      sparks: [], // Сбрасываем искры при новом скиллчеке
      shakeSparks: [], // Сбрасываем искры тряски при новом скиллчеке
      arrowSpeedMultiplier: arrowSpeedMultiplier,
      skillCheckSizeMultiplier: skillCheckSizeMultiplier,
      activeModifiers: activeModifiers,
    }));
  }, [CHANCE_OFFSET_CORNER, CHANCE_SIZE_MODIFIER, CHANCE_SHAKE, CHANCE_MIRRORED, CHANCE_MOVING_ZONE, CHANCE_SLOW_ARROW, CHANCE_FAST_ARROW, CHANCE_LARGE_SKILLCHECK, CHANCE_SMALL_SKILLCHECK]);

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
    
    // Для зеркального режима отражаем зону по вертикали для проверки попадания
    // Это должно соответствовать логике отрисовки в Game6.jsx
    let effectiveZoneStart = state.targetZoneStart;
    if (state.isMirrored) {
      effectiveZoneStart = (360 - state.targetZoneStart - zoneSize + 360) % 360;
    }
    
    // Проверяем попадание в белую зону
    // Зона начинается с effectiveZoneStart и идет по часовой стрелке
    let zoneEnd = (effectiveZoneStart + zoneSize) % 360;
    
    let hit = false;
    
    if (zoneEnd > effectiveZoneStart) {
      // Зона не пересекает 0 градусов
      hit = normalizedArrowAngle >= effectiveZoneStart && normalizedArrowAngle <= zoneEnd;
    } else {
      // Зона пересекает 0 градусов
      hit = normalizedArrowAngle >= effectiveZoneStart || normalizedArrowAngle <= zoneEnd;
    }

    // Получаем позицию для floating text
    const centerX = (state.skillCheckPosition.x / 100) * canvas.width;
    const centerY = (state.skillCheckPosition.y / 100) * canvas.height;

    if (hit) {
      // ПОПАДАНИЕ: +300 очков, скилл чек исчезает сразу
      setGameState(prev => ({
        ...prev,
        score: prev.score + 300,
        skillCheckActive: false,
        showFailAnimation: false,
        floatingText: { 
          text: '+300', 
          x: centerX, 
          y: centerY, 
          startTime: Date.now() 
        },
      }));
      
      // Новый скилл чек без задержки (сразу)
      spawnSkillCheck();
    } else {
      // ПРОВАЛ: стрелка не в зоне
      setGameState(prev => ({
        ...prev,
        skillCheckActive: false,
        showFailAnimation: false,
        floatingText: {
          text: '+0',
          x: centerX,
          y: centerY,
          startTime: Date.now(),
          color: '#ff0000'
        },
      }));

      // Новый скилл чек сразу (без задержки)
      spawnSkillCheck();
    }
  }, [spawnSkillCheck]);

  // Основной игровой цикл
  const updateGame = useCallback((deltaTime) => {
    const state = gameStateRef.current;
    if (!state?.isRunning) return;

    // Обновляем угол стрелки если скилл чек активен
    if (state.skillCheckActive) {
      const direction = state.isClockwise ? 1 : -1;
      const newAngle = (state.arrowAngle + direction * ARROW_SPEED * state.arrowSpeedMultiplier * deltaTime) % 360;

      setGameState(prev => ({
        ...prev,
        arrowAngle: newAngle,
      }));
    }

    // Обновляем движущуюся зону если активна
    if (state.skillCheckActive && state.zoneMoving) {
      const zoneSize = TARGET_ZONE_PERCENT * state.zoneSizeMultiplier;
      const newTargetZoneStart = (state.targetZoneStart + state.zoneMoveDirection * state.zoneMoveSpeed * deltaTime + 360) % 360;
      
      setGameState(prev => ({
        ...prev,
        targetZoneStart: newTargetZoneStart,
      }));
    }

    // Обновляем искры (от отскока)
    if (state.sparks && state.sparks.length > 0) {
      const now = Date.now();
      const updatedSparks = state.sparks.filter(spark => {
        const elapsed = (now - spark.startTime) / 1000;
        return elapsed < spark.life;
      }).map(spark => ({
        ...spark,
        x: spark.x + spark.vx * deltaTime,
        y: spark.y + spark.vy * deltaTime,
      }));
      
      setGameState(prev => ({
        ...prev,
        sparks: updatedSparks,
      }));
    }

    // Обновляем искры тряски (если скиллчек трясется)
    if (state.isShaking && state.skillCheckActive) {
      const canvas = canvasRef.current;
      if (canvas) {
        const centerX = (state.skillCheckPosition.x / 100) * canvas.width;
        const centerY = (state.skillCheckPosition.y / 100) * canvas.height;
        const skillCheckRadius = SKILL_CHECK_SIZE / 2;
        
        const now = Date.now();
        // Фильтруем старые искры
        let updatedShakeSparks = state.shakeSparks.filter(spark => {
          const elapsed = (now - spark.startTime) / 1000;
          return elapsed < spark.life;
        }).map(spark => ({
          ...spark,
          x: spark.x + spark.vx * deltaTime,
          y: spark.y + spark.vy * deltaTime,
        }));
        
        // Добавляем новые искры сзади трясущегося скиллчека (случайные позиции по краю)
        if (Math.random() < 0.3) { // 30% шанс каждый кадр добавить искру
          const angle = Math.random() * Math.PI * 2;
          const edgeX = centerX + Math.cos(angle) * skillCheckRadius * 0.9;
          const edgeY = centerY + Math.sin(angle) * skillCheckRadius * 0.9;
          const sparkAngle = angle + Math.PI; // Искры летят наружу от центра
          const speed = 30 + Math.random() * 50;
          
          updatedShakeSparks.push({
            x: edgeX,
            y: edgeY,
            vx: Math.cos(sparkAngle) * speed,
            vy: Math.sin(sparkAngle) * speed,
            life: 0.2 + Math.random() * 0.15, // 200-350мс жизни
            startTime: now
          });
        }
        
        setGameState(prev => ({
          ...prev,
          shakeSparks: updatedShakeSparks,
        }));
      }
    }

    // Проверяем, ушла ли стрелка за пределы зоны прохождения (провал скиллчека)
    if (state.skillCheckActive) {
      let normalizedArrowAngle = state.arrowAngle % 360;
      if (normalizedArrowAngle < 0) normalizedArrowAngle += 360;

      const zoneSize = TARGET_ZONE_PERCENT * state.zoneSizeMultiplier;
      let zoneEnd = (state.targetZoneStart + zoneSize) % 360;

      let inZone = false;
      
      if (zoneEnd > state.targetZoneStart) {
        inZone = normalizedArrowAngle >= state.targetZoneStart && normalizedArrowAngle <= zoneEnd;
      } else {
        inZone = normalizedArrowAngle >= state.targetZoneStart || normalizedArrowAngle <= zoneEnd;
      }

      // Если стрелка была в зоне и теперь вышла за её пределы после прохождения - это провал
      // Отслеживаем, прошла ли стрелка зону полностью
      const hasPassedZone = (() => {
        if (state.isClockwise) {
          // По часовой стрелке: стрелка должна пройти от targetZoneStart до zoneEnd
          return normalizedArrowAngle > zoneEnd && normalizedArrowAngle < state.targetZoneStart + 180;
        } else {
          // Против часовой стрелки (зеркально): стрелка идет от 0 в минус
          const effectiveAngle = (360 - normalizedArrowAngle) % 360;
          const effectiveZoneStart = (360 - state.targetZoneStart) % 360;
          const effectiveZoneEnd = (360 - zoneEnd) % 360;
          
          if (effectiveZoneEnd > effectiveZoneStart) {
            return effectiveAngle > effectiveZoneEnd;
          } else {
            return effectiveAngle > effectiveZoneEnd && effectiveAngle < effectiveZoneStart;
          }
        }
      })();

      // Простая логика: если стрелка ушла далеко от зоны (пролетела мимо) - это провал
      // Проверяем, находится ли стрелка в "зоне провала" - после целевой зоны
      const pastZoneThreshold = 30; // градусов после зоны считается пролетом
      let missed = false;
      
      if (state.isClockwise) {
        // По часовой: зона от targetZoneStart до zoneEnd
        // Пролет если угол больше zoneEnd + порог но меньше чем полный круг до зоны
        const afterZone = (zoneEnd + pastZoneThreshold) % 360;
        if (zoneEnd + pastZoneThreshold < 360) {
          missed = normalizedArrowAngle > zoneEnd + pastZoneThreshold && 
                   normalizedArrowAngle < state.targetZoneStart;
        } else {
          missed = normalizedArrowAngle > zoneEnd + pastZoneThreshold || 
                   normalizedArrowAngle < state.targetZoneStart;
        }
      } else {
        // Против часовой: зона та же, но стрелка идет в обратную сторону
        // Пролет если угол меньше targetZoneStart - порог
        const beforeZone = (state.targetZoneStart - pastZoneThreshold + 360) % 360;
        missed = normalizedArrowAngle < state.targetZoneStart - pastZoneThreshold &&
                 normalizedArrowAngle > zoneEnd;
      }

      if (missed) {
        // Стрелка перелетела за зону - провал
        setGameState(prev => ({
          ...prev,
          skillCheckActive: false,
          showFailAnimation: true,
        }));
        
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            showFailAnimation: false,
          }));
          spawnSkillCheck();
        }, 300);
      }
    }

    // Очищаем floating text после 500мс
    if (state.floatingText) {
      const elapsed = Date.now() - state.floatingText.startTime;
      if (elapsed > 500) {
        setGameState(prev => ({
          ...prev,
          floatingText: null,
        }));
      }
    }
  }, [spawnSkillCheck]);

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
    floatingText: gameState.floatingText,
    activeModifiers: gameState.activeModifiers,
  };
}
