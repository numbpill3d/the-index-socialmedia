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
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bbs-border bg-black hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-6 border border-[#d1d1d1]/30 flex items-center justify-center relative overflow-hidden">
            <div className={`absolute inset-0 transition-colors ${isOpen ? 'bg-white/10' : 'bg-black'}`} />
            <div className="w-4 h-0.5 bg-[#d1d1d1]/50 rounded-full z-10" />
          </div>
          <div className="text-left">
            <h2 className="font-display font-bold uppercase tracking-[0.2em] text-sm text-[#d1d1d1]">{drawer.name}</h2>
            {drawer.description && (
              <p className="text-[10px] opacity-60 leading-none mt-1 font-mono uppercase">{drawer.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs opacity-50">[{cardCount.toString().padStart(3, '0')}]</span>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-x-2 border-b-2 border-[#4a4a4a]/20 bg-black/20 flex flex-wrap gap-6 justify-center">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
