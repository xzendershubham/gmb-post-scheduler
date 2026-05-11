import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const API_URL = APP_URL.includes('localhost:3000') ? 'http://localhost:3001' : APP_URL;

export function Dashboard({ onEditPost, selectedAccountId }: { onEditPost: (post: any) => void, selectedAccountId: string }) {
  const { user } = useAuth();
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Derived: filter client-side by selected account
  const pipelinePosts = allPosts
    .filter(p => selectedAccountId === 'all' || p.account_id === selectedAccountId)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error) {
        setAllPosts(data || []);
      }
      setLoading(false);
    };

    fetchPosts();

    // Subscribe to changes
    const channel = supabase
      .channel('posts_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'posts',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSync = async () => {
    if (!user) return;
    const secret = prompt('Enter CRON_SECRET to verify authorized sync:');
    if (!secret) return;

    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/publish-posts?userId=${user.id}&secret=${secret}`);
      const data = await res.json();
      if (data.ok) {
        alert(`Sync Complete! Published: ${data.published}, Failed: ${data.failed}, Skipped: ${data.skipped}`);
      } else {
        alert(`Sync Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Sync error:', err);
      alert('Network error during sync.');
    } finally {
      setSyncing(false);
    }
  };

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
            <div className="flex items-center gap-4">
               <Button 
                onClick={handleSync} 
                disabled={syncing}
                variant="outline" 
                className="h-10 px-4 rounded-xl border-blue-500/30 bg-blue-500/5 text-blue-400 font-bold text-[10px] uppercase tracking-widest hover:bg-blue-500/10 transition-all flex items-center gap-2"
               >
                 {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                 Sync Pipeline
               </Button>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Live Sync Enabled</span>
               </div>
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
                     className={cn(
                       "group bg-[#020617]/50 border p-6 rounded-2xl flex items-center justify-between hover:border-blue-500/30 transition-all shadow-inner",
                       post.status === 'PUBLISHED' ? 'border-emerald-500/20' :
                       post.status === 'FAILED' ? 'border-red-500/20' :
                       'border-slate-800/50'
                     )}
                    >
                      <div className="flex items-center gap-6">
                         <div className={cn(
                           "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0",
                           post.status === 'PUBLISHED' ? 'bg-emerald-500/10 border-emerald-500/20' :
                           post.status === 'FAILED' ? 'bg-red-500/10 border-red-500/20' :
                           'bg-slate-900 border-slate-800'
                         )}>
                            {post.status === 'PUBLISHED' ? (
                               <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : post.status === 'FAILED' ? (
                               <XCircle className="w-5 h-5 text-red-400" />
                            ) : post.post_type === 'EVENT' ? (
                               <Sparkles className="w-5 h-5 text-purple-500" />
                            ) : (
                               <Clock className="w-5 h-5 text-blue-500" />
                            )}
                         </div>
                         <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{post.post_type}</span>
                               <span className="text-[10px] font-bold text-slate-500 uppercase opacity-40">|</span>
                               <span className="text-[10px] font-bold text-white uppercase tracking-widest">{post.account_name || 'No Account'}</span>
                               <span className="text-[10px] font-bold text-slate-500 uppercase opacity-40">|</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                 {post.scheduled_at ? format(new Date(post.scheduled_at), 'MMM dd, HH:mm') : 'Unscheduled'}
                               </span>
                            </div>
                            <h4 className="text-sm font-bold text-white tracking-tight line-clamp-1">{post.summary}</h4>
                            {post.status === 'FAILED' && post.publish_error && (
                               <p className="text-[10px] text-red-400 font-medium line-clamp-2 max-w-md mt-1">
                                 ⚠ {post.publish_error}
                               </p>
                            )}
                            {post.status === 'PUBLISHED' && post.updated_at && (() => {
                               try {
                                 const date = new Date(post.updated_at);
                                 if (isNaN(date.getTime())) return null;
                                 return (
                                   <p className="text-[10px] text-emerald-400 font-bold">
                                     Published {formatDistanceToNow(date, { addSuffix: true })}
                                   </p>
                                 );
                               } catch (e) {
                                 return null;
                               }
                            })()}
                         </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                         <div className={cn(
                           "px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5",
                           post.status === 'PUBLISHED'
                             ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                             : post.status === 'FAILED'
                             ? 'border-red-500/30 bg-red-500/10 text-red-400'
                             : 'border-blue-500/20 bg-blue-500/5 text-blue-400'
                         )}>
                            <div className={cn(
                               "w-1.5 h-1.5 rounded-full",
                               post.status === 'PUBLISHED' ? 'bg-emerald-400 animate-pulse' :
                               post.status === 'FAILED' ? 'bg-red-400' : 'bg-blue-400 animate-pulse'
                            )} />
                            {post.status}
                         </div>
                         {post.status !== 'PUBLISHED' && (
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => onEditPost(post)}
                             className="h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] uppercase tracking-widest transition-all"
                           >
                             Edit
                           </Button>
                         )}
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
