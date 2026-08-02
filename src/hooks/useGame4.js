import { useState, useEffect, useCallback, useRef } from 'react';

// Константы игры
const METAL_SHEET_WIDTH_PERCENT = 70; // Ширина листа металла в % от экрана
const METAL_SHEET_HEIGHT_PERCENT = 60; // Высота листа металла в % от экрана
const SEAM_WIDTH = 50; // Ширина шва в пикселях
const WELD_DOT_RADIUS = 8; // Радиус точки сварки
const WELD_DOT_SPACING = 10; // Расстояние между точками сварки в пикселях
const POINTS_FOR_TYPES = {
  straight: 1000,
  snake: 2000,
  circles: 3000
};

// Типы сварки
const WELD_TYPES = ['straight', 'snake', 'circles'];

// Генерация случайного разрыва (кривая через центр листа)
function generateSeamPath(sheetWidth, sheetHeight) {
  const centerX = sheetWidth / 2;
  const centerY = sheetHeight / 2;
  
  // Количество контрольных точек
  const numPoints = 15;
  const points = [];
  
  // Генерируем точки с шумом для создания извилистой линии
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const baseX = t * sheetWidth;
    const baseY = centerY + Math.sin(t * Math.PI * 4) * (sheetHeight * 0.2);
    
    // Добавляем случайные отклонения
    const noise = (Math.random() - 0.5) * sheetHeight * 0.15;
    const x = baseX + (Math.random() - 0.5) * sheetWidth * 0.05;
    const y = baseY + noise;
    
    points.push({ x, y });
  }
  
  // Убедимся что линия проходит через центр
  const centerIndex = Math.floor(numPoints / 2);
  points[centerIndex].x = centerX;
  points[centerIndex].y = centerY;
  
  return points;
}

// Генерация пунктирной линии паттерна внутри шва
function generatePatternPath(seamPoints, weldType, seamWidth) {
  if (!seamPoints || seamPoints.length < 2) return [];
  
  const patternPoints = [];
  
  if (weldType === 'straight') {
    // Просто следуем основному пути
    return seamPoints.map(p => ({ ...p }));
  } else if (weldType === 'snake') {
    // Змейка вдоль шва
    const amplitude = seamWidth * 0.35;
    const frequency = 0.3;
    
    for (let i = 0; i < seamPoints.length; i++) {
      const t = i / seamPoints.length;
      const normalAngle = calculateNormalAngle(seamPoints, i);
      const offset = Math.sin(t * Math.PI * 8 * frequency) * amplitude;
      
      patternPoints.push({
        x: seamPoints[i].x + Math.cos(normalAngle) * offset,
        y: seamPoints[i].y + Math.sin(normalAngle) * offset
      });
    }
  } else if (weldType === 'circles') {
    // Спираль/кружочки вдоль шва
    const spiralRadius = seamWidth * 0.3;
    const spiralFrequency = 0.5;
    
    for (let i = 0; i < seamPoints.length; i++) {
      const t = i / seamPoints.length;
      const normalAngle = calculateNormalAngle(seamPoints, i);
      const spiralOffset = Math.sin(t * Math.PI * 12 * spiralFrequency) * spiralRadius;
      
      patternPoints.push({
        x: seamPoints[i].x + Math.cos(normalAngle) * spiralOffset,
        y: seamPoints[i].y + Math.sin(normalAngle) * spiralOffset
      });
    }
  }
  
  return patternPoints;
}

// Вычисление угла нормали к кривой в точке
function calculateNormalAngle(points, index) {
  if (index < 1 || index >= points.length - 1) return Math.PI / 2;
  
  const prev = points[index - 1];
  const next = points[index + 1];
  const tangentAngle = Math.atan2(next.y - prev.y, next.x - prev.x);
  return tangentAngle + Math.PI / 2;
}

// Интерполяция точек для получения плавной кривой
function interpolatePoints(points, numSegments = 100) {
  const interpolated = [];
  
  for (let i = 0; i < numSegments; i++) {
    const t = i / (numSegments - 1);
    const point = catmullRomSpline(points, t);
    if (point) {
      interpolated.push(point);
    }
  }
  
  return interpolated;
}

// Catmull-Rom сплайн для плавной интерполяции
function catmullRomSpline(points, t) {
  if (points.length < 2) return null;
  
  const n = points.length - 1;
  const scaledT = t * n;
  const index = Math.floor(scaledT);
  const localT = scaledT - index;
  
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[Math.min(n, index + 1)];
  const p3 = points[Math.min(n, index + 2)];
  
  const t2 = localT * localT;
  const t3 = t2 * localT;
  
  const x = 0.5 * ((2 * p1.x) +
    (-p0.x + p2.x) * localT +
    (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
    (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  
  const y = 0.5 * ((2 * p1.y) +
    (-p0.y + p2.y) * localT +
    (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
    (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  
  return { x, y };
}

export function useGame4() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    currentWeldType: 'straight',
    seamFillPercent: 0,
    qualityPercent: 0,
    totalWeldLength: 0,
    weldedLength: 0,
    weldDots: [],
    gameOver: false,
    roundComplete: false,
    showRoundResult: false,
    roundScore: 0
  });
  
  const gameStateRef = useRef(null);
  const seamPointsRef = useRef([]);
  const patternPointsRef = useRef([]);
  const weldedAreaRef = useRef(new Set());
  const lastWeldPositionRef = useRef(null);
  const totalWeldDistanceRef = useRef(0);
  const metalSheetRef = useRef({ width: 0, height: 0, x: 0, y: 0 });
  
  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback(() => {
    const container = document.querySelector('.game-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sheetWidth = rect.width * (METAL_SHEET_WIDTH_PERCENT / 100);
    const sheetHeight = rect.height * (METAL_SHEET_HEIGHT_PERCENT / 100);
    const sheetX = (rect.width - sheetWidth) / 2;
    const sheetY = (rect.height - sheetHeight) / 2 + 60; // Отступ сверху для UI
    
    metalSheetRef.current = {
      width: sheetWidth,
      height: sheetHeight,
      x: sheetX,
      y: sheetY
    };
    
    // Генерируем новый разрыв
    const rawSeamPoints = generateSeamPath(sheetWidth, sheetHeight);
    const interpolatedSeam = interpolatePoints(rawSeamPoints, 200);
    
    // Смещаем точки относительно позиции листа
    const seamPoints = interpolatedSeam.map(p => ({
      x: p.x + sheetX,
      y: p.y + sheetY
    }));
    
    seamPointsRef.current = seamPoints;
    
    // Выбираем случайный тип сварки
    const randomTypeIndex = Math.floor(Math.random() * WELD_TYPES.length);
    const weldType = WELD_TYPES[randomTypeIndex];
    
    // Генерируем паттерн для текущего типа сварки
    const patternPoints = generatePatternPath(seamPoints, weldType, SEAM_WIDTH);
    const shiftedPatternPoints = patternPoints.map(p => ({
      x: p.x + sheetX,
      y: p.y + sheetY
    }));
    patternPointsRef.current = shiftedPatternPoints;
    
    // Сбрасываем состояние сварки
    weldedAreaRef.current = new Set();
    lastWeldPositionRef.current = null;
    totalWeldDistanceRef.current = 0;
    
    // Вычисляем общую длину шва
    let totalLength = 0;
    for (let i = 1; i < seamPoints.length; i++) {
      const dx = seamPoints[i].x - seamPoints[i-1].x;
      const dy = seamPoints[i].y - seamPoints[i-1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    setGameState(prev => ({
      ...prev,
      currentWeldType: weldType,
      seamFillPercent: 0,
      qualityPercent: 0,
      totalWeldLength: totalLength,
      weldedLength: 0,
      weldDots: [],
      roundComplete: false,
      showRoundResult: false,
      roundScore: 0
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
  
  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);
  
  const resetGame = useCallback(() => {
    weldedAreaRef.current = new Set();
    lastWeldPositionRef.current = null;
    totalWeldDistanceRef.current = 0;
    
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      currentWeldType: 'straight',
      seamFillPercent: 0,
      qualityPercent: 0,
      totalWeldLength: 0,
      weldedLength: 0,
      weldDots: [],
      gameOver: false,
      roundComplete: false,
      showRoundResult: false,
      roundScore: 0
    });
  }, []);
  
  // Обработка движения мыши с зажатой кнопкой
  const handleWelding = useCallback((clientX, clientY, isPressed) => {
    if (!isPressed || !gameStateRef.current?.isRunning || gameStateRef.current?.roundComplete) return;
    
    const currentState = gameStateRef.current;
    const seamPoints = seamPointsRef.current;
    const patternPoints = patternPointsRef.current;
    
    if (seamPoints.length === 0) return;
    
    // Проверяем находится ли курсор над листом металла
    const { x: sheetX, y: sheetY, width: sheetWidth, height: sheetHeight } = metalSheetRef.current;
    
    if (clientX < sheetX || clientX > sheetX + sheetWidth ||
        clientY < sheetY || clientY > sheetY + sheetHeight) {
      lastWeldPositionRef.current = null;
      return;
    }
    
    const currentPos = { x: clientX, y: clientY };
    
    // Если это первая точка или расстояние достаточно большое
    if (lastWeldPositionRef.current) {
      const dx = currentPos.x - lastWeldPositionRef.current.x;
      const dy = currentPos.y - lastWeldPositionRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < WELD_DOT_SPACING) return;
      
      totalWeldDistanceRef.current += distance;
    }
    
    lastWeldPositionRef.current = currentPos;
    
    // Находим ближайшую точку шва
    let minDistToSeam = Infinity;
    let closestSeamIndex = -1;
    
    for (let i = 0; i < seamPoints.length; i++) {
      const dx = currentPos.x - seamPoints[i].x;
      const dy = currentPos.y - seamPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDistToSeam) {
        minDistToSeam = dist;
        closestSeamIndex = i;
      }
    }
    
    // Проверяем попадает ли точка в шов
    const isInSeam = minDistToSeam <= SEAM_WIDTH / 2;
    
    if (!isInSeam) return;
    
    // Создаем ключ для уникальной области сварки
    const gridCellSize = WELD_DOT_RADIUS * 2;
    const gridX = Math.floor(currentPos.x / gridCellSize);
    const gridY = Math.floor(currentPos.y / gridCellSize);
    const gridKey = `${gridX},${gridY}`;
    
    // Проверяем была ли уже эта область сварена
    if (weldedAreaRef.current.has(gridKey)) return;
    
    weldedAreaRef.current.add(gridKey);
    
    // Находим ближайшую точку паттерна для оценки качества
    let minDistToPattern = Infinity;
    for (let i = 0; i < patternPoints.length; i++) {
      const dx = currentPos.x - patternPoints[i].x;
      const dy = currentPos.y - patternPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      minDistToPattern = Math.min(minDistToPattern, dist);
    }
    
    // Добавляем точку сварки
    const newDot = {
      id: Date.now() + Math.random(),
      x: currentPos.x,
      y: currentPos.y,
      distanceToPattern: minDistToPattern
    };
    
    setGameState(prev => {
      const newWeldDots = [...prev.weldDots, newDot];
      
      // Пересчитываем процент заполнения
      const totalSeamArea = prev.totalWeldLength * SEAM_WIDTH;
      const weldedArea = weldedAreaRef.current.size * (gridCellSize * gridCellSize);
      const fillPercent = Math.min(100, (weldedArea / totalSeamArea) * 100);
      
      // Вычисляем качество на основе соответствия паттерну
      let qualityScore = 0;
      let validDots = 0;
      
      newWeldDots.forEach(dot => {
        // Точка считается качественной если она близко к паттерну
        const maxPatternDistance = SEAM_WIDTH * 0.4;
        if (dot.distanceToPattern <= maxPatternDistance) {
          validDots++;
          // Чем ближе к паттерну, тем выше качество
          qualityScore += 1 - (dot.distanceToPattern / maxPatternDistance);
        }
      });
      
      const qualityPercent = validDots > 0 ? (qualityScore / validDots) * 100 : 0;
      
      return {
        ...prev,
        weldDots: newWeldDots,
        seamFillPercent: fillPercent,
        qualityPercent: qualityPercent
      };
    });
  }, []);
  
  // Проверка завершения раунда
  const checkRoundComplete = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState || currentState.roundComplete || !currentState.isRunning) return;
    
    if (currentState.seamFillPercent >= 100) {
      // Раунд завершен
      const basePoints = POINTS_FOR_TYPES[currentState.currentWeldType];
      const roundScore = Math.round(basePoints * (currentState.qualityPercent / 100));
      
      setGameState(prev => ({
        ...prev,
        roundComplete: true,
        showRoundResult: true,
        roundScore: roundScore,
        score: prev.score + roundScore
      }));
    }
  }, []);
  
  // Переход к следующему раунду
  const nextRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      roundComplete: false,
      showRoundResult: false,
      seamFillPercent: 0,
      qualityPercent: 0,
      weldedLength: 0,
      weldDots: []
    }));
    
    weldedAreaRef.current = new Set();
    lastWeldPositionRef.current = null;
    totalWeldDistanceRef.current = 0;
    
    initRound();
  }, [initRound]);
  
  // Получение названия типа сварки для отображения
  const getWeldTypeName = useCallback((type) => {
    const names = {
      straight: 'Прямой шов',
      snake: 'Змейка',
      circles: 'Кружочки'
    };
    return names[type] || type;
  }, []);
  
  // Получение инструкции для текущего типа сварки
  const getWeldInstruction = useCallback((type) => {
    const instructions = {
      straight: 'Ведите курсор вдоль разрыва',
      snake: 'Двигайте курсор волнообразными движениями вдоль шва',
      circles: 'Заполняйте шов круговыми спиральными движениями'
    };
    return instructions[type] || '';
  }, []);
  
  return {
    gameState,
    setGameState,
    startGame,
    stopGame,
    resetGame,
    handleWelding,
    checkRoundComplete,
    nextRound,
    getWeldTypeName,
    getWeldInstruction,
    seamPointsRef,
    patternPointsRef,
    METAL_SHEET_WIDTH_PERCENT,
    METAL_SHEET_HEIGHT_PERCENT,
    SEAM_WIDTH,
    WELD_DOT_RADIUS,
    POINTS_FOR_TYPES
  };
}
