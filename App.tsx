import React, { useState, useEffect } from 'react';
import { AttendanceTracker } from './components/AttendanceTracker';
import { AuthModal } from './components/AuthModal';
import { supabase } from './lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { FeeTracker } from './components/FeeTracker';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees'>('attendance');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          setShowAuthModal(false); // Close modal on successful login
          checkAdminRole(session.user.id);
        } else {
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (data && data.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans antialiased">
      <header className="absolute top-0 right-0 p-4">
        {session ? (
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-700 text-white rounded-md font-semibold hover:bg-slate-600 transition-colors"
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-500 transition-colors"
          >
            Login
          </button>
        )}
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 text-center pt-16">
          <h1 className="text-4xl font-bold tracking-tight text-slate-100 sm:text-5xl">
            Monthly Tracker
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            A simple interface to track member attendance and monthly fees for <b>ONDO</b> table tennis team.
          </p>
        </header>

        <div className="mb-6 border-b border-slate-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                onClick={() => setActiveTab('attendance')}
                className={`${
                    activeTab === 'attendance'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors focus:outline-none`}
                >
                Attendance
                </button>
                <button
                onClick={() => setActiveTab('fees')}
                className={`${
                    activeTab === 'fees'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors focus:outline-none`}
                >
                Membership Fees
                </button>
            </nav>
        </div>

        <div>
            {activeTab === 'attendance' && <AttendanceTracker isAdmin={isAdmin} />}
            {activeTab === 'fees' && <FeeTracker isAdmin={isAdmin} />}
        </div>

      </main>
      <footer className="text-center p-4 text-slate-500 text-sm mt-8">
        <p>Built by a World-Class Senior Frontend React Engineer.</p>
      </footer>
      <AuthModal show={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

export default App;