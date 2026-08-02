import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const BASE_GAP_WIDTH = 160; // Базовая ширина разрыва
export const WELD_SIZE_RATIO = 0.6; // Размер точки = 60% от ширины шва
export const COOL_DOWN_TIME = 2000; // Время остывания в мс
export const FADE_DURATION = 2000; // Длительность остывания (2 секунды)
export const MAX_WELD_POINTS = 2000; // Максимальное количество точек сварки
export const WIN_COVERAGE = 95; // Процент покрытия для победы
export const INNER_TRIGGER_RATIO = 1/3; // Внутренняя зона триггера = 1/3 радиуса

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
    
    // Ограничиваем y в пределах листа
    y = Math.max(height * 0.15, Math.min(height * 0.85, y));
    
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

  // Корректируем x с учетом отступа листа
  const adjustedX = x - sheetMargin;
  
  // Находим ближайшую точку на центральной линии разрыва
  let minDist = Infinity;
  let closestWidth = 0;
  
  // Оптимизация: проверяем только точки поблизости по X
  const approximateIndex = Math.floor((adjustedX / canvasWidth) * (gapPoints.length - 1));
  const startIndex = Math.max(0, approximateIndex - 5);
  const endIndex = Math.min(gapPoints.length - 1, approximateIndex + 5);

  for (let i = startIndex; i <= endIndex; i++) {
    const p = gapPoints[i];
    const dist = Math.hypot(adjustedX - p.x, y - p.y);
    if (dist < minDist) {
      minDist = dist;
      closestWidth = gapWidths[i];
    }
  }

  // Радиус зоны шва = половина ширины разрыва + допуск
  const gapRadius = closestWidth / 2;
  
  return minDist <= (gapRadius + weldRadius * 0.5);
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

export function useGame4() {
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
    mouseX: 0,
    mouseY: 0
  });
  
  const gameStateRef = useRef(null);
  const weldCountRef = useRef(0);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const canvasRef = useRef(null);
  const speedRef = useRef(0);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const { points, widths } = generateGapPath(rect.width, rect.height);
    
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    
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
      gameOver: false
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
      mouseY: 0
    });
  }, []);
  
  // Обработка движения мыши с новой логикой: рисуем точку когда курсор прошел 2/3 радиуса от последней точки
  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current || !gameStateRef.current?.isRunning) return;
    
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const { gapPath, gapWidths, cooledPoints, weldPoints } = gameStateRef.current;
    
    // Параметры листа (должны совпадать с отрисовкой)
    const sheetMargin = 40;
    const sheetWidth = rect.width - sheetMargin * 2;
    
    // Получаем локальную ширину шва
    const adjustedMouseX = mouseX - sheetMargin;
    const approximateIndex = Math.floor((adjustedMouseX / sheetWidth) * (gapWidths.length - 1));
    const idx = Math.max(0, Math.min(gapWidths.length - 1, approximateIndex));
    const localGapWidth = gapWidths[idx];
    const localWeldRadius = (localGapWidth * WELD_SIZE_RATIO) / 2;
    const triggerDistance = localWeldRadius * (2/3); // 2/3 радиуса для триггера
    
    if (lastWeldPointRef.current) {
      // Проверяем, прошло ли курсор достаточное расстояние от последней точки
      const dx = mouseX - lastWeldPointRef.current.x;
      const dy = mouseY - lastWeldPointRef.current.y;
      const dist = Math.hypot(dx, dy);
      
      // Если не прошли достаточное расстояние - не рисуем
      if (dist < triggerDistance) {
        return;
      }
      
      // Проверяем что точка в зоне шва или на существующей сварке
      const inGap = isPointInGapZone(mouseX, mouseY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
      const onWeld = canWeldOnExisting(mouseX, mouseY, localWeldRadius, cooledPoints, weldPoints);
      
      if (!inGap && !onWeld) {
        return;
      }
      
      if (weldCountRef.current >= MAX_WELD_POINTS) return;
      
      const newDot = {
        x: mouseX,
        y: mouseY,
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
      lastWeldPointRef.current = { x: mouseX, y: mouseY };
      
    } else {
      // Первая точка при зажатии ЛКМ
      lastWeldPointRef.current = { x: mouseX, y: mouseY };
      
      const inGap = isPointInGapZone(mouseX, mouseY, gapPath, gapWidths, localWeldRadius, sheetWidth, sheetMargin);
      const onWeld = canWeldOnExisting(mouseX, mouseY, localWeldRadius, cooledPoints, weldPoints);
      
      if ((inGap || onWeld) && weldCountRef.current < MAX_WELD_POINTS) {
        const newDot = {
          x: mouseX,
          y: mouseY,
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
  
  // Проверка прогресса заполнения
  const checkCoverage = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.gapPath.length === 0) return;
    
    const { gapPath, gapWidths, weldPoints } = state;
    const totalLength = gapPath.length;
    
    // Создаем битовую маску покрытия
    const coverageMap = new Array(200).fill(false);
    
    weldPoints.forEach(p => {
      const xIdx = Math.floor((p.x / (canvasRef.current?.width || 1)) * 200);
      if (xIdx >= 0 && xIdx < 200) {
        const spread = Math.ceil((p.width * WELD_SIZE_RATIO) / ((canvasRef.current?.width || 1) / 200) / 2);
        for(let k = -spread; k <= spread; k++) {
          if (xIdx + k >= 0 && xIdx + k < 200) {
            coverageMap[xIdx + k] = true;
          }
        }
      }
    });
    
    const filledCount = coverageMap.filter(Boolean).length;
    const coverage = Math.min(100, (filledCount / 200) * 100);
    
    setGameState(prev => {
      const newState = {
        ...prev,
        weldCoverage: Math.round(coverage)
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
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      roundComplete: false
    }));
    initRound();
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
    MAX_WELD_POINTS,
    WELD_SIZE_RATIO,
    BASE_GAP_WIDTH,
    FADE_DURATION
  };
}
