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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bbs-card w-full flex flex-col group"
    >
      <div className="bbs-header flex justify-between items-center">
        <span className="truncate mr-2">{card.title}</span>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleShare}
            className="hover:scale-110 transition-transform"
            title="Copy Link"
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </button>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-110 transition-transform"
            title="Visit Resource"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Embed Section */}
      {card.embed_type !== 'none' && (
        <div className="mb-4 border border-[#d1d1d1]/20 overflow-hidden bg-black/50 aspect-video flex items-center justify-center relative group/embed">
          {card.embed_type === 'image' && card.image_url ? (
            <img 
              src={card.image_url} 
              alt={card.title}
              className="w-full h-full object-cover opacity-60 group-hover/embed:opacity-100 transition-opacity"
              referrerPolicy="no-referrer"
            />
          ) : card.embed_type === 'iframe' ? (
            <iframe
              src={card.iframe_url || card.url}
              className="w-full h-full border-none opacity-60 group-hover/embed:opacity-100 transition-opacity"
              title={card.title}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-30">
              {card.embed_type === 'image' ? <ImageIcon size={32} /> : <Frame size={32} />}
              <span className="text-[10px]">NO_PREVIEW_AVAILABLE</span>
            </div>
          )}
          
          <div className="absolute top-2 right-2 bg-black/80 border border-[#d1d1d1]/30 px-2 py-1 text-[8px] font-bold uppercase tracking-widest">
            {card.embed_type}_EMBED
          </div>
        </div>
      )}

      <div className="flex-1 mb-6">
        <p className="text-sm leading-relaxed opacity-70 font-mono">
          {card.description}
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-[#d1d1d1]/10 flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <div className="text-[8px] uppercase tracking-[0.2em] opacity-40">SUBMITTED_BY</div>
          <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
            <User size={10} className="opacity-50" />
            <span className="truncate max-w-[120px]">{card.submitted_by_name || 'ANONYMOUS'}</span>
          </div>
        </div>
        
        <button
          onClick={() => onStamp(card.id)}
          className={`bbs-button !py-1 !px-2 flex items-center gap-2 ${
            isStamped ? 'bg-white text-black border-white' : ''
          }`}
        >
          <Bookmark size={12} fill={isStamped ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">{card.stamp_count || 0}</span>
        </button>
      </div>

      {isStamped && (
        <div className="stamp-effect">
          STAMPED
        </div>
      )}
    </motion.div>
  );
};

