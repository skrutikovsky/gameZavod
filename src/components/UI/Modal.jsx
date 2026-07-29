import React from 'react';

export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]" onClick={onClose}>
      <div 
        className="bg-white/95 p-12 rounded-3xl text-center max-w-lg w-[90%]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-3xl text-gray-800 mb-8">{title}</h2>
        {children}
      </div>
    </div>
  );
}
