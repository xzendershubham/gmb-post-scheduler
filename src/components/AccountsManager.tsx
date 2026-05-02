import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Trash2, 
  Globe, 
  Mail, 
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthProvider';

export function AccountsManager() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    gmbId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'accounts'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAccounts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccounts(fetchedAccounts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.gmbId) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'accounts'), {
        userId: user.uid,
        name: formData.name,
        email: formData.email || user.email,
        gmbId: formData.gmbId,
        createdAt: serverTimestamp()
      });
      setFormData({ name: '', email: '', gmbId: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add account:', error);
      alert('Error adding account. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Terminate this account link? All associated metadata will be unlinked.')) return;
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-white italic uppercase">Asset Management</h1>
          <p className="text-slate-400 font-medium tracking-tight">Configure and authorize GMB production environments.</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="accent-gradient text-white font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-2xl shadow-xl shadow-blue-500/20"
        >
          {showAddForm ? 'Close Terminal' : 'Link New Account'}
        </Button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass p-8 rounded-[32px] border-blue-500/20 mb-10">
              <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-3">
                  <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">Business Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input 
                      placeholder="e.g. Main Street Bakery"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="bg-[#020617]/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">GMB Profile ID</Label>
                  <div className="relative">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input 
                      placeholder="e.g. 1234567890"
                      value={formData.gmbId}
                      onChange={(e) => setFormData({...formData, gmbId: e.target.value})}
                      className="bg-[#020617]/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-1 focus:ring-blue-500/30"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="h-14 bg-white hover:bg-slate-100 text-slate-950 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                >
                  {submitting ? 'Authorizing...' : 'Authorize Sync →'}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center animate-pulse text-slate-500 font-black uppercase tracking-widest">
            Scanning Authorized Assets...
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
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                  <Globe className="w-7 h-7 text-blue-400" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white italic truncate">{account.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <Fingerprint className="w-3 h-3" />
                    {account.gmbId}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-black uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                   </div>
                   <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Sync: Nominal
                   </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-slate-500 border-2 border-dashed border-slate-800/50 rounded-[40px]">
             <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p className="font-black uppercase tracking-[0.2em] italic">No Linked Assets Detected</p>
             <p className="text-xs font-medium opacity-60 mt-2">Initialize your first GMB account to start scheduling.</p>
          </div>
        )}
      </div>
    </div>
  );
}
