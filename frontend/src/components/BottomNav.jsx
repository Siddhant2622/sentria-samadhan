import { NavLink, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Map, User, Globe, Shield, Truck, BarChart2, Users } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

export default function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const path = location.pathname;

  // 1. OFFICER NAVIGATION
  if (path.startsWith('/officer')) {
    const officerNav = [
      { name: 'Tasks', path: '/officer', icon: Truck },
      { name: 'Map', path: '/map', icon: Map },
      { name: 'Profile', path: '/profile', icon: User },
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-teal-900/95 backdrop-blur-xl border-t border-white/10 px-10 py-3 pb-safe z-50">
        <div className="flex justify-between items-center text-white/70">
          {officerNav.map((item) => {
            const isActive = path === item.path;
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={`flex flex-col items-center space-y-1 ${isActive ? 'text-white' : 'hover:text-white'}`}>
                <Icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. ADMIN NAVIGATION
  if (path.startsWith('/admin')) {
    const adminNav = [
      { name: 'Cases', path: '/admin?tab=board', icon: Shield },
      { name: 'Users', path: '/admin?tab=users', icon: Users },
      { name: 'Analytics', path: '/admin?tab=sla', icon: BarChart2 },
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-white/10 px-10 py-3 pb-safe z-50">
        <div className="flex justify-between items-center text-slate-400">
          {adminNav.map((item) => {
            const isActive = (path + location.search) === item.path || (path === item.path && !location.search && item.name === 'Cases');
            const Icon = item.icon;
            return (
              <NavLink key={item.name} to={item.path} className={`flex flex-col items-center space-y-1 ${isActive ? 'text-white' : 'hover:text-white'}`}>
                <Icon size={20} />
                <span className="text-[10px] font-bold uppercase">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. SUPER ADMIN NAVIGATION
  if (path.startsWith('/superadmin')) {
    const superNav = [
      { name: 'Regions', path: '/superadmin?tab=regions', icon: Globe },
      { name: 'Admins', path: '/superadmin?tab=admins', icon: Shield },
      { name: 'Analytics', path: '/superadmin?tab=analytics', icon: BarChart2 },
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-indigo-950/95 backdrop-blur-xl border-t border-white/10 px-10 py-3 pb-safe z-50">
        <div className="flex justify-between items-center text-white/60">
          {superNav.map((item) => {
            const isActive = (path + location.search) === item.path || (path === item.path && !location.search && item.name === 'Regions');
            const Icon = item.icon;
            return (
              <NavLink key={item.name} to={item.path} className={`flex flex-col items-center space-y-1 ${isActive ? 'text-white' : 'hover:text-white'}`}>
                <Icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. CITIZEN NAVIGATION (Default)
  const navItems = [
    { name: t('navHome'), path: '/dashboard', icon: Home },
    { name: t('navMap'), path: '/map', icon: Map },
    { name: t('navReport'), path: '/report', icon: PlusCircle, isMain: true },
    { name: t('navFeed') || 'Reports', path: '/feed', icon: Globe },
    { name: t('navProfile'), path: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface/90 backdrop-blur-xl border-t border-black/[0.06] px-6 py-3 pb-safe z-50">
      {/* Dancheong accent line at top of nav */}
      <div className="absolute top-0 left-6 right-6 dancheong-line" />
      <div className="flex justify-between items-center relative">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
          const Icon = item.icon;

          if (item.isMain) {
            return (
              <NavLink key={item.path} to={item.path} className="relative -top-6 flex flex-col items-center">
                <div className="bg-gradient-to-br from-primary to-teal text-white p-4 rounded-full shadow-[0_6px_24px_rgba(91,123,111,0.35)] transform transition-transform hover:scale-105 active:scale-95">
                  <Icon size={28} strokeWidth={2.5} />
                </div>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center space-y-1 transition-colors ${isActive ? 'text-primary' : 'text-textMuted hover:text-textMain'}`}
            >
              <Icon size={22} className={`${isActive ? 'drop-shadow-[0_0_6px_rgba(91,123,111,0.3)]' : ''}`} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

