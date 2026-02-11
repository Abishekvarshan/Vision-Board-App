import React, { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  getRedirectResult,
  User,
} from 'firebase/auth';
import { Layout } from 'lucide-react';
import { auth } from '../src/firebase';

type Props = {
  children: (user: User) => React.ReactNode;
};

export const AuthGate: React.FC<Props> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 font-medium">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
            <Layout className="w-6 h-6" /> VisionFlow
          </h1>
          <p className="text-slate-600 mt-2">
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
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Signed in as <span className="font-semibold text-slate-900">{user.email ?? user.uid}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="px-3 py-2 rounded-xl bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition"
          >
            Sign out
          </button>
        </div>
      </div>
      {children(user)}
    </>
  );
};
