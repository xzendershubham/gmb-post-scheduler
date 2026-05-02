import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './components/Dashboard';
import { PostComposer } from './components/PostComposer';
import { Calendar } from './components/Calendar';
import { AccountsManager } from './components/AccountsManager';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, LogIn, Sparkles, Globe, ShieldCheck, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

function AppContent() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingPost, setEditingPost] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('all');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (mode === 'signup') {
        const result = await signUpWithEmail(email, password);
        // Firebase Auth automatically logs the user in after signup if configured,
        // or we can show a success message.
        if (result.user) {
          setSuccessMessage('Account created successfully!');
          // The onAuthStateChanged listener in AuthProvider will pick this up
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (msg.includes('Invalid login credentials') && mode === 'login') {
        msg = 'Login rejected. Please check your email and password.';
      }
      if (msg.includes('Email not confirmed')) {
        msg = 'Account pending verification. Please confirm your email to activate the sync profile.';
      }
      if (msg.includes('User already registered') && mode === 'signup') {
        msg = 'Identity profile already exists. Switching to login mode.';
        setMode('login');
      }
      setErrorMessage(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#020617]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <span className="text-blue-400 font-bold tracking-widest uppercase text-[10px]">Initializing PostPilot...</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass p-10 rounded-[40px] space-y-8 z-10 border-white/5 shadow-2xl"
        >
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-[22px] accent-gradient flex items-center justify-center shadow-2xl shadow-blue-500/40 mx-auto transform rotate-6 scale-110">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase">POSTFLOW</h1>
              <p className="text-slate-400 text-sm font-medium leading-relaxed px-4 text-balanced">Direct-to-platform content publishing. Draft, schedule, and sync your original updates.</p>
            </div>
          </div>

          <motion.form 
            key="auth-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleAuth} 
            className="space-y-4"
          >
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-medium text-center"
              >
                {successMessage}
              </motion.div>
            )}
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-400 font-bold uppercase tracking-widest leading-relaxed text-center"
              >
                {errorMessage}
              </motion.div>
            )}
            <div className="space-y-2">
              <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  type="email" 
                  placeholder="your-email@gmail.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#020617]/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#020617]/50 border-slate-800 h-14 pl-12 pr-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit"
              disabled={authLoading}
              className="w-full h-14 accent-gradient text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-blue-500/20 border-none transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              {authLoading ? 'Verifying...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
            <button 
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-blue-400 transition-colors"
            >
              {mode === 'login' ? 'New user? Create Account' : 'Already have an account? Sign In'}
            </button>
          </motion.form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
              <span className="px-3 bg-transparent text-slate-500 font-black">Cluster Access</span>
            </div>
          </div>

          <div className="space-y-4">
             <Button 
                onClick={signInWithGoogle}
                type="button"
                className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all hover:scale-[1.01]"
             >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Connect via Google
             </Button>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/5">
             <div className="flex flex-col items-center gap-1">
                <LayoutDashboard className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">RAW TOOLS</span>
             </div>
             <div className="flex flex-col items-center gap-1">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">DIRECT SYNC</span>
             </div>
             <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">VERIFIED</span>
             </div>
          </div>
        </motion.div>

        <div className="mt-12 text-slate-500 text-[10px] font-bold tracking-[0.3em] uppercase">
          &copy; 2026 POSTFLOW
        </div>
      </div>
    );
  }

  const renderContent = () => {
      return (
        <PostComposer 
          key={editingPost?.id || 'edit'}
          initialData={editingPost} 
          onCancel={() => setEditingPost(null)}
          selectedAccountId={selectedAccountId}
          onSuccess={() => {
            setEditingPost(null);
            setActiveTab('dashboard');
          }}
        
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onEditPost={(post: any) => setEditingPost(post)} selectedAccountId={selectedAccountId} />;
      case 'posts':
        return <PostComposer key={selectedAccountId} onSuccess={() => setActiveTab('dashboard')} selectedAccountId={selectedAccountId} />;
      case 'calendar':
        return <Calendar onEditPost={(post: any) => setEditingPost(post)} selectedAccountId={selectedAccountId} />;
      case 'accounts':
        return <AccountsManager />;
      default:
        return <Dashboard onEditPost={(post: any) => setEditingPost(post)} selectedAccountId={selectedAccountId} />;
    }
  };

  return (
    <MainLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      selectedAccountId={selectedAccountId}
      onAccountChange={setSelectedAccountId}
    >
      {renderContent()}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
