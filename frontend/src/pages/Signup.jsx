import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export default function Signup() {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) return setError('Passwords do not match');
        if (form.password.length < 6) return setError('Password must be at least 6 characters');
        setLoading(true);
        try {
            const res = await axios.post(`${API}/auth/signup`, {
                name: form.name, email: form.email, password: form.password
            });
            login(res.data.token, res.data.user);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed');
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
                <h2 className="auth-title">Create account</h2>
                <p className="auth-subtitle">Start your AI learning journey</p>

                {error && (
                    <div className="auth-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <User size={16} className="field-icon" />
                        <input
                            type="text"
                            placeholder="Full name"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
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
                            placeholder="Password (min 6 chars)"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            required
                        />
                        <button type="button" className="toggle-pass" onClick={() => setShowPass(p => !p)}>
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <div className="auth-field">
                        <Lock size={16} className="field-icon" />
                        <input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Confirm password"
                            value={form.confirm}
                            onChange={e => setForm({ ...form, confirm: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn primary" disabled={loading}>
                        {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-divider"><span>or</span></div>

                <a href={`${API}/auth/google`} className="auth-btn google">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} />
                    Continue with Google
                </a>

                <p className="auth-switch">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
            <div className="auth-bg" />
        </div>
    );
}
