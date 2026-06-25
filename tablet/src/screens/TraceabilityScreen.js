import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import apiClient from '../api/apiClient';

export default function TraceabilityScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [ctrbData, setCtrbData] = useState(null);
    const [localInspections, setLocalInspections] = useState([]);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!query.trim()) {
            Alert.alert('Search Error', 'Please enter a CTRB Number or Job ID.');
            return;
        }

        setLoading(true);
        setError('');
        setCtrbData(null);
        setLocalInspections([]);

        const searchVal = query.trim().toUpperCase();

        try {
            // 1. Try to query the backend first
            try {
                const res = await apiClient.get(`/ctrb/search?q=${searchVal}`);
                if (res.data?.data?.length > 0) {
                    const ctrbBrief = res.data.data[0];
                    // Fetch full profile with cycle history
                    const fullRes = await apiClient.get(`/ctrb/${ctrbBrief.id}`);
                    if (fullRes.data?.data) {
                        setCtrbData(fullRes.data.data);
                        setLoading(false);
                        return;
                    }
                }
            } catch (apiErr) {
                console.log('Search API failed or unreachable, looking up offline SQLite...', apiErr.message);
            }

            // 2. Offline Fallback: Query local SQLite (WatermelonDB)
            const localRecords = await database.collections.get('ctrb_records')
                .query().fetch();
            
            const match = localRecords.find(r => 
                r.ctrb_number.toUpperCase() === searchVal || 
                r.job_id.toUpperCase() === searchVal
            );

            if (match) {
                // Construct a mock profile using local DB records
                const offlineProfile = {
                    id: match.id,
                    ctrb_number: match.ctrb_number,
                    job_id: match.job_id,
                    make: match.make,
                    date_received: match.date_received,
                    source: 'scheduled_maint', // mock fallback field
                    status: match.status,
                    is_offline: true
                };

                // Fetch local inspections for this record
                const inspections = await database.collections.get('inspections')
                    .query().fetch();
                const matchedInspections = inspections.filter(i => i.ctrb_id === match.id);
                
                // Parse inspection payloads
                const parsedInspections = matchedInspections.map(i => {
                    try {
                        return {
                            id: i.id,
                            component: i.component,
                            type: i.type,
                            payload: JSON.parse(i.payload),
                            is_synced: i.is_synced
                        };
                    } catch (e) {
                        return { id: i.id, component: i.component, type: i.type, payload: {}, is_synced: i.is_synced };
                    }
                });

                setLocalInspections(parsedInspections);
                setCtrbData(offlineProfile);
            } else {
                setError('No CTRB record matches this search query.');
            }
        } catch (err) {
            console.error('Search failed', err);
            setError('An error occurred during search.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'ready':
                return { bg: '#d1fae5', text: '#065f46', label: 'READY' };
            case 'rejected':
            case 'scrap':
                return { bg: '#fee2e2', text: '#991b1b', label: 'REJECT / SCRAP' };
            case 'under_inspection':
                return { bg: '#dbeafe', text: '#1e40af', label: 'INSPECTIONS' };
            default:
                return { bg: '#fef3c7', text: '#92400e', label: 'RECEIVED' };
        }
    };

    const renderQuickStats = () => {
        if (!ctrbData) return null;
        
        const cycleCount = ctrbData.cycles ? ctrbData.cycles.length : (localInspections.length > 0 ? 1 : 0);
        const days = Math.max(0, Math.floor((new Date() - new Date(ctrbData.date_received)) / (1000 * 60 * 60 * 24)));
        const statusStyle = getStatusStyle(ctrbData.status);
        
        return (
            <View style={styles.quickStatsRow}>
                <View style={styles.quickStatCard}>
                    <MaterialCommunityIcons name="history" size={16} color="#002045" />
                    <View style={{ marginLeft: 6 }}>
                        <Text style={styles.quickStatLabel}>Cycles</Text>
                        <Text style={styles.quickStatVal}>{cycleCount}</Text>
                    </View>
                </View>
                <View style={styles.quickStatCard}>
                    <MaterialCommunityIcons name="shield-check-outline" size={16} color={statusStyle.text} />
                    <View style={{ marginLeft: 6 }}>
                        <Text style={styles.quickStatLabel}>Status</Text>
                        <Text style={[styles.quickStatVal, { color: statusStyle.text }]}>{statusStyle.label}</Text>
                    </View>
                </View>
                <View style={styles.quickStatCard}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color="#002045" />
                    <View style={{ marginLeft: 6 }}>
                        <Text style={styles.quickStatLabel}>Age</Text>
                        <Text style={styles.quickStatVal}>{days} Days</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafd' }} edges={['bottom', 'left', 'right']}>
            <View style={styles.container}>
                {/* Top Bar Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#002045" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Traceability Lookup Portal</Text>
                    <TouchableOpacity 
                        style={styles.exportBtn}
                        onPress={() => Alert.alert('Export Service', 'Export to PDF coming soon!')}
                    >
                        <MaterialCommunityIcons name="printer" size={24} color="#002045" />
                    </TouchableOpacity>
                </View>

            {/* Search Input Bar */}
            <View style={styles.searchBar}>
                <View style={styles.searchInputWrapper}>
                    <MaterialCommunityIcons name="magnify" size={24} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search CTRB Serial (e.g. TIM-9021)"
                        placeholderTextColor="#94a3b8"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                    />
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                    <Text style={styles.searchBtnText}>Locate</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {loading && <ActivityIndicator size="large" color="#002045" style={{ marginVertical: 32 }} />}

                    {error ? (
                        <View style={styles.errorBox}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#ef4444" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {ctrbData && (
                        <View>
                            {/* Quick Stats Strip */}
                            {renderQuickStats()}
                        {/* Profile Info Card */}
                        <View style={styles.profileCard}>
                            <View style={styles.accentBorder} />
                            <View style={styles.profileHeader}>
                                <View>
                                    <Text style={styles.profileTitle}>{ctrbData.ctrb_number}</Text>
                                    <Text style={styles.profileSub}>Job ID: {ctrbData.job_id}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(ctrbData.status).bg }]}>
                                    <Text style={[styles.statusText, { color: getStatusStyle(ctrbData.status).text }]}>
                                        {getStatusStyle(ctrbData.status).label}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.profileGrid}>
                                <View style={styles.profileCol}>
                                    <Text style={styles.profileLabel}>MAKE</Text>
                                    <Text style={styles.profileVal}>{ctrbData.make.toUpperCase()}</Text>
                                </View>
                                <View style={styles.profileCol}>
                                    <Text style={styles.profileLabel}>DATE REGISTERED</Text>
                                    <Text style={styles.profileVal}>
                                        {new Date(ctrbData.date_received).toLocaleDateString()}
                                    </Text>
                                </View>
                                <View style={styles.profileCol}>
                                    <Text style={styles.profileLabel}>DATA SOURCE</Text>
                                    <Text style={styles.profileVal}>{ctrbData.is_offline ? 'SQLite (Offline Cache)' : 'Production Server'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Timeline Header */}
                        <Text style={styles.timelineTitle}>Chronological Repair Timeline</Text>

                        {/* TIMELINE COMPONENT */}
                        <View style={styles.timelineContainer}>
                            
                            {/* Node 1: INTAKE */}
                            <View style={styles.timelineNode}>
                                <View style={styles.timelineSidebar}>
                                    <View style={[styles.timelineIconWrapper, { backgroundColor: '#dbeafe' }]}>
                                        <MaterialCommunityIcons name="tray-arrow-down" size={20} color="#1e40af" />
                                    </View>
                                    <View style={styles.timelineLine} />
                                </View>
                                <View style={styles.timelineContentCard}>
                                    <Text style={styles.nodeTitle}>Bearing Intake Registered</Text>
                                    <Text style={styles.nodeMeta}>
                                        {new Date(ctrbData.date_received).toLocaleTimeString()} | Operator: {ctrbData.operator_id || 'System'}
                                    </Text>
                                    <Text style={styles.nodeBody}>
                                        Unit was received into workshop inventory. Basic Make validation set to G-81 {ctrbData.make.toUpperCase()} limits.
                                    </Text>
                                </View>
                            </View>

                            {/* Node 2: INSPECTIONS */}
                            <View style={styles.timelineNode}>
                                <View style={styles.timelineSidebar}>
                                    <View style={[styles.timelineIconWrapper, { backgroundColor: '#e0f2fe' }]}>
                                        <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#0369a1" />
                                    </View>
                                    <View style={styles.timelineLine} />
                                </View>
                                <View style={styles.timelineContentCard}>
                                    <Text style={styles.nodeTitle}>Component Testing & Inspections</Text>
                                    
                                    {/* Web API based nested cycles */}
                                    {ctrbData.cycles && ctrbData.cycles.length > 0 ? (
                                        ctrbData.cycles.map((cycle, cycleIndex) => (
                                            <View key={cycle.id || cycleIndex} style={styles.cycleSubCard}>
                                                <Text style={styles.cycleTitle}>Inspection Cycle #{cycleIndex + 1} ({cycle.status.toUpperCase()})</Text>
                                                
                                                {/* Dimensional list */}
                                                {cycle.dimensional_inspections?.map((d) => (
                                                    <View key={d.id} style={styles.logRow}>
                                                        <MaterialCommunityIcons name="ruler-square" size={14} color="#64748b" />
                                                        <Text style={styles.logText}>
                                                            {d.component.toUpperCase()} {d.param_key.replace(/_/g, ' ')}: {d.measured_value} mm 
                                                        </Text>
                                                        <Text style={d.result === 'accepted' ? styles.passBadge : styles.failBadge}>
                                                            {d.result.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                ))}

                                                {/* Visual list */}
                                                {cycle.visual_inspections?.map((v) => (
                                                    <View key={v.id} style={styles.logRowVisual}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <MaterialCommunityIcons name="eye-outline" size={14} color="#64748b" />
                                                                <Text style={styles.logTextBold}>{v.component.toUpperCase()} Visual check</Text>
                                                            </View>
                                                            <Text style={v.overall_result === 'accepted' ? styles.passBadge : styles.failBadge}>
                                                                {v.overall_result.toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        {v.defects && v.defects.length > 0 && (
                                                            <Text style={styles.defectListText}>Defects: {v.defects.join(', ')}</Text>
                                                        )}
                                                        {v.remarks ? <Text style={styles.remarksText}>Remarks: {v.remarks}</Text> : null}
                                                    </View>
                                                ))}

                                                {/* Replaced items list */}
                                                {cycle.replacements?.map((r) => (
                                                    <View key={r.id} style={styles.replacementRow}>
                                                        <MaterialCommunityIcons name="link-variant" size={14} color="#d97706" />
                                                        <Text style={styles.replacementText}>
                                                            {r.component.toUpperCase()} Replaced with Part: <Text style={{ fontWeight: 'bold' }}>{r.replacement_part_number}</Text>
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        ))
                                    ) : localInspections.length > 0 ? (
                                        // Offline SQLite local database inspections mapping
                                        localInspections.map((item) => (
                                            <View key={item.id} style={styles.logRow}>
                                                <MaterialCommunityIcons name={item.type === 'visual' ? "eye-outline" : "ruler-square"} size={16} color="#64748b" />
                                                <View style={{ flex: 1, marginLeft: 6 }}>
                                                    <Text style={styles.logTextBold}>
                                                        {item.component.toUpperCase()} - {item.type === 'dimensional' && item.payload.param_key 
                                                            ? item.payload.param_key.replace(/_/g, ' ').toUpperCase() 
                                                            : item.type.toUpperCase()}
                                                    </Text>
                                                    {item.payload.measured_value ? (
                                                        <Text style={styles.logText}>Measured: {item.payload.measured_value} mm</Text>
                                                    ) : null}
                                                    {item.type === 'visual' && (!item.payload.defects || item.payload.defects.length === 0) && (
                                                        <Text style={styles.logText}>Visual inspection completed</Text>
                                                    )}
                                                    {item.payload.defects && item.payload.defects.length > 0 ? (
                                                        <Text style={styles.defectListText}>Defects: {item.payload.defects.join(', ')}</Text>
                                                    ) : null}
                                                    {item.payload.remarks ? (
                                                        <Text style={styles.remarksText}>Remarks: {item.payload.remarks}</Text>
                                                    ) : null}
                                                    {item.payload.replacement ? (
                                                        <Text style={styles.replacementText}>
                                                            Replaced with: {item.payload.replacement.replacement_part_number}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <Text style={item.payload.result === 'accepted' || item.payload.overall_result === 'accepted' ? styles.passBadge : styles.failBadge}>
                                                    {(item.payload.result || item.payload.overall_result || 'unknown').toUpperCase()}
                                                </Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.timelineEmptyText}>No inspections recorded yet for this unit.</Text>
                                    )}
                                </View>
                            </View>

                            {/* Node 3: ASSEMBLY */}
                            {ctrbData.assembly && (
                                <View style={styles.timelineNode}>
                                    <View style={styles.timelineSidebar}>
                                        <View style={[styles.timelineIconWrapper, { backgroundColor: '#f3e8ff' }]}>
                                            <MaterialCommunityIcons name="speedometer" size={20} color="#7e22ce" />
                                        </View>
                                        <View style={[styles.timelineLine, { height: 0 }]} />
                                    </View>
                                    <View style={styles.timelineContentCard}>
                                        <Text style={styles.nodeTitle}>Final Assembly & QC Sign-off</Text>
                                        <Text style={styles.nodeMeta}>
                                            {new Date(ctrbData.assembly.created_at || new Date()).toLocaleDateString()} | Assembled By: {ctrbData.assembly.assembled_by_name || 'Operator'}
                                        </Text>
                                        <View style={styles.assemblyGrid}>
                                            <View style={styles.assemblyCol}>
                                                <Text style={styles.assemblyLabel}>Grease weight</Text>
                                                <Text style={styles.assemblyVal}>{ctrbData.assembly.grease_qty_g} g</Text>
                                            </View>
                                            <View style={styles.assemblyCol}>
                                                <Text style={styles.assemblyLabel}>Grease type</Text>
                                                <Text style={styles.assemblyVal}>{ctrbData.assembly.grease_type}</Text>
                                            </View>
                                            <View style={styles.assemblyCol}>
                                                <Text style={styles.assemblyLabel}>Lateral play</Text>
                                                <Text style={styles.assemblyVal}>
                                                    {ctrbData.assembly.lateral_play_mm} mm ({ctrbData.assembly.lateral_device.toUpperCase()})
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.qcSignoffBox}>
                                            <MaterialCommunityIcons name="shield-check" size={16} color="#065f46" />
                                            <Text style={styles.qcSignoffText}>
                                                QC Certified Signed off by Inspector: <Text style={{ fontWeight: 'bold' }}>{ctrbData.assembly.qc_inspector_name || ctrbData.assembly.qc_inspector_id}</Text>
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#faf9fd' 
    },
    scrollContainer: { 
        paddingHorizontal: 24, 
        paddingBottom: 48,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    backBtn: {
        padding: 6,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#002045',
    },
    searchBar: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 12,
    },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1a1c1e',
    },
    searchBtn: {
        backgroundColor: '#002045',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    searchBtnText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    profileCard: {
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden',
        marginTop: 20,
    },
    accentBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: '#ffb55c',
    },
    profileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 16,
        marginBottom: 16,
    },
    profileTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#002045',
    },
    profileSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        fontFamily: 'monospace',
    },
    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    profileGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    profileCol: {
        flex: 1,
    },
    profileLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    profileVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 4,
    },
    timelineTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#002045',
        marginTop: 32,
        marginBottom: 20,
    },
    timelineContainer: {
        paddingLeft: 8,
    },
    timelineNode: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineSidebar: {
        alignItems: 'center',
        marginRight: 16,
    },
    timelineIconWrapper: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: '#cbd5e1',
        marginVertical: 4,
    },
    timelineContentCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    nodeTitle: {
        fontSize: 14,
        fontWeight: '850',
        color: '#0f172a',
    },
    nodeMeta: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 4,
        marginBottom: 10,
    },
    nodeBody: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
    },
    cycleSubCard: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    cycleTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1e40af',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    logRowVisual: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    logText: {
        flex: 1,
        fontSize: 12,
        color: '#334155',
        marginLeft: 6,
    },
    logTextBold: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    defectListText: {
        fontSize: 11,
        color: '#dc2626',
        fontWeight: '600',
        marginTop: 4,
    },
    remarksText: {
        fontSize: 11,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 2,
    },
    passBadge: {
        fontSize: 9,
        fontWeight: '800',
        color: '#10b981',
        backgroundColor: '#ecfdf5',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        overflow: 'hidden',
    },
    failBadge: {
        fontSize: 9,
        fontWeight: '800',
        color: '#ef4444',
        backgroundColor: '#fef2f2',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        overflow: 'hidden',
    },
    replacementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        borderColor: '#fef3c7',
        borderWidth: 1,
        padding: 8,
        borderRadius: 6,
        marginTop: 8,
        gap: 6,
    },
    replacementText: {
        fontSize: 11,
        color: '#b45309',
    },
    timelineEmptyText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
    assemblyGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 12,
    },
    assemblyCol: {
        flex: 1,
    },
    assemblyLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    assemblyVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 2,
    },
    qcSignoffBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d1fae5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        padding: 10,
        borderRadius: 8,
        gap: 6,
    },
    qcSignoffText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#065f46',
    },
    errorBox: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginVertical: 20,
    },
    errorText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ef4444',
        textAlign: 'center',
        marginTop: 8,
    },
    exportBtn: {
        padding: 6,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 8,
    },
    quickStatCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
    },
    quickStatLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    quickStatVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 1,
    },
    timelineLine: {
        flex: 1,
        width: 4,
        backgroundColor: '#ffb55c',
        borderRadius: 2,
        marginVertical: 4,
    }
});
