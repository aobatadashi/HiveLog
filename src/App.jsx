import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { setupOnlineSync } from './lib/sync.js';
import OfflineBanner from './components/OfflineBanner.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import YardView from './pages/YardView.jsx';
import HiveView from './pages/HiveView.jsx';
import LogEvent from './pages/LogEvent.jsx';
import Settings from './pages/Settings.jsx';
import WalkYard from './pages/WalkYard.jsx';
import LogYardEvent from './pages/LogYardEvent.jsx';
import ConsultantDashboard from './pages/ConsultantDashboard.jsx';
import ConsultantClientView from './pages/ConsultantClientView.jsx';
import ConsultantSchedule from './pages/ConsultantSchedule.jsx';

function Toast({ message, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return <div className="toast">{message}</div>;
}

function AppRoutes({ user, signOut, handleToast, toast, setToast, consumeSignInRedirect, isConsultant, consultantId }) {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (user && consumeSignInRedirect()) {
      navigate(isConsultant ? '/consultant' : '/', { replace: true });
    }
  }, [user, consumeSignInRedirect, navigate, isConsultant]);

  return (
    <>
      <OfflineBanner />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      <Routes>
        {user ? (
          <>
            <Route path="/" element={<Home user={user} isConsultant={isConsultant} />} />
            <Route path="/yard/:id" element={<YardView user={user} />} />
            <Route path="/hive/:id" element={<HiveView user={user} />} />
            <Route path="/log/:colonyId" element={<LogEvent user={user} onToast={handleToast} />} />
            <Route path="/log-yard/:yardId" element={<LogEvent user={user} onToast={handleToast} />} />
            <Route path="/yard-log/:yardId" element={<LogYardEvent user={user} onToast={handleToast} />} />
            <Route path="/walk/:yardId" element={<WalkYard user={user} onToast={handleToast} />} />
            <Route path="/settings" element={<Settings user={user} onSignOut={signOut} />} />
            {isConsultant && (
              <>
                <Route path="/consultant" element={
                  <ConsultantDashboard
                    user={user}
                    consultantId={consultantId}
                    onSwitchToApp={() => navigate('/')}
                  />
                } />
                <Route path="/consultant/client/:beekeeperId" element={
                  <ConsultantClientView user={user} consultantId={consultantId} />
                } />
                <Route path="/consultant/schedule" element={
                  <ConsultantSchedule user={user} consultantId={consultantId} onToast={handleToast} />
                } />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="*" element={<Login />} />
          </>
        )}
      </Routes>
    </>
  );
}

export default function App() {
  const { user, loading, signOut, consumeSignInRedirect, isConsultant, consultantId } = useAuth();
  const [toast, setToast] = useState(null);

  const handleToast = useCallback((msg) => setToast(msg), []);

  useEffect(() => {
    const showSyncToast = (count) => {
      setToast(`Synced ${count} pending ${count === 1 ? 'change' : 'changes'}`);
    };

    const showSyncError = (failed) => {
      const count = failed.length;
      setToast(`${count} ${count === 1 ? 'change' : 'changes'} failed to sync — review in Settings`);
    };

    const cleanup = setupOnlineSync(showSyncToast, showSyncError);

    return () => {
      cleanup();
    };
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
      <AppRoutes
        user={user}
        signOut={signOut}
        handleToast={handleToast}
        toast={toast}
        setToast={setToast}
        consumeSignInRedirect={consumeSignInRedirect}
        isConsultant={isConsultant}
        consultantId={consultantId}
      />
    </HashRouter>
  );
}
