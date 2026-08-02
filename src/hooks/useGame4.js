import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const WELD_RADIUS = 8; // Радиус точки сварки
export const COOL_DOWN_TIME = 2000; // Время остывания в мс
export const POINT_STEP = 10; // Расстояние между точками в пикселях
export const MAX_WELD_POINTS = 2000; // Максимальное количество точек сварки
export const GAP_WIDTH = 25; // Ширина разрыва
export const WIN_COVERAGE = 95; // Процент покрытия для победы

// Генерация случайного разрыва (синусоида с шумом и гармониками)
export function generateGapPath(width, height) {
  const points = [];
  const centerY = height / 2;
  const segmentCount = 50;
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
  }
  
  return points;
}

// Проверка находится ли точка на металле (в зоне разрыва или на существующей сварке)
export function isPointOnMetal(x, y, gapPoints, cooledPoints, canvasWidth, canvasHeight) {
  const margin = 40;
  
  // Проверяем границы листа металла
  if (x < margin || x > canvasWidth - margin || 
      y < margin || y > canvasHeight - margin) {
    return false;
  }
  
  // Находим минимальное расстояние до линии разрыва
  let minGapDistance = Infinity;
  for (const point of gapPoints) {
    const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
    minGapDistance = Math.min(minGapDistance, dist);
  }
  
  // Если точка в зоне разрыва - разрешаем
  if (minGapDistance <= GAP_WIDTH / 2 + WELD_RADIUS) {
    return true;
  }
  
  // Проверяем расстояние до охлажденных точек сварки
  for (const point of cooledPoints) {
    const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
    if (dist <= WELD_RADIUS * 1.5) {
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
    weldCoverage: 0, // Процент заполнения шва
    weldUsed: 0, // Количество использованных точек
    gapPath: [], // Точки разрыва
    weldPoints: [], // Горячие точки сварки
    cooledPoints: [], // Охлажденные точки сварки
    gameOver: false,
    roundComplete: false
  });
  
  const gameStateRef = useRef(null);
  const weldCountRef = useRef(0);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const canvasRef = useRef(null);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const gapPath = generateGapPath(rect.width, rect.height);
    
    weldCountRef.current = 0;
    lastWeldPointRef.current = null;
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      weldCoverage: 0,
      weldUsed: 0,
      gapPath,
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
      weldPoints: [],
      cooledPoints: [],
      gameOver: false,
      roundComplete: false
    });
  }, []);
  
  // Обработка движения мыши
  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current || !gameStateRef.current?.isRunning) return;
    
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const { gapPath, cooledPoints } = gameStateRef.current;
    
    // Проверяем можно ли варить в этой точке
    if (!isPointOnMetal(mouseX, mouseY, gapPath, cooledPoints, rect.width, rect.height)) {
      lastWeldPointRef.current = { x: mouseX, y: mouseY };
      return;
    }
    
    // Вычисляем расстояние до последней точки
    const lastPoint = lastWeldPointRef.current;
    if (lastPoint) {
      const dx = mouseX - lastPoint.x;
      const dy = mouseY - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < POINT_STEP) {
        return;
      }
      
      // Добавляем точки вдоль линии движения
      const steps = Math.floor(distance / POINT_STEP);
      for (let i = 1; i <= steps; i++) {
        const ratio = i / steps;
        const newX = lastPoint.x + (mouseX - lastPoint.x) * ratio;
        const newY = lastPoint.y + (mouseY - lastPoint.y) * ratio;
        
        // Проверяем лимит
        if (weldCountRef.current >= MAX_WELD_POINTS) break;
        
        // Проверяем можно ли варить в этой точке
        if (!isPointOnMetal(newX, newY, gapPath, cooledPoints, rect.width, rect.height)) {
          continue;
        }
        
        const newDot = {
          x: newX,
          y: newY,
          timestamp: Date.now(),
          id: weldCountRef.current
        };
        
        setGameState(prev => ({
          ...prev,
          weldPoints: [...prev.weldPoints, newDot],
          weldUsed: weldCountRef.current + 1
        }));
        
        weldCountRef.current += 1;
      }
    }
    
    lastWeldPointRef.current = { x: mouseX, y: mouseY };
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
    if (!state || state.gapPath.length === 0 || state.weldPoints.length === 0) return;
    
    const { gapPath, weldPoints } = state;
    let coveredCount = 0;
    let totalCount = 0;
    
    // Проверяем покрытие вдоль всего разрыва
    for (let i = 0; i < gapPath.length - 1; i++) {
      const p1 = gapPath[i];
      const p2 = gapPath[i + 1];
      const checksPerSegment = 5;
      
      for (let j = 0; j < checksPerSegment; j++) {
        const ratio = j / checksPerSegment;
        const checkX = p1.x + (p2.x - p1.x) * ratio;
        const checkY = p1.y + (p2.y - p1.y) * ratio;
        
        // Проверяем по ширине разрыва
        for (let k = -GAP_WIDTH/2; k <= GAP_WIDTH/2; k += 5) {
          totalCount++;
          const testX = checkX;
          const testY = checkY + k;
          
          // Проверяем покрыта ли эта точка сваркой
          let isCovered = false;
          for (const point of weldPoints) {
            const dist = Math.sqrt(Math.pow(testX - point.x, 2) + Math.pow(testY - point.y, 2));
            if (dist <= WELD_RADIUS) {
              isCovered = true;
              break;
            }
          }
          
          if (isCovered) {
            coveredCount++;
          }
        }
      }
    }
    
    const coverage = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;
    
    setGameState(prev => {
      const newState = {
        ...prev,
        weldCoverage: Math.round(coverage)
      };
      
      // Проверяем победу
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
    startGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    setCanvasRef,
    initRound,
    MAX_WELD_POINTS,
    WELD_RADIUS,
    GAP_WIDTH
  };
}
