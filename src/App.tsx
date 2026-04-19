import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, LogIn, LogOut, X, Terminal, Sparkles, BookOpen, Clock, Bookmark, Upload, Image as ImageIcon, Frame, Globe, Github } from 'lucide-react';
import { supabase, supabaseUrl } from './supabase';
import { Drawer as DrawerType, Card as CardType } from './types';
import { Drawer } from './components/Drawer';
import { Card } from './components/Card';
import { User } from '@supabase/supabase-js';

const INITIAL_RESOURCES = [
  {
    drawer: { name: "SYSTEM_TOOLS", description: "Essential utilities for the digital frontier." },
    cards: [
      { title: "MDN_WEB_DOCS", url: "https://developer.mozilla.org", description: "The definitive resource for web platform technologies.", embed_type: 'none' as const },
      { title: "TERMINAL_FONTS", url: "https://www.nerdfonts.com", description: "High-quality monospaced fonts for your terminal.", embed_type: 'none' as const }
    ]
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [drawers, setDrawers] = useState<DrawerType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [stamps, setStamps] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isAddingDrawer, setIsAddingDrawer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'all' | 'stamped'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

  const [newCard, setNewCard] = useState<{
    title: string;
    url: string;
    description: string;
    drawerId: string;
    embed_type: 'none' | 'image' | 'iframe';
    image_url: string;
    iframe_url: string;
  }>({
    title: '',
    url: '',
    description: '',
    drawerId: '',
    embed_type: 'none',
    image_url: '',
    iframe_url: ''
  });
  const [newDrawer, setNewDrawer] = useState({ name: '', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null);
        });
      }
    };
    window.addEventListener('message', handleMessage);

    fetchDrawers();
    fetchCards();

    const drawersSub = supabase
      .channel('drawers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawers' }, () => fetchDrawers())
      .subscribe();

    const cardsSub = supabase
      .channel('cards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => fetchCards())
      .subscribe();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
      supabase.removeChannel(drawersSub);
      supabase.removeChannel(cardsSub);
    };
  }, []);

  useEffect(() => {
    const isPopup = window.opener && window.opener !== window;
    const hasHash = window.location.hash || window.location.search.includes('code=');

    if (isPopup && hasHash) {
      setTimeout(() => {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          window.close();
        }
      }, 1500);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchStamps();
      const stampsSub = supabase
        .channel('stamps-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stamps', filter: `user_id=eq.${user.id}` }, () => fetchStamps())
        .subscribe();
      return () => { supabase.removeChannel(stampsSub); };
    } else {
      setStamps({});
    }
  }, [user]);

  const fetchDrawers = async () => {
    const { data } = await supabase.from('drawers').select('*').order('name');
    if (data) setDrawers(data);
  };

  const fetchCards = async () => {
    const { data } = await supabase.from('cards').select('*').order('created_at', { ascending: false });
    if (data) setCards(data);
  };

  const fetchStamps = async () => {
    if (!user) return;
    const { data } = await supabase.from('stamps').select('card_id').eq('user_id', user.id);
    if (data) {
      const s: Record<string, boolean> = {};
      data.forEach(d => s[d.card_id] = true);
      setStamps(s);
    }
  };

  const handleLogin = async (provider: 'google' | 'github') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: true,
      }
    });

    if (error) {
      console.error('Login failed:', error.message);
      alert(`LOGIN_ERROR: ${error.message}\n\nHINT: Ensure ${provider} Provider is enabled in Supabase Dashboard.`);
      return;
    }

    if (data?.url) {
      const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) alert('PLEASE_ALLOW_POPUPS // TO_AUTHENTICATE');
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingMagicLink(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { emailRedirectTo: window.location.origin }
    });
    setIsSendingMagicLink(false);
    if (error) alert(error.message);
    else {
      alert('MAGIC_LINK_SENT // CHECK_INBOX');
      setIsLoginModalOpen(false);
      setLoginEmail('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);

      setNewCard(prev => ({ ...prev, image_url: publicUrl, embed_type: 'image' }));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Ensure "card-images" bucket exists and is public.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCard.drawerId) return;

    const { error } = await supabase.from('cards').insert({
      title: newCard.title,
      url: newCard.url,
      description: newCard.description,
      drawer_id: newCard.drawerId,
      submitted_by: user.id,
      submitted_by_name: user.user_metadata.full_name || user.email,
      stamp_count: 0,
      image_url: newCard.image_url,
      embed_type: newCard.embed_type,
      iframe_url: newCard.iframe_url || newCard.url
    });

    if (!error) {
      setNewCard({ title: '', url: '', description: '', drawerId: '', embed_type: 'none', image_url: '', iframe_url: '' });
      setIsAddingCard(false);
      fetchCards();
    }
  };

  const handleAddDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('drawers').insert({
      name: newDrawer.name,
      description: newDrawer.description
    });

    if (!error) {
      setNewDrawer({ name: '', description: '' });
      setIsAddingDrawer(false);
      fetchDrawers();
    }
  };

  const handleStamp = async (cardId: string) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    const isCurrentlyStamped = stamps[cardId];

    try {
      if (isCurrentlyStamped) {
        await supabase.from('stamps').delete().match({ user_id: user.id, card_id: cardId });
        await supabase.rpc('decrement_stamp_count', { card_id_input: cardId });
      } else {
        await supabase.from('stamps').insert({ user_id: user.id, card_id: cardId });
        await supabase.rpc('increment_stamp_count', { card_id_input: cardId });
      }
      fetchCards();
      fetchStamps();
    } catch (error) {
      console.error('Stamping failed:', error);
    }
  };

  const filteredCards = useMemo(() => {
    let result = cards;
    if (view === 'stamped') result = result.filter(c => stamps[c.id]);
    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }, [cards, searchQuery, view, stamps]);

  const cardsByDrawer = useMemo(() => {
    const map: Record<string, CardType[]> = {};
    filteredCards.forEach(c => {
      if (!map[c.drawer_id]) map[c.drawer_id] = [];
      map[c.drawer_id].push(c);
    });
    return map;
  }, [filteredCards]);

  const handleSeed = async () => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      for (const item of INITIAL_RESOURCES) {
        const { data: drawer, error: dError } = await supabase
          .from('drawers')
          .insert(item.drawer)
          .select()
          .single();

        if (dError) throw dError;

        if (drawer) {
          const cardsToInsert = item.cards.map(c => ({
            ...c,
            drawer_id: drawer.id,
            submitted_by: user.id,
            submitted_by_name: user.user_metadata.full_name || user.email,
            stamp_count: 0
          }));

          const { error: cError } = await supabase.from('cards').insert(cardsToInsert);
          if (cError) throw cError;
        }
      }
      fetchDrawers();
      fetchCards();
    } catch (error) {
      console.error('Seeding failed:', error);
      alert('Seeding failed. Check console for errors.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── LOADING ────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="vt text-5xl tracking-[0.3em] animate-flicker"
            style={{ color: '#b8ff00', textShadow: '0 0 22px rgba(184,255,0,0.5)' }}
          >
            THE_INDEX
          </div>
          <div className="text-[9px] uppercase tracking-[0.5em] animate-pulse" style={{ color: '#252525' }}>
            // initializing system
          </div>
        </div>
      </div>
    );
  }

  const keysMissing = !(import.meta as any).env.VITE_SUPABASE_URL || !(import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  /* ── RENDER ─────────────────────────────────────── */
  return (
    <div className="min-h-screen relative pb-24" style={{ background: '#050505' }}>
      <div className="crt-overlay" />
      <div className="scanline" />

      {/* missing keys banner */}
      {keysMissing && (
        <div
          className="fixed top-0 left-0 w-full p-3 z-[100] text-center text-[10px] uppercase tracking-widest animate-pulse"
          style={{ background: '#0a0a0a', borderBottom: '1px solid #ff2244', color: '#ff2244' }}
        >
          ◈ CRITICAL_ERROR: SUPABASE_KEYS_MISSING // ADD_TO_.ENV_IMMEDIATELY ◈
        </div>
      )}

      <div className="max-w-5xl mx-auto px-5 py-10 relative z-10">

        {/* ── TOPBAR ── */}
        <div
          className="flex justify-between items-center px-4 py-2 mb-10 text-[9px] uppercase tracking-[0.3em]"
          style={{ background: '#070707', border: '1px solid #141414', color: '#2a2a2a' }}
        >
          <div className="flex items-center gap-2">
            <Terminal size={11} style={{ color: '#252525' }} />
            <span>BBS_NODE_702</span>
            <span style={{ color: '#161616' }}>◈</span>
            <span>THE_INDEX</span>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span style={{ color: '#1e1e1e' }}>operator:</span>
                <span style={{ color: '#444' }}>{user.user_metadata.full_name || user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bbs-button !py-0.5 !px-2 flex items-center gap-1.5"
              >
                <LogOut size={11} /> logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bbs-button !py-0.5 !px-2 flex items-center gap-1.5"
            >
              <LogIn size={11} /> authenticate
            </button>
          )}
        </div>

        {/* ── HEADER ── */}
        <header className="mb-14">
          <div className="mb-1 text-[9px] tracking-[0.5em] uppercase" style={{ color: '#1e1e1e' }}>
            // collaborative directory of digital artifacts
          </div>
          <h1
            className="vt leading-none animate-flicker"
            style={{
              fontSize: 'clamp(4rem, 12vw, 8rem)',
              color: '#b8ff00',
              textShadow: '0 0 30px rgba(184,255,0,0.35), 0 0 80px rgba(184,255,0,0.1)',
              letterSpacing: '0.06em',
            }}
          >
            THE INDEX
          </h1>
          <div
            className="mt-3 text-[9px] uppercase tracking-[0.4em]"
            style={{ color: '#1e1e1e', borderTop: '1px solid #111111', paddingTop: '0.5rem' }}
          >
            <span style={{ color: '#b8ff00', opacity: 0.4 }}>◈</span>
            {' '}OPEN_SOURCE KNOWLEDGE ARCHIVE // COMMUNITY CURATED // REALTIME SYNC{' '}
            <span style={{ color: '#b8ff00', opacity: 0.4 }}>◈</span>
          </div>
        </header>

        {/* ── CONTROLS ── */}
        <div className="flex flex-col gap-5 mb-12">
          {/* search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2"
              size={14}
              style={{ color: '#222' }}
            />
            <input
              type="text"
              placeholder="SEARCH_CATALOG..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bbs-input !pl-10"
            />
          </div>

          {/* view + action row */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            {/* view toggles */}
            <div className="flex gap-2">
              <button
                onClick={() => setView('all')}
                className={`bbs-button flex items-center gap-1.5 ${view === 'all' ? 'bbs-button-active' : ''}`}
              >
                <BookOpen size={11} /> all_records
              </button>
              <button
                onClick={() => setView('stamped')}
                className={`bbs-button flex items-center gap-1.5 ${view === 'stamped' ? 'bbs-button-active' : ''}`}
              >
                <Bookmark size={11} /> my_index
              </button>
            </div>

            {/* add buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { if (!user) setIsLoginModalOpen(true); else setIsAddingCard(true); }}
                className="bbs-button bbs-button-active flex items-center gap-1.5"
              >
                <Plus size={12} /> file_card
              </button>
              <button
                onClick={() => { if (!user) setIsLoginModalOpen(true); else setIsAddingDrawer(true); }}
                className="bbs-button flex items-center gap-1.5"
              >
                <Plus size={12} /> new_drawer
              </button>
            </div>
          </div>
        </div>

        {/* ── CATALOG ── */}
        <div>
          {drawers.length === 0 ? (
            <div
              className="py-24 text-center flex flex-col items-center gap-5"
              style={{ border: '1px dashed #141414' }}
            >
              <div className="vt text-3xl tracking-widest" style={{ color: '#1e1e1e' }}>
                // CATALOG_EMPTY //
              </div>
              <p className="text-[9px] uppercase tracking-[0.4em]" style={{ color: '#1a1a1a' }}>
                awaiting first operator input
              </p>
              <button
                onClick={handleSeed}
                className="bbs-button bbs-button-active flex items-center gap-2 mt-2"
              >
                <Sparkles size={12} /> initialize_defaults
              </button>
            </div>
          ) : (
            drawers.map(drawer => (
              <Drawer
                key={drawer.id}
                drawer={drawer}
                isOpen={openDrawerId === drawer.id}
                onToggle={() => setOpenDrawerId(openDrawerId === drawer.id ? null : drawer.id)}
                cardCount={cardsByDrawer[drawer.id]?.length || 0}
              >
                {cardsByDrawer[drawer.id]?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                    {cardsByDrawer[drawer.id].map(card => (
                      <Card
                        key={card.id}
                        card={card}
                        isStamped={!!stamps[card.id]}
                        onStamp={handleStamp}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-full py-16 text-center text-[9px] uppercase tracking-[0.35em]" style={{ color: '#1e1e1e' }}>
                    // no_records_in_drawer
                  </div>
                )}
              </Drawer>
            ))
          )}
        </div>

        {/* ── FOOTER ── */}
        <footer className="mt-24 pt-8" style={{ borderTop: '1px solid #101010' }}>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="vt text-xl tracking-[0.5em]" style={{ color: '#1a1a1a' }}>
              ◈ ◈ ◈
            </div>
            <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.35em]" style={{ color: '#1e1e1e' }}>
              <Clock size={10} />
              <span>sys_time: {new Date().toLocaleDateString()} // {new Date().toLocaleTimeString()}</span>
            </div>
            <p className="text-[9px] uppercase tracking-widest max-w-lg leading-relaxed" style={{ color: '#161616' }}>
              the index is a public utility for the preservation of digital knowledge.
              all records are community-submitted and verified by operator stamps.
            </p>
          </div>
        </footer>
      </div>

      {/* ── MODAL: LOGIN ── */}
      {isLoginModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6 z-[60]"
          style={{ background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsLoginModalOpen(false); }}
        >
          <div className="bbs-card max-w-sm w-full relative">
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-3 right-3 text-[#1e1e1e] hover:text-[#b8ff00] transition-colors"
            >
              <X size={16} />
            </button>

            <div className="bbs-header">◈ OPERATOR_AUTHENTICATION</div>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#252525' }}>
                  // oauth_provider
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleLogin('google')}
                    className="bbs-button w-full justify-center flex items-center gap-2 !py-3"
                  >
                    <Globe size={13} /> auth_via_google
                  </button>
                  <button
                    onClick={() => handleLogin('github')}
                    className="bbs-button w-full justify-center flex items-center gap-2 !py-3"
                  >
                    <Github size={13} /> auth_via_github
                  </button>
                </div>
                <p className="text-[8px] leading-relaxed uppercase" style={{ color: '#1c1c1c' }}>
                  requires providers enabled in supabase dashboard.
                  redirect: {window.location.origin}
                  &nbsp;// project: {supabaseUrl.replace('https://', '').split('.')[0]}
                </p>
              </div>

              <div
                className="flex items-center gap-3 text-[8px] uppercase tracking-widest"
                style={{ color: '#1e1e1e' }}
              >
                <div className="flex-1 h-px" style={{ background: '#111' }} />
                <span>or</span>
                <div className="flex-1 h-px" style={{ background: '#111' }} />
              </div>

              <form onSubmit={handleMagicLinkLogin} className="space-y-3">
                <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#252525' }}>
                  // magic_link
                </p>
                <div className="space-y-1.5">
                  <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#1e1e1e' }}>
                    operator_email
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="USER@DOMAIN.COM"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="bbs-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingMagicLink}
                  className="bbs-button w-full justify-center flex items-center gap-2 !py-3"
                >
                  {isSendingMagicLink ? '// dispatching...' : <><LogIn size={13} /> dispatch_magic_link</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CARD ── */}
      {isAddingCard && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6 z-50 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddingCard(false); }}
        >
          <div className="bbs-card max-w-xl w-full relative my-auto">
            <button
              onClick={() => setIsAddingCard(false)}
              className="absolute top-3 right-3 text-[#1e1e1e] hover:text-[#b8ff00] transition-colors"
            >
              <X size={16} />
            </button>

            <div className="bbs-header">◈ FILE_NEW_RECORD</div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                    target_drawer
                  </label>
                  <select
                    required
                    value={newCard.drawerId}
                    onChange={(e) => setNewCard({ ...newCard, drawerId: e.target.value })}
                    className="bbs-input"
                  >
                    <option value="">SELECT_DRAWER...</option>
                    {drawers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                    record_title
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="NEURAL_NET_ARCHIVE"
                    value={newCard.title}
                    onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                    className="bbs-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                  resource_url
                </label>
                <input
                  required
                  type="url"
                  placeholder="HTTPS://..."
                  value={newCard.url}
                  onChange={(e) => setNewCard({ ...newCard, url: e.target.value })}
                  className="bbs-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                  description
                </label>
                <textarea
                  required
                  maxLength={200}
                  placeholder="BRIEF_SUMMARY_OF_ARTIFACT..."
                  value={newCard.description}
                  onChange={(e) => setNewCard({ ...newCard, description: e.target.value })}
                  className="bbs-input h-20 resize-none"
                />
              </div>

              <div className="space-y-3 p-3" style={{ border: '1px solid #141414' }}>
                <div className="bbs-header !mb-2">embed_options</div>
                <div className="flex gap-2">
                  {(['none', 'image', 'iframe'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCard(prev => ({ ...prev, embed_type: type }))}
                      className={`flex-1 bbs-button text-[9px] justify-center ${newCard.embed_type === type ? 'bbs-button-active' : ''}`}
                    >
                      {type === 'none' && <><Globe size={10} className="mr-1" /> none</>}
                      {type === 'image' && <><ImageIcon size={10} className="mr-1" /> image</>}
                      {type === 'iframe' && <><Frame size={10} className="mr-1" /> iframe</>}
                    </button>
                  ))}
                </div>

                {newCard.embed_type === 'image' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="IMAGE_URL_OR_UPLOAD..."
                      value={newCard.image_url}
                      onChange={(e) => setNewCard({ ...newCard, image_url: e.target.value })}
                      className="bbs-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bbs-button"
                    >
                      {isUploading ? '...' : <Upload size={13} />}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}

                {newCard.embed_type === 'iframe' && (
                  <div className="space-y-1.5">
                    <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                      iframe_url (optional — defaults to main url)
                    </label>
                    <input
                      type="url"
                      placeholder="LEAVE_BLANK_TO_USE_MAIN_URL"
                      value={newCard.iframe_url}
                      onChange={(e) => setNewCard({ ...newCard, iframe_url: e.target.value })}
                      className="bbs-input"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="bbs-button bbs-button-active w-full justify-center !py-3 !text-xs"
              >
                COMMIT_TO_CATALOG
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD DRAWER ── */}
      {isAddingDrawer && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6 z-50"
          style={{ background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddingDrawer(false); }}
        >
          <div className="bbs-card max-w-sm w-full relative">
            <button
              onClick={() => setIsAddingDrawer(false)}
              className="absolute top-3 right-3 text-[#1e1e1e] hover:text-[#b8ff00] transition-colors"
            >
              <X size={16} />
            </button>

            <div className="bbs-header">◈ NEW_DRAWER_INSTALL</div>

            <form onSubmit={handleAddDrawer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                  drawer_name
                </label>
                <input
                  required
                  type="text"
                  placeholder="GRAPHICS_DATA"
                  value={newDrawer.name}
                  onChange={(e) => setNewDrawer({ ...newDrawer, name: e.target.value })}
                  className="bbs-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8px] uppercase tracking-widest" style={{ color: '#252525' }}>
                  description
                </label>
                <input
                  type="text"
                  placeholder="SCOPE_OF_DRAWER"
                  value={newDrawer.description}
                  onChange={(e) => setNewDrawer({ ...newDrawer, description: e.target.value })}
                  className="bbs-input"
                />
              </div>
              <button
                type="submit"
                className="bbs-button bbs-button-active w-full justify-center !py-3 !text-xs"
              >
                INSTALL_DRAWER
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
