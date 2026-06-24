import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, CheckCircle, XCircle, AlertTriangle, LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api/v1';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await axios.get(`${API_URL}/dashboard/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data.data);
            } catch (err) {
                console.error('Failed to load dashboard', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    const logout = () => {
        localStorage.clear();
        navigate('/login');
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading dashboard...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-blue-900 text-white p-4 shadow-md flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <Activity size={24} />
                    <h1 className="text-xl font-bold tracking-wider">CTRB-TIMS Admin</h1>
                </div>
                <div className="flex items-center space-x-6">
                    <button className="flex items-center space-x-1 hover:text-blue-200 transition">
                        <Search size={18} />
                        <span>Search</span>
                    </button>
                    <button onClick={logout} className="flex items-center space-x-1 hover:text-red-300 transition">
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-8">
                <h2 className="text-3xl font-extrabold text-slate-800 mb-8">Workshop Dashboard</h2>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center justify-between border-l-4 border-slate-400">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Received</p>
                            <p className="text-3xl font-bold text-slate-800">{stats?.total_received || 0}</p>
                        </div>
                        <Activity className="text-slate-300" size={32} />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center justify-between border-l-4 border-green-500">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Accepted (Ready)</p>
                            <p className="text-3xl font-bold text-slate-800">{stats?.total_accepted || 0}</p>
                        </div>
                        <CheckCircle className="text-green-500/20" size={32} />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center justify-between border-l-4 border-red-500">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Rejected</p>
                            <p className="text-3xl font-bold text-slate-800">{stats?.total_rejected || 0}</p>
                        </div>
                        <XCircle className="text-red-500/20" size={32} />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center justify-between border-l-4 border-orange-400">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Currently In-Process</p>
                            <p className="text-3xl font-bold text-slate-800">{stats?.open_jobs || 0}</p>
                        </div>
                        <AlertTriangle className="text-orange-400/20" size={32} />
                    </div>
                </div>

                {/* Additional views like charts would go here */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Analytics Overview</h3>
                    <div className="h-64 flex items-center justify-center bg-slate-50 rounded border border-dashed border-slate-300">
                        <p className="text-slate-400 font-medium cursor-not-allowed">Chart modules placeholder for Donut & Bar Charts</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
