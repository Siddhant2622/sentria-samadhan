import { NavLink, useLocation } from 'react-router-dom';
import { memo } from 'react';
import { Home, PlusCircle, Map, User, Globe, Shield, Truck, BarChart2, Users } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/AuthContext';

function BottomNav() {
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const path = location.pathname;

  // Normalize role to lowercase for safe comparison regardless of backend casing
  const role = user?.role?.toLowerCase();

  // ─── Shared wrapper style for all roles ─────────────────────
  // Uses inline style to guarantee fixed positioning within the max-w-md shell.
  // `env(safe-area-inset-bottom)` handles iPhone home indicator spacing.
  const baseWrapperStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  };

  // ─────────────────────────────────────────────────────────────
  // 1. OFFICER NAVIGATION
  // ─────────────────────────────────────────────────────────────
  if (role === 'officer') {
    const officerNav = [
      { name: 'Tasks', path: '/officer', icon: Truck },
      { name: 'Map',   path: '/map',     icon: Map  },
      { name: 'Profile', path: '/profile', icon: User },
    ];

    return (
      <div style={{ ...baseWrapperStyle, background: 'rgba(13, 60, 55, 0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', padding: '10px 40px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {officerNav.map((item) => {
            const isActive = path === item.path;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  position: 'relative',
                  padding: '4px 12px',
                }}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28,
                    height: 3,
                    background: '#7BA8A0',
                    borderRadius: '0 0 4px 4px',
                  }} />
                )}
                <Icon
                  size={22}
                  style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(123,168,160,0.7))' } : {}}
                />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ADMIN NAVIGATION
  // ─────────────────────────────────────────────────────────────
  if (role === 'admin') {
    const adminNav = [
      { name: 'Cases',     path: '/admin', query: '?tab=board', icon: Shield   },
      { name: 'Users',     path: '/admin', query: '?tab=users', icon: Users    },
      { name: 'Analytics', path: '/admin', query: '?tab=sla',   icon: BarChart2 },
    ];

    return (
      <div style={{ ...baseWrapperStyle, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', padding: '10px 40px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {adminNav.map((item) => {
            const isActive = path === item.path && (
              location.search === item.query || (!location.search && item.name === 'Cases')
            );
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={`${item.path}${item.query}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  color: isActive ? '#fff' : 'rgba(148,163,184,0.8)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  position: 'relative',
                  padding: '4px 12px',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28,
                    height: 3,
                    background: '#6366f1',
                    borderRadius: '0 0 4px 4px',
                  }} />
                )}
                <Icon size={20} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. SUPER ADMIN NAVIGATION
  // ─────────────────────────────────────────────────────────────
  if (role === 'superadmin') {
    const superNav = [
      { name: 'Regions',   path: '/superadmin', query: '?tab=regions',   icon: Globe    },
      { name: 'Admins',    path: '/superadmin', query: '?tab=admins',    icon: Shield   },
      { name: 'Analytics', path: '/superadmin', query: '?tab=analytics', icon: BarChart2 },
    ];

    return (
      <div style={{ ...baseWrapperStyle, background: 'rgba(30, 27, 75, 0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto', padding: '10px 40px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {superNav.map((item) => {
            const isActive = path === item.path && (
              location.search === item.query || (!location.search && item.name === 'Regions')
            );
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={`${item.path}${item.query}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  color: isActive ? '#fff' : 'rgba(165,180,252,0.6)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                  position: 'relative',
                  padding: '4px 12px',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28,
                    height: 3,
                    background: '#818cf8',
                    borderRadius: '0 0 4px 4px',
                  }} />
                )}
                <Icon
                  size={22}
                  style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(129,140,248,0.6))' } : {}}
                />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CITIZEN NAVIGATION (Default — shown for 'citizen' role or null)
  // ─────────────────────────────────────────────────────────────
  const navItems = [
    { name: t('navHome'),              path: '/dashboard', icon: Home      },
    { name: t('navMap'),               path: '/map',       icon: Map       },
    { name: t('navReport'),            path: '/report',    icon: PlusCircle, isMain: true },
    { name: t('navFeed') || 'Reports', path: '/feed',      icon: Globe     },
    { name: t('navProfile'),           path: '/profile',   icon: User      },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface/90 backdrop-blur-xl border-t border-black/[0.06] px-6 py-3 z-50" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
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

export default memo(BottomNav);
