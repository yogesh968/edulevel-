import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen } from 'lucide-react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export default function AuthCallback() {
    const [params] = useSearchParams();
    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const token = params.get('token');
        if (!token) return navigate('/login?error=no_token');

        axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                login(token, res.data.user);
                navigate('/');
            })
            .catch(() => navigate('/login?error=invalid_token'));
    }, []);

    return (
        <div className="auth-page">
            <div className="auth-card" style={{ textAlign: 'center', gap: '1rem' }}>
                <div className="auth-logo">
                    <BookOpen size={32} />
                    <h1>Lumina Tutor</h1>
                </div>
                <div className="spinner" style={{ margin: '1rem auto' }} />
                <p style={{ color: '#718096' }}>Signing you in with Google…</p>
            </div>
        </div>
    );
}
