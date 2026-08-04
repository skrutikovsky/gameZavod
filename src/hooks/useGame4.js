import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const BASE_GAP_WIDTH = 160; // Базовая ширина разрыва
export const WELD_SIZE_RATIO = 1.0; // Размер точки = 100% от ширины шва (увеличено в 1.7 раза с 0.6)
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

// Генерация случайного разрыва с неравномерной шириной
export function generateGapPath(width, height, sheetMargin = 40) {
  const points = [];
  const widths = [];
  const centerY = height / 2;
  // Вычисляем доступную ширину листа металла (с учетом отступов с обеих сторон)
  const sheetWidth = width - sheetMargin * 2;
  const segmentCount = 100;
  const segmentLength = sheetWidth / segmentCount;
  
  // Параметры для генерации извилистой линии
  const baseFrequency = 0.3 + Math.random() * 0.4;
  const amplitude = height * 0.1 + Math.random() * height * 0.08;
  const noiseAmplitude = height * 0.03;
  const phaseShift = Math.random() * Math.PI * 2;
  
  for (let i = 0; i <= segmentCount; i++) {
    // x начинается с sheetMargin и заканчивается на width - sheetMargin
    const x = sheetMargin + i * segmentLength;
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

export function useGame4({ onLevelComplete }) {
  const [gameState, setGameState] = useState({
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
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sheetMargin = 40;
    const { points, widths } = generateGapPath(rect.width, rect.height, sheetMargin);
    
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    lastTimeRef.current = null;
    
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
      
    } else {
      // Первая точка при зажатии ЛКМ
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
  }, []);
  
  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    lastWeldPointRef.current = null;
  }, []);
  
  // Проверка прогресса заполнения - подсчет площади покрытия
  const checkCoverage = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.gapPath.length === 0) return;
    
    const { gapPath, gapWidths, weldPoints, cooledPoints } = state;
    const allWeldPoints = [...weldPoints, ...cooledPoints];
    
    // Площадь покрытая сваркой - используем сетку для учета перекрытий
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gridSize = 4; // Размер ячейки сетки в пикселях (чем меньше, тем точнее)
    const sheetMargin = 40;
    const sheetWidth = canvas.width - sheetMargin * 2;
    const sheetHeight = canvas.height - sheetMargin * 2;
    
    const cols = Math.ceil(sheetWidth / gridSize);
    const rows = Math.ceil(sheetHeight / gridSize);
    
    // Создаем массив для отслеживания покрытых ячеек в зоне шва
    const coveredCells = new Set();
    let totalCellsInGap = 0;
    
    // Сначала определяем все ячейки которые находятся в зоне шва
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = sheetMargin + col * gridSize + gridSize / 2;
        const cellY = sheetMargin + row * gridSize + gridSize / 2;
        
        // Проверяем находится ли ячейка в зоне шва
        const inGap = isPointInGapZone(cellX, cellY, gapPath, gapWidths, BASE_GAP_WIDTH / 2, sheetWidth, sheetMargin);
        if (inGap) {
          totalCellsInGap++;
          coveredCells.add(`${col},${row}`);
        }
      }
    }
    
    // Теперь проверяем какие ячейки покрыты сваркой
    const weldedCells = new Set();
    allWeldPoints.forEach(p => {
      const weldRadius = (p.width || BASE_GAP_WIDTH) * WELD_SIZE_RATIO / 2;
      
      // Определяем диапазон ячеек которые может покрывать эта точка сварки
      const minCol = Math.max(0, Math.floor((p.x - sheetMargin - weldRadius) / gridSize));
      const maxCol = Math.min(cols - 1, Math.floor((p.x - sheetMargin + weldRadius) / gridSize));
      const minRow = Math.max(0, Math.floor((p.y - sheetMargin - weldRadius) / gridSize));
      const maxRow = Math.min(rows - 1, Math.floor((p.y - sheetMargin + weldRadius) / gridSize));
      
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const cellX = sheetMargin + col * gridSize + gridSize / 2;
          const cellY = sheetMargin + row * gridSize + gridSize / 2;
          
          // Проверяем попадает ли центр ячейки в радиус сварки
          const dist = Math.hypot(cellX - p.x, cellY - p.y);
          if (dist <= weldRadius) {
            // Проверяем что ячейка находится в зоне шва
            const key = `${col},${row}`;
            if (coveredCells.has(key)) {
              weldedCells.add(key);
            }
          }
        }
      }
    });
    
    // Процент покрытия = (количество покрытых ячеек шва / общее количество ячеек шва) * 100
    const coverage = totalCellsInGap > 0 ? (weldedCells.size / totalCellsInGap) * 100 : 0;
    
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
  
  // Периодическая проверка покрытия
  useEffect(() => {
    if (!gameState.isRunning) return;
    
    const checkInterval = setInterval(checkCoverage, 100);
    return () => clearInterval(checkInterval);
  }, [gameState.isRunning, checkCoverage]);
  
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
    MAX_ROUNDS
  };
}
