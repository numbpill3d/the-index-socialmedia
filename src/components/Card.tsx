import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Bookmark, User, Share2, Check, Image as ImageIcon, Frame } from 'lucide-react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  isStamped: boolean;
  onStamp: (cardId: string) => void;
}

export const Card: React.FC<CardProps> = ({ card, isStamped, onStamp }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bbs-card w-full flex flex-col group"
    >
      {/* header row */}
      <div className="flex justify-between items-start mb-3 pb-2 border-b border-[#181818]">
        <span
          className="truncate mr-2 vt tracking-wider text-base"
          style={{ color: '#b8ff00', textShadow: '0 0 7px rgba(184,255,0,0.5)' }}
        >
          {card.title}
        </span>
        <div className="flex gap-3 shrink-0 mt-0.5">
          <button
            onClick={handleShare}
            className="text-[#2e2e2e] hover:text-[#b8ff00] transition-colors"
            title="copy link"
          >
            {copied ? <Check size={13} /> : <Share2 size={13} />}
          </button>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2e2e2e] hover:text-[#b8ff00] transition-colors"
            title="visit"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* embed */}
      {card.embed_type !== 'none' && (
        <div className="mb-3 border border-[#141414] overflow-hidden bg-black aspect-video flex items-center justify-center relative group/embed">
          {card.embed_type === 'image' && card.image_url ? (
            <img
              src={card.image_url}
              alt={card.title}
              className="w-full h-full object-cover opacity-50 group-hover/embed:opacity-80 transition-opacity"
              referrerPolicy="no-referrer"
            />
          ) : card.embed_type === 'iframe' ? (
            <iframe
              src={card.iframe_url || card.url}
              className="w-full h-full border-none opacity-50 group-hover/embed:opacity-80 transition-opacity"
              title={card.title}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-20">
              {card.embed_type === 'image' ? <ImageIcon size={28} /> : <Frame size={28} />}
              <span className="text-[9px] tracking-widest">NO_PREVIEW</span>
            </div>
          )}
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] tracking-widest uppercase"
            style={{ background: 'rgba(0,0,0,0.85)', color: '#3a3a3a', border: '1px solid #1a1a1a' }}
          >
            {card.embed_type}
          </div>
        </div>
      )}

      {/* description */}
      <div className="flex-1 mb-4">
        <p className="text-[0.72rem] leading-relaxed" style={{ color: '#4a4a4a' }}>
          {card.description}
        </p>
      </div>

      {/* footer row */}
      <div className="mt-auto pt-3 border-t border-[#141414] flex justify-between items-end">
        <div className="flex flex-col gap-0.5">
          <div className="text-[8px] uppercase tracking-[0.25em]" style={{ color: '#242424' }}>submitted_by</div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: '#3a3a3a' }}>
            <User size={9} />
            <span className="truncate max-w-[110px]">{card.submitted_by_name || 'anonymous'}</span>
          </div>
        </div>

        <button
          onClick={() => onStamp(card.id)}
          className="bbs-button !py-1 !px-2 flex items-center gap-1.5"
          style={isStamped ? {
            borderColor: '#b8ff00',
            color: '#b8ff00',
            boxShadow: '0 0 8px rgba(184,255,0,0.3)',
          } : {}}
        >
          <Bookmark size={11} fill={isStamped ? '#b8ff00' : 'none'} stroke={isStamped ? '#b8ff00' : 'currentColor'} />
          <span className="text-[9px] font-bold">{card.stamp_count || 0}</span>
        </button>
      </div>

      {isStamped && (
        <div className="stamp-effect">INDEXED</div>
      )}
    </motion.div>
  );
};
