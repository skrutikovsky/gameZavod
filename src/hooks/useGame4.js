import { useState, useEffect, useCallback, useRef } from 'react';

// Константы игры
const WELD_DOT_RADIUS = 8; // Радиус точки сварки в пикселях
const WELD_DOT_SPACING = 10; // Расстояние между точками сварки в пикселях
const SEAM_WIDTH_BASE = 50; // Базовая ширина шва в пикселях
const CANVAS_PADDING = 50; // Отступы от краев холста

// Типы сварки
const WELD_TYPES = {
  STRAIGHT: { id: 'straight', name: 'Прямой шов', points: 1000, description: 'Ведите вдоль линии разрыва' },
  SINE: { id: 'sine', name: 'Змейка', points: 2000, description: 'Заполняйте шов волнообразными движениями' },
  SPIRAL: { id: 'spiral', name: 'Кружочки', points: 3000, description: 'Заполняйте шов круговыми движениями' }
};

// Генерация случайной линии разрыва
function generateSeamPath(width, height, complexity = 5) {
  const points = [];
  const numPoints = 10 + complexity * 3;
  const segmentHeight = (height - CANVAS_PADDING * 2) / (numPoints - 1);
  
  // Начинаем с левой стороны
  let currentX = CANVAS_PADDING + Math.random() * (width - CANVAS_PADDING * 2);
  let currentY = CANVAS_PADDING;
  
  points.push({ x: currentX, y: currentY });
  
  for (let i = 1; i < numPoints; i++) {
    currentY = CANVAS_PADDING + i * segmentHeight;
    
    // Добавляем случайные отклонения по X
    const deviation = (Math.random() - 0.5) * 100 * (complexity / 5);
    currentX = Math.max(CANVAS_PADDING, Math.min(width - CANVAS_PADDING, currentX + deviation));
    
    points.push({ x: currentX, y: currentY });
  }
  
  return points;
}

// Создание пути для разных типов сварки
function createWeldPattern(seamPoints, weldType, seamWidth) {
  const patternPoints = [];
  const numSegments = seamPoints.length - 1;
  
  if (weldType === WELD_TYPES.STRAIGHT.id) {
    // Прямая линия вдоль центра шва
    seamPoints.forEach(point => {
      patternPoints.push({ ...point });
    });
  } else if (weldType === WELD_TYPES.SINE.id) {
    // Синусоида вдоль шва
    const amplitude = seamWidth * 0.35;
    const frequency = 0.3;
    
    for (let i = 0; i < numSegments; i++) {
      const p1 = seamPoints[i];
      const p2 = seamPoints[i + 1];
      const segments = 20;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const baseX = p1.x + (p2.x - p1.x) * t;
        const baseY = p1.y + (p2.y - p1.y) * t;
        
        // Нормаль к направлению шва
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        // Синусоидальное отклонение
        const phase = i * Math.PI * 2 * frequency + j * Math.PI * 2 * frequency / segments;
        const offset = Math.sin(phase) * amplitude;
        
        patternPoints.push({
          x: baseX + nx * offset,
          y: baseY + ny * offset
        });
      }
    }
  } else if (weldType === WELD_TYPES.SPIRAL.id) {
    // Спираль вдоль шва
    const spiralRadius = seamWidth * 0.3;
    const spiralStep = 0.3;
    
    for (let i = 0; i < numSegments; i++) {
      const p1 = seamPoints[i];
      const p2 = seamPoints[i + 1];
      const segments = 15;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const baseX = p1.x + (p2.x - p1.x) * t;
        const baseY = p1.y + (p2.y - p1.y) * t;
        
        // Нормаль к направлению шва
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        // Спиральное движение
        const angle = (i * segments + j) * spiralStep;
        const offsetX = Math.cos(angle) * spiralRadius * nx;
        const offsetY = Math.cos(angle) * spiralRadius * ny;
        const progressOffset = Math.sin(angle) * spiralRadius * 0.3;
        
        patternPoints.push({
          x: baseX + offsetX,
          y: baseY + offsetY + progressOffset
        });
      }
    }
  }
  
  return patternPoints;
}

export function useGame4() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    totalScore: 0,
    round: 1,
    weldType: WELD_TYPES.STRAIGHT,
    seamPoints: [],
    patternPoints: [],
    weldDots: [],
    seamWidth: SEAM_WIDTH_BASE,
    fillPercentage: 0,
    qualityPercentage: 0,
    isWelding: false,
    lastWeldPosition: null,
    distanceTraveled: 0,
    patternDistanceTraveled: 0,
    gameOver: false
  });
  
  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const weldDotsRef = useRef([]);
  const lastPositionRef = useRef(null);
  const distanceRef = useRef(0);
  const patternDistanceRef = useRef(0);
  
  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback((weldTypeOverride = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Выбираем тип сварки
    const weldTypes = Object.values(WELD_TYPES);
    const selectedType = weldTypeOverride || weldTypes[Math.floor(Math.random() * weldTypes.length)];
    
    // Генерируем путь разрыва
    const complexity = 3 + Math.random() * 3; // От 3 до 6
    const seamPoints = generateSeamPath(width, height, complexity);
    
    // Ширина шва может немного варьироваться
    const seamWidth = SEAM_WIDTH_BASE + Math.random() * 20;
    
    // Создаем паттерн для текущего типа сварки
    const patternPoints = createWeldPattern(seamPoints, selectedType.id, seamWidth);
    
    // Сбрасываем точки сварки
    weldDotsRef.current = [];
    lastPositionRef.current = null;
    distanceRef.current = 0;
    patternDistanceRef.current = 0;
    
    setGameState(prev => ({
      ...prev,
      weldType: selectedType,
      seamPoints,
      patternPoints,
      seamWidth,
      weldDots: [],
      fillPercentage: 0,
      qualityPercentage: 0,
      isWelding: false,
      lastWeldPosition: null,
      distanceTraveled: 0,
      patternDistanceTraveled: 0,
      gameOver: false
    }));
  }, []);
  
  // Старт игры
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      totalScore: 0,
      round: 1
    }));
    initRound();
  }, [initRound]);
  
  // Остановка игры
  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false,
      isWelding: false
    }));
  }, []);
  
  // Сброс игры
  const resetGame = useCallback(() => {
    weldDotsRef.current = [];
    lastPositionRef.current = null;
    distanceRef.current = 0;
    patternDistanceRef.current = 0;
    
    setGameState({
      isRunning: false,
      score: 0,
      totalScore: 0,
      round: 1,
      weldType: WELD_TYPES.STRAIGHT,
      seamPoints: [],
      patternPoints: [],
      weldDots: [],
      seamWidth: SEAM_WIDTH_BASE,
      fillPercentage: 0,
      qualityPercentage: 0,
      isWelding: false,
      lastWeldPosition: null,
      distanceTraveled: 0,
      patternDistanceTraveled: 0,
      gameOver: false
    });
  }, []);
  
  // Проверка расстояния от точки до линии (отрезка)
  const distanceToLine = useCallback((point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }, []);
  
  // Расчет процента заполнения и качества
  const calculateFillAndQuality = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState || currentState.seamPoints.length === 0) return { fill: 0, quality: 0 };
    
    const weldDots = weldDotsRef.current;
    const seamPoints = currentState.seamPoints;
    const patternPoints = currentState.patternPoints;
    const seamWidth = currentState.seamWidth;
    
    if (weldDots.length === 0) return { fill: 0, quality: 0 };
    
    // Расчет заполнения шва
    // Разбиваем шов на сегменты и проверяем заполненность каждого
    const numSegments = seamPoints.length - 1;
    let filledSegments = 0;
    const segmentCheckPoints = 5; // Количество точек проверки на сегмент
    
    for (let i = 0; i < numSegments; i++) {
      const p1 = seamPoints[i];
      const p2 = seamPoints[i + 1];
      let segmentFilled = false;
      
      for (let j = 0; j < segmentCheckPoints; j++) {
        const t = j / segmentCheckPoints;
        const checkX = p1.x + (p2.x - p1.x) * t;
        const checkY = p1.y + (p2.y - p1.y) * t;
        
        // Проверяем, есть ли точка сварки рядом с этой позицией
        for (const dot of weldDots) {
          const dist = Math.sqrt(
            Math.pow(dot.x - checkX, 2) + Math.pow(dot.y - checkY, 2)
          );
          
          if (dist < seamWidth / 2 + WELD_DOT_RADIUS) {
            segmentFilled = true;
            break;
          }
        }
        
        if (segmentFilled) break;
      }
      
      if (segmentFilled) {
        filledSegments++;
      }
    }
    
    const fillPercentage = (filledSegments / numSegments) * 100;
    
    // Расчет качества (насколько хорошо игрок следует паттерну)
    let patternFollowed = 0;
    const checkInterval = 20; // Проверяем каждую N-ю точку сварки
    
    for (let i = 0; i < weldDots.length; i += checkInterval) {
      const dot = weldDots[i];
      let minDistToPattern = Infinity;
      
      // Находим минимальное расстояние до любой точки паттерна
      for (const patternPoint of patternPoints) {
        const dist = Math.sqrt(
          Math.pow(dot.x - patternPoint.x, 2) + Math.pow(dot.y - patternPoint.y, 2)
        );
        minDistToPattern = Math.min(minDistToPattern, dist);
      }
      
      // Если точка близко к паттерну, считаем что паттерн соблюден
      if (minDistToPattern < seamWidth * 0.4) {
        patternFollowed++;
      }
    }
    
    const qualityPercentage = weldDots.length > 0 
      ? (patternFollowed / Math.ceil(weldDots.length / checkInterval)) * 100 
      : 0;
    
    return { 
      fill: Math.min(100, fillPercentage), 
      quality: Math.min(100, qualityPercentage) 
    };
  }, []);
  
  // Начало сварки
  const startWelding = useCallback((x, y) => {
    setGameState(prev => ({
      ...prev,
      isWelding: true,
      lastWeldPosition: { x, y }
    }));
    lastPositionRef.current = { x, y };
  }, []);
  
  // Процесс сварки
  const weld = useCallback((x, y) => {
    const currentState = gameStateRef.current;
    if (!currentState || !currentState.isWelding || !lastPositionRef.current) return;
    
    const lastPos = lastPositionRef.current;
    const dx = x - lastPos.x;
    const dy = y - lastPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Добавляем точку сварки каждые WELD_DOT_SPACING пикселей
    if (distance >= WELD_DOT_SPACING) {
      const newDot = { x, y };
      weldDotsRef.current = [...weldDotsRef.current, newDot];
      lastPositionRef.current = { x, y };
      distanceRef.current += distance;
      
      // Рассчитываем заполнение и качество
      const { fill, quality } = calculateFillAndQuality();
      
      setGameState(prev => ({
        ...prev,
        weldDots: weldDotsRef.current,
        fillPercentage: fill,
        qualityPercentage: quality,
        distanceTraveled: distanceRef.current
      }));
    }
  }, [calculateFillAndQuality]);
  
  // Окончание сварки
  const stopWelding = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isWelding: false,
      lastWeldPosition: null
    }));
    lastPositionRef.current = null;
  }, []);
  
  // Завершение раунда
  const completeRound = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState) return;
    
    const { fill, quality } = calculateFillAndQuality();
    
    // Раунд завершен если шов заполнен на 100%
    if (fill >= 95) {
      const basePoints = currentState.weldType.points;
      const qualityMultiplier = quality / 100;
      const earnedPoints = Math.round(basePoints * qualityMultiplier);
      
      setGameState(prev => ({
        ...prev,
        score: earnedPoints,
        totalScore: prev.totalScore + earnedPoints,
        gameOver: true
      }));
      
      return { completed: true, earnedPoints, quality };
    }
    
    return { completed: false };
  }, [calculateFillAndQuality]);
  
  // Переход к следующему раунду
  const nextRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      gameOver: false
    }));
    initRound();
  }, [initRound]);
  
  return {
    gameState,
    setGameState,
    canvasRef,
    startGame,
    stopGame,
    resetGame,
    initRound,
    startWelding,
    weld,
    stopWelding,
    completeRound,
    nextRound,
    calculateFillAndQuality,
    WELD_DOT_RADIUS,
    WELD_DOT_SPACING,
    WELD_TYPES,
    CANVAS_PADDING
  };
}
