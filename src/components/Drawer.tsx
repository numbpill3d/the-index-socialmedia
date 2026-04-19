import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Drawer as DrawerType } from '../types';

interface DrawerProps {
  drawer: DrawerType;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  cardCount: number;
}

export const Drawer: React.FC<DrawerProps> = ({ drawer, isOpen, onToggle, children, cardCount }) => {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors group"
        style={{
          background: isOpen ? '#0b0b0b' : '#070707',
          border: `1px solid ${isOpen ? '#252525' : '#161616'}`,
          borderBottom: isOpen ? '1px solid #0b0b0b' : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          {/* sigil indicator */}
          <div
            className="w-2 h-2 transition-all"
            style={{
              background: isOpen ? '#b8ff00' : 'transparent',
              border: `1px solid ${isOpen ? '#b8ff00' : '#2a2a2a'}`,
              boxShadow: isOpen ? '0 0 6px rgba(184,255,0,0.6)' : 'none',
            }}
          />
          <div className="text-left">
            <h2
              className="vt tracking-[0.22em] text-sm"
              style={{
                color: isOpen ? '#b8ff00' : '#3d3d3d',
                textShadow: isOpen ? '0 0 8px rgba(184,255,0,0.45)' : 'none',
                transition: 'color 0.12s, text-shadow 0.12s',
              }}
            >
              {drawer.name}
            </h2>
            {drawer.description && (
              <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: '#2a2a2a' }}>
                {drawer.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-widest" style={{ color: '#252525' }}>
            [{cardCount.toString().padStart(3, '0')}]
          </span>
          <span style={{ color: isOpen ? '#b8ff00' : '#2a2a2a', transition: 'color 0.12s' }}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="p-5 flex flex-wrap gap-5 justify-start"
              style={{ background: '#070707', border: '1px solid #1a1a1a', borderTop: 'none' }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
