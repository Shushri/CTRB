import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchIcon, FileText, CheckCircle, Settings, Camera, Search as SearchLogo, ArrowLeft, Wrench, ShieldCheck, AlertTriangle, Link, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Dynamic photo fetching component to resolve signed S3/MinIO URLs
function DefectPhoto({ photoKey }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUrl = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/photos?key=${photoKey}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setUrl(res.data.signed_url);
            } catch (e) {
                console.error('Failed to get signed photo URL', e);
            } finally {
                setLoading(false);
            }
        };
        fetchUrl();
    }, [photoKey]);

    if (loading) {
        return <div className="w-32 h-32 bg-slate-100 border border-slate-200 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">Loading Image...</div>;
    }
    if (!url) {
        return <div className="w-32 h-32 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-xs text-red-400">Error Loading</div>;
    }

    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block relative overflow-hidden rounded-lg group">
            <img src={url} className="w-32 h-32 object-cover border border-slate-200 group-hover:scale-105 transition-transform duration-200" alt="Defect" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <span className="text-[10px] text-white font-bold uppercase tracking-wider bg-slate-900/60 px-2 py-1 rounded">View Large</span>
            </div>
        </a>
    );
}

export default function SearchAndProfile() {
    const [query, setQuery] = useState('');
    const [ctrbData, setCtrbData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            // First search for the CTRB brief
            const res = await axios.get(`${API_URL}/ctrb/search?q=${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.data.length > 0) {
                const ctrbBrief = res.data.data[0];
                // Fetch the full profile containing the nested cycles, inspections, replacements, and assembly
                const detailsRes = await axios.get(`${API_URL}/ctrb/${ctrbBrief.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCtrbData(detailsRes.data.data);
            } else {
                setError('No CTRB found matching this criteria.');
                setCtrbData(null);
            }
        } catch (err) {
            console.error('Search failed', err);
            setError('Search failed. Please verify credentials or server connectivity.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'ready':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'rejected':
            case 'scrap':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'under_inspection':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            default:
                return 'bg-amber-50 text-amber-700 border-amber-200';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center space-x-3">
                        <SearchLogo size={32} className="text-slate-900" />
                        <h2 className="text-2xl font-bold text-slate-900">Traceability Search Portal</h2>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium transition"
                    >
                        <ArrowLeft size={18} />
                        <span>Back to Dashboard</span>
                    </button>
                </div>

                {/* Search Bar */}
                <form onSubmit={handleSearch} className="flex gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <input
                        type="text"
                        placeholder="Search CTRB Serial Number (e.g. TIM-9021) or Job ID..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition text-slate-800"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold shadow active:scale-95 transition flex items-center space-x-2"
                    >
                        {loading ? <span>Searching...</span> : <>
                            <SearchIcon size={18} />
                            <span>Locate Record</span>
                        </>}
                    </button>
                </form>

                {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 font-medium mb-8">
                        {error}
                    </div>
                )}

                {ctrbData && (
                    <div className="space-y-8">
                        {/* Profile Info Summary Card */}
                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden relative">
                            <div className="h-1 bg-amber-500 w-full" />
                            <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <div className="flex items-center space-x-3">
                                        <h3 className="text-xl font-bold text-slate-900">{ctrbData.ctrb_number}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadgeClass(ctrbData.status)}`}>
                                            {ctrbData.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1 font-mono">Job ID Reference: {ctrbData.job_id}</p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100 w-full md:w-auto">
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Make</p><p className="font-semibold text-slate-700 capitalize">{ctrbData.make}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Date Received</p><p className="font-semibold text-slate-700">{new Date(ctrbData.date_received).toLocaleDateString()}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Source</p><p className="font-semibold text-slate-700 capitalize">{ctrbData.source?.replace('_', ' ') || 'N/A'}</p></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Source Remarks</p><p className="font-semibold text-slate-700 truncate max-w-[120px]" title={ctrbData.source_remarks || 'None'}>{ctrbData.source_remarks || 'None'}</p></div>
                                </div>
                            </div>
                        </div>

                        {/* Chronological repair Timeline Section */}
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center space-x-2 border-b pb-3">
                                <Clock size={20} className="text-slate-700" />
                                <span>Chronological Maintenance Lifecycle</span>
                            </h3>

                            {ctrbData.cycles && ctrbData.cycles.length > 0 ? (
                                <div className="space-y-8 pl-4 border-l border-slate-200">
                                    {ctrbData.cycles.map((cycle, index) => (
                                        <div key={cycle.id || index} className="relative">
                                            {/* Left timeline dot */}
                                            <div className="absolute -left-[25px] top-1 bg-slate-900 text-white w-5 h-5 rounded-full border border-white flex items-center justify-center text-[10px] font-bold">
                                                {index + 1}
                                            </div>

                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-base">Overhaul Cycle #{index + 1}</h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            Cycle ID: {cycle.id} | Started: {new Date(cycle.started_at).toLocaleString()}
                                                            {cycle.completed_at && ` | Completed: ${new Date(cycle.completed_at).toLocaleString()}`}
                                                        </p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusBadgeClass(cycle.status)}`}>
                                                        {cycle.status}
                                                    </span>
                                                </div>

                                                {/* Cycle Sub-section 1: Dimensional Checks */}
                                                <div className="mb-6">
                                                    <h5 className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                                        <Wrench size={14} /> <span>G-81 Dimensional Checks</span>
                                                    </h5>
                                                    {cycle.dimensional_inspections && cycle.dimensional_inspections.length > 0 ? (
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                            <table className="min-w-full text-left border-collapse">
                                                                <thead className="bg-slate-100 text-[10px] text-slate-500 font-bold uppercase">
                                                                    <tr>
                                                                        <th className="p-3">Component</th>
                                                                        <th className="p-3">Parameter Checked</th>
                                                                        <th className="p-3">Measured Value</th>
                                                                        <th className="p-3">G-81 Spec Bounds</th>
                                                                        <th className="p-3">Result</th>
                                                                        <th className="p-3">Inspected By</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                                                                    {cycle.dimensional_inspections.map((item) => (
                                                                        <tr key={item.id} className="hover:bg-slate-50">
                                                                            <td className="p-3 font-semibold uppercase">{item.component}</td>
                                                                            <td className="p-3 capitalize">{item.param_key.replace(/_/g, ' ')}</td>
                                                                            <td className="p-3 font-mono">{item.measured_value} mm</td>
                                                                            <td className="p-3 text-slate-400 font-mono">{item.tolerance_min} - {item.tolerance_max} mm</td>
                                                                            <td className="p-3">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.result === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                                                    {item.result.toUpperCase()}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-slate-400">{item.operator_name || item.operator_id}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic bg-white p-3 border border-slate-200 rounded-lg">No dimensional measurements recorded.</p>
                                                    )}
                                                </div>

                                                {/* Cycle Sub-section 2: Visual Defect Reports */}
                                                <div className="mb-6">
                                                    <h5 className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                                        <FileText size={14} /> <span>Visual Inspections & defect logs</span>
                                                    </h5>
                                                    {cycle.visual_inspections && cycle.visual_inspections.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {cycle.visual_inspections.map((vis) => (
                                                                <div key={vis.id} className="bg-white border border-slate-200 rounded-lg p-4">
                                                                    <div className="flex justify-between items-center mb-2 border-b pb-2">
                                                                        <span className="font-bold text-slate-800 uppercase text-xs">{vis.component}</span>
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${vis.overall_result === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                                            {vis.overall_result.toUpperCase()}
                                                                        </span>
                                                                    </div>
                                                                    {vis.defects && vis.defects.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                                                            {vis.defects.map(d => (
                                                                                <span key={d} className="px-2 py-0.5 bg-red-50 border border-red-100 rounded text-[10px] text-red-600 font-bold uppercase">
                                                                                    {d.replace(/_/g, ' ')}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-slate-400 text-xs italic mb-2">No structural defects flagged.</p>
                                                                    )}
                                                                    {vis.remarks && (
                                                                        <p className="text-slate-600 text-xs italic bg-slate-50 p-2 rounded mt-2">
                                                                            Remarks: {vis.remarks}
                                                                        </p>
                                                                    )}

                                                                    {/* Defect Photo Gallery */}
                                                                    {vis.photos && vis.photos.length > 0 && (
                                                                        <div className="mt-3">
                                                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-2 flex items-center gap-1">
                                                                                <Camera size={12} /> Snapped Defect Photos:
                                                                            </p>
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {vis.photos.map(pKey => (
                                                                                    <DefectPhoto key={pKey} photoKey={pKey} />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic bg-white p-3 border border-slate-200 rounded-lg">No visual inspection reports saved.</p>
                                                    )}
                                                </div>

                                                {/* Cycle Sub-section 3: Replaced Components Ledger */}
                                                <div>
                                                    <h5 className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                                        <Link size={14} /> <span>Traceability Replacement Ledger</span>
                                                    </h5>
                                                    {cycle.replacements && cycle.replacements.length > 0 ? (
                                                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                            <table className="min-w-full text-left border-collapse">
                                                                <thead className="bg-slate-100 text-[10px] text-slate-500 font-bold uppercase">
                                                                    <tr>
                                                                        <th className="p-3">Component Replaced</th>
                                                                        <th className="p-3">Cause of Rejection</th>
                                                                        <th className="p-3">Replacement Part Serial Number</th>
                                                                        <th className="p-3">Replaced By</th>
                                                                        <th className="p-3">Replaced Date</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-xs text-slate-700 divide-y divide-slate-100">
                                                                    {cycle.replacements.map((rep) => (
                                                                        <tr key={rep.id} className="hover:bg-slate-50 bg-amber-50/10">
                                                                            <td className="p-3 font-semibold uppercase text-amber-700">{rep.component}</td>
                                                                            <td className="p-3 text-slate-600">{rep.rejection_cause}</td>
                                                                            <td className="p-3 font-mono font-bold">{rep.replacement_part_number}</td>
                                                                            <td className="p-3 text-slate-400">{rep.operator_name || rep.replaced_by}</td>
                                                                            <td className="p-3 text-slate-400">{new Date(rep.replaced_at).toLocaleDateString()}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic bg-white p-3 border border-slate-200 rounded-lg">No component replacement overrides occurred in this cycle.</p>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400 bg-slate-50 border rounded-lg border-dashed">
                                    <AlertTriangle size={24} className="mx-auto mb-2 text-slate-400" />
                                    <p className="text-sm font-medium">No overhaul cycle records synced for this unit.</p>
                                </div>
                            )}
                        </div>

                        {/* Final Assembly & QC Sign-off Certificate */}
                        {ctrbData.assembly ? (
                            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                                <div className="bg-slate-900 text-white px-6 py-4 flex items-center space-x-2">
                                    <ShieldCheck size={22} className="text-emerald-400" />
                                    <h3 className="text-base font-bold">G-81 Assembly & QC Verification Certificate</h3>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50">
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Grease Specifications</p>
                                        <p className="text-lg font-bold text-slate-700">{ctrbData.assembly.grease_qty_g} g</p>
                                        <p className="text-xs text-slate-400 mt-1 capitalize">Compound: {ctrbData.assembly.grease_type}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lateral Play Measurement</p>
                                        <p className="text-lg font-bold text-slate-700">{ctrbData.assembly.lateral_play_mm} mm</p>
                                        <p className="text-xs text-slate-400 mt-1 uppercase">Method: {ctrbData.assembly.lateral_device} Device</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Inspector Sign-off ID</p>
                                        <p className="text-lg font-bold text-emerald-600 flex items-center gap-1">
                                            <ShieldCheck size={18} /> Verified
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Authorized ID: {ctrbData.assembly.qc_inspector_name || ctrbData.assembly.qc_inspector_id}</p>
                                    </div>
                                </div>
                                <div className="bg-emerald-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center text-xs text-emerald-800">
                                    <p className="font-semibold">Overall Unit Outcome: READY TO RETURN TO RAILWAY SERVICE</p>
                                    <p className="text-slate-400">Date: {new Date(ctrbData.assembly.assembly_date).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border border-slate-200 border-dashed text-slate-500 rounded-xl p-8 text-center flex flex-col items-center">
                                <AlertTriangle size={32} className="text-slate-300 mb-2" />
                                <h4 className="font-bold text-slate-700">QC Sign-off Pending</h4>
                                <p className="text-xs text-slate-400 mt-1">This unit is currently incomplete and has not completed final G-81 assembly checks.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
