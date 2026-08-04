import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const BASE_GAP_WIDTH = 160; // Базовая ширина разрыва
export const WELD_SIZE_RATIO = 1.0; // Размер точки = 100% от ширины шва
export const COOL_DOWN_TIME = 2000; // Время остывания в мс
export const FADE_DURATION = 2000; // Длительность остывания (2 секунды)
export const MAX_WELD_POINTS = 2000; // Максимальное количество точек сварки
export const WIN_COVERAGE = 98; // Процент покрытия для победы (фактический)
export const MAX_ROUNDS = 3; // Максимальное количество раундов для завершения уровня
export const INNER_TRIGGER_RATIO = 1/3; // Внутренняя зона триггера = 1/3 радиуса
export const WELDING_GUN_SPEED = 200; // Скорость движения сопла в пикселях в секунду
export const WELDING_GUN_WIDTH = 400; // Ширина текстуры сварочного аппарата
export const WELDING_GUN_HEIGHT = 500; // Высота текстуры сварочного аппарата
export const NOZZLE_OFFSET_Y = 0; // Смещение сопла от низа аппарата (теперь 0 - сопло в самом низу)

// Пиксельный размер (4x4)
export const PIXEL_SIZE = 4;

// Параметры для физической симуляции сварки
export const WELD_DROP_SIZE_VARIATION = 0.1; // ±10% вариация размера капли
export const WELD_SURFACE_TENSION = 0.3; // Поверхностное натяжение
export const WELD_VISCOSITY = 0.7; // Вязкость расплавленного металла
export const WELD_COALESCENCE_RADIUS = 1.5; // Радиус слияния капель (в радиусах капли)
export const WELD_SPREAD_FACTOR = 0.4; // Фактор растекания капли
export const WELD_PENETRATION_DEPTH = 0.6; // Глубина проникновения в зазор

// Генерация случайного разрыва с неравномерной шириной
export function generateGapPath(width, height) {
  const points = [];
  const widths = [];
  const centerY = height / 2;
  const segmentCount = 100;
  const segmentLength = width / segmentCount;
  
  // Параметры для генерации извилистой линии
  const baseFrequency = 0.3 + Math.random() * 0.4;
  const amplitude = height * 0.1 + Math.random() * height * 0.08;
  const noiseAmplitude = height * 0.03;
  const phaseShift = Math.random() * Math.PI * 2;
  
  for (let i = 0; i <= segmentCount; i++) {
    const x = i * segmentLength;
    const t = i / segmentCount;
    
    // Комбинируем несколько синусоид для естественного вида
    let y = centerY + Math.sin(t * Math.PI * baseFrequency * 2 + phaseShift) * amplitude;
    y += Math.sin(t * Math.PI * baseFrequency * 4 + phaseShift * 1.5) * (amplitude * 0.4);
    y += Math.sin(t * Math.PI * 6 + phaseShift * 0.7) * (amplitude * 0.2);
    
    // Добавляем шум для неровности
    y += (Math.random() - 0.5) * noiseAmplitude;
    
    // Ограничиваем y в пределах листа (с запасом чтобы шов не выходил за край)
    const maxGapWidth = BASE_GAP_WIDTH * 0.6;
    const halfGap = maxGapWidth / 2;
    y = Math.max(height * 0.15 + halfGap, Math.min(height * 0.85 - halfGap, y));
    
    points.push({ x, y });
    
    // Ширина шва всегда фиксирована = 60% от базовой ширины разрыва
    const w = BASE_GAP_WIDTH * 0.6;
    widths.push(w);
  }
  
  return { points, widths };
}

// Проверка находится ли точка в зоне шва
export function isPointInGapZone(x, y, gapPoints, gapWidths, weldRadius, canvasWidth, sheetMargin = 0) {
  if (gapPoints.length === 0) return false;

  // Корректируем x и y с учетом отступа листа
  const adjustedX = x - sheetMargin;
  const adjustedY = y - sheetMargin;
  
  // Проверяем что x находится в пределах металла
  if (adjustedX < 0 || adjustedX > canvasWidth) return false;
  
  // Находим ближайшую точку на центральной линии разрыва
  let minDist = Infinity;
  let closestWidth = 0;
  
  // Оптимизация: проверяем только точки поблизости по X
  const approximateIndex = Math.floor((adjustedX / canvasWidth) * (gapPoints.length - 1));
  const startIndex = Math.max(0, approximateIndex - 5);
  const endIndex = Math.min(gapPoints.length - 1, approximateIndex + 5);

  for (let i = startIndex; i <= endIndex; i++) {
    const p = gapPoints[i];
    const dist = Math.hypot(adjustedX - p.x, adjustedY - p.y);
    if (dist < minDist) {
      minDist = dist;
      closestWidth = gapWidths[i];
    }
  }

  // Радиус зоны шва = половина ширины разрыва + допуск для сварки
  const gapRadius = closestWidth / 2;
  
  // Разрешаем сварку если центр курсора попадает в зону шва (половина ширины шва)
  return minDist <= gapRadius;
}

// Проверка возможности наваривания на существующую сварку
export function canWeldOnExisting(x, y, radius, cooledPoints, allWeldPoints) {
  // Можно варить на любую существующую сварку (остывшую или горячую)
  const allPoints = [...cooledPoints, ...allWeldPoints];
  
  for (let p of allPoints) {
    const localRadius = (p.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
    const dist = Math.hypot(x - p.x, y - p.y);
    // Проверяем попадание во внутреннюю зону (1/3 радиуса предыдущей точки)
    if (dist < (localRadius * INNER_TRIGGER_RATIO)) {
      return true;
    }
  }
  return false;
}

// Генерация пиксельной формы капли с неровностями
function generateDropShape(cx, cy, baseRadius, pixelSize) {
  const pixels = [];
  const variation = WELD_DROP_SIZE_VARIATION;
  
  // Создаем неровную форму капли используя шум Перлина-подобный подход
  const angleSteps = 16; // Количество угловых шагов для формы капли
  const radii = [];
  
  for (let i = 0; i < angleSteps; i++) {
    const angle = (i / angleSteps) * Math.PI * 2;
    // Вариация радиуса ±10% + дополнительный шум
    const radiusVar = baseRadius * (1 + (Math.random() - 0.5) * 2 * variation);
    radii.push(radiusVar);
  }
  
  // Интерполяция между угловыми точками для создания плавной но неровной формы
  const interpolateRadius = (angle) => {
    const index = (angle / (Math.PI * 2)) * angleSteps;
    const lowerIndex = Math.floor(index) % angleSteps;
    const upperIndex = (lowerIndex + 1) % angleSteps;
    const t = index - Math.floor(index);
    return radii[lowerIndex] * (1 - t) + radii[upperIndex] * t;
  };
  
  // Заполняем пиксели внутри формы капли
  const gridRadius = Math.ceil(baseRadius * (1 + variation) / pixelSize);
  
  for (let dy = -gridRadius; dy <= gridRadius; dy++) {
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      const px = dx * pixelSize;
      const py = dy * pixelSize;
      const angle = Math.atan2(py, px);
      const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
      const maxRadiusAtAngle = interpolateRadius(normalizedAngle);
      
      const dist = Math.hypot(px, py);
      
      // Добавляем поверхностное натяжение - края более гладкие
      const edgeFactor = 1 - (dist / maxRadiusAtAngle);
      const tensionThreshold = edgeFactor > WELD_SURFACE_TENSION ? 1 : 0.7;
      
      if (dist <= maxRadiusAtAngle * tensionThreshold) {
        pixels.push({
          x: Math.round(cx / pixelSize) * pixelSize + px,
          y: Math.round(cy / pixelSize) * pixelSize + py,
          depth: 1 // Базовая глубина проникновения
        });
      }
    }
  }
  
  return pixels;
}

// Слияние близких капель (коалесценция)
function coalesceDrops(pixels, existingPixels, pixelSize) {
  const mergedPixels = new Map();
  
  // Добавляем существующие пиксели
  existingPixels.forEach(p => {
    const key = `${p.x},${p.y}`;
    mergedPixels.set(key, { x: p.x, y: p.y, depth: p.depth || 1 });
  });
  
  // Добавляем новые пиксели с учетом слияния
  pixels.forEach(p => {
    const key = `${p.x},${p.y}`;
    if (mergedPixels.has(key)) {
      // Увеличиваем глубину при наложении
      const existing = mergedPixels.get(key);
      existing.depth = Math.min(3, existing.depth + WELD_VISCOSITY);
    } else {
      mergedPixels.set(key, { x: p.x, y: p.y, depth: WELD_PENETRATION_DEPTH });
    }
  });
  
  // Распространение металла по соседним пикселям (растекание)
  const spreadPixels = new Map(mergedPixels);
  mergedPixels.forEach((pixel, key) => {
    if (pixel.depth > 1) {
      // Избыток металла растекается к соседям
      const excessDepth = pixel.depth - 1;
      const spreadAmount = excessDepth * WELD_SPREAD_FACTOR;
      
      // Соседние пиксели
      const neighbors = [
        { x: pixel.x - pixelSize, y: pixel.y },
        { x: pixel.x + pixelSize, y: pixel.y },
        { x: pixel.x, y: pixel.y - pixelSize },
        { x: pixel.x, y: pixel.y + pixelSize }
      ];
      
      neighbors.forEach(n => {
        const nKey = `${n.x},${n.y}`;
        if (!spreadPixels.has(nKey)) {
          spreadPixels.set(nKey, { x: n.x, y: n.y, depth: spreadAmount * 0.5 });
        } else {
          const existing = spreadPixels.get(nKey);
          existing.depth = Math.min(3, existing.depth + spreadAmount * 0.3);
        }
      });
    }
  });
  
  return Array.from(spreadPixels.values());
}

// Создание физического шва сварки
export function createWeldDrop(x, y, baseWidth, existingPixels, pixelSize = PIXEL_SIZE) {
  // Базовый радиус капли с вариацией ±10%
  const sizeVariation = 1 + (Math.random() - 0.5) * 2 * WELD_DROP_SIZE_VARIATION;
  const baseRadius = (baseWidth * WELD_SIZE_RATIO / 2) * sizeVariation;
  
  // Генерируем пиксельную форму капли
  const dropPixels = generateDropShape(x, y, baseRadius, pixelSize);
  
  // Сливаем с существующими пикселями
  const mergedPixels = coalesceDrops(dropPixels, existingPixels, pixelSize);
  
  return {
    pixels: mergedPixels,
    center: { x, y },
    radius: baseRadius,
    actualSize: baseRadius * sizeVariation
  };
}

// Отрисовка пиксельного шва
export function renderPixelatedWeld(ctx, pixels, pixelSize = PIXEL_SIZE, isHot = true, coolProgress = 0) {
  pixels.forEach(pixel => {
    const intensity = Math.min(1, pixel.depth || 1);
    
    // Цвет зависит от температуры (остывания)
    let r, g, b;
    if (isHot) {
      // Горячий металл - оранжево-красный с вариациями
      const heatVar = 0.8 + Math.random() * 0.4; // Вариация яркости
      r = Math.round(255 * heatVar * intensity);
      g = Math.round(80 * heatVar * intensity * (1 - coolProgress * 0.5));
      b = Math.round(50 * heatVar * intensity * (1 - coolProgress));
    } else {
      // Остывший металл - серый с оттенком
      const grayBase = 100 + intensity * 100;
      r = Math.round(grayBase * (1 - coolProgress) + 80 * coolProgress);
      g = Math.round(grayBase * (1 - coolProgress) + 90 * coolProgress);
      b = Math.round(grayBase * (1 - coolProgress) + 100 * coolProgress);
    }
    
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
  });
}

export function useGame4({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    weldCoverage: 0,
    weldUsed: 0,
    gapPath: [],
    gapWidths: [],
    weldPoints: [], // Горячие точки (пиксели)
    cooledPoints: [], // Остывшие точки (пиксели)
    gameOver: false,
    roundComplete: false,
    levelComplete: false,
    mouseX: 0,
    mouseY: 0,
    weldingGunX: 0,
    weldingGunY: 0,
    targetX: 0,
    targetY: 0
  });
  
  const gameStateRef = useRef(null);
  const weldCountRef = useRef(0);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const canvasRef = useRef(null);
  const lastTimeRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const weldPixelsRef = useRef([]); // Все пиксели шва для физической симуляции
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sheetMargin = 40;
    const sheetWidth = rect.width - sheetMargin * 2;
    const sheetHeight = rect.height - sheetMargin * 2;
    const { points, widths } = generateGapPath(sheetWidth, sheetHeight);
    
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    lastTimeRef.current = null;
    weldPixelsRef.current = []; // Сброс пикселей шва
    
    // Инициализируем позицию сварочного аппарата по середине сверху листа металла
    const initialGunX = rect.width / 2;
    const initialGunY = sheetMargin + NOZZLE_OFFSET_Y; // Сопло на краю листа
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      weldCoverage: 0,
      weldUsed: 0,
      gapPath: points,
      gapWidths: widths,
      weldPoints: [],
      cooledPoints: [],
      roundComplete: false,
      gameOver: false,
      weldingGunX: initialGunX,
      weldingGunY: initialGunY,
      mouseX: initialGunX,
      mouseY: sheetMargin // Позиция сопла на листе
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
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    lastTimeRef.current = null;
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      weldCoverage: 0,
      weldUsed: 0,
      gapPath: [],
      gapWidths: [],
      weldPoints: [],
      cooledPoints: [],
      gameOver: false,
      roundComplete: false,
      mouseX: 0,
      mouseY: 0,
      weldingGunX: 0,
      weldingGunY: 0
    });
  }, []);
  
  // Обновление позиции сварочного аппарата (сопла) с ограничением скорости
  const updateWeldingGunPosition = useCallback((targetX, targetY, deltaTime) => {
    const state = gameStateRef.current;
    if (!state) return { x: state?.weldingGunX || 0, y: state?.weldingGunY || 0 };
    
    const canvas = canvasRef.current;
    if (!canvas) return { x: state.weldingGunX, y: state.weldingGunY };
    
    const rect = canvas.getBoundingClientRect();
    const sheetMargin = 40;
    const sheetWidth = rect.width - sheetMargin * 2;
    const sheetHeight = rect.height - sheetMargin * 2;
    
    // Текущая позиция сопла
    let currentNozzleX = state.weldingGunX;
    let currentNozzleY = state.weldingGunY;
    
    // Проверяем, находится ли курсор за пределами листа металла
    const isCursorOutsideSheet = targetX < sheetMargin || targetX > sheetMargin + sheetWidth || 
                                  targetY < sheetMargin || targetY > sheetMargin + sheetHeight;
    
    // Если курсор за пределами листа - сопло останавливается
    if (isCursorOutsideSheet) {
      return { x: currentNozzleX, y: currentNozzleY };
    }
    
    // Вычисляем направление к целевой точке (курсор)
    const dx = targetX - currentNozzleX;
    const dy = targetY - currentNozzleY;
    const distance = Math.hypot(dx, dy);
    
    // Ограничиваем скорость движения сопла (200 пикселей в секунду)
    const maxDistance = WELDING_GUN_SPEED * deltaTime;
    
    let newNozzleX, newNozzleY;
    if (distance <= maxDistance) {
      // Достигли цели
      newNozzleX = targetX;
      newNozzleY = targetY;
    } else {
      // Двигаемся к цели с ограниченной скоростью
      newNozzleX = currentNozzleX + (dx / distance) * maxDistance;
      newNozzleY = currentNozzleY + (dy / distance) * maxDistance;
    }
    
    // Ограничиваем позицию сопла пределами листа металла
    // Сопло не может выходить за пределы листа
    newNozzleX = Math.max(sheetMargin, Math.min(sheetMargin + sheetWidth, newNozzleX));
    newNozzleY = Math.max(sheetMargin, Math.min(sheetMargin + sheetHeight, newNozzleY));
    
    return { x: newNozzleX, y: newNozzleY };
  }, []);
  
  // Обработка движения мыши с логикой сварочного аппарата
  const handleMouseMove = useCallback((e) => {
    if (!gameStateRef.current?.isRunning) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const state = gameStateRef.current;
    const { gapPath, gapWidths, cooledPoints, weldPoints } = state;
    
    // Параметры листа (должны совпадать с отрисовкой)
    const sheetMargin = 40;
    const sheetWidth = rect.width - sheetMargin * 2;
    const sheetHeight = rect.height - sheetMargin * 2;
    
    // Обновляем последнюю позицию курсора
    lastMousePosRef.current = { x: mouseX, y: mouseY };
    
    // Получаем текущее время для расчета delta time
    const currentTime = performance.now();
    let deltaTime = 0;
    if (lastTimeRef.current !== null) {
      deltaTime = (currentTime - lastTimeRef.current) / 1000; // Конвертируем в секунды
    }
    lastTimeRef.current = currentTime;
    
    // Обновляем целевую позицию (курсор) - сопло будет двигаться к ней в игровом цикле
    setGameState(prev => ({
      ...prev,
      targetX: mouseX,
      targetY: mouseY
    }));
    
    // Если ЛКМ не зажата - просто обновляем позицию курсора и выходим
    // Движение сопла происходит в игровом цикле updateLoop
    if (!isMouseDownRef.current) return;
    
    // Позиция сопла для сварки берется из текущего состояния (обновляется в updateLoop)
    const currentNozzleX = state.weldingGunX;
    const currentNozzleY = state.weldingGunY;
    const weldX = currentNozzleX;
    const weldY = currentNozzleY;
    
    // Получаем локальную ширину шва
    const adjustedWeldX = weldX - sheetMargin;
    const approximateIndex = Math.floor((adjustedWeldX / sheetWidth) * (gapWidths.length - 1));
    const idx = Math.max(0, Math.min(gapWidths.length - 1, approximateIndex));
    const localGapWidth = gapWidths[idx];
    const localWeldRadius = (localGapWidth * WELD_SIZE_RATIO) / 2;
    const triggerDistance = localWeldRadius * (2/3); // 2/3 радиуса для триггера
    
    if (lastWeldPointRef.current) {
      // Проверяем, прошло ли сопло достаточное расстояние от последней точки
      const dx = weldX - lastWeldPointRef.current.x;
      const dy = weldY - lastWeldPointRef.current.y;
      const dist = Math.hypot(dx, dy);
      
      // Если не прошли достаточное расстояние - не рисуем
      if (dist < triggerDistance) {
        return;
      }
      
      // Проверяем что точка в зоне шва или на существующей сварке
      const inGap = isPointInGapZone(weldX, weldY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
      const onWeld = canWeldOnExisting(weldX, weldY, localWeldRadius, cooledPoints, weldPoints);
      
      if (!inGap && !onWeld) {
        return;
      }
      
      if (weldCountRef.current >= MAX_WELD_POINTS) return;
      
      // Создаем физическую каплю сварки с пиксельной структурой
      const newDrop = createWeldDrop(weldX, weldY, localGapWidth, weldPixelsRef.current, PIXEL_SIZE);
      
      // Добавляем пиксели капли в общий массив
      weldPixelsRef.current = newDrop.pixels;
      
      // Сохраняем информацию о капле для отрисовки и остывания
      const newDot = {
        x: weldX,
        y: weldY,
        timestamp: Date.now(),
        id: weldCountRef.current,
        width: localGapWidth,
        pixels: newDrop.pixels,
        radius: newDrop.radius
      };
      
      setGameState(prev => ({
        ...prev,
        weldPoints: [...prev.weldPoints, newDot],
        weldUsed: weldCountRef.current + 1
      }));
      
      weldCountRef.current += 1;
      lastWeldPointRef.current = { x: weldX, y: weldY };
      
    } else {
      // Первая точка при зажатии ЛКМ
      lastWeldPointRef.current = { x: weldX, y: weldY };
      
      const inGap = isPointInGapZone(weldX, weldY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
      const onWeld = canWeldOnExisting(weldX, weldY, localWeldRadius, cooledPoints, weldPoints);
      
      if ((inGap || onWeld) && weldCountRef.current < MAX_WELD_POINTS) {
        // Создаем физическую каплю сварки с пиксельной структурой
        const newDrop = createWeldDrop(weldX, weldY, localGapWidth, weldPixelsRef.current, PIXEL_SIZE);
        
        // Добавляем пиксели капли в общий массив
        weldPixelsRef.current = newDrop.pixels;
        
        const newDot = {
          x: weldX,
          y: weldY,
          timestamp: Date.now(),
          id: weldCountRef.current,
          width: localGapWidth,
          pixels: newDrop.pixels,
          radius: newDrop.radius
        };
        
        setGameState(prev => ({
          ...prev,
          weldPoints: [...prev.weldPoints, newDot],
          weldUsed: weldCountRef.current + 1
        }));
        
        weldCountRef.current += 1;
      }
    }
  }, []);
  
  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    lastWeldPointRef.current = null;
  }, []);
  
  // Игровой цикл для постоянного движения сопла к курсору
  useEffect(() => {
    if (!gameState.isRunning) return;
    
    let animationFrameId;
    let lastUpdateTime = performance.now();
    
    const updateLoop = () => {
      const state = gameStateRef.current;
      if (!state || !canvasRef.current) {
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }
      
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const sheetMargin = 40;
      const sheetWidth = rect.width - sheetMargin * 2;
      const sheetHeight = rect.height - sheetMargin * 2;
      
      // Получаем текущее время для расчета delta time
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastUpdateTime) / 1000; // Конвертируем в секунды
      lastUpdateTime = currentTime;
      
      // Целевая позиция - последняя известная позиция мыши
      const targetX = state.targetX;
      const targetY = state.targetY;
      
      // Обновляем позицию сопла
      const nozzlePos = updateWeldingGunPosition(targetX, targetY, deltaTime);
      
      // Обновляем состояние с новой позицией сопла
      setGameState(prev => ({
        ...prev,
        weldingGunX: nozzlePos.x,
        weldingGunY: nozzlePos.y,
        mouseX: nozzlePos.x,
        mouseY: nozzlePos.y
      }));
      
      // Если ЛКМ зажата - продолжаем сварку
      if (isMouseDownRef.current) {
        const weldX = nozzlePos.x;
        const weldY = nozzlePos.y;
        
        const { gapPath, gapWidths, cooledPoints, weldPoints } = state;
        
        // Получаем локальную ширину шва
        const adjustedWeldX = weldX - sheetMargin;
        const approximateIndex = Math.floor((adjustedWeldX / sheetWidth) * (gapWidths.length - 1));
        const idx = Math.max(0, Math.min(gapWidths.length - 1, approximateIndex));
        const localGapWidth = gapWidths[idx];
        const localWeldRadius = (localGapWidth * WELD_SIZE_RATIO) / 2;
        const triggerDistance = localWeldRadius * (2/3);
        
        if (lastWeldPointRef.current) {
          const dx = weldX - lastWeldPointRef.current.x;
          const dy = weldY - lastWeldPointRef.current.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist >= triggerDistance) {
            const inGap = isPointInGapZone(weldX, weldY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
            const onWeld = canWeldOnExisting(weldX, weldY, localWeldRadius, cooledPoints, weldPoints);
            
            if ((inGap || onWeld) && weldCountRef.current < MAX_WELD_POINTS) {
              const newDot = {
                x: weldX,
                y: weldY,
                timestamp: Date.now(),
                id: weldCountRef.current,
                width: localGapWidth
              };
              
              setGameState(prev => ({
                ...prev,
                weldPoints: [...prev.weldPoints, newDot],
                weldUsed: weldCountRef.current + 1
              }));
              
              weldCountRef.current += 1;
              lastWeldPointRef.current = { x: weldX, y: weldY };
            }
          }
        } else {
          lastWeldPointRef.current = { x: weldX, y: weldY };
          
          const inGap = isPointInGapZone(weldX, weldY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
          const onWeld = canWeldOnExisting(weldX, weldY, localWeldRadius, cooledPoints, weldPoints);
          
          if ((inGap || onWeld) && weldCountRef.current < MAX_WELD_POINTS) {
            const newDot = {
              x: weldX,
              y: weldY,
              timestamp: Date.now(),
              id: weldCountRef.current,
              width: localGapWidth
            };
            
            setGameState(prev => ({
              ...prev,
              weldPoints: [...prev.weldPoints, newDot],
              weldUsed: weldCountRef.current + 1
            }));
            
            weldCountRef.current += 1;
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(updateLoop);
    };
    
    animationFrameId = requestAnimationFrame(updateLoop);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [gameState.isRunning, updateWeldingGunPosition]);
  
  // Эффект остывания сварки
  useEffect(() => {
    if (!gameState.isRunning) return;
    
    const coolInterval = setInterval(() => {
      const now = Date.now();
      setGameState(prev => {
        const stillHot = [];
        const newlyCooled = [];
        
        prev.weldPoints.forEach(point => {
          if (now - point.timestamp >= COOL_DOWN_TIME) {
            newlyCooled.push(point);
          } else {
            stillHot.push(point);
          }
        });
        
        if (newlyCooled.length > 0) {
          return {
            ...prev,
            weldPoints: stillHot,
            cooledPoints: [...prev.cooledPoints, ...newlyCooled]
          };
        }
        
        return prev;
      });
    }, 500);
    
    return () => clearInterval(coolInterval);
  }, [gameState.isRunning]);
  
  // Периодическая проверка покрытия с использованием пиксельной сетки
  const checkCoverage = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.gapPath.length === 0) return;
    
    const { gapPath, gapWidths, weldPoints, cooledPoints } = state;
    const allWeldPoints = [...weldPoints, ...cooledPoints];
    
    // Площадь покрытая сваркой - используем пиксельную сетку
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const pixelSize = PIXEL_SIZE;
    const sheetMargin = 40;
    const sheetWidth = canvas.width - sheetMargin * 2;
    const sheetHeight = canvas.height - sheetMargin * 2;
    
    const cols = Math.ceil(sheetWidth / pixelSize);
    const rows = Math.ceil(sheetHeight / pixelSize);
    
    // Создаем массив для отслеживания покрытых пикселей в зоне шва
    const coveredPixels = new Set();
    let totalPixelsInGap = 0;
    
    // Сначала определяем все пиксели которые находятся в зоне шва
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const pixelX = sheetMargin + col * pixelSize + pixelSize / 2;
        const pixelY = sheetMargin + row * pixelSize + pixelSize / 2;
        
        // Проверяем находится ли пиксель в зоне шва
        const inGap = isPointInGapZone(pixelX, pixelY, gapPath, gapWidths, BASE_GAP_WIDTH / 2, sheetWidth, sheetMargin);
        if (inGap) {
          totalPixelsInGap++;
          coveredPixels.add(`${col},${row}`);
        }
      }
    }
    
    // Теперь проверяем какие пиксели покрыты сваркой (используем пиксели из физической модели)
    const weldedPixels = new Set();
    
    // Собираем все пиксели из всех капель
    allWeldPoints.forEach(p => {
      if (p.pixels) {
        p.pixels.forEach(pixel => {
          const col = Math.floor((pixel.x - sheetMargin) / pixelSize);
          const row = Math.floor((pixel.y - sheetMargin) / pixelSize);
          const key = `${col},${row}`;
          
          // Проверяем что пиксель находится в зоне шва
          const pixelCenterX = sheetMargin + col * pixelSize + pixelSize / 2;
          const pixelCenterY = sheetMargin + row * pixelSize + pixelSize / 2;
          const inGap = isPointInGapZone(pixelCenterX, pixelCenterY, gapPath, gapWidths, BASE_GAP_WIDTH / 2, sheetWidth, sheetMargin);
          
          if (inGap && coveredPixels.has(key)) {
            weldedPixels.add(key);
          }
        });
      }
    });
    
    // Процент покрытия = (количество покрытых пикселей шва / общее количество пикселей шва) * 100
    const coverage = totalPixelsInGap > 0 ? (weldedPixels.size / totalPixelsInGap) * 100 : 0;
    
    // Для отображения игроку показываем завышенные проценты (чтобы 98% выглядело как 100%)
    // Но не показываем больше 100% и не показываем скачок с 0% сразу на 2%
    const displayedCoverage = coverage >= WIN_COVERAGE ? 100 : Math.min(97, Math.round(coverage));
    
    setGameState(prev => {
      const newState = {
        ...prev,
        weldCoverage: displayedCoverage
      };
      
      if (coverage >= WIN_COVERAGE) {
        const pointsEarned = Math.round(1000 * (coverage / 100));
        newState.score = prev.score + pointsEarned;
        newState.roundComplete = true;
        newState.isRunning = false;
      } else if (weldCountRef.current >= MAX_WELD_POINTS && coverage < WIN_COVERAGE) {
        newState.gameOver = true;
        newState.isRunning = false;
      }
      
      return newState;
    });
  }, []);
  
  // Переход к следующему раунду
  const nextRound = useCallback(() => {
    setGameState(prev => {
      const newRound = prev.round + 1;
      
      // Проверка: если достигнут максимальный номер раунда, уровень завершен
      if (newRound > MAX_ROUNDS) {
        // Вызываем onLevelComplete для показа окна завершения уровня
        if (onLevelComplete) {
          onLevelComplete();
        }
        return {
          ...prev,
          levelComplete: true,
          roundComplete: false,
          isRunning: false
        };
      }
      
      return {
        ...prev,
        round: newRound,
        roundComplete: false
      };
    });
    initRound();
  }, [initRound, onLevelComplete]);
  
  const setCanvasRef = useCallback((ref) => {
    canvasRef.current = ref;
  }, []);
  
  return {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    setCanvasRef,
    initRound,
    MAX_WELD_POINTS,
    WELD_SIZE_RATIO,
    BASE_GAP_WIDTH,
    FADE_DURATION,
    WELDING_GUN_WIDTH,
    WELDING_GUN_HEIGHT,
    NOZZLE_OFFSET_Y,
    MAX_ROUNDS,
    PIXEL_SIZE
  };
}
