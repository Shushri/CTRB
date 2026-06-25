import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Train, LayoutDashboard, Search, BarChart2, Settings, LogOut, User } from 'lucide-react';

export default function SidebarLayout({ children, activeTab }) {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const logout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { id: 'search', label: 'Traceability Search', icon: Search, path: '/search' },
        { id: 'analytics', label: 'Analytics', icon: BarChart2, path: '/dashboard', disabled: true },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/dashboard', disabled: true }
    ];

    return (
        <div className="flex min-h-screen bg-[#F8FAFD]">
            {/* Sidebar */}
            <aside className="w-20 md:w-60 bg-[#002045] text-white flex flex-col justify-between transition-all duration-300 border-r border-[#E2E8F0]/10 shrink-0">
                <div>
                    {/* Logo Area */}
                    <div className="h-16 flex items-center justify-center md:justify-start px-4 md:px-6 border-b border-[#E2E8F0]/10 gap-3">
                        <div className="bg-[#FFB55C] p-2 rounded-lg text-[#002045]">
                            <Train size={20} className="stroke-[2.5]" />
                        </div>
                        <span className="hidden md:inline font-black text-lg tracking-wider bg-gradient-to-r from-white via-white to-amber-300 bg-clip-text text-transparent">
                            CTRB-TIMS
                        </span>
                    </div>

                    {/* Navigation */}
                    <nav className="mt-6 px-2 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => !item.disabled && navigate(item.path)}
                                    disabled={item.disabled}
                                    className={`w-full flex items-center justify-center md:justify-start px-4 py-3 rounded-lg font-semibold transition-all group relative ${
                                        isActive
                                            ? 'bg-white/10 text-[#FFB55C] border-l-4 border-[#FFB55C]'
                                            : item.disabled
                                            ? 'text-white/40 cursor-not-allowed'
                                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <Icon size={20} className={`shrink-0 ${isActive ? 'text-[#FFB55C]' : 'text-white/60 group-hover:text-white'}`} />
                                    <span className="hidden md:inline ml-3 text-sm">{item.label}</span>
                                    {item.disabled && (
                                        <span className="hidden md:inline-block ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
                                            Soon
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer User Info */}
                <div className="p-2 md:p-4 border-t border-[#E2E8F0]/10 space-y-3">
                    {user && (
                        <div className="hidden md:flex items-center gap-3 px-2 py-1.5 rounded-lg bg-white/5">
                            <div className="bg-white/10 p-2 rounded-full text-amber-300">
                                <User size={18} />
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm text-white truncate">{user.name}</p>
                                <span className="inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-amber-400/20 text-[#FFB55C] rounded-full mt-0.5">
                                    {user.role}
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center md:justify-start px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors font-semibold gap-3"
                    >
                        <LogOut size={20} className="shrink-0" />
                        <span className="hidden md:inline text-sm">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {children}
            </main>
        </div>
    );
}
