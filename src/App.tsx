import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, LogIn, LogOut, Info, X, Terminal, Sparkles, BookOpen, Clock, Bookmark, Upload, Image as ImageIcon, Frame, Globe, Github } from 'lucide-react';
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

  // Form states
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

    // Handle OAuth popup success message
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

  // Detect if we are in an OAuth popup callback
  useEffect(() => {
    const isPopup = window.opener && window.opener !== window;
    const hasHash = window.location.hash || window.location.search.includes('code=');
    
    if (isPopup && hasHash) {
      // We are likely in the callback phase of an OAuth flow in a popup
      // Wait a bit for Supabase to process the hash/code
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
      // Open the OAuth PROVIDER's URL directly in popup
      const authWindow = window.open(
        data.url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('PLEASE_ALLOW_POPUPS // TO_AUTHENTICATE');
      }
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingMagicLink(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: {
        emailRedirectTo: window.location.origin,
      }
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
    if (view === 'stamped') {
      result = result.filter(c => stamps[c.id]);
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm uppercase tracking-widest text-[#d1d1d1]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#d1d1d1] border-t-transparent rounded-full animate-spin" />
          BOOTING_SYSTEM...
        </div>
      </div>
    );
  }

  const keysMissing = !(import.meta as any).env.VITE_SUPABASE_URL || !(import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  return (
    <div className="min-h-screen relative pb-24 selection:bg-[#d1d1d1] selection:text-black">
      <div className="crt-overlay" />
      <div className="scanline" />
      
      {keysMissing && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-black p-4 z-[100] text-center font-mono text-xs font-bold uppercase tracking-widest animate-pulse">
          CRITICAL_ERROR: SUPABASE_KEYS_MISSING // ADD_TO_SECRETS_IMMEDIATELY
        </div>
      )}
      
      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <header className="mb-16 text-center">
          <div className="flex justify-between items-center mb-12 border-b-2 border-[#d1d1d1]/20 pb-4">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] font-bold">
              <Terminal size={16} />
              <span>BBS_NODE_702 // THE_INDEX</span>
            </div>
            
            {user ? (
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase opacity-60">OPERATOR</span>
                  <span className="text-xs uppercase font-bold tracking-widest">{user.user_metadata.full_name || user.email}</span>
                </div>
                <button onClick={handleLogout} className="bbs-button p-2">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} className="bbs-button flex items-center gap-2">
                <LogIn size={14} /> LOGIN_TO_CATALOG
              </button>
            )}
          </div>

          <div className="relative inline-block mb-8">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none text-shadow-lg text-[#d1d1d1] font-display">
              The Index
            </h1>
          </div>
          <p className="text-lg opacity-80 mt-4 max-w-2xl mx-auto font-mono uppercase tracking-widest border-y-2 border-[#d1d1d1]/10 py-4">
            [ COLLABORATIVE_DIRECTORY_OF_DIGITAL_ARTIFACTS ]
          </p>
        </header>

        {/* Search & View Controls */}
        <div className="flex flex-col gap-8 mb-16">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 text-[#d1d1d1]" size={20} />
              <input
                type="text"
                placeholder="SEARCH_CATALOG_BY_KEYWORD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bbs-input pl-14 py-4 text-lg tracking-widest"
              />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setView('all')}
                className={`flex-1 md:flex-none bbs-button flex items-center justify-center gap-2 ${
                  view === 'all' ? 'bbs-button-active' : ''
                }`}
              >
                <BookOpen size={14} /> ALL_RECORDS
              </button>
              <button
                onClick={() => setView('stamped')}
                className={`flex-1 md:flex-none bbs-button flex items-center justify-center gap-2 ${
                  view === 'stamped' ? 'bbs-button-active' : ''
                }`}
              >
                <Bookmark size={14} /> MY_STAMPS
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => {
                if (!user) setIsLoginModalOpen(true);
                else setIsAddingCard(true);
              }}
              className="bbs-button flex items-center gap-2 bbs-button-active px-10 py-4 text-sm"
            >
              <Plus size={18} /> FILE_NEW_CARD
            </button>
            <button
              onClick={() => {
                if (!user) setIsLoginModalOpen(true);
                else setIsAddingDrawer(true);
              }}
              className="bbs-button flex items-center gap-2 px-10 py-4 text-sm"
            >
              <Plus size={18} /> INSTALL_DRAWER
            </button>
          </div>
        </div>

        {/* Catalog Drawers */}
        <div className="space-y-8">
          {drawers.length === 0 ? (
            <div className="text-center py-32 border-4 border-dashed border-[#d1d1d1]/10 rounded-xl flex flex-col items-center">
              <Terminal size={48} className="mx-auto mb-6 opacity-20" />
              <p className="text-sm opacity-40 uppercase tracking-[0.3em] font-bold">CATALOG_IS_EMPTY</p>
              <p className="text-[10px] opacity-30 mt-2 uppercase mb-8">AWAITING_FIRST_LIBRARIAN_INPUT</p>
              <button 
                onClick={handleSeed}
                className="bbs-button flex items-center gap-2 px-8 py-3 text-xs bbs-button-active"
              >
                <Sparkles size={14} /> INITIALIZE_SYSTEM_DEFAULTS
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
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
                  <div className="w-full py-20 text-center opacity-40 text-xs uppercase tracking-widest italic">
                    NO_RECORDS_IN_THIS_DRAWER
                  </div>
                )}
              </Drawer>
            ))
          )}
        </div>

        {/* Modals */}
        {isLoginModalOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <div className="bbs-card max-w-md w-full relative">
              <div className="bbs-header">OPERATOR_AUTHENTICATION</div>
              
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-[10px] uppercase opacity-60 tracking-widest">OPTION_01: EXTERNAL_OAUTH</p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => handleLogin('google')}
                      className="w-full py-4 bg-[#d1d1d1] text-black uppercase font-bold hover:bg-white transition-all border-2 border-black flex items-center justify-center gap-2"
                    >
                      <Globe size={18} /> LOGIN_WITH_GOOGLE
                    </button>
                    <button 
                      onClick={() => handleLogin('github')}
                      className="w-full py-4 bg-[#d1d1d1] text-black uppercase font-bold hover:bg-white transition-all border-2 border-black flex items-center justify-center gap-2"
                    >
                      <Github size={18} /> LOGIN_WITH_GITHUB
                    </button>
                  </div>
                  <p className="text-[8px] opacity-40 uppercase leading-relaxed">
                    NOTE: REQUIRES PROVIDERS ENABLED IN SUPABASE_DASHBOARD.
                    <br />
                    REDIRECT_URL: {window.location.origin}
                    <br />
                    SUPABASE_PROJECT: {supabaseUrl.replace('https://', '').split('.')[0]}
                  </p>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#d1d1d1]/20"></div></div>
                  <div className="relative flex justify-center"><span className="bg-[#333333] px-4 text-[10px] uppercase opacity-40">OR</span></div>
                </div>

                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <p className="text-[10px] uppercase opacity-60 tracking-widest">OPTION_02: MAGIC_LINK</p>
                  <div className="space-y-2">
                    <label className="block text-[8px] uppercase font-bold tracking-widest opacity-40">OPERATOR_EMAIL</label>
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
                    className="w-full py-4 bbs-button flex items-center justify-center gap-2"
                  >
                    {isSendingMagicLink ? 'SENDING...' : <><LogIn size={18} /> SEND_MAGIC_LINK</>}
                  </button>
                  <p className="text-[8px] opacity-40 uppercase leading-relaxed">
                    A SECURE LOGIN LINK WILL BE DISPATCHED TO YOUR INBOX.
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}

        {isAddingCard && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bbs-card max-w-2xl w-full relative">
              <button onClick={() => setIsAddingCard(false)} className="absolute top-4 right-4 text-[#d1d1d1] hover:scale-110 transition-transform">
                <X size={24} />
              </button>
              <div className="bbs-header">FILE_NEW_RECORD</div>
              <form onSubmit={handleAddCard} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">TARGET_DRAWER</label>
                    <select
                      required
                      value={newCard.drawerId}
                      onChange={(e) => setNewCard({ ...newCard, drawerId: e.target.value })}
                      className="bbs-input"
                    >
                      <option value="">SELECT_DRAWER...</option>
                      {drawers.map(d => <option key={d.id} value={d.id} className="bg-black">{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">RECORD_TITLE</label>
                    <input
                      required
                      type="text"
                      placeholder="E.G. NEURAL_NET_ARCHIVE"
                      value={newCard.title}
                      onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                      className="bbs-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">RESOURCE_URL</label>
                  <input
                    required
                    type="url"
                    placeholder="HTTPS://..."
                    value={newCard.url}
                    onChange={(e) => setNewCard({ ...newCard, url: e.target.value })}
                    className="bbs-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">DESCRIPTION</label>
                  <textarea
                    required
                    maxLength={200}
                    placeholder="BRIEF_SUMMARY_OF_ARTIFACT"
                    value={newCard.description}
                    onChange={(e) => setNewCard({ ...newCard, description: e.target.value })}
                    className="bbs-input h-24 resize-none"
                  />
                </div>

                <div className="border border-[#d1d1d1]/20 p-4 space-y-4">
                  <div className="bbs-header text-xs mb-2">EMBED_OPTIONS</div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setNewCard(prev => ({ ...prev, embed_type: 'none' }))}
                      className={`flex-1 bbs-button text-[10px] ${newCard.embed_type === 'none' ? 'bg-[#d1d1d1] text-black' : ''}`}
                    >
                      <Globe size={12} className="inline mr-1" /> NONE
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCard(prev => ({ ...prev, embed_type: 'image' }))}
                      className={`flex-1 bbs-button text-[10px] ${newCard.embed_type === 'image' ? 'bg-[#d1d1d1] text-black' : ''}`}
                    >
                      <ImageIcon size={12} className="inline mr-1" /> IMAGE
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCard(prev => ({ ...prev, embed_type: 'iframe' }))}
                      className={`flex-1 bbs-button text-[10px] ${newCard.embed_type === 'iframe' ? 'bg-[#d1d1d1] text-black' : ''}`}
                    >
                      <Frame size={12} className="inline mr-1" /> IFRAME
                    </button>
                  </div>

                  {newCard.embed_type === 'image' && (
                    <div className="space-y-4">
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
                          {isUploading ? '...' : <Upload size={16} />}
                        </button>
                      </div>
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
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">IFRAME_URL (OPTIONAL)</label>
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

                <button type="submit" className="w-full py-4 bg-[#d1d1d1] text-black uppercase font-bold hover:bg-white transition-all shadow-xl border-2 border-black">
                  COMMIT_TO_CATALOG
                </button>
              </form>
            </div>
          </div>
        )}

        {isAddingDrawer && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bbs-card max-w-md w-full relative">
              <button onClick={() => setIsAddingDrawer(false)} className="absolute top-4 right-4 text-[#d1d1d1] hover:scale-110 transition-transform">
                <X size={24} />
              </button>
              <div className="bbs-header">NEW_DRAWER_INSTALL</div>
              <form onSubmit={handleAddDrawer} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">DRAWER_NAME</label>
                  <input
                    required
                    type="text"
                    placeholder="E.G. GRAPHICS_DATA"
                    value={newDrawer.name}
                    onChange={(e) => setNewDrawer({ ...newDrawer, name: e.target.value })}
                    className="bbs-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase font-bold tracking-widest opacity-60">DESCRIPTION</label>
                  <input
                    type="text"
                    placeholder="SCOPE_OF_DRAWER"
                    value={newDrawer.description}
                    onChange={(e) => setNewDrawer({ ...newDrawer, description: e.target.value })}
                    className="bbs-input"
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#d1d1d1] text-black uppercase font-bold hover:bg-white transition-all border-2 border-black">
                  INSTALL_DRAWER
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-32 pt-16 border-t border-[#d1d1d1]/10 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.4em] font-bold opacity-60">
              <Clock size={14} />
              <span>SYSTEM_TIME: {new Date().toLocaleDateString()} // {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest opacity-40 bg-white/5 px-6 py-2 border border-[#d1d1d1]/10">
              <Info size={14} />
              <span>NAV: TAB // OPEN: ENTER // CLOSE: ESC</span>
            </div>
            <p className="text-[10px] opacity-40 uppercase tracking-widest max-w-xl leading-relaxed">
              THE_INDEX IS A PUBLIC UTILITY FOR THE PRESERVATION OF DIGITAL KNOWLEDGE. 
              ALL RECORDS ARE COMMUNITY-SUBMITTED AND VERIFIED BY OPERATOR STAMPS.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}


