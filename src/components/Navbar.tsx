'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { apiFetch, removeToken } from '@/lib/api';
import {
  Calendar,
  Trophy,
  History,
  LogOut,
  Menu,
  X,
  Users,
  Tv,
  BarChart3,
  Shield,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/jornada', label: 'Jornada', icon: Users },
  { href: '/matches', label: 'Partidos', icon: Calendar },
  { href: '/laliga', label: 'LaLiga', icon: Tv },
  { href: '/standings', label: 'Clasificacion', icon: Trophy },
  { href: '/stats', label: 'Estadisticas', icon: BarChart3 },
  { href: '/history', label: 'Historial', icon: History },
];

// Seccion personal, fuera de la competicion: solo la ve el administrador. Ocultar
// el enlace es cosmetico — quien protege de verdad es require_admin en el backend.
const adminNavItem = { href: '/castellon', label: 'Castellon', icon: Shield };

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Se consulta al backend en vez de leer localStorage: las sesiones abiertas
  // antes de este cambio guardaron un usuario sin el flag y nunca verian el
  // enlace hasta volver a entrar.
  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>('/api/auth/me')
      .then((me) => setIsAdmin(!!me.is_admin))
      .catch(() => setIsAdmin(false));
  }, []);

  const items = isAdmin ? [...navItems, adminNavItem] : navItems;

  const handleSignOut = () => {
    removeToken();
    router.push('/login');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/matches" className="flex items-center gap-2">
            <span className="text-2xl">&#9917;</span>
            <span className="font-bold text-xl text-white">BetSoccer</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ml-2"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {isOpen && (
        <div className="md:hidden border-t border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-base font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Salir
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
