import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGame4 } from '../../hooks/useGame4';
import { GameStats } from '../UI/GameStats';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';

const CANVAS_PADDING = 50; // Отступы от краев холста

// Типы сварки
const WELD_TYPES = {
  STRAIGHT: { id: 'straight', name: 'Прямой шов', points: 1000, description: 'Ведите вдоль линии разрыва' },
  SINE: { id: 'sine', name: 'Змейка', points: 2000, description: 'Заполняйте шов волнообразными движениями' },
  SPIRAL: { id: 'spiral', name: 'Кружочки', points: 3000, description: 'Заполняйте шов круговыми движениями' }
};

const Game4 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
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
    WELD_DOT_RADIUS,
    WELD_DOT_SPACING
  } = useGame4();

  const gameContainerRef = useRef(null);
  const requestRef = useRef(null);
  const [showRoundComplete, setShowRoundComplete] = useState(false);
  const [roundResult, setRoundResult] = useState(null);

  // Инициализация игры
  useEffect(() => {
    startGame();
    return () => {
      stopGame();
    };
  }, []);

  // Обработка мыши на холсте
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    startWelding(x, y);
  }, [startWelding]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState.isWelding) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    weld(x, y);
  }, [weld, gameState.isWelding]);

  const handleMouseUp = useCallback(() => {
    stopWelding();
  }, [stopWelding]);

  const handleMouseLeave = useCallback(() => {
    stopWelding();
  }, [stopWelding]);

  // Обработка тач-событий для мобильных
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    startWelding(x, y);
  }, [startWelding]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !gameState.isWelding) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    weld(x, y);
  }, [weld, gameState.isWelding]);

  const handleTouchEnd = useCallback(() => {
    stopWelding();
  }, [stopWelding]);

  // Отрисовка на холсте
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Очистка холста
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем лист металла
    drawMetalSheet(ctx, canvas.width, canvas.height);

    // Рисуем шов (разрыв)
    if (gameState.seamPoints.length > 0) {
      drawSeam(ctx, gameState.seamPoints, gameState.seamWidth);
    }

    // Рисуем пунктирную линию паттерна
    if (gameState.patternPoints.length > 0) {
      drawPatternGuide(ctx, gameState.patternPoints, gameState.weldType);
    }

    // Рисуем точки сварки
    if (gameState.weldDots.length > 0) {
      drawWeldDots(ctx, gameState.weldDots, WELD_DOT_RADIUS);
    }

    // Рисуем индикатор завершения
    if (gameState.fillPercentage >= 95 && !gameState.gameOver) {
      drawCompleteIndicator(ctx, canvas.width, canvas.height);
    }
  }, [
    gameState.seamPoints,
    gameState.patternPoints,
    gameState.weldDots,
    gameState.seamWidth,
    gameState.weldType,
    gameState.fillPercentage,
    gameState.gameOver
  ]);

  // Функции отрисовки
  const drawMetalSheet = (ctx, width, height) => {
    // Градиент для металлической поверхности
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#6b7280');
    gradient.addColorStop(0.5, '#9ca3af');
    gradient.addColorStop(1, '#6b7280');

    ctx.fillStyle = gradient;
    ctx.fillRect(
      CANVAS_PADDING - 10,
      CANVAS_PADDING - 10,
      width - CANVAS_PADDING * 2 + 20,
      height - CANVAS_PADDING * 2 + 20
    );

    // Добавляем текстуру металла (линии)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, i);
      ctx.lineTo(width - CANVAS_PADDING, i);
      ctx.stroke();
    }
  };

  const drawSeam = (ctx, seamPoints, seamWidth) => {
    if (seamPoints.length < 2) return;

    // Рисуем область шва
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = seamWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(seamPoints[0].x, seamPoints[0].y);
    
    for (let i = 1; i < seamPoints.length; i++) {
      ctx.lineTo(seamPoints[i].x, seamPoints[i].y);
    }
    
    ctx.stroke();

    // Рисуем границы шва
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = seamWidth + 4;
    ctx.stroke();
  };

  const drawPatternGuide = (ctx, patternPoints, weldType) => {
    if (patternPoints.length < 2) return;

    ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]); // Пунктирная линия
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(patternPoints[0].x, patternPoints[0].y);
    
    for (let i = 1; i < patternPoints.length; i++) {
      ctx.lineTo(patternPoints[i].x, patternPoints[i].y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);

    // Добавляем иконки типа сварки вдоль линии
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.font = '16px Arial';
    
    const iconSpacing = 80;
    let distance = 0;
    let lastIndex = 0;

    for (let i = 1; i < patternPoints.length; i++) {
      const dx = patternPoints[i].x - patternPoints[i - 1].x;
      const dy = patternPoints[i].y - patternPoints[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);

      if (distance >= iconSpacing) {
        const t = (i - lastIndex) / (patternPoints.length - lastIndex);
        const midX = patternPoints[lastIndex].x + (patternPoints[i].x - patternPoints[lastIndex].x) * 0.5;
        const midY = patternPoints[lastIndex].y + (patternPoints[i].y - patternPoints[lastIndex].y) * 0.5;

        // Рисуем мини-иконку в зависимости от типа сварки
        if (weldType.id === WELD_TYPES.SINE.id) {
          drawMiniSine(ctx, midX, midY, 15, 5);
        } else if (weldType.id === WELD_TYPES.SPIRAL.id) {
          drawMiniSpiral(ctx, midX, midY, 8);
        } else {
          drawMiniArrow(ctx, midX, midY);
        }

        distance = 0;
        lastIndex = i;
      }
    }
  };

  const drawMiniSine = (ctx, x, y, width, amplitude) => {
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y);
    
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const px = x - width / 2 + t * width;
      const py = y + Math.sin(t * Math.PI * 2) * amplitude;
      ctx.lineTo(px, py);
    }
    
    ctx.stroke();
  };

  const drawMiniSpiral = (ctx, x, y, radius) => {
    ctx.beginPath();
    
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 4;
      const r = (i / 20) * radius;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    
    ctx.stroke();
  };

  const drawMiniArrow = (ctx, x, y) => {
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 3);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x - 5, y + 3);
    ctx.stroke();
  };

  const drawWeldDots = (ctx, weldDots, radius) => {
    weldDots.forEach((dot, index) => {
      // Градиент для точки сварки (эффект нагрева)
      const gradient = ctx.createRadialGradient(
        dot.x, dot.y, 0,
        dot.x, dot.y, radius
      );
      
      // Цвет меняется от центра к краям (оранжевый -> желтый -> белый)
      const progress = index / weldDots.length;
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, '#fef3c7');
      gradient.addColorStop(0.7, '#fbbf24');
      gradient.addColorStop(1, '#f59e0b');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Добавляем свечение
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const drawCompleteIndicator = (ctx, width, height) => {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Шов готов!', width / 2, height / 2);
    ctx.font = '24px Arial';
    ctx.fillText('Отпустите кнопку', width / 2, height / 2 + 40);
  };

  // Проверка завершения раунда
  useEffect(() => {
    if (gameState.fillPercentage >= 95 && !gameState.gameOver && !showRoundComplete) {
      const result = completeRound();
      if (result.completed) {
        setRoundResult(result);
        setShowRoundComplete(true);
      }
    }
  }, [gameState.fillPercentage, gameState.gameOver, completeRound]);

  const handleContinue = () => {
    setShowRoundComplete(false);
    setRoundResult(null);
    nextRound();
  };

  const handleRestart = () => {
    resetGame();
    startGame();
    setShowRoundComplete(false);
    setRoundResult(null);
  };

  const isGameOver = gameState.lives <= 0;

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden bg-gray-900"
      style={{ cursor: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Crect fill=\'%23fbbf24\' x=\'2\' y=\'2\' width=\'28\' height=\'28\' rx=\'4\'/%3E%3Ccircle fill=\'%23fff\' cx=\'16\' cy=\'16\' r=\'8\'/%3E%3C/svg%3E") 16 16, auto' }}
    >
      {/* Статистика игры */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-black/60 text-white text-xl w-full z-30 backdrop-blur-sm border-b border-white/20">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-xl font-bold transition-all"
        >
          ←
        </button>
        
        <div className="flex gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Счёт</span>
            <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">{gameState.totalScore}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Раунд</span>
            <span className="text-2xl font-bold text-blue-400 drop-shadow-lg">{gameState.round}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Тип шва</span>
            <span className="text-lg font-bold text-purple-400 drop-shadow-lg">{gameState.weldType.name}</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Заполнение</span>
            <span className="text-2xl font-bold text-green-400 drop-shadow-lg">{gameState.fillPercentage.toFixed(0)}%</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs opacity-80 uppercase tracking-wider">Качество</span>
            <span className="text-2xl font-bold text-cyan-400 drop-shadow-lg">{gameState.qualityPercentage.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Холст для рисования */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute top-0 left-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Подсказка по типу сварки */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-lg backdrop-blur-sm border border-white/20">
        <p className="text-lg font-bold">{gameState.weldType.description}</p>
        <p className="text-sm opacity-80">Максимум очков: {gameState.weldType.points}</p>
      </div>

      {/* Модальное окно завершения раунда */}
      {showRoundComplete && roundResult && (
        <Modal
          title={`Раунд ${gameState.round} завершен!`}
          message={`Очки за раунд: ${roundResult.earnedPoints}\nКачество выполнения: ${roundResult.quality.toFixed(0)}%\nОбщий счёт: ${gameState.totalScore}`}
        >
          <div className="space-y-4">
            <Button onClick={handleContinue} variant="primary">
              Следующий раунд
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}

      {/* Модальное окно конца игры */}
      {isGameOver && (
        <Modal
          title="Игра окончена!"
          message={`Общий счёт: ${gameState.totalScore}\nПройдено раундов: ${gameState.round}`}
        >
          <div className="space-y-4">
            <Button onClick={handleRestart} variant="primary">
              Рестарт
            </Button>
            <Button onClick={onGameOver} variant="secondary">
              В главное меню
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Game4;
