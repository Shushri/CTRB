import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { database } from '../database';
import { syncOfflineData } from '../utils/syncQueue';
import apiClient from '../api/apiClient';

export default function DashboardScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({ total: 0, ready: 0, rejected: 0, inProgress: 0 });
    const [activeJobs, setActiveJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    // Local WatermelonDB analytics strip states
    const [inspectedTodayCount, setInspectedTodayCount] = useState(0);
    const [acceptedCount, setAcceptedCount] = useState(0);
    const [holdCount, setHoldCount] = useState(0);

    const loadData = async () => {
        try {
            setLoading(true);
            // Load user data
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                setUser(JSON.parse(userStr));
            }

            // Load records from WatermelonDB to calculate offline stats
            const records = await database.collections.get('ctrb_records').query().fetch();
            
            const total = records.length;
            const ready = records.filter(r => r.status === 'ready').length;
            const rejected = records.filter(r => r.status === 'rejected' || r.status === 'scrap').length;
            const inProgress = records.filter(r => ['received', 'under_inspection', 'assembly'].includes(r.status)).length;

            setStats({ total, ready, rejected, inProgress });

            // Set active jobs list (in progress)
            const activeList = records.filter(r => ['received', 'under_inspection', 'assembly'].includes(r.status));
            setActiveJobs(activeList.slice(0, 10)); // Show top 10 active jobs

            // Fetch local analytics counts
            const inspections = await database.collections.get('inspections').query().fetch();
            const uniqueInspectedIds = new Set(inspections.map(i => i.ctrb_id));
            
            setInspectedTodayCount(uniqueInspectedIds.size);
            setAcceptedCount(ready);
            setHoldCount(records.filter(r => r.status === 'hold').length);

            // Fetch live data from backend if online (Fix 3c)
            try {
                const summaryRes = await apiClient.get('/dashboard/summary');
                if (summaryRes.data?.data) {
                    const data = summaryRes.data.data;
                    setStats({
                        total: parseInt(data.total_received) || 0,
                        ready: parseInt(data.total_accepted) || 0,
                        rejected: (parseInt(data.total_rejected) || 0) + (parseInt(data.total_scrap) || 0),
                        inProgress: (parseInt(data.total_received_status) || 0) + (parseInt(data.open_jobs) || 0)
                    });
                    setAcceptedCount(parseInt(data.total_accepted) || 0);
                    setHoldCount(parseInt(data.total_hold) || 0);
                }

                const recentRes = await apiClient.get('/ctrb/recent?limit=10');
                if (recentRes.data?.data) {
                    setActiveJobs(recentRes.data.data);
                }
            } catch (apiErr) {
                console.log('Dashboard API unreachable, using local WatermelonDB stats:', apiErr.message);
            }

            // Trigger background sync silently
            syncOfflineData().catch(e => console.log('Background sync failed:', e.message));
        } catch (err) {
            console.error('Error loading dashboard data', err);
            Alert.alert('Database Error', 'Failed to load local statistics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadData();
        });
        return unsubscribe;
    }, [navigation]);

    const handleLogout = async () => {
        Alert.alert(
            'Confirm Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Sign Out', 
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.removeItem('userToken');
                        await AsyncStorage.removeItem('user');
                        navigation.replace('Login');
                    }
                }
            ]
        );
    };

    const handleResetDatabase = async () => {
        Alert.alert(
            'Reset Mock Database',
            'This will erase all local modifications, inspection logs, and photo queue, and reload the 3 default seed records on the tablet. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Reset Database', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const keys = [
                                '@ctrb_app_db:ctrb_records',
                                '@ctrb_app_db:inspections',
                                '@ctrb_app_db:photo_queue'
                            ];
                            await AsyncStorage.multiRemove(keys);
                            
                            const SEED_RECORDS = [
                              {
                                id: 'ctrb_seed_1',
                                ctrb_number: 'TIM-9831A',
                                job_id: 'JOB-2026-001',
                                make: 'TIM',
                                date_received: '2026-06-20',
                                status: 'under_inspection',
                              },
                              {
                                id: 'ctrb_seed_2',
                                ctrb_number: 'SKF-4512B',
                                job_id: 'JOB-2026-002',
                                make: 'SKF',
                                date_received: '2026-06-22',
                                status: 'received',
                              },
                              {
                                id: 'ctrb_seed_3',
                                ctrb_number: 'TIM-1122C',
                                job_id: 'JOB-2026-003',
                                make: 'TIM',
                                date_received: '2026-06-25',
                                status: 'assembly',
                              },
                            ];
                            await AsyncStorage.setItem('@ctrb_app_db:ctrb_records', JSON.stringify(SEED_RECORDS));
                            Alert.alert('Reset Complete', 'Local mock database has been reset.');
                            loadData();
                        } catch (e) {
                            console.error('Failed to reset local database:', e);
                            Alert.alert('Error', 'Failed to reset database.');
                        }
                    }
                }
            ]
        );
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'received':
                return { bg: '#fef3c7', text: '#d97706', label: 'RECEIVED', color: '#d97706' };
            case 'under_inspection':
                return { bg: '#dbeafe', text: '#2563eb', label: 'INSPECTING', color: '#2563eb' };
            case 'assembly':
                return { bg: '#fae8ff', text: '#a855f7', label: 'ASSEMBLY', color: '#a855f7' };
            case 'ready':
                return { bg: '#d1fae5', text: '#10b981', label: 'READY', color: '#10b981' };
            case 'rejected':
            case 'scrap':
                return { bg: '#fee2e2', text: '#ef4444', label: 'REJECTED', color: '#ef4444' };
            case 'hold':
                return { bg: '#ffedd5', text: '#f97316', label: 'ON HOLD', color: '#f97316' };
            default:
                return { bg: '#f1f5f9', text: '#64748b', label: 'UNKNOWN', color: '#64748b' };
        }
    };

    const handleQueueLongPress = (item) => {
        Alert.alert(
            `CTRB Unit Options`,
            `Quick Actions for CTRB No: ${item.ctrb_number}`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Component Inspection', 
                    onPress: () => navigation.navigate('Inspection', { autoSelectId: item.id }) 
                },
                { 
                    text: 'Assembly & QC Check', 
                    onPress: () => navigation.navigate('Assembly', { autoSelectId: item.id }) 
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            {/* Top Bar Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.railwayTitle}>Wagon Repair Workshop</Text>
                    <Text style={styles.supervisorName} numberOfLines={1}>
                        {user ? `${user.name} (${user.role.toUpperCase()})` : 'Supervisor Console'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.resetDbButton} onPress={handleResetDatabase}>
                        <MaterialCommunityIcons name="database-refresh" size={20} color="#64748b" />
                        <Text style={styles.resetDbText}>Reset DB</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {/* Stats Panel */}
                    <View style={styles.statsRow}>
                        <LinearGradient
                            colors={['#ffffff', '#f8fafc']}
                            style={[styles.statCard, { borderLeftColor: '#64748b' }]}
                        >
                            <MaterialCommunityIcons name="database" size={26} color="#64748b" style={styles.statIcon} />
                            <Text style={styles.statValue}>{stats.total}</Text>
                            <Text style={styles.statLabel}>Total Attended</Text>
                        </LinearGradient>

                        <LinearGradient
                            colors={['#ffffff', '#f0fdf4']}
                            style={[styles.statCard, { borderLeftColor: '#10b981' }]}
                        >
                            <MaterialCommunityIcons name="check-circle" size={26} color="#10b981" style={styles.statIcon} />
                            <Text style={styles.statValue}>{stats.ready}</Text>
                            <Text style={styles.statLabel}>Ready (In Spec)</Text>
                        </LinearGradient>

                        <LinearGradient
                            colors={['#ffffff', '#fef2f2']}
                            style={[styles.statCard, { borderLeftColor: '#ef4444' }]}
                        >
                            <MaterialCommunityIcons name="close-circle" size={26} color="#ef4444" style={styles.statIcon} />
                            <Text style={styles.statValue}>{stats.rejected}</Text>
                            <Text style={styles.statLabel}>Rejected Units</Text>
                        </LinearGradient>

                        <LinearGradient
                            colors={['#ffffff', '#fffbeb']}
                            style={[styles.statCard, { borderLeftColor: '#ffb55c' }]}
                        >
                            <MaterialCommunityIcons name="wrench-clock" size={26} color="#ffb55c" style={styles.statIcon} />
                            <Text style={styles.statValue}>{stats.inProgress}</Text>
                            <Text style={styles.statLabel}>In Progress</Text>
                        </LinearGradient>
                    </View>

                    {/* Mini Analytics Strip */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={styles.miniAnalyticsStrip}
                        contentContainerStyle={{ paddingRight: 24 }}
                    >
                        <View style={styles.miniChip}>
                            <MaterialCommunityIcons name="clipboard-check" size={16} color="#2563eb" />
                            <Text style={styles.miniChipText}>{inspectedTodayCount} bearings inspected</Text>
                        </View>
                        <View style={styles.miniChip}>
                            <MaterialCommunityIcons name="check-decagram" size={16} color="#10b981" />
                            <Text style={styles.miniChipText}>{acceptedCount} accepted</Text>
                        </View>
                        <View style={styles.miniChip}>
                            <MaterialCommunityIcons name="alert-circle" size={16} color="#f59e0b" />
                            <Text style={styles.miniChipText}>{holdCount} on hold</Text>
                        </View>
                    </ScrollView>

                    {/* Quick Access Grid Title */}
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="view-grid" size={20} color="#002045" />
                        <Text style={styles.sectionTitle}>Quick Access Modules</Text>
                    </View>

                    {/* Quick Action Grid */}
                    <View style={styles.grid}>
                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('NewCTRB')}>
                            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                                <MaterialCommunityIcons name="qrcode-scan" size={28} color="#2563eb" />
                            </View>
                            <Text style={styles.cardText}>Intake New CTRB</Text>
                            <Text style={styles.cardSubText}>Scan & receive record</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Inspection')}>
                            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
                                <MaterialCommunityIcons name="clipboard-check-outline" size={28} color="#10b981" />
                            </View>
                            <Text style={styles.cardText}>Component Inspections</Text>
                            <Text style={styles.cardSubText}>Dimensional & visual</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Assembly')}>
                            <View style={[styles.iconBox, { backgroundColor: '#faf5ff' }]}>
                                <MaterialCommunityIcons name="speedometer" size={28} color="#a855f7" />
                            </View>
                            <Text style={styles.cardText}>Submit Assembly & QC</Text>
                            <Text style={styles.cardSubText}>Grease & lateral checks</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Traceability')}>
                            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                                <MaterialCommunityIcons name="history" size={28} color="#f97316" />
                            </View>
                            <Text style={styles.cardText}>Traceability Explorer</Text>
                            <Text style={styles.cardSubText}>Timeline & repair history</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Active Jobs Section */}
                    <View style={styles.jobsHeader}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#002045" />
                            <Text style={styles.sectionTitle}>Active Workshop Queue</Text>
                        </View>
                        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
                            <MaterialCommunityIcons name="refresh" size={18} color="#002045" />
                            <Text style={styles.refreshText}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    {activeJobs.length === 0 ? (
                        <View style={styles.emptyQueueBox}>
                            <MaterialCommunityIcons name="tray-arrow-down" size={32} color="#94a3b8" />
                            <Text style={styles.emptyQueueText}>No active jobs in queue.</Text>
                            <Text style={styles.emptyQueueSubText}>Intake a new bearing or search completed units.</Text>
                        </View>
                    ) : (
                        <View style={styles.queueContainer}>
                            {activeJobs.map((item) => {
                                const statusStyle = getStatusStyle(item.status);
                                return (
                                    <TouchableOpacity 
                                        key={item.id} 
                                        style={[styles.queueItem, { borderLeftWidth: 5, borderLeftColor: statusStyle.color }]}
                                        onLongPress={() => handleQueueLongPress(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.queueItemMain}>
                                            <Text style={styles.queueJobId}>{item.job_id}</Text>
                                            <View style={styles.ctrbBadgeRow}>
                                                <Text style={styles.queueSerial}>{item.ctrb_number}</Text>
                                                <View style={styles.makeBadge}>
                                                    <Text style={styles.makeBadgeText}>{item.make.slice(0, 3).toUpperCase()}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.queueActions}>
                                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                                    {statusStyle.label}
                                                </Text>
                                            </View>
                                            <TouchableOpacity 
                                                style={styles.actionArrow}
                                                onPress={() => {
                                                    if (item.status === 'received' || item.status === 'under_inspection') {
                                                        navigation.navigate('Inspection', { autoSelectId: item.id });
                                                    } else {
                                                        navigation.navigate('Assembly', { autoSelectId: item.id });
                                                    }
                                                }}
                                            >
                                                <MaterialCommunityIcons name="chevron-right" size={24} color="#002045" />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f8fafd' 
    },
    scrollContainer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 16,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 20,
    },
    railwayTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#ffb55c',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    supervisorName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#002045',
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        minHeight: 44,
        minWidth: 44,
    },
    logoutText: {
        color: '#ef4444',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 13,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        backgroundColor: '#ffffff',
        width: '47%',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
        position: 'relative',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 4,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#002045',
    },
    statIcon: {
        position: 'absolute',
        top: 12,
        right: 12,
        opacity: 0.15,
    },
    miniAnalyticsStrip: {
        flexDirection: 'row',
        marginBottom: 24,
        paddingVertical: 4,
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    miniChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        marginLeft: 6,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#002045',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    grid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 28,
    },
    card: { 
        backgroundColor: '#ffffff', 
        width: '48%',
        padding: 20, 
        borderRadius: 16, 
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardText: { 
        fontSize: 14, 
        fontWeight: '700', 
        color: '#002045' 
    },
    cardSubText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    jobsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        minHeight: 44,
    },
    refreshText: {
        color: '#002045',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    },
    emptyQueueBox: {
        backgroundColor: '#ffffff',
        padding: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyQueueText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
        marginTop: 8,
    },
    emptyQueueSubText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        textAlign: 'center',
    },
    queueContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 2,
    },
    queueItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    queueItemMain: {
        flex: 1,
    },
    queueJobId: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    ctrbBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 8,
    },
    queueSerial: {
        fontSize: 14,
        fontWeight: '700',
        color: '#002045',
    },
    makeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    makeBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#475569',
    },
    queueActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    actionArrow: {
        padding: 6,
        minHeight: 44,
        minWidth: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetDbButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        minHeight: 44,
    },
    resetDbText: {
        color: '#475569',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 13,
    }
});
