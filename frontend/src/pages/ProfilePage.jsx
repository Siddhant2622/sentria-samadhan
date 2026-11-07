import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Bell, CheckCircle, MapPin, Shield, User, Phone, Mail, LogOut, Star, AlertTriangle, Languages, MessageSquare, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useLanguage } from '../lib/LanguageContext';
import { languages } from '../lib/translations';

// All 52 districts of Madhya Pradesh
const MP_DISTRICTS = [
  'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat',
  'Barwani', 'Betul', 'Bhind', 'Bhopal', 'Burhanpur',
  'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas',
  'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda',
  'Hoshangabad', 'Indore', 'Jabalpur', 'Jhabua', 'Katni',
  'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena',
  'Narsinghpur', 'Neemuch', 'Panna', 'Raisen', 'Rajgarh',
  'Ratlam', 'Rewa', 'Sagar', 'Satna', 'Sehore',
  'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri',
  'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria',
  'Vidisha', 'Niwari'
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUserDistrict } = useAuth();
  const { t, lang, changeLanguage } = useLanguage();

  const trustScore = user?.trust_score ?? 100;
  const trustLabel = trustScore >= 80 ? 'Excellent' : trustScore >= 50 ? 'Good' : trustScore >= 25 ? 'Low' : 'Critical';
  const trustColor = trustScore >= 80 ? 'text-primary' : trustScore >= 50 ? 'text-teal' : trustScore >= 25 ? 'text-warning' : 'text-danger';
  const trustBg = trustScore >= 80 ? 'bg-primary/10' : trustScore >= 50 ? 'bg-teal/10' : trustScore >= 25 ? 'bg-warning/10' : 'bg-danger/10';
  const ringColor = trustScore >= 80 ? 'from-primary to-teal' : trustScore >= 50 ? 'from-teal to-primary' : trustScore >= 25 ? 'from-warning to-danger' : 'from-danger to-danger/50';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="p-4 flex items-center justify-between border-b border-black/[0.06] bg-surface/70 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-surfaceLight rounded-full mr-3">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg font-serif">My Profile</h1>
        </div>
        <button onClick={logout} className="p-2 bg-surfaceLight rounded-full text-textMuted hover:text-danger transition-colors">
          <LogOut size={18} />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Avatar & name */}
        <div className="korean-card p-6 text-center">
          <div className={`mx-auto h-24 w-24 rounded-3xl bg-gradient-to-tr ${ringColor} p-[2.5px] mb-4 shadow-soft`}>
            <div className="h-full w-full rounded-3xl bg-surface flex items-center justify-center">
              {user?.profile_image ? (
                <img src={user.profile_image} className="w-full h-full object-cover rounded-3xl" alt="Avatar" />
              ) : (
                <User size={36} className="text-textMuted" />
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold font-serif">{user?.name || 'Citizen'}</h2>
          <p className="text-sm text-textMuted mt-1">{user?.email || 'No email linked'}</p>
        </div>

        {/* Language Selection */}
        <div className="korean-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-2 rounded-xl text-primary">
              <Languages size={18} />
            </div>
            <h3 className="font-bold text-sm">{t('language')}</h3>
          </div>
          <div className="relative">
            <select
              value={lang}
              onChange={(e) => changeLanguage(e.target.value)}
              className="w-full appearance-none bg-surfaceLight border border-black/5 text-textMain rounded-2xl py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-bold text-sm"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* District Selection */}
        <div className="korean-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-warning/10 p-2 rounded-xl text-warning">
              <MapPin size={18} />
            </div>
            <h3 className="font-bold text-sm">My District</h3>
          </div>
          <div className="relative">
            <select
              value={user?.district || ''}
              onChange={(e) => updateUserDistrict(e.target.value)}
              className="w-full appearance-none bg-surfaceLight border border-black/5 text-textMain rounded-2xl py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-warning/30 transition-all font-bold text-sm"
            >
              <option value="" disabled>Select your district</option>
              {MP_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-textMuted">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* Feedback Link */}
        <button onClick={() => navigate('/feedback')}
          className="w-full korean-card p-5 flex items-center justify-between group hover:border-primary/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="bg-teal/10 p-2 rounded-xl text-teal">
              <MessageSquare size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-sm">{t('feedbackTitle')}</h3>
              <p className="text-[10px] text-textMuted mt-0.5">{t('feedbackMsg')}</p>
            </div>
          </div>
          <div className="bg-surfaceLight p-1.5 rounded-full text-textMuted group-hover:text-primary transition-colors">
            <ArrowLeft size={14} className="rotate-180" />
          </div>
        </button>

        {/* Trust Score Card */}
        <div className={`${trustBg} border border-black/[0.06] rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-textMuted uppercase tracking-wide mb-1">{t('trustScore')}</p>
              <p className={`text-3xl font-black ${trustColor}`}>{trustScore}<span className="text-base font-medium text-textMuted">/100</span></p>
              <p className={`text-sm font-semibold ${trustColor} mt-0.5`}>{trustLabel}</p>
            </div>
            <Shield size={36} className={`${trustColor} opacity-40`} />
          </div>
          <div className="h-2 bg-black/[0.06] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${trustScore >= 80 ? 'bg-primary' : trustScore >= 50 ? 'bg-teal' : trustScore >= 25 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${trustScore}%` }} />
          </div>
        </div>

        <button onClick={logout} className="w-full korean-card border-danger/20 text-danger font-semibold py-4 flex items-center justify-center gap-2 hover:bg-danger/5 transition-colors">
          <LogOut size={18} /> {t('logout')}
        </button>
      </div>
    </div>
  );
}

