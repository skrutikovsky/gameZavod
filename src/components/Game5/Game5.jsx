import React, { useEffect, useRef, useCallback } from 'react';
import { useGame5, ICE_CREAM_WIDTH, ICE_CREAM_HEIGHT, STICK_WIDTH, STICK_HEIGHT, CONVEYOR_SPEED, ICE_CREAM_COLORS, ICE_CREAM_TYPES, SPAWN_COOLDOWN } from '../../hooks/useGame5';
import { GameStats } from '../UI/GameStats';

const Game5 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    setGameState,
    startGame,
    resetGame,
    handleSpacePress,
    setCanvasRef,
    initRound,
    canvasRef,
  } = useGame5({ onLevelComplete });

  const requestRef = useRef(null);
  const bgCanvasRef = useRef(null);

  // Кэширование фона (туннели и конвейер)
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
    // Используем максимальную высоту мороженки для позиционирования конвейера
    const maxIceCreamHeight = ICE_CREAM_HEIGHT * Math.max(...ICE_CREAM_TYPES.map(t => t.heightMultiplier));
    const conveyorY = height / 2 - maxIceCreamHeight / 2;
    const tunnelWidth = 100;

    // Рисуем фон (темный цех)
    const bgGradient = bgCtx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    bgCtx.fillStyle = bgGradient;
    bgCtx.fillRect(0, 0, width, height);

    // Левый туннель
    const leftTunnelGradient = bgCtx.createLinearGradient(0, 0, tunnelWidth, 0);
    leftTunnelGradient.addColorStop(0, '#0f0f1a');
    leftTunnelGradient.addColorStop(0.5, '#2a2a3e');
    leftTunnelGradient.addColorStop(1, '#1a1a2e');
    bgCtx.fillStyle = leftTunnelGradient;
    bgCtx.fillRect(0, 0, tunnelWidth, height);

    // Ребра жесткости левого туннеля
    bgCtx.strokeStyle = '#3a3a4e';
    bgCtx.lineWidth = 2;
    for (let i = 0; i < height; i += 50) {
      bgCtx.beginPath();
      bgCtx.moveTo(0, i);
      bgCtx.lineTo(tunnelWidth, i);
      bgCtx.stroke();
    }

    // Правый туннель
    const rightTunnelGradient = bgCtx.createLinearGradient(width - tunnelWidth, 0, width, 0);
    rightTunnelGradient.addColorStop(0, '#1a1a2e');
    rightTunnelGradient.addColorStop(0.5, '#2a2a3e');
    rightTunnelGradient.addColorStop(1, '#0f0f1a');
    bgCtx.fillStyle = rightTunnelGradient;
    bgCtx.fillRect(width - tunnelWidth, 0, tunnelWidth, height);

    // Ребра жесткости правого туннеля
    bgCtx.strokeStyle = '#3a3a4e';
    bgCtx.lineWidth = 2;
    for (let i = 0; i < height; i += 50) {
      bgCtx.beginPath();
      bgCtx.moveTo(width - tunnelWidth, i);
      bgCtx.lineTo(width, i);
      bgCtx.stroke();
    }

    // Конвейерная дорожка
    const conveyorHeight = 20;
    const conveyorGradient = bgCtx.createLinearGradient(0, conveyorY + maxIceCreamHeight, 0, conveyorY + maxIceCreamHeight + conveyorHeight);
    conveyorGradient.addColorStop(0, '#4a4a5a');
    conveyorGradient.addColorStop(0.5, '#6a6a7a');
    conveyorGradient.addColorStop(1, '#4a4a5a');
    bgCtx.fillStyle = conveyorGradient;
    bgCtx.fillRect(tunnelWidth, conveyorY + maxIceCreamHeight, width - tunnelWidth * 2, conveyorHeight);

    // Полоски на конвейере (для визуализации движения)
    bgCtx.strokeStyle = '#3a3a4a';
    bgCtx.lineWidth = 2;
    for (let i = tunnelWidth; i < width - tunnelWidth; i += 40) {
      bgCtx.beginPath();
      bgCtx.moveTo(i, conveyorY + maxIceCreamHeight);
      bgCtx.lineTo(i, conveyorY + maxIceCreamHeight + conveyorHeight);
      bgCtx.stroke();
    }

    // Границы конвейера
    bgCtx.strokeStyle = '#5a5a6a';
    bgCtx.lineWidth = 4;
    bgCtx.beginPath();
    bgCtx.moveTo(tunnelWidth, conveyorY + maxIceCreamHeight);
    bgCtx.lineTo(width - tunnelWidth, conveyorY + maxIceCreamHeight);
    bgCtx.stroke();

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

    // Используем максимальную высоту мороженки для позиционирования конвейера
    const maxIceCreamHeight = ICE_CREAM_HEIGHT * Math.max(...ICE_CREAM_TYPES.map(t => t.heightMultiplier));
    const conveyorY = height / 2 - maxIceCreamHeight / 2;

    // Рисуем аппарат с палочками по центру сверху (опущен ниже хэдера)
    const dispenserX = width / 2 - 40;
    const dispenserY = 80; // Опустили аппарат ниже (было 0)
    const dispenserWidth = 80;
    const dispenserHeight = 60;

    // Корпус аппарата
    const dispenserGradient = ctx.createLinearGradient(dispenserX, dispenserY, dispenserX + dispenserWidth, dispenserY + dispenserHeight);
    dispenserGradient.addColorStop(0, '#8b7355');
    dispenserGradient.addColorStop(0.5, '#a08060');
    dispenserGradient.addColorStop(1, '#8b7355');
    ctx.fillStyle = dispenserGradient;
    ctx.fillRect(dispenserX, dispenserY, dispenserWidth, dispenserHeight);

    // Деревянная текстура на аппарате
    ctx.strokeStyle = '#6b5340';
    ctx.lineWidth = 2;
    for (let i = 10; i < dispenserHeight - 10; i += 8) {
      ctx.beginPath();
      ctx.moveTo(dispenserX + 5, dispenserY + i);
      ctx.lineTo(dispenserX + dispenserWidth - 5, dispenserY + i);
      ctx.stroke();
    }

    // Отверстие для палочек
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(width / 2 - 8, dispenserY + dispenserHeight - 10, 16, 10);

    // Механизм выпуска (кнопка/рычаг)
    ctx.fillStyle = '#cd853f';
    ctx.beginPath();
    ctx.arc(width / 2, dispenserY + 20, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#daa520';
    ctx.beginPath();
    ctx.arc(width / 2, dispenserY + 20, 10, 0, Math.PI * 2);
    ctx.fill();

    // Индикатор перезарядки (лаконичное обозначение)
    const now = Date.now();
    const timeSinceLastPress = now - gameState.lastSpawnPressTime;
    const cooldownRemaining = Math.max(0, SPAWN_COOLDOWN - timeSinceLastPress);
    const cooldownProgress = cooldownRemaining / SPAWN_COOLDOWN;
    
    // Полоска перезарядки под аппаратом
    const barWidth = 60;
    const barHeight = 6;
    const barX = width / 2 - barWidth / 2;
    const barY = dispenserY + dispenserHeight + 8;
    
    // Фон полоски
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Заполнение полоски (зеленый когда готов, красный когда перезаряжается)
    if (cooldownRemaining <= 0) {
      ctx.fillStyle = '#00ff00'; // Готов
    } else {
      ctx.fillStyle = '#ff4444'; // Перезарядка
    }
    ctx.fillRect(barX, barY, barWidth * (1 - cooldownProgress), barHeight);

    // Рисуем мороженки (прямоугольные со скруглениями)
    gameState.iceCreams.forEach(icecream => {
      const iceCreamType = icecream.type || ICE_CREAM_TYPES[0]; // Тип по умолчанию - обычный
      const iceCreamWidth = ICE_CREAM_WIDTH * iceCreamType.widthMultiplier;
      const iceCreamHeight = ICE_CREAM_HEIGHT * iceCreamType.heightMultiplier;
      const iceX = icecream.x;
      const iceY = icecream.y;
      const color = icecream.color || ICE_CREAM_COLORS[0]; // Цвет по умолчанию

      // Если есть палочка - рисуем её ПЕРВОЙ (ЗА мороженкой), потом мороженое сверху
      if (icecream.hasStick) {
        // Вычисляем позицию палочки относительно мороженки - где именно она упала
        const stickRelativeX = icecream.stuckStickOffset !== undefined ? 
          icecream.stuckStickOffset * iceCreamWidth : 
          iceCreamWidth / 2 - STICK_WIDTH / 2;
        
        const stickX = iceX + stickRelativeX;
        // Используем сохраненную Y позицию верха палочки (где она коснулась мороженки)
        const stickY = icecream.stickTopY !== undefined ? icecream.stickTopY : iceY - STICK_HEIGHT;

        // Анимация погружения: палочка опускается на 1/3 своей высоты
        // Проверяем, началась ли анимация (если есть stickTopY, значит палочка воткнулась)
        const immersionProgress = Math.min(1, (Date.now() - (icecream.stickInsertTime || Date.now())) / 500);
        const immersionDepth = STICK_HEIGHT * (1/3) * immersionProgress;
        
        // Палочка
        const stickGradient = ctx.createLinearGradient(stickX, stickY + immersionDepth, stickX + STICK_WIDTH, stickY + immersionDepth + STICK_HEIGHT);
        stickGradient.addColorStop(0, '#deb887');
        stickGradient.addColorStop(0.5, '#d2a679');
        stickGradient.addColorStop(1, '#b8956a'); // Более темный низ для реалистичности

        ctx.fillStyle = stickGradient;
        ctx.fillRect(stickX, stickY + immersionDepth, STICK_WIDTH, STICK_HEIGHT);

        // Текстура дерева на палочке
        ctx.strokeStyle = '#a08060';
        ctx.lineWidth = 1;
        for (let i = 5; i < STICK_HEIGHT - 5; i += 10) {
          ctx.beginPath();
          ctx.moveTo(stickX + 2, stickY + immersionDepth + i);
          ctx.lineTo(stickX + STICK_WIDTH - 2, stickY + immersionDepth + i + 3);
          ctx.stroke();
        }
      }

      // Тело мороженки (прямоугольник со скруглениями) - непрозрачный
      const cornerRadius = 20; // Радиус скругления углов
      
      // Основной цвет мороженки (сплошной, непрозрачный)
      ctx.fillStyle = color.middle;
      ctx.beginPath();
      ctx.roundRect(iceX, iceY, iceCreamWidth, iceCreamHeight, cornerRadius);
      ctx.fill();
      
      // Небольшой градиент для объема но без прозрачности
      const iceCreamGradient = ctx.createLinearGradient(iceX, iceY, iceX + iceCreamWidth, iceY + iceCreamHeight);
      iceCreamGradient.addColorStop(0, color.top);
      iceCreamGradient.addColorStop(0.5, color.middle);
      iceCreamGradient.addColorStop(1, color.bottom);
      ctx.fillStyle = iceCreamGradient;
      ctx.beginPath();
      ctx.roundRect(iceX, iceY, iceCreamWidth, iceCreamHeight, cornerRadius);
      ctx.fill();

      // Блик на мороженке (более непрозрачный)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(
        iceX + iceCreamWidth / 3,
        iceY + iceCreamHeight / 3,
        iceCreamWidth / 6,
        iceCreamHeight / 8,
        -0.3,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Отображаем очки за попадание
      if (icecream.hasStick) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`+${icecream.points}`, iceX + iceCreamWidth / 2, iceY - 10);
      }
    });

    // Рисуем падающие палочки
    gameState.fallingSticks.forEach(stick => {
      const stickX = stick.x;
      const stickY = stick.y;

      // Палочка
      const stickGradient = ctx.createLinearGradient(stickX, stickY, stickX + STICK_WIDTH, stickY + STICK_HEIGHT);
      stickGradient.addColorStop(0, '#deb887');
      stickGradient.addColorStop(0.5, '#d2a679');
      stickGradient.addColorStop(1, '#deb887');

      ctx.fillStyle = stickGradient;
      ctx.fillRect(stickX, stickY, STICK_WIDTH, STICK_HEIGHT);

      // Текстура дерева на палочке
      ctx.strokeStyle = '#b8956a';
      ctx.lineWidth = 1;
      for (let i = 5; i < STICK_HEIGHT - 5; i += 10) {
        ctx.beginPath();
        ctx.moveTo(stickX + 2, stickY + i);
        ctx.lineTo(stickX + STICK_WIDTH - 2, stickY + i + 3);
        ctx.stroke();
      }
    });

  }, [gameState, cacheBackground]);

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
        handleSpacePress();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSpacePress]);

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
    startGame();
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* Статистика игры */}
      <GameStats
        score={gameState.score}
        round={gameState.round}
        itemsOnBoard={undefined}
        gameTime={undefined}
        formatTime={formatTime}
        onBack={onBack}
        isGame5={true}
      />

      {/* Канвас для рендеринга игры */}
      <canvas
        ref={setCanvasRef}
        className="absolute inset-0"
      />

      {/* Инструкция */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-md rounded-lg px-6 py-3 text-white text-center">
        <p className="text-lg font-semibold">Нажмите ПРОБЕЛ чтобы уронить палочку</p>
        <p className="text-sm text-gray-300 mt-1">
          Центр 20% = 500 очков | 70% зона = 300 очков | Края 15% = промах
        </p>
      </div>
    </div>
  );
};

export default Game5;
