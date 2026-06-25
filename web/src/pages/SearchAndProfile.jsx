import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    Search as SearchIcon, ArrowLeft, FileText, CheckCircle, 
    Settings, Camera, Wrench, ShieldAlert, Check, X, Calendar, User, Eye, Info
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api/v1';

export default function SearchAndProfile() {
    const [searchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [ctrbData, setCtrbData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [photoUrls, setPhotoUrls] = useState({});
    const [lightboxImg, setLightboxImg] = useState(null);
    const navigate = useNavigate();

    const performSearch = async (searchQuery) => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setError('');
        setCtrbData(null);
        setPhotoUrls({});

        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Search brief record
            const res = await axios.get(`${API_URL}/ctrb/search?q=${searchQuery}`, { headers });

            if (res.data.data.length > 0) {
                const ctrbBrief = res.data.data[0];
                
                // 2. Fetch full profile by ID
                const fullRes = await axios.get(`${API_URL}/ctrb/${ctrbBrief.id}`, { headers });
                const fullData = fullRes.data.data;
                setCtrbData(fullData);

                // 3. Extract and fetch photos
                const photosToFetch = [];
                if (fullData.cycles && fullData.cycles.length > 0) {
                    const latestCycle = fullData.cycles[fullData.cycles.length - 1];
                    if (latestCycle.visual_inspections) {
                        latestCycle.visual_inspections.forEach(vis => {
                            if (vis.photos && vis.photos.length > 0) {
                                vis.photos.forEach(key => {
                                    photosToFetch.push(key);
                                });
                            }
                        });
                    }
                }

                if (photosToFetch.length > 0) {
                    fetchPhotoUrls(photosToFetch, headers);
                }
            } else {
                setError('No CTRB found matching this criteria.');
            }
        } catch (err) {
            console.error(err);
            setError('Search failed. Please verify connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchPhotoUrls = async (keys, headers) => {
        const urls = {};
        await Promise.all(
            keys.map(async (key) => {
                try {
                    const encodedKey = encodeURIComponent(key);
                    const res = await axios.get(`${API_URL}/photos/${encodedKey}`, { headers });
                    urls[key] = res.data.signed_url;
                } catch (err) {
                    console.error(`Failed to fetch photo URL for ${key}`, err);
                }
            })
        );
        setPhotoUrls(urls);
    };

    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            performSearch(q);
        }
    }, [searchParams]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        performSearch(query);
    };

    const getStatusBadge = (status) => {
        const configs = {
            received: { bg: 'bg-blue-50/75 border-blue-200 text-blue-700', label: 'Received' },
            under_inspection: { bg: 'bg-amber-50/75 border-amber-200 text-amber-700', label: 'Under Inspection' },
            assembly: { bg: 'bg-amber-50/75 border-amber-300 text-amber-800', label: 'Assembly' },
            ready: { bg: 'bg-emerald-50/75 border-emerald-200 text-emerald-700', label: 'Ready' },
            rejected: { bg: 'bg-rose-50/75 border-rose-200 text-rose-700', label: 'Rejected' },
            hold: { bg: 'bg-orange-50/75 border-orange-200 text-orange-700', label: 'Hold' },
            scrap: { bg: 'bg-slate-100 border-slate-300 text-slate-700', label: 'Scrap' }
        };
        const config = configs[status] || { bg: 'bg-slate-50 border-slate-200 text-slate-600', label: status };
        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${config.bg}`}>
                {config.label}
            </span>
        );
    };

    // Extract Latest Cycle data for the timeline
    const latestCycle = ctrbData?.cycles && ctrbData.cycles.length > 0 
        ? ctrbData.cycles[ctrbData.cycles.length - 1] 
        : null;

    const dimInspections = latestCycle?.dimensional_inspections || [];
    const visInspections = latestCycle?.visual_inspections || [];
    const replacements = latestCycle?.replacements || [];
    const assembly = ctrbData?.assembly || null;

    return (
        <div className="p-6 md:p-8 space-y-8 flex-1 overflow-y-auto bg-[#F8FAFD]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 gap-4 border-b border-[#E2E8F0]">
                <div>
                    <h1 className="text-2xl font-black text-[#002045] flex items-center gap-2">
                        <SearchIcon className="text-[#FFB55C]" size={28} />
                        Traceability Profile
                    </h1>
                    <p className="text-sm font-medium text-[#64748B]">Locate and inspect history for any registered CTRB unit</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="self-start sm:self-center px-4 py-2 bg-white hover:bg-slate-50 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#002045] flex items-center gap-2 shadow-sm transition active:scale-95 duration-200 cursor-pointer min-h-[44px]"
                >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                </button>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={20} />
                    <input
                        type="text"
                        placeholder="Enter CTRB Number (e.g. D-03-22-211523) or Job ID..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-[#E2E8F0] focus:border-[#FFB55C] rounded-xl outline-none transition focus:ring-2 focus:ring-[#FFB55C]/20 text-sm font-semibold text-[#0F172A]"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-[#002045] hover:bg-[#002045]/90 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md transition active:scale-95 duration-200 cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
                >
                    {loading ? 'Locating Record...' : 'Locate Record'}
                </button>
            </form>

            {error && (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-sm font-semibold text-rose-700 flex items-center gap-2">
                    <ShieldAlert size={18} />
                    <span>{error}</span>
                </div>
            )}

            {loading && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 space-y-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] animate-pulse">
                    <div className="h-16 bg-slate-100 rounded-xl"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="h-12 bg-slate-100 rounded-xl"></div>
                        <div className="h-12 bg-slate-100 rounded-xl"></div>
                        <div className="h-12 bg-slate-100 rounded-xl"></div>
                    </div>
                    <div className="h-96 bg-slate-50 rounded-xl"></div>
                </div>
            )}

            {/* Profile Content */}
            {ctrbData && !loading && (
                <div className="space-y-8">
                    {/* Wide Summary Card */}
                    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-t-[5px] border-[#FFB55C] overflow-hidden">
                        {/* Profile Header */}
                        <div className="p-6 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <span className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">CTRB Serial Number</span>
                                <h2 className="text-2xl font-black text-[#002045] mt-1">{ctrbData.ctrb_number}</h2>
                                <p className="text-xs font-mono font-bold text-[#64748B] mt-1">JOB ID: {ctrbData.job_id}</p>
                            </div>
                            <div>
                                {getStatusBadge(ctrbData.status)}
                            </div>
                        </div>

                        {/* Three Info Columns */}
                        <div className="p-6 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-[#E2E8F0]">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2.5 rounded-xl border border-[#E2E8F0] text-[#002045]">
                                    <Wrench size={18} />
                                </div>
                                <div>
                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">CTRB Manufacturer</span>
                                    <span className="text-sm font-bold text-[#0F172A] capitalize">{ctrbData.make}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2.5 rounded-xl border border-[#E2E8F0] text-[#002045]">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Date Received</span>
                                    <span className="text-sm font-bold text-[#0F172A]">
                                        {new Date(ctrbData.date_received).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2.5 rounded-xl border border-[#E2E8F0] text-[#002045]">
                                    <User size={18} />
                                </div>
                                <div>
                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Source Depot / Shop</span>
                                    <span className="text-sm font-bold text-[#0F172A] capitalize">
                                        {ctrbData.source?.replace(/_/g, ' ') || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Chronological Timeline Container */}
                        <div className="p-6 md:p-8">
                            <h3 className="font-extrabold text-sm text-[#002045] uppercase tracking-wider mb-8 flex items-center gap-2">
                                <FileText size={16} className="text-[#FFB55C]" /> Traceability History Timeline
                            </h3>

                            <div className="relative border-l-[3px] border-[#E2E8F0] ml-4 pl-8 pb-4 space-y-12">
                                
                                {/* NODE 1: INTAKE */}
                                <div className="relative">
                                    {/* Circle Icon */}
                                    <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-[#3B82F6] bg-white text-[#3B82F6] flex items-center justify-center shadow-sm">
                                        <Calendar size={14} className="stroke-[2.5]" />
                                    </div>
                                    {/* Node Card */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-base text-[#0F172A]">Intake & Registration</h4>
                                            <span className="px-2 py-0.5 text-[10px] font-extrabold text-[#3B82F6] bg-blue-50 border border-blue-200 rounded uppercase">Complete</span>
                                        </div>
                                        <p className="text-sm text-[#64748B]">
                                            Bearing received from <span className="font-bold text-[#0F172A] capitalize">{ctrbData.source?.replace(/_/g, ' ')}</span> on{' '}
                                            <span className="font-semibold text-[#0F172A]">
                                                {new Date(ctrbData.date_received).toLocaleDateString()}
                                            </span>.
                                        </p>
                                    </div>
                                </div>

                                {/* NODE 2: DIMENSIONAL INSPECTION */}
                                <div className="relative">
                                    {/* Circle Icon */}
                                    {dimInspections.length > 0 ? (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-[#10B981] bg-white text-[#10B981] flex items-center justify-center shadow-sm">
                                            <CheckCircle size={14} className="stroke-[2.5]" />
                                        </div>
                                    ) : (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        </div>
                                    )}

                                    {/* Node Content */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-base ${dimInspections.length > 0 ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                                                Dimensional Inspection
                                            </h4>
                                            {dimInspections.length > 0 ? (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-[#10B981] bg-emerald-50 border border-emerald-200 rounded uppercase">Complete</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 rounded uppercase">Pending</span>
                                            )}
                                        </div>

                                        {dimInspections.length > 0 ? (
                                            <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl bg-white shadow-sm max-w-3xl">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                                                            <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Component</th>
                                                            <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Parameter</th>
                                                            <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Measured</th>
                                                            <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Limits (Min-Max)</th>
                                                            <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider text-center">Result</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[#E2E8F0]">
                                                        {dimInspections.map((row) => {
                                                            const isPass = row.result === 'pass';
                                                            return (
                                                                <tr key={row.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-4 py-2 font-bold text-[#0F172A] capitalize">{row.component}</td>
                                                                    <td className="px-4 py-2 font-medium text-[#64748B] capitalize">{row.parameter.replace(/_/g, ' ')}</td>
                                                                    <td className="px-4 py-2 font-bold text-[#0F172A]">{row.measured_value} mm</td>
                                                                    <td className="px-4 py-2 text-[#64748B] font-mono">{row.min_limit} - {row.max_limit} mm</td>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <span className={`inline-block px-1.5 py-0.5 font-bold rounded uppercase text-[9px] ${
                                                                            isPass ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-[#EF4444]'
                                                                        }`}>
                                                                            {row.result}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No dimensional inspection data available yet.</p>
                                        )}
                                    </div>
                                </div>

                                {/* NODE 3: VISUAL INSPECTION */}
                                <div className="relative">
                                    {/* Circle Icon */}
                                    {visInspections.length > 0 ? (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-[#10B981] bg-white text-[#10B981] flex items-center justify-center shadow-sm">
                                            <CheckCircle size={14} className="stroke-[2.5]" />
                                        </div>
                                    ) : (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        </div>
                                    )}

                                    {/* Node Content */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-base ${visInspections.length > 0 ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                                                Visual Inspection
                                            </h4>
                                            {visInspections.length > 0 ? (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-[#10B981] bg-emerald-50 border border-emerald-200 rounded uppercase">Complete</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 rounded uppercase">Pending</span>
                                            )}
                                        </div>

                                        {visInspections.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                                                {visInspections.map((vis) => {
                                                    const isPass = vis.overall_result === 'pass';
                                                    return (
                                                        <div key={vis.id} className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-sm space-y-2.5">
                                                            <div className="flex justify-between items-center">
                                                                <h5 className="font-extrabold text-sm text-[#0F172A] capitalize">{vis.component} Visual</h5>
                                                                <span className={`inline-block px-1.5 py-0.5 font-bold rounded uppercase text-[9px] ${
                                                                    isPass ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-[#EF4444]'
                                                                }`}>
                                                                    {vis.overall_result}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Defects</span>
                                                                {vis.defects && vis.defects.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                                        {vis.defects.map((def, idx) => (
                                                                            <span key={idx} className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-md uppercase">
                                                                                {def}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs font-semibold text-[#10B981] block mt-0.5">✓ No visual defects found</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Remarks</span>
                                                                <p className="text-xs italic text-[#64748B] mt-0.5">{vis.remarks || 'No remarks provided'}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No visual inspection logs recorded.</p>
                                        )}
                                    </div>
                                </div>

                                {/* NODE 4: COMPONENT REPLACEMENTS */}
                                <div className="relative">
                                    {/* Circle Icon */}
                                    <div className={`absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 bg-white flex items-center justify-center shadow-sm ${
                                        latestCycle ? 'border-[#F59E0B] text-[#F59E0B]' : 'border-slate-300 text-slate-300'
                                    }`}>
                                        <Settings size={14} className="stroke-[2.5]" />
                                    </div>

                                    {/* Node Content */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-base ${latestCycle ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                                                Component Replacements
                                            </h4>
                                            {latestCycle ? (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-[#F59E0B] bg-amber-50 border border-amber-200 rounded uppercase">Processed</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 rounded uppercase">Pending</span>
                                            )}
                                        </div>

                                        {latestCycle ? (
                                            replacements.length > 0 ? (
                                                <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl bg-white shadow-sm max-w-3xl">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                                                                <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Component</th>
                                                                <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Old Serial</th>
                                                                <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">New Part Serial</th>
                                                                <th className="px-4 py-2.5 font-bold text-[#64748B] uppercase tracking-wider">Reason</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#E2E8F0]">
                                                            {replacements.map((rep) => (
                                                                <tr key={rep.id} className="hover:bg-slate-50/50">
                                                                    <td className="px-4 py-2 font-bold text-[#0F172A] capitalize">{rep.component}</td>
                                                                    <td className="px-4 py-2 font-mono text-[#64748B]">{rep.old_part_serial_number || 'N/A'}</td>
                                                                    <td className="px-4 py-2 font-mono font-bold text-[#0F172A]">{rep.replacement_part_number}</td>
                                                                    <td className="px-4 py-2 text-[#64748B] font-semibold">{rep.reason || 'Replacement'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2 max-w-md">
                                                    <Check size={16} />
                                                    <span>All components passed inspection. No component replacements required.</span>
                                                </div>
                                            )
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No replacement records yet.</p>
                                        )}
                                    </div>
                                </div>

                                {/* NODE 5: ASSEMBLY & QC */}
                                <div className="relative">
                                    {/* Circle Icon */}
                                    {assembly ? (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-purple-500 bg-white text-purple-500 flex items-center justify-center shadow-sm">
                                            <Wrench size={14} className="stroke-[2.5]" />
                                        </div>
                                    ) : (
                                        <div className="absolute -left-[45px] top-1.5 w-8 h-8 rounded-full border-2 border-slate-300 bg-slate-50 text-slate-400 flex items-center justify-center shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        </div>
                                    )}

                                    {/* Node Content */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-base ${assembly ? 'text-[#0F172A]' : 'text-slate-400'}`}>
                                                Assembly & Quality Control
                                            </h4>
                                            {assembly ? (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-purple-600 bg-purple-50 border border-purple-200 rounded uppercase">Complete</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 rounded uppercase">Pending</span>
                                            )}
                                        </div>

                                        {assembly ? (
                                            <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl text-xs">
                                                <div>
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Grease Weight</span>
                                                    <p className="font-bold text-sm text-[#0F172A] mt-0.5">{assembly.grease_weight} g</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Grease Type</span>
                                                    <p className="font-bold text-sm text-[#0F172A] mt-0.5 capitalize">{assembly.grease_type}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Lateral Play</span>
                                                    <p className="font-bold text-sm text-[#0F172A] mt-0.5">{assembly.lateral_play} mm</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Inspection Status</span>
                                                    <span className={`inline-block px-1.5 py-0.5 font-bold rounded uppercase mt-0.5 text-[9px] ${
                                                        assembly.status === 'ready' ? 'bg-emerald-50 text-[#10B981]' : 'bg-rose-50 text-[#EF4444]'
                                                    }`}>
                                                        {assembly.status === 'ready' ? 'Passed' : 'Rejected'}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 border-t border-slate-50 pt-2">
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">Assembled By</span>
                                                    <p className="font-semibold text-slate-700 mt-0.5">{assembly.assembled_by_name || 'Operator'}</p>
                                                </div>
                                                <div className="col-span-2 border-t border-slate-50 pt-2">
                                                    <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider block">QC Inspector</span>
                                                    <p className="font-semibold text-slate-700 mt-0.5">{assembly.qc_inspector_name || 'Not Inspected'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No assembly & QC metrics submitted.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Defect Photo Gallery */}
                        <div className="p-6 md:p-8 bg-slate-50/50 border-t border-[#E2E8F0]">
                            <h3 className="font-extrabold text-sm text-[#002045] uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Camera size={16} className="text-[#FFB55C]" /> Documented Defect Photos
                            </h3>

                            {Object.keys(photoUrls).length === 0 ? (
                                <div className="p-8 border border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-white max-w-sm">
                                    <Camera size={32} className="stroke-[1.5]" />
                                    <span className="text-xs font-semibold">No defect photos recorded</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl">
                                    {Object.entries(photoUrls).map(([key, url]) => (
                                        <div 
                                            key={key} 
                                            onClick={() => setLightboxImg(url)}
                                            className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm hover:shadow-md cursor-pointer transition-all duration-300"
                                        >
                                            <img 
                                                src={url} 
                                                alt="Inspection Defect" 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-[#002045]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                                <Eye size={16} />
                                                <span>Expand</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox / Image Modal */}
            {lightboxImg && (
                <div 
                    className="fixed inset-0 z-50 bg-[#002045]/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setLightboxImg(null)}
                >
                    <div className="relative max-w-4xl max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col justify-between">
                        <button 
                            onClick={() => setLightboxImg(null)}
                            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 transition active:scale-95 cursor-pointer z-10"
                        >
                            <X size={20} />
                        </button>
                        <img 
                            src={lightboxImg} 
                            alt="Lightbox expanded view" 
                            className="max-w-full max-h-[75vh] object-contain rounded-xl"
                        />
                        <div className="p-4 text-center">
                            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Defect Image Inspection Detail</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
