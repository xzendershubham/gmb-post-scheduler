import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Trash2,
  Globe,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Building2,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from './AuthProvider';

const APP_URL = import.meta.env.VITE_APP_URL || 'https://gmb-post-scheduler.vercel.app';

export function AccountsManager() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', gmbId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, 'healthy' | 'error' | null>>({});

  // GMB Real Connect State
  const [gmbConnecting, setGmbConnecting] = useState(false);
  const [gmbLocations, setGmbLocations] = useState<any[]>([]);
  const [gmbAccounts, setGmbAccounts] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isGmbConnected, setIsGmbConnected] = useState(false);
  const [gmb_status, setGmbStatus] = useState<'idle' | 'connected' | 'error'>('idle');

  // Check URL params on load (callback from OAuth)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmb_connected') === 'true') {
      setGmbStatus('connected');
      setIsGmbConnected(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Load locations
      loadGmbLocations();
    }
    if (params.get('gmb_error')) {
      setGmbStatus('error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Listen to user's accounts in Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setAccounts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // ─── Connect Real GMB (OAuth) ──────────────────────────────────────────────
  const handleConnectGMB = () => {
    if (!user) return;
    const oauthUrl = `${APP_URL}/api/gmb-auth?userId=${user.uid}`;
    window.location.href = oauthUrl;
  };

  // ─── Load GMB Locations after OAuth ───────────────────────────────────────
  const loadGmbLocations = async () => {
    if (!user) return;
    setLoadingLocations(true);
    try {
      // Fetch GMB accounts
      const res = await fetch(`${APP_URL}/api/gmb-locations?userId=${user.uid}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGmbAccounts(data.accounts || []);

      // Fetch locations for the first account
      if (data.accounts?.length > 0) {
        const acctName = data.accounts[0].name;
        const locRes = await fetch(
          `${APP_URL}/api/gmb-locations?userId=${user.uid}&accountName=${acctName}`
        );
        const locData = await locRes.json();
        setGmbLocations(locData.locations || []);
      }
    } catch (err: any) {
      console.error('Error loading GMB locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  // ─── Save GMB Location as an Account ──────────────────────────────────────
  const handleSaveLocation = async (location: any) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // location.name = "accounts/xxx/locations/yyy"
      // location.title = Business Name
      await addDoc(collection(db, 'accounts'), {
        userId: user.uid,
        name: location.title || location.name,
        locationId: location.name, // e.g. "accounts/12345/locations/67890"
        gmbId: location.name.split('/').pop(),
        type: 'gmb_real',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving location:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Manual Add Account ────────────────────────────────────────────────────
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.gmbId) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'accounts'), {
        userId: user.uid,
        name: formData.name,
        gmbId: formData.gmbId,
        type: 'manual',
        createdAt: serverTimestamp(),
      });
      setFormData({ name: '', gmbId: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add account:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Remove this GMB account link?')) return;
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleVerifyAccount = async (account: any) => {
    if (!user || account.type !== 'gmb_real') return;
    setVerifying(account.id);
    try {
      // Use gmb-locations to test the token
      const locId = account.locationId || '';
      const accountName = locId.includes('/locations/') ? locId.split('/locations/')[0] : '';
      
      if (!accountName) {
        setHealthStatus(prev => ({ ...prev, [account.id]: 'error' }));
        return;
      }

      const res = await fetch(`${APP_URL}/api/gmb-locations?userId=${user.uid}&accountName=${accountName}`);
      const data = await res.json();
      
      if (data.accounts || data.locations) {
        setHealthStatus(prev => ({ ...prev, [account.id]: 'healthy' }));
        setTimeout(() => setHealthStatus(prev => ({ ...prev, [account.id]: null })), 3000);
      } else {
        setHealthStatus(prev => ({ ...prev, [account.id]: 'error' }));
      }
    } catch (err) {
      setHealthStatus(prev => ({ ...prev, [account.id]: 'error' }));
    } finally {
      setVerifying(null);
    }
  };

  const isAlreadySaved = (location: any) =>
    accounts.some((a) => a.locationId === location.name || a.gmbId === location.name.split('/').pop());

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-white italic uppercase">GMB Accounts</h1>
          <p className="text-slate-400 font-medium tracking-tight">
            Connect your real Google Business Profiles for auto-publishing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleConnectGMB}
            className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-white text-slate-900 hover:bg-slate-100 shadow-xl flex items-center gap-2"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" />
            Connect Real GMB
          </Button>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="accent-gradient text-white font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-2xl shadow-xl shadow-blue-500/20"
          >
            {showAddForm ? 'Close' : '+ Manual'}
          </Button>
        </div>
      </div>

      {/* GMB OAuth Status */}
      <AnimatePresence>
        {gmb_status === 'connected' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-400 font-bold text-sm">
              Google Business Profile connected! Select your locations below to add them.
            </p>
          </motion.div>
        )}
        {gmb_status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 font-bold text-sm">
              Connection failed. Please try again or check your Google Cloud OAuth setup.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GMB Locations (after OAuth) */}
      <AnimatePresence>
        {(isGmbConnected || gmbLocations.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass p-8 rounded-[32px] border-emerald-500/20 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Your GMB Locations
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadGmbLocations}
                disabled={loadingLocations}
                className="text-slate-400 hover:text-white text-[10px] uppercase font-black tracking-widest"
              >
                {loadingLocations ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>

            {loadingLocations ? (
              <div className="py-8 text-center text-slate-500 font-black text-[10px] uppercase tracking-widest animate-pulse">
                Loading GMB Locations...
              </div>
            ) : gmbLocations.length > 0 ? (
              <div className="space-y-3">
                {gmbLocations.map((loc) => {
                  const saved = isAlreadySaved(loc);
                  return (
                    <div
                      key={loc.name}
                      className="flex items-center justify-between p-4 bg-[#020617]/50 rounded-2xl border border-slate-800/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{loc.title || loc.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{loc.name}</p>
                        </div>
                      </div>
                      {saved ? (
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-4 h-4" />
                          Added
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleSaveLocation(loc)}
                          disabled={submitting}
                          className="h-9 px-4 accent-gradient text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                        >
                          Add to List
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                <MapPin className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  No locations found. Make sure you have GMB locations in your Google account.
                </p>
                <Button
                  onClick={loadGmbLocations}
                  className="mt-4 text-[10px] font-black uppercase tracking-widest"
                  variant="ghost"
                >
                  Retry
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass p-8 rounded-[32px] border-blue-500/20 mb-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
                Manual Entry — Use this if you know your GMB Location ID
              </p>
              <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-3">
                  <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Business Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="e.g. Main Street Bakery"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-[#020617]/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">GMB Location ID</Label>
                  <div className="relative">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="accounts/xxx/locations/yyy"
                      value={formData.gmbId}
                      onChange={(e) => setFormData({ ...formData, gmbId: e.target.value })}
                      className="bg-[#020617]/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-14 bg-white hover:bg-slate-100 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                >
                  {submitting ? 'Saving...' : 'Save Account →'}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center animate-pulse text-slate-500 font-black uppercase tracking-widest">
            Loading Accounts...
          </div>
        ) : accounts.length > 0 ? (
          accounts.map((account) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={account.id}
              className="glass p-8 rounded-[32px] border-white/5 group hover:border-blue-500/30 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  account.type === 'gmb_real'
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-blue-600/10 border border-blue-500/20'
                }`}>
                  {account.type === 'gmb_real' ? (
                    <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="G" />
                  ) : (
                    <Globe className="w-7 h-7 text-blue-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white italic truncate">{account.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <Fingerprint className="w-3 h-3" />
                    <span className="truncate">{account.locationId || account.gmbId || 'Manual'}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                    account.type === 'gmb_real' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {account.type === 'gmb_real' ? (
                      <><Wifi className="w-3.5 h-3.5" /> Live GMB</>
                    ) : (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Manual</>
                    )}
                  </div>

                  {account.type === 'gmb_real' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVerifyAccount(account)}
                      disabled={verifying === account.id}
                      className={cn(
                        "h-7 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                        healthStatus[account.id] === 'healthy' ? "bg-emerald-500/20 text-emerald-400" :
                        healthStatus[account.id] === 'error' ? "bg-red-500/20 text-red-400" :
                        "bg-white/5 text-slate-400 hover:text-white"
                      )}
                    >
                      {verifying === account.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 
                       healthStatus[account.id] === 'healthy' ? "Verified ✓" :
                       healthStatus[account.id] === 'error' ? "Connection Error" : "Verify Connection"}
                    </Button>
                  )}

                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {account.type === 'gmb_real' ? 'Auto-Publish ✓' : 'Scheduler Only'}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border-2 border-dashed border-slate-800/50 rounded-[40px]">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-black uppercase tracking-[0.2em] italic">No Accounts Yet</p>
            <p className="text-xs font-medium opacity-60 mt-2 max-w-xs mx-auto">
              Click "Connect Real GMB" to link your Google Business Profiles for auto-publishing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
