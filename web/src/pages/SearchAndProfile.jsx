import React, { useState } from 'react';
import axios from 'axios';
import { SearchIcon, FileText, CheckCircle, Settings, Camera, Search as SearchLogo } from 'lucide-react';

const API_URL = 'http://localhost:5000/api/v1';

export default function SearchAndProfile() {
    const [query, setQuery] = useState('');
    const [ctrbData, setCtrbData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/ctrb/search?q=${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.data.length > 0) {
                const ctrb = res.data.data[0];
                // In a production app, we would fetch the full profile with cycles: GET /ctrb/:id
                setCtrbData(ctrb);
            } else {
                setError('No CTRB found matching this criteria.');
                setCtrbData(null);
            }
        } catch (err) {
            setError('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center space-x-3 mb-8">
                    <SearchLogo size={32} className="text-blue-900" />
                    <h2 className="text-3xl font-extrabold text-slate-800">Traceability Search</h2>
                </div>

                <form onSubmit={handleSearch} className="flex gap-4 mb-10 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <input
                        type="text"
                        placeholder="Enter CTRB Number (e.g. D-03-22-211523) or Job ID"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                        required
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold shadow-md active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-600 flex items-center space-x-2"
                    >
                        {loading ? <span>Searching...</span> : <>
                            <SearchIcon size={20} />
                            <span>Locate Record</span>
                        </>}
                    </button>
                </form>

                {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 font-medium">{error}</div>}

                {ctrbData && (
                    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                        <div className="bg-blue-900 px-6 py-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">{ctrbData.ctrb_number}</h3>
                                <p className="text-blue-200 text-sm">{ctrbData.job_id}</p>
                            </div>
                            <span className="px-4 py-1 bg-green-500/20 text-green-300 rounded-full font-bold uppercase tracking-wider text-sm border border-green-500/50">
                                {ctrbData.status}
                            </span>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="flex items-center space-x-2 text-slate-500 font-bold mb-2 uppercase text-sm border-b pb-1">
                                        <FileText size={16} /> <span>Basic Info</span>
                                    </h4>
                                    <div className="grid grid-cols-2 gap-y-4">
                                        <div><p className="text-xs text-slate-400">Make</p><p className="font-semibold text-slate-700 capitalize">{ctrbData.make}</p></div>
                                        <div><p className="text-xs text-slate-400">Received Date</p><p className="font-semibold text-slate-700">{new Date(ctrbData.date_received).toLocaleDateString()}</p></div>
                                        <div><p className="text-xs text-slate-400">Source</p><p className="font-semibold text-slate-700 capitalize">{ctrbData.source.replace('_', ' ')}</p></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="flex items-center space-x-2 text-slate-500 font-bold mb-2 uppercase text-sm border-b pb-1">
                                        <CheckCircle size={16} /> <span>Inspection History Placeholder</span>
                                    </h4>
                                    <p className="text-slate-400 italic text-sm">Full TRD implementation would fetch visual and dimensional aggregates here.</p>
                                </div>
                                <div>
                                    <h4 className="flex items-center space-x-2 text-slate-500 font-bold mb-2 uppercase text-sm border-b pb-1">
                                        <Settings size={16} /> <span>Replacement Ledger Placeholder</span>
                                    </h4>
                                    <p className="text-slate-400 italic text-sm">Original vs Replacement correlations would display in a table structure here.</p>
                                </div>
                            </div>
                        </div>

                        {/* Photo Gallery Placeholder */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <h4 className="flex items-center space-x-2 text-slate-500 font-bold mb-4 uppercase text-sm">
                                <Camera size={16} /> <span>Documented Defect Photos</span>
                            </h4>
                            <div className="flex gap-4 overflow-x-auto">
                                <div className="w-32 h-32 bg-slate-200 rounded flex items-center justify-center border border-dashed border-slate-300">
                                    <span className="text-xs text-slate-400">No Photos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
