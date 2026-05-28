import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export function AuthProvider({ children }) {
    // TODO: Replace with real auth when integrating later
    const [user, setUser] = useState({ name: 'Guest', avatar: null });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Auth integration placeholder — re-enable token check when ready
        // const token = localStorage.getItem('token');
        // if (token) {
        //     axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        //         .then(res => setUser(res.data.user))
        //         .catch(() => localStorage.removeItem('token'))
        //         .finally(() => setLoading(false));
        // } else {
        //     setLoading(false);
        // }
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('topicId');
        localStorage.removeItem('pdfName');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
