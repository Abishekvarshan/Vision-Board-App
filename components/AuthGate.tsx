import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  getRedirectResult,
  User,
} from 'firebase/auth';
import { Layout, Menu, Moon, Sun, User as UserIcon, LogOut } from 'lucide-react';
import { auth } from '../src/firebase';
import { enableDailyReminderPush } from '../src/push';

type Props = {
  children: (user: User) => React.ReactNode;
};

export const AuthGate: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushTokenPreview, setPushTokenPreview] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('theme');
      return stored === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    try {
      localStorage.setItem('theme', t);
    } catch {
      // ignore
    }
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const toggleTheme = () => applyTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in failed', err);
      setError(err?.message ?? 'Sign-in failed');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Initialize theme on mount based on current <html> class (bootstrapped in index.html)
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuOpen) return;
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleGoogleSignIn = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error('Google sign-in failed', err);
      setError(err?.message ?? 'Google sign-in failed');
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Sign out failed', err);
      setError(err?.message ?? 'Sign out failed');
    }
  };

  const onEnablePush = async () => {
    if (!user) return;
    setPushError(null);
    setPushTokenPreview(null);
    setPushBusy(true);
    try {
      const { token } = await enableDailyReminderPush(user.uid);
      setPushTokenPreview(token);
      setPushEnabled(true);
    } catch (e: any) {
      console.error('Enable push failed', e);
      setPushError(e?.message ?? 'Failed to enable push notifications');
    } finally {
      setPushBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400 font-medium">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
            <Layout className="w-6 h-6" /> VisionFlow
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Sign in with Google to sync your streak and progress.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            className="mt-6 w-full px-4 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Continue with Google
          </button>

          <div className="mt-6 text-xs text-slate-400 leading-relaxed">
            If you see <b>“Missing or insufficient permissions”</b>, update your Firestore rules.
            A template is included in <code>firestore.rules</code>.
          </div>

          <button
            onClick={toggleTheme}
            className="mt-6 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-[55] bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-bold text-indigo-600 flex items-center gap-2">
            <Layout className="w-5 h-5" /> VisionFlow
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-[56] mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
                <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-indigo-700 dark:text-indigo-200" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">Profile</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email ?? user.uid}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    toggleTheme();
                    setMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>

                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onEnablePush();
                  }}
                  disabled={pushBusy || pushEnabled}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-2 disabled:opacity-60"
                  title="Enable daily reminder notifications (requires permission)"
                >
                  <span className="inline-flex items-center justify-center w-5">🔔</span>
                  {pushEnabled ? 'Daily reminders enabled' : pushBusy ? 'Enabling reminders…' : 'Enable daily reminders'}
                </button>

                {/* {pushError && (
                  <div className="px-4 pb-3 text-xs text-red-600 dark:text-red-400">
                    {pushError}
                  </div>
                )}

                {pushTokenPreview && (
                  <div className="px-4 pb-3 text-[11px] text-slate-600 dark:text-slate-300 break-all">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">FCM token</div>
                    <div className="mt-1">{pushTokenPreview}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      Saved to Firestore at <code>users/{user.uid}/pushTokens/*</code>
                    </div>
                  </div>
                )} */}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {children(user)}
    </>
  );
};
