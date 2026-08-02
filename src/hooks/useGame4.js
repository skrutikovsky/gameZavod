import { useState, useCallback, useRef, useEffect } from 'react';

// Константы игры
export const WELD_PATTERNS = {
  STRAIGHT: 'straight',
  ZIGZAG: 'zigzag',
  CIRCLES: 'circles'
};

export const PATTERN_SCORES = {
  [WELD_PATTERNS.STRAIGHT]: 1000,
  [WELD_PATTERNS.ZIGZAG]: 2000,
  [WELD_PATTERNS.CIRCLES]: 3000
};

export const WELD_DOT_SPACING = 10; // Расстояние между точками сварки в пикселях
export const SEAM_WIDTH_PERCENT = 8; // Ширина шва в процентах от ширины листа
export const METAL_SHEET_WIDTH_PERCENT = 70; // Ширина листа металла в процентах
export const METAL_SHEET_HEIGHT_PERCENT = 60; // Высота листа металла в процентах

// Генерация случайного разрыва (синусоида с шумом)
export function generateSeamPath(sheetWidth, sheetHeight) {
  const points = [];
  const centerY = sheetHeight / 2;
  const numPoints = 150; // Увеличили количество точек для плавности
  
  // Параметры для генерации извилистой линии
  const baseFrequency = 0.5 + Math.random() * 0.5; // Частота синусоиды (0.5-1.0 волн)
  const amplitude = sheetHeight * 0.12 + Math.random() * sheetHeight * 0.08; // Амплитуда
  const noiseAmplitude = sheetHeight * 0.04; // Амплитуда шума
  
  // Случайный фазовый сдвиг
  const phaseShift = Math.random() * Math.PI * 2;
  
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * sheetWidth;
    const t = i / numPoints;
    
    // Основная синусоида с фазовым сдвигом
    let y = centerY + Math.sin(t * Math.PI * baseFrequency * 2 + phaseShift) * amplitude;
    
    // Добавляем вторую гармонику для более интересной формы
    y += Math.sin(t * Math.PI * baseFrequency * 4 + phaseShift * 1.5) * (amplitude * 0.3);
    
    // Добавляем шум для неровности
    y += (Math.random() - 0.5) * noiseAmplitude;
    
    // Добавляем небольшие завитки
    const swirl = Math.sin(t * Math.PI * 8) * (sheetHeight * 0.02);
    y += swirl;
    
    // Ограничиваем y в пределах листа (с отступами)
    y = Math.max(sheetHeight * 0.15, Math.min(sheetHeight * 0.85, y));
    
    points.push({ x, y });
  }
  
  return points;
}

// Генерация пунктирной линии паттерна внутри шва
export function generatePatternPath(seamPoints, pattern, seamWidth) {
  if (!seamPoints || seamPoints.length === 0) return [];
  
  const patternPoints = [];
  const halfWidth = seamWidth / 2;
  
  switch (pattern) {
    case WELD_PATTERNS.STRAIGHT:
      // Прямая линия вдоль центра шва
      patternPoints.push(...seamPoints.map(p => ({ ...p })));
      break;
      
    case WELD_PATTERNS.ZIGZAG:
      // Змейка внутри шва
      const zigzagAmplitude = halfWidth * 0.6;
      const zigzagFrequency = 0.15;
      
      for (let i = 0; i < seamPoints.length; i++) {
        const p = seamPoints[i];
        const t = i / seamPoints.length;
        const offset = Math.sin(t * Math.PI * 2 * (1 / zigzagFrequency)) * zigzagAmplitude;
        
        // Нормаль к направлению шва
        let dx = 1, dy = 0;
        if (i > 0 && i < seamPoints.length - 1) {
          const prev = seamPoints[i - 1];
          const next = seamPoints[i + 1];
          dx = next.x - prev.x;
          dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            dx /= len;
            dy /= len;
          }
        }
        
        // Перпендикуляр
        const perpX = -dy;
        const perpY = dx;
        
        patternPoints.push({
          x: p.x + perpX * offset,
          y: p.y + perpY * offset
        });
      }
      break;
      
    case WELD_PATTERNS.CIRCLES:
      // Спираль/кружочки вдоль шва
      const circleRadius = halfWidth * 0.4;
      const circleSpacing = 0.08; // Расстояние между витками
      
      for (let i = 0; i < seamPoints.length; i++) {
        const p = seamPoints[i];
        const t = i / seamPoints.length;
        
        // Спиральное движение
        const spiralAngle = t * Math.PI * 2 * (1 / circleSpacing);
        const spiralRadius = circleRadius * (0.5 + 0.5 * Math.sin(t * Math.PI * 4));
        
        // Нормаль к направлению шва
        let dx = 1, dy = 0;
        if (i > 0 && i < seamPoints.length - 1) {
          const prev = seamPoints[i - 1];
          const next = seamPoints[i + 1];
          dx = next.x - prev.x;
          dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            dx /= len;
            dy /= len;
          }
        }
        
        const perpX = -dy;
        const perpY = dx;
        
        const offset = Math.cos(spiralAngle) * spiralRadius;
        
        patternPoints.push({
          x: p.x + perpX * offset,
          y: p.y + perpY * offset
        });
      }
      break;
      
    default:
      patternPoints.push(...seamPoints.map(p => ({ ...p })));
  }
  
  return patternPoints;
}

export function useGame4() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    totalScore: 0,
    round: 1,
    currentPattern: WELD_PATTERNS.STRAIGHT,
    seamProgress: 0, // Процент заполнения шва (0-100)
    qualityPercent: 0, // Процент качества выполнения паттерна
    weldDots: [], // Точки сварки игрока
    seamPoints: [], // Точки разрыва
    patternPoints: [], // Точки паттерна для отображения
    sheetWidth: 0,
    sheetHeight: 0,
    sheetX: 0,
    sheetY: 0,
    gameOver: false,
    roundComplete: false,
    lastRoundScore: 0
  });
  
  const gameStateRef = useRef(null);
  const weldDotsRef = useRef([]);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const canvasRef = useRef(null);
  
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  // Инициализация нового раунда
  const initRound = useCallback((pattern = null) => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sheetWidth = rect.width * (METAL_SHEET_WIDTH_PERCENT / 100);
    const sheetHeight = rect.height * (METAL_SHEET_HEIGHT_PERCENT / 100);
    const sheetX = (rect.width - sheetWidth) / 2;
    const sheetY = (rect.height - sheetHeight) / 2;
    
    // Выбираем случайный паттерн если не указан
    const patterns = Object.values(WELD_PATTERNS);
    const selectedPattern = pattern || patterns[Math.floor(Math.random() * patterns.length)];
    
    // Генерируем разрыв
    const seamPoints = generateSeamPath(sheetWidth, sheetHeight);
    const seamWidth = sheetWidth * (SEAM_WIDTH_PERCENT / 100);
    const patternPoints = generatePatternPath(seamPoints, selectedPattern, seamWidth);
    
    weldDotsRef.current = [];
    lastWeldPointRef.current = null;
    
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      seamProgress: 0,
      qualityPercent: 0,
      weldDots: [],
      seamPoints,
      patternPoints,
      sheetWidth,
      sheetHeight,
      sheetX,
      sheetY,
      currentPattern: selectedPattern,
      roundComplete: false,
      gameOver: false
    }));
  }, []);
  
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: true,
      score: 0,
      totalScore: 0,
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
    weldDotsRef.current = [];
    lastWeldPointRef.current = null;
    setGameState({
      isRunning: false,
      score: 0,
      totalScore: 0,
      round: 1,
      currentPattern: WELD_PATTERNS.STRAIGHT,
      seamProgress: 0,
      qualityPercent: 0,
      weldDots: [],
      seamPoints: [],
      patternPoints: [],
      sheetWidth: 0,
      sheetHeight: 0,
      sheetX: 0,
      sheetY: 0,
      gameOver: false,
      roundComplete: false,
      lastRoundScore: 0
    });
  }, []);
  
  // Обработка движения мыши с зажатой кнопкой
  const handleMouseMove = useCallback((e) => {
    if (!isMouseDownRef.current || !gameStateRef.current?.isRunning) return;
    
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Проверяем, находится ли курсор над листом металла
    const { sheetX, sheetY, sheetWidth, sheetHeight } = gameStateRef.current;
    
    if (mouseX < sheetX || mouseX > sheetX + sheetWidth ||
        mouseY < sheetY || mouseY > sheetY + sheetHeight) {
      return;
    }
    
    // Вычисляем относительные координаты на листе
    const relX = mouseX - sheetX;
    const relY = mouseY - sheetY;
    
    // Проверяем расстояние до последней точки сварки
    const lastPoint = lastWeldPointRef.current;
    if (lastPoint) {
      const dx = relX - lastPoint.x;
      const dy = relY - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < WELD_DOT_SPACING) {
        return;
      }
    }
    
    // Добавляем точку сварки
    const newDot = {
      x: relX,
      y: relY,
      id: Date.now() + Math.random()
    };
    
    weldDotsRef.current = [...weldDotsRef.current, newDot];
    lastWeldPointRef.current = { x: relX, y: relY };
    
    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      weldDots: weldDotsRef.current
    }));
    
    // Проверяем прогресс и качество
    checkProgress();
  }, []);
  
  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    lastWeldPointRef.current = null;
  }, []);
  
  // Проверка прогресса заполнения шва
  const checkProgress = useCallback(() => {
    const state = gameStateRef.current;
    if (!state || state.seamPoints.length === 0) return;
    
    const { seamPoints, weldDots, sheetWidth, sheetHeight, currentPattern } = state;
    const seamWidth = sheetWidth * (SEAM_WIDTH_PERCENT / 100);
    const weldRadius = seamWidth / 2.5; // Радиус точки сварки
    
    let coveredCount = 0;
    let patternMatches = 0;
    let totalPatternPoints = 0;
    
    // Проверяем каждую точку шва
    for (let i = 0; i < seamPoints.length; i++) {
      const seamPoint = seamPoints[i];
      let isCovered = false;
      
      // Проверяем, покрыта ли эта точка шва сваркой
      for (const dot of weldDots) {
        const dx = dot.x - seamPoint.x;
        const dy = dot.y - seamPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= weldRadius) {
          isCovered = true;
          
          // Проверяем соответствие паттерну
          if (state.patternPoints && state.patternPoints[i]) {
            const patternPoint = state.patternPoints[i];
            const pdx = dot.x - patternPoint.x;
            const pdy = dot.y - patternPoint.y;
            const pDistance = Math.sqrt(pdx * pdx + pdy * pdy);
            
            // Для разных паттернов разная допустимая погрешность
            let patternTolerance = weldRadius * 1.8;
            if (currentPattern === WELD_PATTERNS.STRAIGHT) {
              patternTolerance = weldRadius * 2; // Более宽容 для прямого шва
            } else if (currentPattern === WELD_PATTERNS.CIRCLES) {
              patternTolerance = weldRadius * 2.2; // Еще более宽容 для кружочков
            }
            
            if (pDistance <= patternTolerance) {
              patternMatches++;
            }
            totalPatternPoints++;
          }
          
          break;
        }
      }
      
      if (isCovered) {
        coveredCount++;
      }
    }
    
    const progress = Math.min(100, (coveredCount / seamPoints.length) * 100);
    const quality = totalPatternPoints > 0 ? (patternMatches / totalPatternPoints) * 100 : 0;
    
    setGameState(prev => ({
      ...prev,
      seamProgress: Math.round(progress),
      qualityPercent: Math.round(quality)
    }));
    
    // Проверяем завершение раунда
    if (progress >= 100) {
      completeRound(quality);
    }
  }, []);
  
  // Завершение раунда
  const completeRound = useCallback((quality) => {
    const state = gameStateRef.current;
    if (!state || state.roundComplete) return;
    
    const baseScore = PATTERN_SCORES[state.currentPattern];
    const qualityMultiplier = quality / 100;
    const roundScore = Math.round(baseScore * qualityMultiplier);
    
    setGameState(prev => ({
      ...prev,
      roundComplete: true,
      isRunning: false,
      totalScore: prev.totalScore + roundScore,
      lastRoundScore: roundScore
    }));
  }, []);
  
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
    stopGame,
    resetGame,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    checkProgress,
    nextRound,
    setCanvasRef,
    initRound,
    WELD_PATTERNS,
    PATTERN_SCORES,
    SEAM_WIDTH_PERCENT,
    METAL_SHEET_WIDTH_PERCENT,
    METAL_SHEET_HEIGHT_PERCENT
  };
}
