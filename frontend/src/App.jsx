import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Upload from './components/Upload';
import ChatUI from './components/ChatUI';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import { BookOpen, LogOut, User } from 'lucide-react';

function ProtectedApp() {
    const { user, loading, logout } = useAuth();
    const [topicId, setTopicId] = useState(() => localStorage.getItem('topicId'));
    const [pdfName, setPdfName] = useState(() => localStorage.getItem('pdfName') || '');

    useEffect(() => {
        if (topicId) {
            localStorage.setItem('topicId', topicId);
            localStorage.setItem('pdfName', pdfName);
        } else {
            localStorage.removeItem('topicId');
            localStorage.removeItem('pdfName');
        }
    }, [topicId, pdfName]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div className="spinner" />
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                    <BookOpen size={28} className="icon-pulse" />
                    <h1>Lemon Tea Studio</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {user.avatar
                        ? <img src={user.avatar} alt={user.name} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} />
                        : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color="white" /></div>
                    }
                    <span style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{user.name}</span>
                    <button onClick={logout} title="Sign out" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'white', fontSize: '0.85rem' }}>
                        <LogOut size={15} /> Sign out
                    </button>
                </div>
            </header>

            <main className="main-content">
                {!topicId ? (
                    <Upload setTopicId={setTopicId} setPdfName={setPdfName} />
                ) : (
                    <ChatUI topicId={topicId} pdfName={pdfName} onBack={() => { setTopicId(null); setPdfName(''); }} />
                )}
            </main>

            <div className="background-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/*" element={<ProtectedApp />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
