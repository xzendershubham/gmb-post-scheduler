import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  PlusSquare, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Search,
  Globe
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from './AuthProvider';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'posts', label: 'Compose Post', icon: PlusSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'accounts', label: 'Accounts', icon: Users },
];

export function MainLayout({ children, activeTab, setActiveTab, selectedAccountId, onAccountChange }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accounts, setAccounts] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!user) return;
    
    const fetchAccounts = async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error) {
        setAccounts(data || []);
      }
    };

    fetchAccounts();

    const channel = supabase
      .channel('layout_accounts')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'accounts',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAccounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const avatarUrl = user?.user_metadata?.avatar_url;
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operator';

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#020617] border-r border-slate-800/60">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center shadow-lg shadow-blue-500/20">
            <LayoutDashboard className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">PostFlow</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group text-sm font-medium",
                activeTab === item.id 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/10" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-blue-400"
              )}
            >
              <item.icon className={cn(
                "w-4.5 h-4.5 transition-colors",
                activeTab === item.id ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400/80"
              )} />
              {item.label}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800/60 mt-auto">
          <div className="flex items-center gap-3">
            <Avatar className="w-9 h-9 border border-slate-700/50">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-slate-800 text-[10px]">{fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{fullName}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Session</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout}
              className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 h-8 w-8"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/40 sticky top-0 z-20">
          <div className="md:hidden flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="w-6 h-6 text-slate-400" />
            </Button>
            <span className="font-bold text-lg tracking-tight text-white">PostFlow</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
             <h2 className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Management Terminal</h2>
             <div className="h-6 w-px bg-slate-800" />
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Environment:</span>
                <Select value={selectedAccountId} onValueChange={onAccountChange}>
                  <SelectTrigger className="bg-[#020617] border-slate-800 h-10 w-[240px] rounded-xl text-white font-bold text-xs">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="all">ALL PIPELINES</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="default" size="sm" onClick={() => setActiveTab('posts')} className="accent-gradient text-white border-none rounded-xl font-semibold shadow-lg shadow-blue-500/20 h-10 px-5">
              <PlusSquare className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-7xl mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              className="w-full max-w-[280px] h-full bg-[#1e293b] flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <span className="font-bold text-xl text-glow text-white">PostFlow</span>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6 text-slate-400" />
                </Button>
              </div>
              <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium",
                      activeTab === item.id 
                        ? "bg-blue-600/10 text-blue-400" 
                        : "text-slate-400"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
