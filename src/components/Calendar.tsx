import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock,
  Filter,
  TrendingUp,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

interface ScheduledPost {
  id: string;
  summary: string;
  scheduledAt: string;
  imageUrl?: string;
  status: string;
  postType: string;
  accountId?: string;
  accountName?: string;
}

export function Calendar({ onEditPost, selectedAccountId }: { onEditPost: (post: any) => void, selectedAccountId: string }) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allPosts, setAllPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter client-side by selected account
  const posts = allPosts.filter(
    p => selectedAccountId === 'all' || p.accountId === selectedAccountId
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id);
      
      if (!error) {
        setAllPosts((data || []).map(p => ({
           id: p.id,
           summary: p.summary,
           scheduledAt: p.scheduled_at,
           imageUrl: p.image_url,
           status: p.status,
           postType: p.post_type,
           accountId: p.account_id,
           accountName: p.account_name
        })));
      }
      setLoading(false);
    };

    fetchPosts();

    const channel = supabase
      .channel('calendar_changes')
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

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white italic underline decoration-blue-500/50 decoration-4 underline-offset-8 uppercase">{format(currentMonth, 'MMMM yyyy')}</h1>
          <p className="text-slate-400 font-medium tracking-tight mt-2 opacity-60">Strategic temporal planning for GMB assets.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#020617] rounded-xl p-1 border border-slate-800/80">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-slate-500 hover:text-white transition-colors h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="h-4 w-[1px] bg-slate-800 mx-2" />
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-slate-500 hover:text-white transition-colors h-9 w-9">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 border-l border-t border-white/5">
        {calendarDays.map((date, i) => {
          const dayPosts = posts.filter(post => {
            if (!post.scheduledAt) return false;
            try {
              const postDate = new Date(post.scheduledAt);
              if (isNaN(postDate.getTime())) return false;
              return isSameDay(postDate, date);
            } catch (e) {
              return false;
            }
          });
          const isSelected = isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, monthStart);

          return (
            <div
              key={date.toString()}
              className={cn(
                "min-h-[140px] p-3 border-r border-b border-white/5 transition-all relative group",
                !isCurrentMonth ? "bg-slate-900/10 text-slate-700" : "bg-transparent text-slate-300",
                isSelected && "bg-blue-600/5 ring-1 ring-inset ring-blue-500/20"
              )}
              onClick={() => setSelectedDate(date)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={cn(
                  "text-xs font-black italic tracking-tighter opacity-50",
                  isSameDay(date, new Date()) && "text-blue-500 opacity-100 ring-1 ring-blue-500/50 px-1.5 py-0.5 rounded-md"
                )}>
                  {format(date, 'd')}
                </span>
                {dayPosts.length > 0 && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                )}
              </div>
              <div className="space-y-1.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <motion.div 
                    key={post.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPost(post);
                    }}
                    className={cn(
                      "border rounded-md p-1.5 cursor-pointer transition-all group/post",
                      post.status === 'PUBLISHED'
                        ? 'bg-emerald-600/10 border-emerald-500/20 hover:bg-emerald-600/20'
                        : post.status === 'FAILED'
                        ? 'bg-red-600/10 border-red-500/20 hover:bg-red-600/20'
                        : 'bg-blue-600/10 border-blue-500/20 hover:bg-blue-600/20'
                    )}
                  >
                    <p className={cn(
                      "text-[10px] font-black uppercase mb-0.5",
                      post.status === 'PUBLISHED' ? 'text-emerald-400/60' :
                      post.status === 'FAILED' ? 'text-red-400/60' : 'text-blue-400/60'
                    )}>{post.postType}</p>
                    <p className={cn(
                      "text-[10px] font-bold truncate tracking-tight",
                      post.status === 'PUBLISHED' ? 'text-emerald-200' :
                      post.status === 'FAILED' ? 'text-red-200' : 'text-blue-200'
                    )}>{post.summary}</p>
                    <div className="flex items-center justify-between mt-1 opacity-0 group-hover/post:opacity-100 transition-opacity">
                      <span className={cn(
                        "text-[7px] font-black truncate uppercase",
                        post.status === 'PUBLISHED' ? 'text-emerald-400/80' :
                        post.status === 'FAILED' ? 'text-red-400/80' : 'text-blue-400/80'
                      )}>{post.accountName || 'GMB'}</span>
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                    </div>
                  </motion.div>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest pt-1">
                    + {dayPosts.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
     return (
        <div className="flex items-center justify-center h-[50vh] text-slate-500 font-black uppercase tracking-[0.4em] italic animate-pulse">
           Initializing Temporal Data...
        </div>
     );
  }

  return (
    <div className="space-y-8">
      {renderHeader()}
      <div className="glass p-1.5 rounded-[32px] overflow-hidden border-white/5 shadow-2xl">
        {renderDays()}
        {renderCells()}
      </div>

      <div className="flex items-center gap-8 mt-10 p-8 glass rounded-[32px]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Scheduled</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Published</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Error</span>
        </div>
        <div className="ml-auto text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black">
           Temporal Distribution: <span className="text-blue-400 ml-1">{posts.length} Active Records</span>
        </div>
      </div>
    </div>
  );
}
