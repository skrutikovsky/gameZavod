import { useState, useCallback, useRef, useEffect } from 'react';

// Типы сварки и их параметры
const WELD_TYPES = [
  { id: 1, name: 'Прямая', points: 1000, description: 'Ведите курсор вдоль разрыва' },
  { id: 2, name: 'Змейка', points: 2000, description: 'Заполняйте шов волнообразными движениями' },
  { id: 3, name: 'Кружочки', points: 3000, description: 'Заполняйте шов круговыми движениями' },
];

const METAL_SHEET_WIDTH = 400; // Ширина листа металла в пикселях
const METAL_SHEET_HEIGHT = 300; // Высота листа металла в пикселях
const SEAM_WIDTH = 30; // Ширина шва (разрыва) в пикселях
const WELD_DOT_RADIUS = 8; // Радиус точки сварки
const WELD_DOT_SPACING = 10; // Расстояние между точками сварки в пикселях

// Генерация случайной кривой разрыва
const generateSeamCurve = (width, height) => {
  const points = [];
  const numPoints = 50;
  const centerY = height / 2;
  
  // Базовая синусоида с добавлением случайности
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = t * width;
    
    // Основная синусоида
    const baseSine = Math.sin(t * Math.PI * 3) * (height * 0.15);
    
    // Добавляем случайные искажения
    const noise = (Math.random() - 0.5) * (height * 0.08);
    
    // Параболическое отклонение для большей извилистости
    const parabola = Math.sin(t * Math.PI) * (height * 0.1) * (Math.random() > 0.5 ? 1 : -1);
    
    const y = centerY + baseSine + noise + parabola;
    points.push({ x, y });
  }
  
  return points;
};

// Генерация пунктирной линии паттерна внутри шва
const generatePatternDots = (seamPoints, weldType, seamWidth) => {
  const patternDots = [];
  const numDots = 40;
  
  for (let i = 0; i < numDots; i++) {
    const t = i / (numDots - 1);
    const pointIndex = Math.floor(t * (seamPoints.length - 1));
    const nextPointIndex = Math.min(pointIndex + 1, seamPoints.length - 1);
    
    // Интерполяция между точками шва
    const localT = (t * (seamPoints.length - 1)) - pointIndex;
    const baseX = seamPoints[pointIndex].x + (seamPoints[nextPointIndex].x - seamPoints[pointIndex].x) * localT;
    const baseY = seamPoints[pointIndex].y + (seamPoints[nextPointIndex].y - seamPoints[pointIndex].y) * localT;
    
    let offsetX = 0;
    let offsetY = 0;
    
    if (weldType === 1) {
      // Прямая - пунктир вдоль центра шва
      offsetX = 0;
      offsetY = 0;
    } else if (weldType === 2) {
      // Змейка - синусоида поперек шва
      const waveOffset = Math.sin(t * Math.PI * 8) * (seamWidth * 0.3);
      offsetX = waveOffset;
      offsetY = 0;
    } else if (weldType === 3) {
      // Кружочки - спираль вдоль шва
      const spiralOffset = Math.sin(t * Math.PI * 12) * (seamWidth * 0.25);
      offsetX = spiralOffset;
      offsetY = Math.cos(t * Math.PI * 12) * (seamWidth * 0.15);
    }
    
    patternDots.push({
      x: baseX + offsetX,
      y: baseY + offsetY,
      t: t,
    });
  }
  
  return patternDots;
};

// Проверка попадания точки в шов
const isPointInSeam = (x, y, seamPoints, seamWidth) => {
  for (let i = 0; i < seamPoints.length - 1; i++) {
    const p1 = seamPoints[i];
    const p2 = seamPoints[i + 1];
    
    // Расстояние от точки до отрезка
    const dist = pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
    
    if (dist <= seamWidth / 2) {
      return true;
    }
  }
  return false;
};

// Расстояние от точки до отрезка
const pointToSegmentDistance = (px, py, x1, y1, x2, y2) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
};

// Проверка соответствия паттерну сварки
const checkPatternCompliance = (weldDots, patternDots, weldType) => {
  if (weldDots.length === 0) return 0;
  
  let compliantDots = 0;
  
  weldDots.forEach(dot => {
    // Находим ближайшую точку паттерна
    let minDist = Infinity;
    let closestT = 0;
    
    patternDots.forEach((patternDot, idx) => {
      const dist = Math.sqrt(
        Math.pow(dot.x - patternDot.x, 2) + Math.pow(dot.y - patternDot.y, 2)
      );
      
      if (dist < minDist) {
        minDist = dist;
        closestT = patternDot.t;
      }
    });
    
    // Проверяем соответствие паттерну в зависимости от типа сварки
    const threshold = weldType === 1 ? 20 : weldType === 2 ? 25 : 30;
    
    if (minDist <= threshold) {
      compliantDots++;
    }
  });
  
  return (compliantDots / weldDots.length) * 100;
};

export const useGame4 = () => {
  const [gameState, setGameState] = useState({
    score: 0,
    round: 1,
    currentWeldType: null,
    seamPoints: [],
    patternDots: [],
    weldDots: [],
    isWelding: false,
    seamCoverage: 0,
    patternQuality: 0,
    totalScore: 0,
    isRoundComplete: false,
  });
  
  const canvasRef = useRef(null);
  const lastWeldDotRef = useRef(null);
  const distanceTraveledRef = useRef(0);
  
  // Инициализация раунда
  const initRound = useCallback(() => {
    // Выбираем случайный тип сварки
    const randomTypeIdx = Math.floor(Math.random() * WELD_TYPES.length);
    const weldType = WELD_TYPES[randomTypeIdx];
    
    // Генерируем новый шов
    const seamPoints = generateSeamCurve(METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT);
    const patternDots = generatePatternDots(seamPoints, weldType.id, SEAM_WIDTH);
    
    setGameState(prev => ({
      ...prev,
      currentWeldType: weldType,
      seamPoints,
      patternDots,
      weldDots: [],
      isWelding: false,
      seamCoverage: 0,
      patternQuality: 0,
      isRoundComplete: false,
    }));
    
    lastWeldDotRef.current = null;
    distanceTraveledRef.current = 0;
  }, []);
  
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      round: 1,
      totalScore: 0,
    }));
    initRound();
  }, [initRound]);
  
  // Обработка начала сварки
  const startWelding = useCallback((x, y) => {
    setGameState(prev => ({
      ...prev,
      isWelding: true,
    }));
    lastWeldDotRef.current = { x, y };
    distanceTraveledRef.current = 0;
  }, []);
  
  // Обработка движения при сварке
  const weldMove = useCallback((x, y) => {
    setGameState(prev => {
      if (!prev.isWelding || !prev.currentWeldType) return prev;
      
      // Вычисляем расстояние от последней точки
      if (lastWeldDotRef.current) {
        const dx = x - lastWeldDotRef.current.x;
        const dy = y - lastWeldDotRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        distanceTraveledRef.current += distance;
        
        // Если прошли достаточно расстояния, добавляем точку сварки
        if (distanceTraveledRef.current >= WELD_DOT_SPACING) {
          // Проверяем, находится ли точка в пределах шва
          const isInSeam = isPointInSeam(x, y, prev.seamPoints, SEAM_WIDTH);
          
          if (isInSeam) {
            const newWeldDots = [
              ...prev.weldDots,
              { x, y, isInSeam }
            ];
            
            // Пересчитываем покрытие шва
            const coverage = calculateSeamCoverage(newWeldDots, prev.seamPoints, SEAM_WIDTH);
            
            // Пересчитываем качество паттерна
            const quality = checkPatternCompliance(newWeldDots, prev.patternDots, prev.currentWeldType.id);
            
            lastWeldDotRef.current = { x, y };
            distanceTraveledRef.current = 0;
            
            // Проверяем завершение раунда
            const isComplete = coverage >= 100;
            
            if (isComplete && !prev.isRoundComplete) {
              // Раунд завершен, начисляем очки
              const basePoints = prev.currentWeldType.points;
              const qualityMultiplier = quality / 100;
              const earnedScore = Math.round(basePoints * qualityMultiplier);
              
              setTimeout(() => {
                setGameState(state => ({
                  ...state,
                  totalScore: state.totalScore + earnedScore,
                  isRoundComplete: true,
                }));
              }, 100);
              
              return {
                ...prev,
                weldDots: newWeldDots,
                seamCoverage: Math.min(100, coverage),
                patternQuality: quality,
                isRoundComplete: true,
              };
            }
            
            return {
              ...prev,
              weldDots: newWeldDots,
              seamCoverage: Math.min(100, coverage),
              patternQuality: quality,
            };
          } else {
            // Точка вне шва - все равно добавляем но помечаем
            const newWeldDots = [
              ...prev.weldDots,
              { x, y, isInSeam: false }
            ];
            
            lastWeldDotRef.current = { x, y };
            distanceTraveledRef.current = 0;
            
            return {
              ...prev,
              weldDots: newWeldDots,
            };
          }
        }
      } else {
        lastWeldDotRef.current = { x, y };
      }
      
      return prev;
    });
  }, []);
  
  // Обработка окончания сварки
  const stopWelding = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isWelding: false,
    }));
    lastWeldDotRef.current = null;
    distanceTraveledRef.current = 0;
  }, []);
  
  // Переход к следующему раунду
  const nextRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      isRoundComplete: false,
    }));
    initRound();
  }, [initRound]);
  
  // Расчет покрытия шва
  const calculateSeamCoverage = (weldDots, seamPoints, seamWidth) => {
    if (weldDots.length === 0) return 0;
    
    // Разбиваем шов на сегменты
    const segmentLength = WELD_DOT_RADIUS * 2;
    const totalSegments = Math.ceil(seamPoints.length * segmentLength / seamWidth);
    
    let coveredSegments = 0;
    
    // Для каждой точки сварки проверяем, какой сегмент шва она покрывает
    seamPoints.forEach((point, idx) => {
      const hasCoverage = weldDots.some(dot => {
        const dist = Math.sqrt(
          Math.pow(dot.x - point.x, 2) + Math.pow(dot.y - point.y, 2)
        );
        return dist <= seamWidth / 2 + WELD_DOT_RADIUS;
      });
      
      if (hasCoverage) {
        coveredSegments++;
      }
    });
    
    return (coveredSegments / seamPoints.length) * 100;
  };
  
  return {
    gameState,
    startGame,
    startWelding,
    weldMove,
    stopWelding,
    nextRound,
    initRound,
    WELD_TYPES,
    METAL_SHEET_WIDTH,
    METAL_SHEET_HEIGHT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
    canvasRef,
  };
};

export default useGame4;
