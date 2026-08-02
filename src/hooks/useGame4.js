import { useState, useCallback, useRef, useEffect } from 'react';

// Типы сварки и их характеристики
const WELD_TYPES = [
  { id: 1, name: 'Прямая', points: 1000, description: 'Ведите курсор вдоль разрыва' },
  { id: 2, name: 'Змейка', points: 2000, description: 'Заполняйте шов волнообразными движениями' },
  { id: 3, name: 'Кружочки', points: 3000, description: 'Заполняйте шов круговыми движениями' },
];

const METAL_SHEET_WIDTH = 400; // ширина листа металла в пикселях
const METAL_SHEET_HEIGHT = 500; // высота листа металла в пикселях
const SEAM_WIDTH = 50; // ширина шва (разрыва)
const WELD_DOT_RADIUS = 8; // радиус точки сварки
const WELD_DOT_SPACING = 10; // расстояние между точками сварки (пикселей движения курсора)

// Генерация случайного разрыва (кривой проходящей через центр)
const generateSeamPath = (width, height, complexity = 5) => {
  const points = [];
  const centerY = height / 2;
  const centerX = width / 2;
  
  // Начинаем с левой стороны с небольшим смещением от центра
  let currentY = centerY + (Math.random() - 0.5) * 100;
  
  // Количество контрольных точек
  const numPoints = complexity + 3;
  
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * width;
    
    if (i === 0) {
      // Первая точка - левый край
      currentY = centerY + (Math.random() - 0.5) * 80;
    } else if (i === numPoints) {
      // Последняя точка - правый край
      currentY = centerY + (Math.random() - 0.5) * 80;
    } else {
      // Промежуточные точки с изгибами
      const amplitude = 60 + Math.random() * 40; // амплитуда изгиба
      const phase = Math.random() * Math.PI * 2;
      const noise = (Math.random() - 0.5) * 30; // случайный шум
      
      // Комбинируем синусоиду с шумом для создания неровного разрыва
      currentY = centerY + 
        Math.sin((i / numPoints) * Math.PI * 2 + phase) * amplitude + 
        noise;
      
      // Ограничиваем чтобы не выходило за пределы
      currentY = Math.max(50, Math.min(height - 50, currentY));
    }
    
    points.push({ x, y: currentY });
  }
  
  return points;
};

// Генерация пунктирной линии паттерна внутри шва
const generatePatternPath = (seamPoints, weldType, seamWidth) => {
  if (!seamPoints || seamPoints.length < 2) return [];
  
  const patternPoints = [];
  
  if (weldType === 1) {
    // Прямая линия вдоль центра шва
    patternPoints.push(...seamPoints);
  } else if (weldType === 2) {
    // Змейка (синусоида) вдоль шва
    const amplitude = seamWidth * 0.35;
    const frequency = 0.15;
    
    for (let i = 0; i < seamPoints.length; i++) {
      const point = seamPoints[i];
      const nextPoint = seamPoints[Math.min(i + 1, seamPoints.length - 1)];
      
      // Вычисляем нормаль к шву
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / length;
      const ny = dx / length;
      
      // Смещение по синусоиде
      const waveOffset = Math.sin(i * frequency * Math.PI) * amplitude;
      
      patternPoints.push({
        x: point.x + nx * waveOffset,
        y: point.y + ny * waveOffset,
      });
    }
  } else if (weldType === 3) {
    // Спираль/кружочки вдоль шва
    const spiralRadius = seamWidth * 0.3;
    const spiralFrequency = 0.3;
    
    for (let i = 0; i < seamPoints.length; i++) {
      const point = seamPoints[i];
      const nextPoint = seamPoints[Math.min(i + 1, seamPoints.length - 1)];
      
      // Вычисляем нормаль к шву
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / length;
      const ny = dx / length;
      
      // Смещение по спирали
      const spiralOffset = Math.cos(i * spiralFrequency * Math.PI) * spiralRadius;
      
      patternPoints.push({
        x: point.x + nx * spiralOffset,
        y: point.y + ny * spiralOffset,
      });
    }
  }
  
  return patternPoints;
};

// Проверка качества заполнения шва
const calculateWeldQuality = (weldDots, seamPath, weldType, patternPath) => {
  if (!seamPath || seamPath.length === 0) return 0;
  
  // Вычисляем длину шва
  let seamLength = 0;
  for (let i = 1; i < seamPath.length; i++) {
    const dx = seamPath[i].x - seamPath[i - 1].x;
    const dy = seamPath[i].y - seamPath[i - 1].y;
    seamLength += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Проверяем покрытие шва точками сварки
  const coveredLength = calculateCoveredLength(weldDots, seamPath);
  const coveragePercent = Math.min(100, (coveredLength / seamLength) * 100);
  
  // Проверяем соответствие паттерну
  let patternScore = 0;
  if (weldDots.length > 10) {
    patternScore = calculatePatternMatch(weldDots, patternPath, weldType);
  } else {
    patternScore = coveragePercent > 90 ? 1 : coveragePercent / 100;
  }
  
  // Итоговое качество = покрытие * соответствие паттерну
  const quality = coveragePercent * patternScore;
  
  return Math.round(Math.min(100, quality));
};

// Вычисление покрытой длины шва
const calculateCoveredLength = (weldDots, seamPath) => {
  if (weldDots.length === 0) return 0;
  
  let coveredLength = 0;
  const dotCoverage = WELD_DOT_RADIUS * 2; // диаметр точки покрытия
  
  // Для каждой точки на пути шва проверяем есть ли рядом точка сварки
  for (let i = 1; i < seamPath.length; i++) {
    const prevPoint = seamPath[i - 1];
    const currPoint = seamPath[i];
    
    const dx = currPoint.x - prevPoint.x;
    const dy = currPoint.y - prevPoint.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    // Разбиваем сегмент на маленькие части
    const steps = Math.ceil(segmentLength / 5);
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const checkX = prevPoint.x + dx * t;
      const checkY = prevPoint.y + dy * t;
      
      // Проверяем покрыта ли эта точка
      let isCovered = false;
      for (const dot of weldDots) {
        const distToDot = Math.sqrt(
          Math.pow(checkX - dot.x, 2) + Math.pow(checkY - dot.y, 2)
        );
        if (distToDot <= dotCoverage) {
          isCovered = true;
          break;
        }
      }
      
      if (isCovered) {
        coveredLength += segmentLength / steps;
      }
    }
  }
  
  return coveredLength;
};

// Вычисление соответствия паттерну сварки
const calculatePatternMatch = (weldDots, patternPath, weldType) => {
  if (patternPath.length === 0) return 0.5;
  
  let matchScore = 0;
  let checkedDots = 0;
  
  // Для каждой точки сварки проверяем насколько она близка к паттерну
  for (const dot of weldDots) {
    let minDistToPattern = Infinity;
    
    // Находим минимальное расстояние до любой точки паттерна
    for (const patternPoint of patternPath) {
      const dist = Math.sqrt(
        Math.pow(dot.x - patternPoint.x, 2) + Math.pow(dot.y - patternPoint.y, 2)
      );
      minDistToPattern = Math.min(minDistToPattern, dist);
    }
    
    // Оцениваем близость (чем ближе к паттерну, тем выше score)
    const tolerance = WELD_DOT_RADIUS * 2.5;
    if (minDistToPattern <= tolerance) {
      matchScore += 1 - (minDistToPattern / tolerance);
    }
    checkedDots++;
  }
  
  return checkedDots > 0 ? matchScore / checkedDots : 0;
};

export const useGame4 = () => {
  const [gameState, setGameState] = useState({
    score: 0,
    round: 1,
    weldType: 1,
    seamPath: [],
    patternPath: [],
    weldDots: [],
    weldQuality: 0,
    isWelding: false,
    isRoundComplete: false,
    lastMousePos: null,
    distanceTraveled: 0,
  });
  
  const canvasRef = useRef(null);
  const lastMousePosRef = useRef(null);
  const distanceTraveledRef = useRef(0);
  
  // Инициализация раунда
  const initRound = useCallback(() => {
    // Выбираем случайный тип сварки
    const randomWeldType = WELD_TYPES[Math.floor(Math.random() * WELD_TYPES.length)];
    
    // Генерируем новый разрыв
    const newSeamPath = generateSeamPath(METAL_SHEET_WIDTH, METAL_SHEET_HEIGHT, 5 + Math.floor(Math.random() * 3));
    
    // Генерируем паттерн для текущего типа сварки
    const newPatternPath = generatePatternPath(newSeamPath, randomWeldType.id, SEAM_WIDTH);
    
    setGameState(prev => ({
      ...prev,
      weldType: randomWeldType.id,
      seamPath: newSeamPath,
      patternPath: newPatternPath,
      weldDots: [],
      weldQuality: 0,
      isWelding: false,
      isRoundComplete: false,
      lastMousePos: null,
      distanceTraveled: 0,
    }));
    
    lastMousePosRef.current = null;
    distanceTraveledRef.current = 0;
  }, []);
  
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      round: 1,
    }));
    initRound();
  }, [initRound]);
  
  const handleMouseMove = useCallback((e) => {
    if (!gameState.isWelding || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Проверяем находится ли курсор над листом металла
    const metalLeft = (rect.width - METAL_SHEET_WIDTH) / 2;
    const metalTop = (rect.height - METAL_SHEET_HEIGHT) / 2;
    
    if (mouseX < metalLeft || mouseX > metalLeft + METAL_SHEET_WIDTH ||
        mouseY < metalTop || mouseY > metalTop + METAL_SHEET_HEIGHT) {
      return;
    }
    
    // Вычисляем пройденное расстояние
    if (lastMousePosRef.current) {
      const dx = mouseX - lastMousePosRef.current.x;
      const dy = mouseY - lastMousePosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      distanceTraveledRef.current += distance;
      
      // Рисуем точку сварки каждые 10 пикселей
      if (distanceTraveledRef.current >= WELD_DOT_SPACING) {
        setGameState(prev => {
          const newDots = [...prev.weldDots, { x: mouseX, y: mouseY }];
          
          // Пересчитываем качество
          const newQuality = calculateWeldQuality(
            newDots,
            prev.seamPath,
            prev.weldType,
            prev.patternPath
          );
          
          // Проверяем завершение раунда (100% заполнение)
          let isRoundComplete = false;
          let newScore = prev.score;
          
          if (newQuality >= 100 && newDots.length > 50) {
            isRoundComplete = true;
            // Вычисляем очки: базовые очки * (качество / 100)
            const weldTypeInfo = WELD_TYPES.find(t => t.id === prev.weldType);
            const basePoints = weldTypeInfo ? weldTypeInfo.points : 1000;
            newScore = prev.score + Math.round(basePoints * (newQuality / 100));
          }
          
          return {
            ...prev,
            weldDots: newDots,
            weldQuality: newQuality,
            isRoundComplete,
            score: newScore,
          };
        });
        
        distanceTraveledRef.current = 0;
      }
    }
    
    lastMousePosRef.current = { x: mouseX, y: mouseY };
  }, [gameState.isWelding]);
  
  const handleMouseDown = useCallback((e) => {
    if (gameState.isRoundComplete) return;
    
    setGameState(prev => ({
      ...prev,
      isWelding: true,
    }));
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      lastMousePosRef.current = { x: mouseX, y: mouseY };
    }
  }, [gameState.isRoundComplete]);
  
  const handleMouseUp = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isWelding: false,
    }));
    lastMousePosRef.current = null;
    distanceTraveledRef.current = 0;
  }, []);
  
  const nextRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      isRoundComplete: false,
      weldDots: [],
      weldQuality: 0,
    }));
    
    initRound();
  }, [initRound]);
  
  const resetGame = useCallback(() => {
    setGameState({
      score: 0,
      round: 1,
      weldType: 1,
      seamPath: [],
      patternPath: [],
      weldDots: [],
      weldQuality: 0,
      isWelding: false,
      isRoundComplete: false,
      lastMousePos: null,
      distanceTraveled: 0,
    });
    initRound();
  }, [initRound]);
  
  return {
    gameState,
    startGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    nextRound,
    resetGame,
    canvasRef,
    WELD_TYPES,
    METAL_SHEET_WIDTH,
    METAL_SHEET_HEIGHT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
  };
};
