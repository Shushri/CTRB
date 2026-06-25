import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Train, ShieldAlert, Key } from 'lucide-react';

const API_URL = 'http://localhost:5000/api/v1';

export default function Login() {
    const [personnelId, setPersonnelId] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Field validations
    const [touched, setTouched] = useState({ personnelId: false, pin: false });
    const navigate = useNavigate();

    const isPersonnelIdValid = personnelId.trim().length >= 4;
    const isPinValid = pin.trim().length >= 4;

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setTouched({ personnelId: true, pin: true });

        if (!isPersonnelIdValid || !isPinValid) {
            setError('Please enter valid credentials.');
            return;
        }

        setLoading(true);

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
            setError(err.response?.data?.error || 'Authentication failed. Please check credentials.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getInputClass = (field, isValid) => {
        const base = "w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border rounded-xl outline-none transition duration-200 font-semibold text-sm text-[#0F172A]";
        if (!touched[field]) {
            return `${base} border-[#E2E8F0] focus:border-[#002045] focus:ring-4 focus:ring-[#002045]/5`;
        }
        return isValid
            ? `${base} border-[#10B981] focus:border-[#10B981] focus:ring-4 focus:ring-[#10B981]/5`
            : `${base} border-[#EF4444] focus:border-[#EF4444] focus:ring-4 focus:ring-[#EF4444]/5`;
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFD]">
            {/* Left Column: Branding and SVG Bearing */}
            <div className="w-full md:w-1/2 bg-[#002045] text-white flex flex-col justify-between p-8 md:p-12 min-h-[300px] md:min-h-screen">
                {/* Brand Logo Header */}
                <div className="flex items-center gap-3">
                    <div className="bg-[#FFB55C] p-2.5 rounded-xl text-[#002045]">
                        <Train size={24} className="stroke-[2.5]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-wider">CTRB-TIMS</h1>
                        <span className="text-[10px] font-extrabold uppercase text-[#FFB55C] tracking-widest block mt-0.5">Indian Railways</span>
                    </div>
                </div>

                {/* SVG Illustration of a bearing */}
                <div className="my-8 md:my-0 flex flex-col items-center">
                    <svg className="w-48 h-48 md:w-64 md:h-64 text-[#FFB55C] opacity-90 animate-[spin_120s_linear_infinite]" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Outer ring */}
                        <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="8" strokeDasharray="3 3" className="opacity-40" />
                        <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="6" />
                        {/* Inner ring */}
                        <circle cx="100" cy="100" r="42" stroke="currentColor" strokeWidth="5" />
                        <circle cx="100" cy="100" r="32" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="opacity-50" />
                        {/* Rolling components (Tapered/Ball bearings) */}
                        <circle cx="100" cy="58" r="8" fill="currentColor" />
                        <circle cx="130" cy="70" r="8" fill="currentColor" />
                        <circle cx="142" cy="100" r="8" fill="currentColor" />
                        <circle cx="130" cy="130" r="8" fill="currentColor" />
                        <circle cx="100" cy="142" r="8" fill="currentColor" />
                        <circle cx="70" cy="130" r="8" fill="currentColor" />
                        <circle cx="58" cy="100" r="8" fill="currentColor" />
                        <circle cx="70" cy="70" r="8" fill="currentColor" />
                        {/* Center core */}
                        <circle cx="100" cy="100" r="12" fill="currentColor" className="opacity-80" />
                    </svg>
                    <p className="text-center font-medium text-xs md:text-sm text-slate-300 mt-6 max-w-sm">
                        Class K Tapered Roller Bearing Traceability & Quality Inspection Management Suite
                    </p>
                </div>

                {/* Footer terms */}
                <div className="text-[10px] text-slate-400 font-medium">
                    &copy; 2026 CTRB-TIMS. Secured and Authorized Personnel Use Only.
                </div>
            </div>

            {/* Right Column: Centered Login Form */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16">
                <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-[0_4px_24px_rgba(0,32,69,0.04)] border border-[#E2E8F0] space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-[#002045]">Personnel Login</h2>
                        <p className="text-sm font-medium text-[#64748B]">Sign in to verify alignments and record assemblies</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                            <ShieldAlert size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Personnel ID Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider block">Personnel ID</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
                                <input
                                    type="text"
                                    required
                                    className={getInputClass('personnelId', isPersonnelIdValid)}
                                    placeholder="e.g. OP-1001"
                                    value={personnelId}
                                    onChange={(e) => setPersonnelId(e.target.value)}
                                    onBlur={() => setTouched(t => ({ ...t, personnelId: true }))}
                                />
                            </div>
                        </div>

                        {/* PIN Number Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider block">PIN Number</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={18} />
                                <input
                                    type="password"
                                    required
                                    className={getInputClass('pin', isPinValid)}
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    onBlur={() => setTouched(t => ({ ...t, pin: true }))}
                                />
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#002045] hover:bg-[#002045]/90 text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-md active:scale-98 transition duration-200 cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                        >
                            {loading ? 'Authenticating...' : 'Login Securely'}
                        </button>
                    </form>

                    {/* Test Credentials Footer info */}
                    <div className="border-t border-[#E2E8F0] pt-5 mt-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-[#64748B]">
                            <Key size={14} className="text-[#FFB55C]" />
                            <span className="text-[10px] font-extrabold uppercase tracking-wider">Test Credentials</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#64748B] bg-slate-50/50 p-3 rounded-xl border border-[#E2E8F0]">
                            <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#64748B]/70">Operator</p>
                                <p className="font-mono text-[#0F172A] mt-0.5">OP-1001 / 1234</p>
                            </div>
                            <div>
                                <p className="text-[9px] uppercase tracking-wider text-[#64748B]/70">Inspector</p>
                                <p className="font-mono text-[#0F172A] mt-0.5">IN-2001 / 5678</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
