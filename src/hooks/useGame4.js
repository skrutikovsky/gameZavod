import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const BASE_GAP_WIDTH = 160; // Базовая ширина разрыва
export const WELD_SIZE_RATIO = 0.588; // Размер точки = 58.8% от ширины шва (уменьшено в 1.7 раза с 1.0)
export const COOL_DOWN_TIME = 2000; // Время остывания в мс
export const FADE_DURATION = 2000; // Длительность остывания (2 секунды)
export const WIN_COVERAGE = 95; // Процент покрытия для победы (фактический)
export const MAX_WELD_DROPS = 200; // Лимит количества капель сварки
export const INNER_TRIGGER_RATIO = 1/3; // Внутренняя зона триггера = 1/3 радиуса
export const WELDING_GUN_SPEED = 350; // Скорость движения сопла в пикселях в секунду (увеличено для плавности)
export const WELDING_GUN_WIDTH = 400; // Ширина текстуры сварочного аппарата
export const WELDING_GUN_HEIGHT = 500; // Высота текстуры сварочного аппарата
export const NOZZLE_OFFSET_Y = 0; // Смещение сопла от низа аппарата (теперь 0 - сопло в самом низу)
export const WELD_BASE_RADIUS = (BASE_GAP_WIDTH * WELD_SIZE_RATIO) / 2; // Базовый радиус капли сварки

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
  
  // Шанс 30% на появление дополнительной широкой бреши
  const hasExtraBreach = Math.random() < 0.3;
  let breachStartX = -1;
  let breachEndX = -1;
  
  if (hasExtraBreach) {
    // Дополнительная брешь в 4 раза шире обычной ширины разрыва
    const extraBreachWidth = BASE_GAP_WIDTH * 0.6 * 4;
    // Случайная позиция для бреши (в пределах 20%-80% ширины листа)
    breachStartX = width * (0.2 + Math.random() * 0.4);
    breachEndX = breachStartX + extraBreachWidth;
  }
  
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
    let w = BASE_GAP_WIDTH * 0.6;
    
    // Если есть дополнительная брешь и мы в её зоне - увеличиваем ширину
    if (hasExtraBreach && x >= breachStartX && x <= breachEndX) {
      w = BASE_GAP_WIDTH * 0.6 * 4; // В 4 раза шире
    }
    
    widths.push(w);
  }
  
  return { points, widths };
}

// Генерация дыр неправильной формы (0-3 дыры)
export function generateHoles(width, height, gapPoints, gapWidths) {
  const holes = [];
  const holeCount = Math.floor(Math.random() * 4); // 0-3 дыры
  
  const maxAttempts = 20; // Максимальное количество попыток для размещения каждой дыры
  
  for (let h = 0; h < holeCount; h++) {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < maxAttempts) {
      attempts++;
      
      // Случайный размер дыры (от 30 до 80 пикселей в диаметре)
      const holeSize = 30 + Math.random() * 50;
      const holeRadius = holeSize / 2;
      
      // Случайная позиция (с запасом от краев листа)
      const sheetMargin = 40;
      const minX = sheetMargin + holeRadius + 20;
      const maxX = width - holeRadius - 20;
      const minY = sheetMargin + holeRadius + 20;
      const maxY = height - holeRadius - 20;
      
      const centerX = minX + Math.random() * (maxX - minX);
      const centerY = minY + Math.random() * (maxY - minY);
      
      // Проверяем что дыра не пересекает основной разрыв
      let intersectsGap = false;
      const checkPoints = 12; // Количество точек для проверки по периметру дыры
      
      for (let i = 0; i < checkPoints; i++) {
        const angle = (i / checkPoints) * Math.PI * 2;
        const checkX = centerX + Math.cos(angle) * holeRadius;
        const checkY = centerY + Math.sin(angle) * holeRadius;
        
        if (isPointOverGap(checkX, checkY, gapPoints, gapWidths, width, sheetMargin)) {
          intersectsGap = true;
          break;
        }
      }
      
      if (intersectsGap) continue;
      
      // Проверяем что дыра не пересекает другие уже созданные дыры
      let intersectsOtherHoles = false;
      for (const existingHole of holes) {
        const dist = Math.hypot(centerX - existingHole.x, centerY - existingHole.y);
        if (dist < holeRadius + existingHole.radius + 10) { // 10px запас
          intersectsOtherHoles = true;
          break;
        }
      }
      
      if (intersectsOtherHoles) continue;
      
      // Дыра успешно размещена
      // Генерируем неправильную форму используя несколько точек
      const shapePoints = [];
      const pointCount = 8 + Math.floor(Math.random() * 4); // 8-11 точек
      
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        // Вариация радиуса для неправильной формы (+-20%)
        const radiusVariation = 0.8 + Math.random() * 0.4;
        const r = holeRadius * radiusVariation;
        shapePoints.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r
        });
      }
      
      holes.push({
        x: centerX,
        y: centerY,
        radius: holeRadius,
        shapePoints: shapePoints
      });
      
      placed = true;
    }
  }
  
  return holes;
}

// Проверка находится ли точка над разрывом (где нельзя варить)
export function isPointOverGap(x, y, gapPoints, gapWidths, canvasWidth, sheetMargin = 0) {
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

  // Радиус зоны разрыва = половина ширины разрыва (нельзя варить прямо в разрыве)
  const gapRadius = closestWidth / 2;
  
  // Возвращаем true если точка находится НАД разрывом (нельзя варить)
  return minDist <= gapRadius;
}

// Проверка возможности наваривания на существующую сварку
// Возвращает true если точка (позиция сопла) находится над существующей сваркой
export function isPointOverWeld(x, y, cooledPoints, allWeldPoints) {
  const allPoints = [...cooledPoints, ...allWeldPoints];
  
  for (let p of allPoints) {
    // Используем фиксированный базовый радиус для всех точек сварки
    const localRadius = WELD_BASE_RADIUS * (p.randomFactor || 1);
    const dist = Math.hypot(x - p.x, y - p.y);
    // Проверяем находится ли точка внутри существующей сварки
    if (dist <= localRadius) {
      return true;
    }
  }
  return false;
}

// Проверка находится ли точка над дырой (где нельзя варить)
export function isPointOverHole(x, y, holes, sheetMargin = 0) {
  if (!holes || holes.length === 0) return false;
  
  const adjustedX = x - sheetMargin;
  const adjustedY = y - sheetMargin;
  
  for (const hole of holes) {
    // Проверяем попадание точки внутрь полигона дыры
    let inside = false;
    const shapePoints = hole.shapePoints;
    const n = shapePoints.length;
    
    // Алгоритм луча для проверки точки внутри полигона
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = shapePoints[i].x, yi = shapePoints[i].y;
      const xj = shapePoints[j].x, yj = shapePoints[j].y;
      
      if (((yi > adjustedY) !== (yj > adjustedY)) &&
          (adjustedX < (xj - xi) * (adjustedY - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    if (inside) return true;
  }
  
  return false;
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
    holes: [],
    weldPoints: [],
    cooledPoints: [],
    gameOver: false,
    roundComplete: false,
    mouseX: 0,
    mouseY: 0,
    weldingGunX: 0,
    weldingGunY: 0,
    targetX: 0,
    targetY: 0
  });
  
  const gameStateRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const canvasRef = useRef(null);
  const lastTimeRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  const weldCountRef = useRef(0);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sheetMargin = 40;
    const sheetWidth = rect.width - sheetMargin * 2;
    const sheetHeight = rect.height - sheetMargin * 2;
    const { points, widths } = generateGapPath(sheetWidth, sheetHeight);
    const holes = generateHoles(sheetWidth, sheetHeight, points, widths);
    
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    lastTimeRef.current = performance.now(); // Инициализируем время чтобы избежать проблем с delta time
    
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
      holes: holes,
      weldPoints: [],
      cooledPoints: [],
      roundComplete: false,
      gameOver: false,
      weldingGunX: initialGunX,
      weldingGunY: initialGunY,
      mouseX: initialGunX,
      mouseY: sheetMargin, // Позиция сопла на листе
      targetX: initialGunX,
      targetY: sheetMargin // Целевая позиция для движения сопла
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
    lastTimeRef.current = performance.now(); // Инициализируем время чтобы избежать проблем с delta time
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      weldCoverage: 0,
      weldUsed: 0,
      gapPath: [],
      gapWidths: [],
      holes: [],
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
    
    // Получаем локальную ширину шва для triggerDistance (но не для размера капли)
    const adjustedWeldX = weldX - sheetMargin;
    const approximateIndex = Math.floor((adjustedWeldX / sheetWidth) * (gapWidths.length - 1));
    const idx = Math.max(0, Math.min(gapWidths.length - 1, approximateIndex));
    const localGapWidth = gapWidths[idx];
    // Используем фиксированный базовый радиус для триггера
    const localWeldRadius = WELD_BASE_RADIUS;
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
      
      // Проверяем что точка НЕ над разрывом ИЛИ на существующей сварке
      // Сварку можно наносить только если под ней лист металла или другая сварка
      const overGap = isPointOverGap(weldX, weldY, gapPath, gapWidths, sheetWidth, sheetMargin);
      const onWeld = isPointOverWeld(weldX, weldY, cooledPoints, weldPoints);
      const overHole = isPointOverHole(weldX, weldY, state.holes, sheetMargin);
      
      // Нельзя варить если точка над разрывом или дырой и нет существующей сварки под ней
      if ((overGap || overHole) && !onWeld) {
        return;
      }
      
      // Рандомизация размера капли (+-5%)
      const randomFactor = 0.95 + Math.random() * 0.1; // от 0.95 до 1.05
      
      // Проверяем лимит капель сварки - нельзя ставить больше 200
      if (weldCountRef.current >= MAX_WELD_DROPS) {
        // Сварка закончилась - проверяем покрытие
        const coverage = gameStateRef.current.weldCoverage;
        if (coverage < WIN_COVERAGE) {
          setGameState(prev => ({
            ...prev,
            gameOver: true,
            isRunning: false
          }));
        }
        return;
      }
      
      const newDot = {
        x: weldX,
        y: weldY,
        timestamp: Date.now(),
        id: weldCountRef.current,
        width: BASE_GAP_WIDTH, // Используем базовую ширину вместо локальной
        randomFactor: randomFactor
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
      
      const overGap = isPointOverGap(weldX, weldY, gapPath, gapWidths, sheetWidth, sheetMargin);
      const onWeld = isPointOverWeld(weldX, weldY, cooledPoints, weldPoints);
      const overHole = isPointOverHole(weldX, weldY, state.holes, sheetMargin);
      
      // Можно варить если точка НЕ над разрывом или дырой ИЛИ на существующей сварке
      if ((!overGap && !overHole || onWeld)) {
        // Проверяем лимит капель сварки - нельзя ставить больше 200
        if (weldCountRef.current >= MAX_WELD_DROPS) {
          // Сварка закончилась - проверяем покрытие
          const coverage = gameStateRef.current.weldCoverage;
          if (coverage < WIN_COVERAGE) {
            setGameState(prev => ({
              ...prev,
              gameOver: true,
              isRunning: false
            }));
          }
          return;
        }
        
        // Рандомизация размера капли (+-5%)
        const randomFactor = 0.95 + Math.random() * 0.1; // от 0.95 до 1.05
        
        const newDot = {
          x: weldX,
          y: weldY,
          timestamp: Date.now(),
          id: weldCountRef.current,
          width: BASE_GAP_WIDTH, // Используем базовую ширину вместо локальной
          randomFactor: randomFactor
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
  
  // Проверка прогресса заполнения - оптимизированная версия
  const checkCoverage = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.gapPath.length === 0) return;
    
    const { gapPath, gapWidths, holes, weldPoints, cooledPoints } = state;
    const allWeldPoints = [...weldPoints, ...cooledPoints];
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Увеличенный размер ячейки для более быстрой проверки (меньше точность, но быстрее)
    const gridSize = 8;
    const sheetMargin = 40;
    const sheetWidth = canvas.width - sheetMargin * 2;
    const sheetHeight = canvas.height - sheetMargin * 2;
    
    const cols = Math.ceil(sheetWidth / gridSize);
    const rows = Math.ceil(sheetHeight / gridSize);
    
    const coveredCells = new Set();
    let totalCellsInGap = 0;
    
    // Оптимизация: предварительно вычисляем индексы ячеек для шва
    const gapCellSet = new Set();
    for (let i = 0; i < gapPath.length; i++) {
      const p = gapPath[i];
      const w = gapWidths[i] || BASE_GAP_WIDTH;
      const cellCol = Math.floor((p.x) / gridSize);
      const cellRow = Math.floor((p.y) / gridSize);
      const halfWidthCells = Math.ceil((w / 2) / gridSize);
      
      // Добавляем ячейки вокруг точки шва
      for (let dc = -halfWidthCells; dc <= halfWidthCells; dc++) {
        for (let dr = -halfWidthCells; dr <= halfWidthCells; dr++) {
          gapCellSet.add(`${cellCol + dc},${cellRow + dr}`);
        }
      }
    }
    
    // Проверяем только ячейки в зоне шва
    gapCellSet.forEach(key => {
      const [colStr, rowStr] = key.split(',');
      const col = parseInt(colStr);
      const row = parseInt(rowStr);
      
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        const cellX = sheetMargin + col * gridSize + gridSize / 2;
        const cellY = sheetMargin + row * gridSize + gridSize / 2;
        
        const overGap = isPointOverGap(cellX, cellY, gapPath, gapWidths, sheetWidth, sheetMargin);
        const overHole = isPointOverHole(cellX, cellY, holes, sheetMargin);
        if (overGap || overHole) {
          totalCellsInGap++;
          coveredCells.add(key);
        }
      }
    });
    
    // Проверяем покрытие сваркой
    const weldedCells = new Set();
    allWeldPoints.forEach(p => {
      const weldRadius = WELD_BASE_RADIUS * (p.randomFactor || 1);
      const radiusCells = Math.ceil(weldRadius / gridSize);
      
      const centerCol = Math.floor((p.x - sheetMargin) / gridSize);
      const centerRow = Math.floor((p.y - sheetMargin) / gridSize);
      
      for (let dr = -radiusCells; dr <= radiusCells; dr++) {
        for (let dc = -radiusCells; dc <= radiusCells; dc++) {
          const col = centerCol + dc;
          const row = centerRow + dr;
          const key = `${col},${row}`;
          
          if (coveredCells.has(key)) {
            const cellX = sheetMargin + col * gridSize + gridSize / 2;
            const cellY = sheetMargin + row * gridSize + gridSize / 2;
            const dist = Math.hypot(cellX - p.x, cellY - p.y);
            if (dist <= weldRadius) {
              weldedCells.add(key);
            }
          }
        }
      }
    });
    
    const coverage = totalCellsInGap > 0 ? (weldedCells.size / totalCellsInGap) * 100 : 0;
    const displayedCoverage = coverage >= WIN_COVERAGE ? 100 : Math.round(coverage);
    
    setGameState(prev => {
      const newState = {
        ...prev,
        weldCoverage: displayedCoverage
      };
      
      if (coverage >= WIN_COVERAGE && !prev.roundComplete) {
        const pointsEarned = Math.round(1000 * (coverage / 100));
        newState.score = prev.score + pointsEarned;
        newState.roundComplete = true;
      }
      
      return newState;
    });
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
        
        // Получаем локальную ширину шва для triggerDistance (но не для размера капли)
        const adjustedWeldX = weldX - sheetMargin;
        const approximateIndex = Math.floor((adjustedWeldX / sheetWidth) * (gapWidths.length - 1));
        const idx = Math.max(0, Math.min(gapWidths.length - 1, approximateIndex));
        const localGapWidth = gapWidths[idx];
        // Используем фиксированный базовый радиус для триггера
        const localWeldRadius = WELD_BASE_RADIUS;
        const triggerDistance = localWeldRadius * (2/3);
        
        if (lastWeldPointRef.current) {
          const dx = weldX - lastWeldPointRef.current.x;
          const dy = weldY - lastWeldPointRef.current.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist >= triggerDistance) {
            // Проверяем что точка НЕ над разрывом или дырой ИЛИ на существующей сварке
            const overGap = isPointOverGap(weldX, weldY, gapPath, gapWidths, sheetWidth, sheetMargin);
            const onWeld = isPointOverWeld(weldX, weldY, cooledPoints, weldPoints);
            const overHole = isPointOverHole(weldX, weldY, state.holes, sheetMargin);
            
            // Можно варить если точка НЕ над разрывом или дырой ИЛИ на существующей сварке
            if ((!overGap && !overHole || onWeld)) {
              // Рандомизация размера капли (+-5%)
              const randomFactor = 0.95 + Math.random() * 0.1; // от 0.95 до 1.05
              
              // Проверяем лимит капель сварки - нельзя ставить больше 200
              if (weldCountRef.current >= MAX_WELD_DROPS) {
                // Сварка закончилась - проверяем покрытие
                const coverage = gameStateRef.current.weldCoverage;
                if (coverage < WIN_COVERAGE) {
                  setGameState(prev => ({
                    ...prev,
                    gameOver: true,
                    isRunning: false
                  }));
                }
                return;
              }
              
              const newDot = {
                x: weldX,
                y: weldY,
                timestamp: Date.now(),
                id: weldCountRef.current,
                width: BASE_GAP_WIDTH, // Используем базовую ширину вместо локальной
                randomFactor: randomFactor
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
          
          const overGap = isPointOverGap(weldX, weldY, gapPath, gapWidths, sheetWidth, sheetMargin);
          const onWeld = isPointOverWeld(weldX, weldY, cooledPoints, weldPoints);
          const overHole = isPointOverHole(weldX, weldY, state.holes, sheetMargin);
          
          // Можно варить если точка НЕ над разрывом или дырой ИЛИ на существующей сварке
          if ((!overGap && !overHole || onWeld)) {
            // Проверяем лимит капель сварки - нельзя ставить больше 200
            if (weldCountRef.current >= MAX_WELD_DROPS) {
              // Сварка закончилась - проверяем покрытие
              const coverage = gameStateRef.current.weldCoverage;
              if (coverage < WIN_COVERAGE) {
                setGameState(prev => ({
                  ...prev,
                  gameOver: true,
                  isRunning: false
                }));
              }
              return;
            }
            
            // Рандомизация размера капли (+-5%)
            const randomFactor = 0.95 + Math.random() * 0.1; // от 0.95 до 1.05
            
            const newDot = {
              x: weldX,
              y: weldY,
              timestamp: Date.now(),
              id: weldCountRef.current,
              width: BASE_GAP_WIDTH, // Используем базовую ширину вместо локальной
              randomFactor: randomFactor
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
  
  // Периодическая проверка покрытия
  useEffect(() => {
    if (!gameState.isRunning) return;
    
    const checkInterval = setInterval(checkCoverage, 100);
    return () => clearInterval(checkInterval);
  }, [gameState.isRunning, checkCoverage]);
  
  // Переход к следующему раунду
  const nextRound = useCallback(() => {
    // Сначала сбрасываем счетчики сварки
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    lastTimeRef.current = performance.now(); // Инициализируем время чтобы избежать проблем с delta time
    
    // Инициализируем новый раунд с новым разрывом
    initRound();
    
    // Обновляем номер раунда и сбрасываем флаг завершения
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      roundComplete: false
    }));
  }, [initRound]);
  
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
    WELD_SIZE_RATIO,
    BASE_GAP_WIDTH,
    FADE_DURATION,
    WELDING_GUN_WIDTH,
    WELDING_GUN_HEIGHT,
    NOZZLE_OFFSET_Y,
    weldCountRef,
    lastWeldPointRef,
    lastTimeRef
  };
}
