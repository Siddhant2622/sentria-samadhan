import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/LanguageContext';

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [searchParams] = useSearchParams();
  const complaintId = searchParams.get('complaintId');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_id: user?.id,
          complaint_id: complaintId,
          rating,
          comment,
          language: lang
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        alert(data.error || 'Failed to submit feedback.');
        if (data.error?.includes('already submitted')) {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="korean-card p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-textMain mb-2 font-serif">{t('feedbackSuccess')}</h2>
          <p className="text-textMuted text-sm">{t('back')} to dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-surface">
      <div className="dancheong-line" />
      
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-2xl bg-white shadow-soft flex items-center justify-center text-textMuted mb-6">
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-3xl font-bold text-textMain font-serif mb-2">{t('feedbackTitle')}</h1>
        <p className="text-textMuted mb-4">{t('feedbackMsg')}</p>
        
        {complaintId && (
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-6">
            <p className="text-[10px] text-textMuted uppercase tracking-widest font-bold">Feedback For Case</p>
            <p className="text-sm font-semibold text-primary">#{complaintId.slice(0, 8)}</p>
          </div>
        )}

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit} 
          className="space-y-6"
        >
          <div className="korean-card p-6 text-center shadow-card hover:border-primary/20 transition-all">
            <p className="text-sm font-semibold text-textMuted mb-6 uppercase tracking-wider">How was your experience?</p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button" 
                  onClick={() => setRating(star)} 
                  className="p-1 transition-all active:scale-90"
                >
                  <Star 
                    size={40} 
                    className={`transition-all duration-300 ${star <= rating ? "fill-warning text-warning drop-shadow-[0_0_8px_rgba(234,179,8,0.4)] scale-110" : "text-black/10"}`} 
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <motion.p 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-warning font-bold mt-6 text-base tracking-wide"
              >
                {rating === 5 ? "Excellent!" : rating === 4 ? "Good" : rating === 3 ? "Average" : rating === 2 ? "Poor" : "Very Poor"}
              </motion.p>
            )}
          </div>

          <div className="korean-card p-6 shadow-card hover:border-primary/20 transition-all">
            <p className="text-sm font-semibold text-textMuted mb-4 uppercase tracking-wider">Add a comment (Optional)</p>
            <textarea 
              value={comment} 
              onChange={(e) => setComment(e.target.value)} 
              rows="4"
              className="w-full bg-surfaceLight border-none rounded-2xl p-5 text-textMain focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm leading-relaxed"
              placeholder="Tell us more about your experience..."
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={rating === 0 || isSubmitting}
            className={`w-full py-5 rounded-[2rem] font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]
              ${rating > 0 && !isSubmitting ? 'bg-primary text-white shadow-primary/30' : 'bg-black/10 text-textMuted opacity-50'}`}
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={20} /> {t('submit')}
              </>
            )}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
