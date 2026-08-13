import React, { useEffect, useRef, useCallback } from 'react';
import { useGame6, SKILL_CHECK_RADIUS, TARGET_ZONE_SIZE } from '../../hooks/useGame6';
import { GameStats } from '../UI/GameStats';

const Game6 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleAction,
    setCanvasRef,
    initRound,
    canvasRef,
  } = useGame6({ onLevelComplete });

  const requestRef = useRef(null);
  const bgCanvasRef = useRef(null);

  // Кэширование фона
  const cacheBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Создаем оффскрин канвас для кэширования фона
    if (!bgCanvasRef.current || bgCanvasRef.current.width !== width || bgCanvasRef.current.height !== height) {
      bgCanvasRef.current = document.createElement('canvas');
      bgCanvasRef.current.width = width;
      bgCanvasRef.current.height = height;
    }

    const bgCtx = bgCanvasRef.current.getContext('2d');

    // Рисуем фон (темный индустриальный стиль как в DbD)
    const bgGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(0.5, '#16213e');
    bgGradient.addColorStop(1, '#0f0f1a');
    bgCtx.fillStyle = bgGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Добавляем сетку/текстуру для атмосферы
    bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    bgCtx.lineWidth = 1;
    const gridSize = 50;
    
    for (let x = 0; x < width; x += gridSize) {
      bgCtx.beginPath();
      bgCtx.moveTo(x, 0);
      bgCtx.lineTo(x, height);
      bgCtx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, y);
      bgCtx.lineTo(width, y);
      bgCtx.stroke();
    }

  }, []);

  // Отрисовка игры
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);

    // Рисуем закэшированный фон
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0);
    } else {
      cacheBackground();
      return;
    }

    // Рисуем скилл чек если он есть
    if (gameState.skillCheck) {
      const skillCheck = gameState.skillCheck;
      
      // Вычисляем текущий радиус с учетом множителя размера
      const currentRadius = SKILL_CHECK_RADIUS * skillCheck.sizeMultiplier;
      
      // Позиция с учетом тряски
      const drawX = skillCheck.x + skillCheck.shakeOffset.x;
      const drawY = skillCheck.y + skillCheck.shakeOffset.y;

      // Основной круг (фон)
      ctx.beginPath();
      ctx.arc(drawX, drawY, currentRadius, 0, Math.PI * 2);
      
      // Цвет круга зависит от состояния
      if (!skillCheck.isActive) {
        // Промах - красный круг
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        // Активный скилл чек - темно-серый фон
        ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Рисуем белую целевую зону (10%)
        ctx.beginPath();
        ctx.moveTo(drawX, drawY);
        ctx.arc(drawX, drawY, currentRadius, skillCheck.targetStartAngle, skillCheck.targetEndAngle);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Рисуем стрелку
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(skillCheck.angle);
        
        // Стрелка
        ctx.beginPath();
        ctx.moveTo(0, -currentRadius + 10);
        ctx.lineTo(-8, -currentRadius + 30);
        ctx.lineTo(0, -currentRadius + 20);
        ctx.lineTo(8, -currentRadius + 30);
        ctx.closePath();
        ctx.fillStyle = '#ff4444';
        ctx.fill();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
      }
      
      // Если промах - рисуем красный индикатор перед исчезновением
      if (!skillCheck.isActive) {
        // Красная вспышка
        ctx.beginPath();
        ctx.arc(drawX, drawY, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fill();
      }
    }

  }, [gameState.skillCheck, cacheBackground]);

  // Игровой цикл для отрисовки
  useEffect(() => {
    const animate = () => {
      draw();
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [draw]);

  // Обработчик нажатия клавиш
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAction]);

  // Обработчик клика мыши (ЛКМ)
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (e.button === 0) { // ЛКМ
        handleAction();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleAction]);

  // Инициализация канваса
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          cacheBackground();
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      startGame();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [startGame, cacheBackground]);

  const handleRestart = () => {
    resetGame();
    setTimeout(() => startGame(), 100);
  };

  return (
    <div className="relative w-full h-full">
      {/* Канвас игры */}
      <canvas
        ref={setCanvasRef}
        className="w-full h-full"
      />

      {/* Кнопка назад */}
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-40 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
      >
        ←
      </button>

      {/* UI статистики */}
      <GameStats score={gameState.score} isGame6={true} />

      {/* Кнопка рестарта */}
      <button
        onClick={handleRestart}
        className="absolute top-5 right-5 z-40 px-6 py-3 bg-yellow-500/80 hover:bg-yellow-500 text-white font-bold rounded-lg transition-all shadow-lg"
      >
        🔄 Рестарт
      </button>

      {/* Подсказка управления */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-40 text-white/70 text-sm text-center">
        Нажми Пробел или ЛКМ чтобы остановить стрелку в белой зоне
      </div>
    </div>
  );
};

export default Game6;
