import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export function Card({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={onClick ? { scale: 1.01 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={cn("bg-white rounded-2xl p-4 shadow-sm border border-slate-100", className)}
    >
      {children}
    </motion.div>
  );
}

export function Button({ children, className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50'
  };

  return (
    <button 
      className={cn("px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2", variants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ children, variant = 'neutral', className }: { children: React.ReactNode, variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info', className?: string }) {
  const variants = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-rose-100 text-rose-700',
    info: 'bg-blue-100 text-blue-700'
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
}
