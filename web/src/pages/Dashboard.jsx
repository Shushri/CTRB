import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Activity, CheckCircle, XCircle, AlertTriangle, 
    TrendingUp, TrendingDown, Eye, RefreshCw, Inbox, AlertCircle
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const statusMeta = {
    received: { label: 'Received', color: '#3B82F6' },
    under_inspection: { label: 'Under Inspection', color: '#F59E0B' },
    assembly: { label: 'Assembly', color: '#FFB55C' },
    ready: { label: 'Ready (Accepted)', color: '#10B981' },
    rejected: { label: 'Rejected', color: '#EF4444' },
    hold: { label: 'Hold', color: '#F59E0B' },
    scrap: { label: 'Scrap', color: '#64748B' },
};

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    const fetchData = async () => {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            const [statsRes, analyticsRes, recentRes] = await Promise.all([
                axios.get(`${API_URL}/dashboard/summary`, { headers }),
                axios.get(`${API_URL}/analytics/summary`, { headers }),
                axios.get(`${API_URL}/ctrb/recent?limit=10`, { headers })
            ]);
            setStats(statsRes.data.data);
            setAnalytics(analyticsRes.data.data);
            setRecent(recentRes.data.data);
        } catch (err) {
            console.error('Failed to load dashboard data', err);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };
        init();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const getStatusBadge = (status) => {
        const configs = {
            received: { bg: 'bg-blue-50/70 border-blue-200 text-blue-700', label: 'Received' },
            under_inspection: { bg: 'bg-amber-50/70 border-amber-200 text-amber-700', label: 'Under Inspection' },
            assembly: { bg: 'bg-amber-50/70 border-amber-300 text-amber-800', label: 'Assembly' },
            ready: { bg: 'bg-emerald-50/70 border-emerald-200 text-emerald-700', label: 'Ready' },
            rejected: { bg: 'bg-rose-50/70 border-rose-200 text-rose-700', label: 'Rejected' },
            hold: { bg: 'bg-orange-50/70 border-orange-200 text-orange-700', label: 'Hold' },
            scrap: { bg: 'bg-slate-100 border-slate-300 text-slate-700', label: 'Scrap' }
        };
        const config = configs[status] || { bg: 'bg-slate-50 border-slate-200 text-slate-600', label: status };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${config.bg}`}>
                {config.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="p-8 space-y-8 animate-pulse bg-[#F8FAFD] flex-1 overflow-y-auto">
                <div className="flex justify-between items-center pb-6 border-b border-[#E2E8F0]">
                    <div className="space-y-2">
                        <div className="h-8 bg-slate-200 rounded w-48"></div>
                        <div className="h-4 bg-slate-200 rounded w-80"></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
                            <div className="h-4 bg-slate-200 rounded w-24"></div>
                            <div className="h-8 bg-slate-200 rounded w-16"></div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-80 bg-white rounded-2xl border border-[#E2E8F0] p-6"></div>
                    <div className="h-80 bg-white rounded-2xl border border-[#E2E8F0] p-6"></div>
                </div>
            </div>
        );
    }

    // Format Donut Data
    const donutData = Object.keys(statusMeta).map(statusKey => {
        const dbItem = analytics?.status_distribution?.find(item => item.status === statusKey);
        return {
            name: statusMeta[statusKey].label,
            value: dbItem ? parseInt(dbItem.count) : 0,
            color: statusMeta[statusKey].color,
        };
    }).filter(item => item.value > 0);

    const totalBearings = donutData.reduce((acc, curr) => acc + curr.value, 0);

    // Format Bar Data
    const barData = analytics?.rejection_by_component?.map(item => ({
        name: item.component.toUpperCase(),
        count: parseInt(item.count) || 0
    })) || [];

    return (
        <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto bg-[#F8FAFD]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 gap-4 border-b border-[#E2E8F0]">
                <div>
                    <h1 className="text-2xl font-black text-[#002045] flex items-center gap-2">
                        <LayoutDashboard className="text-[#FFB55C]" size={28} />
                        Workshop Dashboard
                    </h1>
                    <p className="text-sm font-medium text-[#64748B]">Real-time bearing tracking and quality assurance dashboard</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="self-start sm:self-center px-4 py-2 bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#0F172A] flex items-center gap-2 shadow-sm transition active:scale-95 duration-200 cursor-pointer min-h-[44px]"
                >
                    <RefreshCw size={16} className={`${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                </button>
            </div>

            {/* KPI Metrics Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Received */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E2E8F0] border-l-[5px] border-[#3B82F6] hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
                    <div className="flex flex-col justify-between h-full relative z-10">
                        <div>
                            <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Total Received</span>
                            <p className="text-3xl font-black text-[#0F172A] mt-2">{stats?.total_received || 0}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-4 text-xs font-bold text-[#10B981]">
                            <TrendingUp size={14} />
                            <span>+4% vs last week</span>
                        </div>
                    </div>
                    <Inbox className="absolute -bottom-4 -right-4 text-[#3B82F6] opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none" size={100} />
                </div>

                {/* Ready / Accepted */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E2E8F0] border-l-[5px] border-[#10B981] hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
                    <div className="flex flex-col justify-between h-full relative z-10">
                        <div>
                            <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Ready (Accepted)</span>
                            <p className="text-3xl font-black text-[#0F172A] mt-2">{stats?.total_accepted || 0}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-4 text-xs font-bold text-[#10B981]">
                            <TrendingUp size={14} />
                            <span>+8% vs last week</span>
                        </div>
                    </div>
                    <CheckCircle className="absolute -bottom-4 -right-4 text-[#10B981] opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none" size={100} />
                </div>

                {/* Rejected */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E2E8F0] border-l-[5px] border-[#EF4444] hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
                    <div className="flex flex-col justify-between h-full relative z-10">
                        <div>
                            <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Total Rejected</span>
                            <p className="text-3xl font-black text-[#0F172A] mt-2">{stats?.total_rejected || 0}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-4 text-xs font-bold text-[#EF4444]">
                            <TrendingDown size={14} />
                            <span>-2% vs last week</span>
                        </div>
                    </div>
                    <XCircle className="absolute -bottom-4 -right-4 text-[#EF4444] opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none" size={100} />
                </div>

                {/* In-Process */}
                <div className="relative overflow-hidden bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#E2E8F0] border-l-[5px] border-[#FFB55C] hover:-translate-y-1 hover:shadow-md transition-all duration-300 group">
                    <div className="flex flex-col justify-between h-full relative z-10">
                        <div>
                            <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">In-Process Jobs</span>
                            <p className="text-3xl font-black text-[#0F172A] mt-2">{stats?.open_jobs || 0}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-[#64748B]">
                            <span>Active in shop floor</span>
                        </div>
                    </div>
                    <AlertTriangle className="absolute -bottom-4 -right-4 text-[#FFB55C] opacity-[0.08] group-hover:opacity-[0.12] transition-opacity pointer-events-none" size={100} />
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Donut Chart: Status Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
                    <div className="border-b border-[#E2E8F0] pb-4 mb-4">
                        <h3 className="font-extrabold text-[#002045] flex items-center gap-2">
                            <Activity size={18} className="text-[#FFB55C]" /> Status Distribution
                        </h3>
                    </div>

                    {donutData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Inbox size={40} className="stroke-[1.5]" />
                            <p className="text-sm font-semibold">No distribution data available</p>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="relative w-full md:w-1/2 h-56 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {donutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [`${value} bearings`, 'Count']} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-[#002045]">{totalBearings}</span>
                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">Total</span>
                                </div>
                            </div>

                            {/* Custom Legend */}
                            <div className="w-full md:w-1/2 grid grid-cols-1 gap-2.5">
                                {donutData.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm border-b border-slate-50 pb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="font-semibold text-[#0F172A]">{item.name}</span>
                                        </div>
                                        <span className="font-bold text-[#64748B]">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bar Chart: Rejections by Component */}
                <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
                    <div className="border-b border-[#E2E8F0] pb-4 mb-4">
                        <h3 className="font-extrabold text-[#002045] flex items-center gap-2">
                            <AlertCircle size={18} className="text-[#EF4444]" /> Rejections by Component
                        </h3>
                    </div>

                    {barData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Inbox size={40} className="stroke-[1.5]" />
                            <p className="text-sm font-semibold">No rejection component records</p>
                        </div>
                    ) : (
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={barData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        tick={{ fill: '#0F172A', fontSize: 11, fontWeight: 'bold' }} 
                                        axisLine={false} 
                                        tickLine={false} 
                                    />
                                    <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                                    <Bar dataKey="count" fill="#EF4444" radius={[0, 6, 6, 0]} barSize={16}>
                                        <LabelList dataKey="count" position="right" style={{ fill: '#0F172A', fontWeight: '800', fontSize: 12 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Activity size={18} className="text-[#FFB55C]" />
                    <h3 className="font-extrabold text-[#002045]">Recent Bearing Activity</h3>
                </div>

                {recent.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Inbox size={48} className="stroke-[1.5]" />
                        <p className="font-semibold text-sm">No recent activity found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">CTRB Number</th>
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Job ID</th>
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Make</th>
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Date Received</th>
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                                {recent.map((record, index) => (
                                    <tr 
                                        key={record.id} 
                                        className={`hover:bg-slate-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/10'}`}
                                    >
                                        <td className="px-6 py-4 font-bold text-sm text-[#0F172A]">{record.ctrb_number}</td>
                                        <td className="px-6 py-4 font-mono text-xs text-[#64748B]">{record.job_id}</td>
                                        <td className="px-6 py-4 font-semibold text-sm text-[#0F172A] capitalize">{record.make}</td>
                                        <td className="px-6 py-4 text-sm text-[#64748B]">
                                            {new Date(record.date_received).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate(`/search?q=${record.ctrb_number}`)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:border-amber-300 hover:bg-[#FFB55C]/10 text-xs font-bold text-[#002045] rounded-lg transition duration-200 cursor-pointer min-h-[32px]"
                                            >
                                                <Eye size={12} />
                                                <span>View Full Record</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
