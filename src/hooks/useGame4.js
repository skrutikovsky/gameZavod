import { useState, useEffect, useCallback, useRef } from 'react';

// Константы игры
const WELD_TYPES = [
  { id: 'straight', name: 'Прямой шов', basePoints: 1000 },
  { id: 'snake', name: 'Змейка', basePoints: 2000 },
  { id: 'circle', name: 'Кружочки', basePoints: 3000 }
];

const METAL_SHEET_WIDTH_PERCENT = 70;
const METAL_SHEET_HEIGHT_PERCENT = 60;
const GAP_WIDTH_BASE = 30; // Базовая ширина разрыва в пикселях
const WELD_DOT_RADIUS = 8; // Радиус точки сварки
const WELD_DOT_SPACING = 10; // Расстояние между точками сварки в пикселях
const QUALITY_THRESHOLD = 0.85; // Порог качества для завершения раунда (85%)

export function useGame4() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    round: 1,
    currentWeldType: null,
    qualityPercent: 0,
    weldProgress: 0,
    patternProgress: 0,
    isWelding: false,
    gameOver: false,
    roundComplete: false
  });

  const canvasRef = useRef(null);
  const metalSheetRef = useRef(null);
  const gapPathRef = useRef(null);
  const patternPathRef = useRef(null);
  const weldDotsRef = useRef([]);
  const isMouseDownRef = useRef(false);
  const lastWeldPointRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Генерация случайного разрыва (кривая через центр листа)
  const generateGapPath = useCallback((width, height) => {
    const points = [];
    const numPoints = 50;
    const centerY = height / 2;
    const amplitude = height * 0.15; // Амплитуда колебаний
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;
      // Комбинируем синусоиду с случайными отклонениями
      const baseY = centerY + Math.sin(i * 0.3) * amplitude * 0.5;
      const randomOffset = (Math.random() - 0.5) * amplitude * 0.8;
      const y = baseY + randomOffset;
      points.push({ x, y });
    }
    
    return points;
  }, []);

  // Генерация паттерна для типа сварки
  const generatePatternPath = useCallback((gapPoints, weldType, gapWidth) => {
    if (!gapPoints || gapPoints.length === 0) return [];
    
    const patternPoints = [];
    const numSegments = gapPoints.length - 1;
    
    if (weldType === 'straight') {
      // Простая линия вдоль центра разрыва
      patternPoints.push(...gapPoints.map(p => ({ ...p })));
    } else if (weldType === 'snake') {
      // Змейка вдоль разрыва
      const snakeAmplitude = gapWidth * 0.8;
      const snakeFrequency = 0.5;
      
      for (let i = 0; i < numSegments; i++) {
        const p1 = gapPoints[i];
        const p2 = gapPoints[i + 1];
        const segmentsPerGap = 5;
        
        for (let j = 0; j < segmentsPerGap; j++) {
          const t = (i * segmentsPerGap + j) / (numSegments * segmentsPerGap);
          const x = p1.x + (p2.x - p1.x) * (j / segmentsPerGap);
          const y = p1.y + (p2.y - p1.y) * (j / segmentsPerGap);
          
          // Добавляем синусоидальное отклонение
          const normalAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;
          const offset = Math.sin(t * Math.PI * 10) * snakeAmplitude;
          
          patternPoints.push({
            x: x + Math.cos(normalAngle) * offset,
            y: y + Math.sin(normalAngle) * offset
          });
        }
      }
    } else if (weldType === 'circle') {
      // Спираль/кружочки вдоль разрыва
      const circleRadius = gapWidth * 0.6;
      const circlesPerSegment = 2;
      
      for (let i = 0; i < numSegments; i++) {
        const p1 = gapPoints[i];
        const p2 = gapPoints[i + 1];
        
        for (let c = 0; c < circlesPerSegment; c++) {
          const t = i + c / circlesPerSegment;
          const centerX = p1.x + (p2.x - p1.x) * (c / circlesPerSegment);
          const centerY = p1.y + (p2.y - p1.y) * (c / circlesPerSegment);
          
          // Генерируем точки круга
          const pointsPerCircle = 12;
          for (let angle = 0; angle < pointsPerCircle; angle++) {
            const theta = (angle / pointsPerCircle) * Math.PI * 2;
            const spiralOffset = (t / numSegments) * circleRadius * 0.3;
            
            patternPoints.push({
              x: centerX + Math.cos(theta) * (circleRadius * 0.5 + spiralOffset),
              y: centerY + Math.sin(theta) * (circleRadius * 0.5 + spiralOffset)
            });
          }
        }
      }
    }
    
    return patternPoints;
  }, []);

  // Инициализация раунда
  const initRound = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Параметры листа металла
    const sheetWidth = width * (METAL_SHEET_WIDTH_PERCENT / 100);
    const sheetHeight = height * (METAL_SHEET_HEIGHT_PERCENT / 100);
    const sheetX = (width - sheetWidth) / 2;
    const sheetY = (height - sheetHeight) / 2;
    
    metalSheetRef.current = { x: sheetX, y: sheetY, width: sheetWidth, height: sheetHeight };
    
    // Генерируем разрыв
    const gapPoints = generateGapPath(sheetWidth, sheetHeight);
    // Смещаем точки относительно листа
    const shiftedGapPoints = gapPoints.map(p => ({
      x: p.x + sheetX,
      y: p.y + sheetY
    }));
    gapPathRef.current = shiftedGapPoints;
    
    // Выбираем случайный тип сварки
    const randomWeldType = WELD_TYPES[Math.floor(Math.random() * WELD_TYPES.length)];
    
    // Генерируем паттерн
    const gapWidth = GAP_WIDTH_BASE + 10; // Ширина разрыва
    const patternPoints = generatePatternPath(gapPoints, randomWeldType.id, gapWidth);
    const shiftedPatternPoints = patternPoints.map(p => ({
      x: p.x + sheetX,
      y: p.y + sheetY
    }));
    patternPathRef.current = shiftedPatternPoints;
    
    // Сбрасываем точки сварки
    weldDotsRef.current = [];
    lastWeldPointRef.current = null;
    
    setGameState(prev => ({
      ...prev,
      currentWeldType: randomWeldType,
      qualityPercent: 0,
      weldProgress: 0,
      patternProgress: 0,
      roundComplete: false
    }));
  }, [generateGapPath, generatePatternPath]);

  // Отрисовка игры
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Очистка
    ctx.clearRect(0, 0, width, height);
    
    // Рисуем лист металла
    const sheet = metalSheetRef.current;
    if (sheet) {
      // Градиент металла
      const gradient = ctx.createLinearGradient(sheet.x, sheet.y, sheet.x + sheet.width, sheet.y + sheet.height);
      gradient.addColorStop(0, '#7f8c8d');
      gradient.addColorStop(0.5, '#95a5a6');
      gradient.addColorStop(1, '#7f8c8d');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
      
      // Граница листа
      ctx.strokeStyle = '#5d6d7e';
      ctx.lineWidth = 3;
      ctx.strokeRect(sheet.x, sheet.y, sheet.width, sheet.height);
    }
    
    // Рисуем разрыв (шов который нужно заварить)
    const gapPoints = gapPathRef.current;
    if (gapPoints && gapPoints.length > 1) {
      const gapWidth = GAP_WIDTH_BASE;
      
      // Рисуем область разрыва
      ctx.beginPath();
      ctx.moveTo(gapPoints[0].x, gapPoints[0].y - gapWidth / 2);
      
      for (let i = 1; i < gapPoints.length; i++) {
        ctx.lineTo(gapPoints[i].x, gapPoints[i].y - gapWidth / 2);
      }
      
      for (let i = gapPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(gapPoints[i].x, gapPoints[i].y + gapWidth / 2);
      }
      
      ctx.closePath();
      ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
      ctx.fill();
      
      // Рисуем пунктирную линию паттерна
      const patternPoints = patternPathRef.current;
      if (patternPoints && patternPoints.length > 1) {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(patternPoints[0].x, patternPoints[0].y);
        
        for (let i = 1; i < patternPoints.length; i++) {
          ctx.lineTo(patternPoints[i].x, patternPoints[i].y);
        }
        
        ctx.strokeStyle = gameState.currentWeldType?.id === 'straight' ? '#ffff00' : 
                         gameState.currentWeldType?.id === 'snake' ? '#00ff00' : '#ff00ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    
    // Рисуем точки сварки
    const weldDots = weldDotsRef.current;
    weldDots.forEach(dot => {
      const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, WELD_DOT_RADIUS);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, '#ffff00');
      gradient.addColorStop(0.7, '#ff8800');
      gradient.addColorStop(1, '#ff4400');
      
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, WELD_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }, [gameState.currentWeldType]);

  // Проверка качества сварки
  const checkWeldQuality = useCallback(() => {
    const gapPoints = gapPathRef.current;
    const weldDots = weldDotsRef.current;
    const patternPoints = patternPathRef.current;
    
    if (!gapPoints || !patternPoints || gapPoints.length === 0) return { weldProgress: 0, patternProgress: 0, quality: 0 };
    
    const gapWidth = GAP_WIDTH_BASE;
    const totalGapLength = calculatePathLength(gapPoints);
    const totalPatternLength = calculatePathLength(patternPoints);
    
    // Проверяем покрытие разрыва
    let coveredLength = 0;
    let patternMatchCount = 0;
    
    // Разбиваем разрыв на сегменты и проверяем каждый
    const segmentLength = 5;
    const numSegments = Math.floor(totalGapLength / segmentLength);
    
    for (let i = 0; i < numSegments; i++) {
      const t = i / numSegments;
      const pointOnGap = getPointOnPath(gapPoints, t);
      
      // Проверяем есть ли точка сварки рядом
      let isCovered = false;
      let matchesPattern = false;
      
      for (const dot of weldDots) {
        const distToGap = Math.sqrt(Math.pow(dot.x - pointOnGap.x, 2) + Math.pow(dot.y - pointOnGap.y, 2));
        
        if (distToGap < gapWidth / 2 + WELD_DOT_RADIUS) {
          isCovered = true;
          
          // Проверяем соответствие паттерну
          for (const patternPoint of patternPoints) {
            const distToPattern = Math.sqrt(Math.pow(dot.x - patternPoint.x, 2) + Math.pow(dot.y - patternPoint.y, 2));
            if (distToPattern < WELD_DOT_RADIUS * 1.5) {
              matchesPattern = true;
              break;
            }
          }
          
          if (matchesPattern) break;
        }
      }
      
      if (isCovered) coveredLength += segmentLength;
      if (matchesPattern) patternMatchCount++;
    }
    
    const weldProgress = (coveredLength / totalGapLength) * 100;
    const patternProgress = patternPoints.length > 0 ? (patternMatchCount / (numSegments * 0.3)) * 100 : 0;
    
    // Качество зависит от соответствия паттерну
    const patternFactor = Math.min(patternProgress / 100, 1);
    const quality = weldProgress * (0.3 + 0.7 * patternFactor);
    
    return {
      weldProgress: Math.min(weldProgress, 100),
      patternProgress: Math.min(patternProgress, 100),
      quality: Math.min(quality, 100)
    };
  }, []);

  // Вспомогательная функция для расчета длины пути
  const calculatePathLength = (points) => {
    if (!points || points.length < 2) return 0;
    
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    
    return length;
  };

  // Вспомогательная функция для получения точки на пути
  const getPointOnPath = (points, t) => {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (t <= 0) return points[0];
    if (t >= 1) return points[points.length - 1];
    
    const totalLength = calculatePathLength(points);
    const targetLength = t * totalLength;
    
    let currentLength = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (currentLength + segmentLength >= targetLength) {
        const remainingLength = targetLength - currentLength;
        const ratio = remainingLength / segmentLength;
        
        return {
          x: points[i - 1].x + dx * ratio,
          y: points[i - 1].y + dy * ratio
        };
      }
      
      currentLength += segmentLength;
    }
    
    return points[points.length - 1];
  };

  // Обработка движения мыши (сварка)
  const handleMouseMove = useCallback((clientX, clientY) => {
    if (!isMouseDownRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    // Проверяем расстояние до последней точки
    const lastPoint = lastWeldPointRef.current;
    if (lastPoint) {
      const dist = Math.sqrt(Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2));
      
      if (dist >= WELD_DOT_SPACING) {
        // Добавляем точку сварки
        weldDotsRef.current.push({ x, y });
        lastWeldPointRef.current = { x, y };
        
        // Проверяем качество
        const qualityCheck = checkWeldQuality();
        
        setGameState(prev => {
          const newState = {
            ...prev,
            weldProgress: qualityCheck.weldProgress,
            patternProgress: qualityCheck.patternProgress,
            qualityPercent: qualityCheck.quality
          };
          
          // Проверяем завершение раунда
          if (qualityCheck.weldProgress >= 100 && !prev.roundComplete) {
            newState.roundComplete = true;
            
            // Рассчитываем очки
            const basePoints = prev.currentWeldType?.basePoints || 1000;
            const earnedPoints = Math.round(basePoints * (qualityCheck.quality / 100));
            newState.score = prev.score + earnedPoints;
          }
          
          return newState;
        });
      }
    } else {
      lastWeldPointRef.current = { x, y };
    }
    
    render();
  }, [checkWeldQuality, render]);

  const handleMouseDown = useCallback(() => {
    isMouseDownRef.current = true;
    setGameState(prev => ({ ...prev, isWelding: true }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    lastWeldPointRef.current = null;
    setGameState(prev => ({ ...prev, isWelding: false }));
  }, []);

  const startGame = useCallback(() => {
    setGameState({
      isRunning: true,
      score: 0,
      round: 1,
      currentWeldType: null,
      qualityPercent: 0,
      weldProgress: 0,
      patternProgress: 0,
      isWelding: false,
      gameOver: false,
      roundComplete: false
    });
    
    // Небольшая задержка перед инициализацией для загрузки canvas
    setTimeout(() => {
      initRound();
    }, 100);
  }, [initRound]);

  const stopGame = useCallback(() => {
    setGameState(prev => ({ ...prev, isRunning: false }));
  }, []);

  const nextRound = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      round: prev.round + 1,
      roundComplete: false,
      qualityPercent: 0,
      weldProgress: 0,
      patternProgress: 0
    }));
    
    setTimeout(() => {
      initRound();
    }, 100);
  }, [initRound]);

  const resetGame = useCallback(() => {
    weldDotsRef.current = [];
    lastWeldPointRef.current = null;
    
    setGameState({
      isRunning: false,
      score: 0,
      round: 1,
      currentWeldType: null,
      qualityPercent: 0,
      weldProgress: 0,
      patternProgress: 0,
      isWelding: false,
      gameOver: false,
      roundComplete: false
    });
  }, []);

  // Игровой цикл для рендеринга
  useEffect(() => {
    if (gameState.isRunning) {
      const gameLoop = () => {
        render();
        animationFrameRef.current = requestAnimationFrame(gameLoop);
      };
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [gameState.isRunning, render]);

  // Обновление размера canvas
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          
          // Перерисовываем при изменении размера
          if (gameState.isRunning) {
            render();
          }
        }
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [gameState.isRunning, render]);

  return {
    gameState,
    setGameState,
    canvasRef,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    startGame,
    stopGame,
    nextRound,
    resetGame,
    initRound,
    WELD_TYPES,
    METAL_SHEET_WIDTH_PERCENT,
    METAL_SHEET_HEIGHT_PERCENT,
    WELD_DOT_RADIUS,
    QUALITY_THRESHOLD
  };
}
