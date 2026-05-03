import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Image as ImageIcon, 
  Send,
  Sparkles,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Clock,
  Globe,
  Tag,
  Link as LinkIcon,
  ShoppingBag,
  Bell,
  MessageSquare,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthProvider';

// Compress image to safe size for Firestore (<200KB base64)
function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type PostType = 'STANDARD' | 'EVENT' | 'OFFER';
type ActionType = 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP' | 'CALL';

export function PostComposer({ initialData, onCancel, onSuccess, selectedAccountId }: { initialData?: any, onCancel?: () => void, onSuccess?: () => void, selectedAccountId?: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [postType, setPostType] = useState<PostType>(initialData?.postType || 'STANDARD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  
  const [formData, setFormData] = useState({
    summary: initialData?.summary || '',
    accountId: initialData?.accountId || (selectedAccountId !== 'all' ? selectedAccountId : ''),
    imageUrl: initialData?.imageUrl || '',
    actionType: (initialData?.ctaType || 'LEARN_MORE') as ActionType,
    actionUrl: initialData?.ctaUrl || '',
    // Event/Offer specific
    eventTitle: initialData?.eventTitle || '',
    startDate: initialData?.startTime ? format(new Date(initialData.startTime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    startTime: initialData?.startTime ? format(new Date(initialData.startTime), 'HH:mm') : '09:00',
    endDate: initialData?.endTime ? format(new Date(initialData.endTime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    endTime: initialData?.endTime ? format(new Date(initialData.endTime), 'HH:mm') : '17:00',
    // Offer specific
    couponCode: initialData?.offerCoupon || '',
    redeemUrl: initialData?.offerUrl || '',
    terms: initialData?.offerTerms || '',
    // Scheduling
    scheduledDate: initialData?.scheduledAt ? format(new Date(initialData.scheduledAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    scheduledTime: initialData?.scheduledAt ? format(new Date(initialData.scheduledAt), 'HH:mm') : '12:00',
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(fetched);
      if (fetched.length > 0 && !formData.accountId) {
        setFormData(f => ({ ...f, accountId: fetched[0].id }));
      }
      setLoadingAccounts(false);
    });
    return () => unsubscribe();
  }, [user]);

  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        // Only use base64 for PREVIEW
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setFormData(f => ({ ...f, imageUrl: '' }));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Parse dates robustly
      const createSafeISO = (dateStr: string, timeStr: string) => {
        try {
          const combined = `${dateStr}T${timeStr}`;
          const date = new Date(combined);
          if (isNaN(date.getTime())) throw new Error('Invalid Date');
          return date.toISOString();
        } catch (e) {
          return new Date().toISOString(); // Fallback
        }
      };

      const scheduledAt = createSafeISO(formData.scheduledDate, formData.scheduledTime);
      const startTime = createSafeISO(formData.startDate, formData.startTime);
      const endTime = createSafeISO(formData.endDate, formData.endTime);

      let finalImageUrl = '';

      // Compress image client-side and store as small base64
      if (selectedFile) {
        try {
          const compressed = await compressImage(selectedFile, 800, 0.7);
          // Compressed JPEG should be well under 200KB - safe for Firestore
          finalImageUrl = compressed;
        } catch (compressError) {
          console.error('Image compression failed:', compressError);
          // Continue without image
          finalImageUrl = '';
        }
      } else if (formData.imageUrl && !formData.imageUrl.startsWith('data:')) {
        // Only use URL if it's a real URL (not base64)
        finalImageUrl = formData.imageUrl;
      }

      const selectedAccount = accounts.find(a => a.id === formData.accountId);

      const postData = {
        userId: user.uid,
        accountId: formData.accountId,
        accountName: selectedAccount?.name || 'Unknown Account',
        postType: postType,
        summary: formData.summary,
        imageUrl: finalImageUrl,
        ctaType: formData.actionType,
        ctaUrl: formData.actionUrl,
        eventTitle: postType !== 'STANDARD' ? formData.eventTitle : null,
        startTime: postType !== 'STANDARD' ? startTime : null,
        endTime: postType !== 'STANDARD' ? endTime : null,
        offerCoupon: postType === 'OFFER' ? formData.couponCode : null,
        offerUrl: postType === 'OFFER' ? formData.redeemUrl : null,
        offerTerms: postType === 'OFFER' ? formData.terms : null,
        scheduledAt: scheduledAt,
        status: initialData?.status || 'SCHEDULED',
        updatedAt: serverTimestamp(),
      };

      if (initialData?.id) {
        await updateDoc(doc(db, 'posts', initialData.id), postData);
      } else {
        await addDoc(collection(db, 'posts'), {
          ...postData,
          createdAt: serverTimestamp(),
        });
      }

      setShowSuccess(true);
    } catch (error: any) {
      console.error('Operation failed:', error);
      alert('Error saving post: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessAck = () => {
    setShowSuccess(false);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-20 relative">
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020617]/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass p-10 rounded-[40px] border-emerald-500/30 shadow-[0_0_100px_rgba(16,185,129,0.2)] flex flex-col items-center gap-6 max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-widest">Post Scheduled</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">The GMB transmission has been successfully materialized. Production sync is active.</p>
              </div>
              <Button 
                onClick={handleSuccessAck}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                Sync OK
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Side */}
      <div className="lg:col-span-7 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-white italic uppercase">{initialData ? 'Update Sync' : 'GMB Command Center'}</h1>
            <p className="text-slate-400 font-medium tracking-tight">{initialData ? 'Modifying existing production parameters.' : 'Full-fidelity Google Business Profile posting protocol.'}</p>
          </div>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="text-slate-500 hover:text-white uppercase text-[10px] font-black tracking-widest">
              Cancel
            </Button>
          )}
        </div>

        <div className="glass p-8 rounded-[32px] space-y-8 border-white/5">
          {/* Account Selector */}
          <div className="space-y-4">
             <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Target Account</Label>
             <Select 
                value={formData.accountId} 
                onValueChange={(v) => setFormData(f => ({ ...f, accountId: v }))}
             >
                <SelectTrigger className="bg-[#020617] border-slate-800 h-14 rounded-2xl text-white font-bold">
                  <SelectValue placeholder={loadingAccounts ? "Loading Accounts..." : "Select GMB Account"} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                  {accounts.length === 0 && !loadingAccounts && (
                    <div className="p-4 text-[10px] text-slate-500 font-bold uppercase text-center">
                      No accounts linked. Go to Accounts tab first.
                    </div>
                  )}
                </SelectContent>
             </Select>
          </div>

          {/* Post Type Selector */}
          <div className="space-y-4">
             <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Transmission Type</Label>
             <Tabs defaultValue="STANDARD" onValueChange={(v) => setPostType(v as PostType)} className="w-full">
                <TabsList className="bg-[#020617] border border-slate-800 p-1 rounded-2xl w-full h-14">
                  <TabsTrigger value="STANDARD" className="flex-1 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-xs uppercase tracking-widest">Standard</TabsTrigger>
                  <TabsTrigger value="EVENT" className="flex-1 rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white font-bold text-xs uppercase tracking-widest">Event</TabsTrigger>
                  <TabsTrigger value="OFFER" className="flex-1 rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold text-xs uppercase tracking-widest">Offer</TabsTrigger>
                </TabsList>
             </Tabs>
          </div>

          {/* Media Module */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
               <ImageIcon className="w-4 h-4 text-blue-500" />
               <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Media Module (Fidelity Check)</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Import Local</p>
                <Input 
                  type="file" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="bg-[#020617]/50 border-slate-800 h-14 rounded-2xl text-slate-400 file:bg-blue-600/20 file:text-blue-400 file:border-none file:rounded-xl file:px-4 file:py-2 file:mr-4 file:font-bold file:text-xs file:uppercase file:tracking-widest cursor-pointer hover:border-slate-700 transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cloud Resource</p>
                <Input 
                  placeholder="https://..."
                  value={formData.imageUrl}
                  onChange={(e) => {
                    setFormData(f => ({ ...f, imageUrl: e.target.value }));
                    setImagePreview(e.target.value);
                  }}
                  className="bg-[#020617]/50 border-slate-800 h-14 rounded-2xl text-slate-200 focus:ring-1 focus:ring-blue-500/30 shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* Core Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
               <MessageSquare className="w-4 h-4 text-blue-400" />
               <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Deep Content Injection</Label>
            </div>
            {postType !== 'STANDARD' && (
               <Input 
                 placeholder={postType === 'EVENT' ? "Event Title (e.g. Summer Festival)" : "Offer Title (e.g. 20% OFF)"}
                 value={formData.eventTitle}
                 onChange={(e) => setFormData(f => ({ ...f, eventTitle: e.target.value }))}
                 className="bg-[#020617]/50 border-slate-800 h-14 rounded-2xl text-slate-200 mb-2 mt-4 font-bold tracking-tight"
               />
            )}
            <Textarea 
              placeholder="Inject main post summary (up to 1500 chars)..." 
              rows={4}
              className="bg-[#020617]/50 border-slate-800 focus:ring-1 focus:ring-blue-500/30 rounded-3xl p-8 text-slate-200 resize-none font-sans leading-relaxed shadow-inner"
              value={formData.summary}
              onChange={(e) => setFormData(f => ({ ...f, summary: e.target.value }))}
            />
          </div>

          {/* CTA Module */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Action Protocol (CTA)</Label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select onValueChange={(v) => setFormData(f => ({ ...f, actionType: v as ActionType }))} defaultValue="LEARN_MORE">
                  <SelectTrigger className="bg-[#020617] border-slate-800 h-14 rounded-2xl text-slate-200 font-bold">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="BOOK">BOOK</SelectItem>
                    <SelectItem value="ORDER">ORDER ONLINE</SelectItem>
                    <SelectItem value="SHOP">BUY / SHOP</SelectItem>
                    <SelectItem value="LEARN_MORE">LEARN MORE</SelectItem>
                    <SelectItem value="SIGN_UP">SIGN UP</SelectItem>
                    <SelectItem value="CALL">CALL NOW</SelectItem>
                  </SelectContent>
                </Select>
                {formData.actionType !== 'CALL' && (
                  <Input 
                    placeholder="https://your-website.com/landing"
                    value={formData.actionUrl}
                    onChange={(e) => setFormData(f => ({ ...f, actionUrl: e.target.value }))}
                    className="bg-[#020617]/50 border-slate-800 h-14 rounded-2xl text-slate-200 focus:ring-1 focus:ring-blue-500/30"
                  />
                )}
             </div>
          </div>

          {/* Event/Offer Temporal Data */}
          {postType !== 'STANDARD' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6 pt-4 border-t border-slate-800/50">
               <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Transmission Window</Label>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Commencement</p>
                     <div className="flex gap-2">
                        <Input type="date" value={formData.startDate} onChange={(e) => setFormData(f => ({ ...f, startDate: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl" />
                        <Input type="time" value={formData.startTime} onChange={(e) => setFormData(f => ({ ...f, startTime: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl w-32" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Termination</p>
                     <div className="flex gap-2">
                        <Input type="date" value={formData.endDate} onChange={(e) => setFormData(f => ({ ...f, endDate: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl" />
                        <Input type="time" value={formData.endTime} onChange={(e) => setFormData(f => ({ ...f, endTime: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl w-32" />
                     </div>
                  </div>
               </div>
               
               {postType === 'OFFER' && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Coupon Identifier</p>
                          <Input placeholder="SAVE20" value={formData.couponCode} onChange={(e) => setFormData(f => ({ ...f, couponCode: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl h-12" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Redemption Vector (URL)</p>
                          <Input placeholder="https://..." value={formData.redeemUrl} onChange={(e) => setFormData(f => ({ ...f, redeemUrl: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-xl h-12" />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Terms & Conditions</p>
                       <Textarea placeholder="Inject legal terms..." value={formData.terms} onChange={(e) => setFormData(f => ({ ...f, terms: e.target.value }))} className="bg-[#020617] border-slate-800 rounded-2xl h-24 text-xs" />
                    </div>
                 </motion.div>
               )}
            </motion.div>
          )}

          {/* Master Scheduling Module */}
          <div className="space-y-4 pt-8 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
               <Bell className="w-4 h-4 text-blue-500" />
               <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Platform Sync Schedule</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sync Date</p>
                 <Input 
                  type="date" 
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="bg-blue-600/5 border-blue-500/20 h-14 rounded-2xl text-slate-200"
                />
              </div>
              <div className="space-y-2">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sync Time</p>
                 <Input 
                  type="time" 
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData(f => ({ ...f, scheduledTime: e.target.value }))}
                  className="bg-blue-600/5 border-blue-500/20 h-14 rounded-2xl text-slate-200"
                />
              </div>
            </div>
          </div>

          <Button 
            disabled={loading || !formData.summary}
            onClick={handleSubmit}
            className="w-full h-16 accent-gradient text-white rounded-2xl shadow-2xl shadow-blue-500/30 border-none font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Initializing Sync...' : 'Schedule Production →'}
          </Button>
        </div>
      </div>

      {/* Preview Side */}
      <div className="lg:col-span-5 space-y-8">
        <Label className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Live GMB Simulation</Label>
        
        <div className="sticky top-24">
          <motion.div layout className="max-w-[420px] mx-auto bg-white text-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/20">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-white text-xs" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-tight">
                      {accounts.find(a => a.id === formData.accountId)?.name || 'Your Business Name'}
                    </p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Active Profile</p>
                  </div>
               </div>
               <AlertCircle className="w-4 h-4 text-slate-200" />
            </div>

            <div className="aspect-[16/10] bg-slate-50 relative overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 font-black italic p-16 text-center text-[10px] uppercase tracking-[0.3em] bg-slate-100/50">
                   Waiting for Visual Media
                </div>
              )}
              {postType !== 'STANDARD' && (
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-sm">
                   <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{postType}</p>
                </div>
              )}
            </div>

            <div className="p-8 space-y-4">
              {formData.eventTitle && (
                <h4 className="text-lg font-black tracking-tight text-slate-900 leading-none">{formData.eventTitle}</h4>
              )}
              
              {postType !== 'STANDARD' && (
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest pb-2">
                   <Clock className="w-3 h-3" />
                   <span>{formData.startDate} - {formData.endDate}</span>
                </div>
              )}

              <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-slate-700">
                {formData.summary || <span className="text-slate-300 italic">Content injection pending...</span>}
              </p>

              {postType === 'OFFER' && formData.couponCode && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                   <div>
                      <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest">Voucher Code</p>
                      <p className="font-mono font-bold text-emerald-700">{formData.couponCode}</p>
                   </div>
                   <Tag className="w-5 h-5 text-emerald-400" />
                </div>
              )}

              {formData.actionType !== 'ACTION_TYPE_UNSPECIFIED' && (
                 <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 text-xs">
                    {formData.actionType === 'CALL' ? 'CALL NOW' : formData.actionType.replace('_', ' ')}
                 </Button>
              )}
            </div>
            
            <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
              <span>Sync Mode: Optimized</span>
              <span className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 Ready
              </span>
            </div>
          </motion.div>

          <div className="mt-10 glass p-8 rounded-[32px] flex items-center gap-5 border-blue-500/10">
            <div className="w-12 h-12 rounded-2xl accent-gradient flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-white font-black uppercase tracking-[0.2em] mb-1">Fidelity Verification</p>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium"> This simulation replicates the exact <span className="text-blue-400 italic font-bold">Search & Maps</span> rendering architecture.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
