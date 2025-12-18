'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'magic' | 'reset'>('login');
  const router = useRouter();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const supabase = createClient();

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      setLoading(false);

      if (error) {
        setError(error.message);
      } else {
        setMessage('Cuenta creada. Revisa tu email para confirmar.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message);
      } else {
        router.push('/matches');
        router.refresh();
      }
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Revisa tu email para el enlace de acceso');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage('Revisa tu email para restablecer tu contraseña');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl">⚽</span>
          <h1 className="text-3xl font-bold mt-4">BetSoccer</h1>
          <p className="text-gray-400 mt-2">
            Pronostica con tus amigos los partidos del Madrid y Barça
          </p>
        </div>

        {/* Login form */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          {/* Mode tabs */}
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Registrarse
            </button>
            <button
              onClick={() => setMode('magic')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'magic'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
          </div>

          <form onSubmit={mode === 'magic' ? handleMagicLink : mode === 'reset' ? handleResetPassword : handlePasswordLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {(mode === 'login' || mode === 'register') && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'magic' || mode === 'reset' ? 'Enviando...' : mode === 'register' ? 'Registrando...' : 'Entrando...'}
                </>
              ) : (
                mode === 'magic' ? 'Enviar enlace mágico' : mode === 'reset' ? 'Enviar email de recuperación' : mode === 'register' ? 'Crear cuenta' : 'Entrar'
              )}
            </button>
          </form>

          {message && (
            <p className="mt-4 text-center text-green-400 text-sm">{message}</p>
          )}

          {error && (
            <p className="mt-4 text-center text-red-400 text-sm">{error}</p>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setMode('reset')}
              className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Volver a iniciar sesión
            </button>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Solo para el grupo de amigos. Si no tienes acceso, contacta al admin.
        </p>
      </div>
    </div>
  );
}
