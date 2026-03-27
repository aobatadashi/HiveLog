import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { setupOnlineSync } from './lib/sync.js';
import OfflineBanner from './components/OfflineBanner.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import YardView from './pages/YardView.jsx';
import HiveView from './pages/HiveView.jsx';
import LogEvent from './pages/LogEvent.jsx';
import Settings from './pages/Settings.jsx';

function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return <div className="toast">{message}</div>;
}

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const cleanup = setupOnlineSync((count) => {
      setToast(`Synced ${count} pending ${count === 1 ? 'change' : 'changes'}`);
    });
    return cleanup;
  }, []);

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <HashRouter>
      <OfflineBanner />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <Routes>
        {user ? (
          <>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/yard/:id" element={<YardView user={user} />} />
            <Route path="/hive/:id" element={<HiveView user={user} />} />
            <Route path="/log/:colonyId" element={<LogEvent user={user} />} />
            <Route path="/settings" element={<Settings user={user} onSignOut={signOut} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="*" element={<Login />} />
          </>
        )}
      </Routes>
    </HashRouter>
  );
}
