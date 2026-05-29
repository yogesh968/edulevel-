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
        <div className="app-loading">
            <div className="spinner" />
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                    <span className="brand-mark">
                        <BookOpen size={24} />
                    </span>
                    <h1>Lemon Tea Studio</h1>
                </div>
                <div className="user-menu">
                    {user.avatar
                        ? <img src={user.avatar} alt={user.name} className="user-avatar" />
                        : <div className="user-avatar user-avatar-fallback"><User size={16} /></div>
                    }
                    <span className="user-name">{user.name}</span>
                    <button onClick={logout} title="Sign out" className="sign-out-btn">
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
