import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useGame3 } from '../../hooks/useGame3';

const Game3 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  // Обработчик появления новых предметов для анимации
  const handleItemSpawned = useCallback((itemIds) => {
    setAnimatingItems(new Set(itemIds));
    // Удаляем предметы из списка анимируемых после завершения анимации (800ms)
    setTimeout(() => {
      setAnimatingItems(new Set());
    }, 800);
  }, []);

  const {
    gameState,
    startGame,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    ITEM_TYPES,
    MAX_BOX_COUNT,
  } = useGame3(handleItemSpawned);

  const gameContainerRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const draggedItemElementRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Состояние для анимации появления предметов
  const [animatingItems, setAnimatingItems] = useState(new Set());

  useEffect(() => {
    startGame();
  }, [startGame]);

  // Глобальные обработчики drag&drop
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (gameState.draggedItem) {
        handleDragMove(e);
      }
    };

    const handleMouseUp = () => {
      if (gameState.draggedItem) {
        // Определяем зону сброса
        const dragPos = gameState.dragPosition;
        const leftRect = leftPanelRef.current?.getBoundingClientRect();
        const rightRect = rightPanelRef.current?.getBoundingClientRect();

        let dropZone = null;

        // Проверяем попадание в левую панель (коробки)
        if (leftRect && 
            dragPos.x >= leftRect.left && 
            dragPos.x <= leftRect.right && 
            dragPos.y >= leftRect.top && 
            dragPos.y <= leftRect.bottom) {
          // Определяем в какую именно коробку попали
          const boxElements = leftPanelRef.current?.querySelectorAll('[data-box-type]');
          if (boxElements) {
            boxElements.forEach(boxEl => {
              const boxRect = boxEl.getBoundingClientRect();
              const boxType = parseInt(boxEl.getAttribute('data-box-type'));
              if (
                dragPos.x >= boxRect.left && 
                dragPos.x <= boxRect.right && 
                dragPos.y >= boxRect.top && 
                dragPos.y <= boxRect.bottom
              ) {
                dropZone = boxType;
              }
            });
          }
        }

        // Проверяем попадание в правую панель (доска-плоскость)
        if (rightRect && 
            dragPos.x >= rightRect.left && 
            dragPos.x <= rightRect.right && 
            dragPos.y >= rightRect.top && 
            dragPos.y <= rightRect.bottom) {
          dropZone = 'board';
        }

        handleDragEnd(dropZone);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState.draggedItem, gameState.dragPosition, handleDragMove, handleDragEnd]);

  // Обработчик начала перетаскивания
  const onItemDragStart = useCallback((item, e) => {
    e.preventDefault();
    
    const rect = e.target.getBoundingClientRect();
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
    
    // Вычисляем смещение относительно точки захвата (где кликнули на предмете)
    dragOffsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    
    handleDragStart(item, e);
    
    // Создаем визуальный элемент для перетаскивания - клон без изменений стиля
    const element = e.target.cloneNode(true);
    element.style.position = 'fixed';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '1000';
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.margin = '0';
    element.style.transform = 'none'; // Убираем transform чтобы не было искажений
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    document.body.appendChild(element);
    draggedItemElementRef.current = element;

    const updateDragElement = (clientX, clientY) => {
      if (draggedItemElementRef.current) {
        // Позиционируем элемент так, чтобы точка захвата была под курсором
        draggedItemElementRef.current.style.left = `${clientX - dragOffsetRef.current.x}px`;
        draggedItemElementRef.current.style.top = `${clientY - dragOffsetRef.current.y}px`;
      }
    };

    const onMouseMove = (moveEvent) => {
      const moveClientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX || 0;
      const moveClientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY || 0;
      updateDragElement(moveClientX, moveClientY);
    };

    const onMouseUpHandler = () => {
      if (draggedItemElementRef.current) {
        document.body.removeChild(draggedItemElementRef.current);
        draggedItemElementRef.current = null;
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUpHandler);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUpHandler);
  }, [handleDragStart]);

  // Получение иконки для типа предмета
  const getItemIcon = (typeId) => {
    const icons = {
      1: '🔌', // чип
      2: '⚡', // предохранитель
      3: '💡', // лампочка
      4: '🌀', // пружина
      5: '🔩', // гайка
      6: '🔨', // болт
    };
    return icons[typeId] || '❓';
  };

  // Получение цвета для типа предмета
  const getItemColor = (typeId) => {
    const colors = {
      1: 'bg-blue-500',
      2: 'bg-red-500',
      3: 'bg-yellow-400',
      4: 'bg-purple-500',
      5: 'bg-gray-500',
      6: 'bg-orange-500',
    };
    return colors[typeId] || 'bg-gray-400';
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden flex"
    >
      {/* Левая панель - коробки (1/3 ширины) */}
      <div 
        ref={leftPanelRef}
        className="h-full bg-gradient-to-b from-indigo-900 to-indigo-700 p-4 flex flex-col justify-around"
        style={{ width: '33.33%' }}
      >
        <h2 className="text-white text-xl font-bold text-center mb-2">Коробки</h2>
        {gameState.boxes.map((box) => (
          <div
            key={box.type}
            data-box-type={box.type}
            className={`relative ${getItemColor(box.type)} rounded-lg p-3 shadow-lg border-4 border-white/30 transition-all hover:scale-102`}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{getItemIcon(box.type)}</span>
              <div className="text-right">
                <div className="text-white text-sm font-semibold">{box.name}</div>
                <div className="text-white text-xs">{box.points} очков</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-white text-lg font-bold">
                {box.count} / {MAX_BOX_COUNT}
              </div>
              {/* Прогресс бар */}
              <div className="flex-1 ml-3 h-3 bg-black/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-400 transition-all duration-300"
                  style={{ width: `${(box.count / MAX_BOX_COUNT) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        
        {/* Общий счет */}
        <div className="mt-4 bg-white/20 backdrop-blur-md rounded-lg p-3 text-center">
          <div className="text-white text-lg">Счет: {gameState.score}</div>
        </div>
      </div>

      {/* Правая панель - доска-плоскость (2/3 ширины) */}
      <div 
        ref={rightPanelRef}
        data-right-panel
        className="h-full bg-gradient-to-b from-stone-400 to-stone-500 p-4 relative border-l-8 border-stone-600 shadow-inner"
        style={{ width: '66.67%' }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-30 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-white text-xl font-bold mb-4 drop-shadow-lg">Доска предметов</h2>
          <div className="text-white/90 text-sm mb-2 font-medium drop-shadow">
            Предметов на доске: {gameState.items.length}
          </div>
        </div>
        
        {/* Предметы на доске */}
        {gameState.items.map((item) => {
          // Генерируем уникальные параметры падения для каждого предмета на основе его id
          const itemHash = item.id.split('-').reduce((acc, str) => acc + str.charCodeAt(0), 0);
          const randomOffsetX = ((itemHash % 100) / 100 - 0.5) * 40; // -20% to 20%
          const randomRotation = (itemHash % 360) - 180; // -180 to 180 degrees
          // Генерируем случайные смещения для отскоков в разные стороны
          const bounce1X = ((itemHash % 7) / 7 - 0.5) * 60; // -30px to 30px
          const bounce2X = (((itemHash * 3) % 11) / 11 - 0.5) * 40; // -20px to 20px
          const bounce3X = (((itemHash * 7) % 13) / 13 - 0.5) * 20; // -10px to 10px
          
          return (
            <div
              key={item.id}
              className={`absolute w-12 h-12 ${getItemColor(item.type)} rounded-lg shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center text-2xl select-none border-2 border-white/70 hover:scale-105`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                animation: animatingItems.has(item.id) 
                  ? `dropIn 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`
                  : undefined,
                '--random-offset-x': `${randomOffsetX}%`,
                '--random-rotation': `${randomRotation}deg`,
                '--bounce1-x': `${bounce1X}px`,
                '--bounce2-x': `${bounce2X}px`,
                '--bounce3-x': `${bounce3X}px`,
              }}
              onMouseDown={(e) => onItemDragStart(item, e)}
              onTouchStart={(e) => onItemDragStart(item, e)}
            >
              {getItemIcon(item.type)}
            </div>
          );
        })}
      </div>

      {/* Стили для анимации падения предметов */}
      <style>{`
        @keyframes dropIn {
          0% {
            transform: translateY(-100vh) translateX(var(--random-offset-x)) scale(0.3) rotate(var(--random-rotation));
            opacity: 0;
          }
          50% {
            transform: translateY(0) translateX(0) scale(1.15, 0.9) rotate(0deg);
            opacity: 1;
          }
          65% {
            transform: translateY(-50px) translateX(var(--bounce1-x)) scale(0.9, 1.1) rotate(0deg);
          }
          75% {
            transform: translateY(0) translateX(0) scale(1.1, 0.9) rotate(0deg);
          }
          85% {
            transform: translateY(-24px) translateX(var(--bounce2-x)) scale(0.95, 1.05) rotate(0deg);
          }
          92% {
            transform: translateY(0) translateX(0) scale(1.05, 0.95) rotate(0deg);
          }
          96% {
            transform: translateY(-12px) translateX(var(--bounce3-x)) scale(0.98, 1.02) rotate(0deg);
          }
          100% {
            transform: translateY(0) translateX(0) scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>

      {/* Кнопка назад */}
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-50 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
      >
        ←
      </button>
    </div>
  );
};

export default Game3;
