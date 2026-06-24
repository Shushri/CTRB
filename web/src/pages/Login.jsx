import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Ideally from env
const API_URL = 'http://localhost:5000/api/v1';

export default function Login() {
    const [personnelId, setPersonnelId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post(`${API_URL}/auth/login`, {
                personnel_id: personnelId,
                pin
            });

            if (response.data.data.token) {
                localStorage.setItem('token', response.data.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.data.user));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to login');
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">CTRB-TIMS</h1>
                    <p className="text-slate-500 mt-2">Sign in to access the platform</p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-center font-medium">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Personnel ID</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-shadow"
                            placeholder="e.g. OP-1049"
                            value={personnelId}
                            onChange={(e) => setPersonnelId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PIN Number</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-shadow"
                            placeholder="****"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                        Login Securely
                    </button>
                </form>
            </div>
        </div>
    );
}
