import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  MousePointer2, 
  Clock,
  ExternalLink,
  Sparkles,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from './AuthProvider';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';

export function Dashboard({ onEditPost, selectedAccountId }: { onEditPost: (post: any) => void, selectedAccountId: string }) {
  const { user } = useAuth();
  const [pipelinePosts, setPipelinePosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const baseQuery = [
      collection(db, 'posts'),
      where('userId', '==', user.uid),
    ];

    if (selectedAccountId && selectedAccountId !== 'all') {
      baseQuery.push(where('accountId', '==', selectedAccountId));
    }

    const q = query(
      ...(baseQuery as [any, ...any[]]),
      orderBy('scheduledAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPipelinePosts(posts);
      setLoading(false);
    }, (error) => {
      console.error('Firestore subscription error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white italic">Protocol Overview</h1>
        <p className="text-slate-400 font-medium tracking-tight">Active session for {user?.email || 'Operator'}. GMB Sync status: Nominal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-12 glass rounded-[32px] overflow-hidden border-white/5 shadow-2xl">
          <div className="flex items-center justify-between p-8 border-b border-white/5">
            <h2 className="text-lg font-bold text-white flex items-center gap-3 uppercase tracking-[0.2em] italic">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Production Pipeline
            </h2>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Live Sync Enabled</span>
            </div>
          </div>
          
          <div className="p-8">
             {loading ? (
               <div className="py-20 text-center animate-pulse text-slate-500 font-black uppercase tracking-widest">Scanning Pipeline...</div>
             ) : pipelinePosts.length > 0 ? (
               <div className="space-y-4">
                 {pipelinePosts.map((post) => (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={post.id} 
                    className="group bg-[#020617]/50 border border-slate-800/50 p-6 rounded-2xl flex items-center justify-between hover:border-blue-500/30 transition-all shadow-inner"
                   >
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                           {post.postType === 'EVENT' ? <Sparkles className="w-5 h-5 text-purple-500" /> : <Clock className="w-5 h-5 text-blue-500" />}
                        </div>
                        <div className="space-y-1">
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{post.postType}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-40">|</span>
                              <span className="text-[10px] font-bold text-white uppercase tracking-widest">{post.accountName || 'No Account'}</span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-40">|</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{post.scheduledAt ? format(new Date(post.scheduledAt), 'MMM dd, HH:mm') : 'Unscheduled'}</span>
                           </div>
                           <h4 className="text-sm font-bold text-white tracking-tight line-clamp-1">{post.summary}</h4>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[8px] font-black uppercase tracking-widest">
                           {post.status}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => onEditPost(post)}
                          className="h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                          Modify
                        </Button>
                     </div>
                   </motion.div>
                 ))}
               </div>
             ) : (
               <div className="py-20 text-center text-slate-500">
                  <div className="w-20 h-20 rounded-3xl bg-[#020617] border border-slate-800/50 flex items-center justify-center mx-auto mb-8 shadow-inner">
                     <Clock className="w-10 h-10 text-blue-500/20" />
                  </div>
                  <h3 className="text-xl font-black text-white italic uppercase tracking-widest mb-4">No Active Records</h3>
                  <p className="text-sm font-medium opacity-60 max-w-sm mx-auto leading-relaxed">
                    The transmission pipeline is currently idle. Initialize a post using the distribution module.
                  </p>
               </div>
             )}

             <div className="mt-12 flex gap-4 justify-center opacity-20">
                <div className="h-px w-12 bg-slate-800 self-center" />
                <span className="text-[10px] font-black italic uppercase tracking-[0.4em] text-white underline underline-offset-4">End of Pipeline Report</span>
                <div className="h-px w-12 bg-slate-800 self-center" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
