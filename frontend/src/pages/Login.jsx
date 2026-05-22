import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export default function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const googleError = params.get('error');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${API}/auth/login`, form);
            login(res.data.token, res.data.user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <BookOpen size={32} />
                    <h1>Lumina Tutor</h1>
                </div>
                <h2 className="auth-title">Welcome back</h2>
                <p className="auth-subtitle">Sign in to continue learning</p>

                {(error || googleError) && (
                    <div className="auth-error">
                        <AlertCircle size={16} />
                        <span>{error || `Google sign-in failed: ${googleError}`}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <Mail size={16} className="field-icon" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>
                    <div className="auth-field">
                        <Lock size={16} className="field-icon" />
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            required
                        />
                        <button type="button" className="toggle-pass" onClick={() => setShowPass(p => !p)}>
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <button type="submit" className="auth-btn primary" disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div className="auth-divider"><span>or</span></div>

                <a href={`${API}/auth/google`} className="auth-btn google">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} />
                    Continue with Google
                </a>

                <p className="auth-switch">
                    Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
            <div className="auth-bg" />
        </div>
    );
}
