import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import apiClient from '../api/apiClient';

export default function AssemblyScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const [ctrbRecords, setCtrbRecords] = useState([]);
    const [selectedCtrbId, setSelectedCtrbId] = useState('');
    const [greaseType, setGreaseType] = useState('AAR M-942');
    const [greaseQty, setGreaseQty] = useState('');
    const [lateralDevice, setLateralDevice] = useState('hand'); // 'hand' or 'power'
    const [lateralPlay, setLateralPlay] = useState('');
    const [qcInspectorId, setQcInspectorId] = useState('qc301');
    const [remarks, setRemarks] = useState('');
    const [loading, setLoading] = useState(false);
    const [operatorId, setOperatorId] = useState('');
    const [focusedInput, setFocusedInput] = useState(null);
    const [inspectionsValid, setInspectionsValid] = useState(false);
    const [inspectionsChecked, setInspectionsChecked] = useState(false);

    // Find the currently selected CTRB metadata
    const currentCtrb = ctrbRecords.find(c => c.id === selectedCtrbId);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch logged-in user
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setOperatorId(user.id);
                }

                // Fetch CTRBs (received, under inspection, assembly)
                const records = await database.collections.get('ctrb_records').query().fetch();
                // Filter records to only show received, under_inspection, assembly
                const filtered = records.filter(r => ['received', 'under_inspection', 'assembly'].includes(r.status));
                setCtrbRecords(filtered);
                
                // Read auto-selection parameter from dashboard
                const autoSelectId = route.params?.autoSelectId;
                if (autoSelectId && filtered.some(r => r.id === autoSelectId)) {
                    setSelectedCtrbId(autoSelectId);
                } else if (filtered.length > 0) {
                    setSelectedCtrbId(filtered[0].id);
                }
            } catch (err) {
                console.error('Failed to load local CTRB records', err);
            }
        };
        loadInitialData();
    }, [route.params]);

    const [checklist, setChecklist] = useState({
        coneDim: false,
        cupDim: false,
        spacerDim: false,
        coneVis: false,
        cupVis: false,
        replacementsLinked: true
    });

    useEffect(() => {
        const verifyInspectionsExist = async () => {
            if (!selectedCtrbId) {
                setInspectionsValid(false);
                setInspectionsChecked(true);
                return;
            }
            try {
                const inspections = await database.collections.get('inspections').query().fetch();
                const matched = inspections.filter(i => i.ctrb_id === selectedCtrbId);
                
                const checks = {
                    coneDim: false,
                    cupDim: false,
                    spacerDim: false,
                    coneVis: false,
                    cupVis: false,
                    replacementsLinked: true
                };

                let hasFailure = false;

                matched.forEach(i => {
                    try {
                        const data = JSON.parse(i.payload);
                        const isPassed = i.type === 'visual' ? data.overall_result === 'accepted' : data.result === 'accepted';
                        
                        if (i.component === 'cone') {
                            if (i.type === 'dimensional') checks.coneDim = true;
                            if (i.type === 'visual') checks.coneVis = true;
                        } else if (i.component === 'cup') {
                            if (i.type === 'dimensional') checks.cupDim = true;
                            if (i.type === 'visual') checks.cupVis = true;
                        } else if (i.component === 'spacer') {
                            if (i.type === 'dimensional') checks.spacerDim = true;
                        }

                        if (!isPassed) {
                            hasFailure = true;
                            if (!data.replacement?.replacement_part_number) {
                                checks.replacementsLinked = false;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing inspection queue payload', e);
                    }
                });

                if (!hasFailure) {
                    checks.replacementsLinked = true;
                }

                setChecklist(checks);
                
                const allPassed = checks.coneDim && checks.cupDim && checks.spacerDim && checks.coneVis && checks.cupVis && checks.replacementsLinked;
                setInspectionsValid(allPassed);
                setInspectionsChecked(true);
            } catch (err) {
                console.error('Error verifying inspections existence:', err);
                setInspectionsValid(false);
                setInspectionsChecked(true);
            }
        };
        verifyInspectionsExist();
    }, [selectedCtrbId]);

    // Live validation checks
    const getGreaseValidation = () => {
        const qty = parseFloat(greaseQty);
        if (isNaN(qty)) return null;
        return qty >= 370 && qty <= 410;
    };

    const getPlayValidation = () => {
        const play = parseFloat(lateralPlay);
        if (isNaN(play)) return null;

        if (lateralDevice === 'hand') {
            return play >= 0.510 && play <= 0.660;
        } else {
            return play >= 0.580 && play <= 0.740;
        }
    };

    const handleSave = async () => {
        if (!selectedCtrbId) {
            Alert.alert('Validation Error', 'Please select a CTRB record.');
            return;
        }

        const gQty = parseFloat(greaseQty);
        if (isNaN(gQty)) {
            Alert.alert('Validation Error', 'Please enter a valid numeric grease quantity.');
            return;
        }

        const lPlay = parseFloat(lateralPlay);
        if (isNaN(lPlay)) {
            Alert.alert('Validation Error', 'Please enter a valid numeric lateral play measurement.');
            return;
        }

        if (gQty < 370 || gQty > 410) {
            Alert.alert('Out of Spec', 'Grease quantity must be between 370g and 410g.');
            return;
        }

        const playValid = getPlayValidation();
        if (playValid === false) {
            Alert.alert(
                'Out of Spec',
                `Lateral play is out of range for the ${lateralDevice} device. Do you still want to proceed?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Proceed', onPress: () => submitData(gQty, lPlay) }
                ]
            );
        } else {
            submitData(gQty, lPlay);
        }
    };

    const submitData = async (gQty, lPlay) => {
        setLoading(true);

        try {
            // Check inspection failures without replacements
            const inspections = await database.collections.get('inspections').query().fetch();
            const matched = inspections.filter(i => i.ctrb_id === selectedCtrbId);

            let hasInspectionFailureWithoutReplacement = false;

            for (const i of matched) {
                try {
                    const data = JSON.parse(i.payload);
                    const isPassed = i.type === 'visual' ? data.overall_result === 'accepted' : data.result === 'accepted';
                    if (!isPassed && !data.replacement?.replacement_part_number) {
                        hasInspectionFailureWithoutReplacement = true;
                        break;
                    }
                } catch (e) {
                    console.error('Error parsing inspection payload:', e);
                }
            }

            const greasePlayPassed = getGreaseValidation() && getPlayValidation();
            let finalStatus;

            if (hasInspectionFailureWithoutReplacement) {
                finalStatus = 'rejected';
            } else {
                finalStatus = greasePlayPassed ? 'ready' : 'scrap';
            }

            const payload = {
                ctrb_id: selectedCtrbId,
                grease_type: greaseType,
                grease_qty_g: gQty,
                lateral_play_mm: lPlay,
                lateral_device: lateralDevice,
                qc_inspector_id: qcInspectorId || 'mock-qc-id',
                remarks: remarks,
                final_status: finalStatus
            };

            let apiSuccess = false;

            // Attempt backend API post
            try {
                await apiClient.post('/assembly', payload);
                apiSuccess = true;
            } catch (apiErr) {
                console.log('Failed to post assembly to API, continuing offline-only...', apiErr.message);
            }

            // Update local CTRB status in SQLite database
            await database.write(async () => {
                const ctrb = await database.collections.get('ctrb_records').find(selectedCtrbId);
                await ctrb.update(record => {
                    record.status = finalStatus;
                });
            });

            if (finalStatus === 'rejected') {
                Alert.alert(
                    'Inspection Rejection',
                    'This unit was marked as REJECTED due to failed component inspections without recorded replacement parts.',
                    [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
                );
            } else {
                Alert.alert(
                    'Success', 
                    apiSuccess 
                        ? `Assembly saved and synced successfully. Final Status: ${finalStatus.toUpperCase()}`
                        : `Stored offline locally. Final Status: ${finalStatus.toUpperCase()}`,
                    [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
                );
            }
        } catch (err) {
            Alert.alert('Database Error', 'Failed to update record in local database.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (ctrbRecords.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="database-alert" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No CTRB records found ready for assembly.</Text>
                <Text style={styles.subtext}>Please receive and inspect components first.</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Dashboard')}>
                    <Text style={styles.backButtonText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const greaseValid = getGreaseValidation();
    const playValid = getPlayValidation();

    const renderChecklistCard = () => {
        if (!selectedCtrbId || !checklist) return null;

        const items = [
            { label: 'Cone Dimensional Inspection', key: 'coneDim' },
            { label: 'Cup Dimensional Inspection', key: 'cupDim' },
            { label: 'Spacer Dimensional Inspection', key: 'spacerDim' },
            { label: 'Cone Visual Inspection', key: 'coneVis' },
            { label: 'Cup Visual Inspection', key: 'cupVis' },
            { label: 'All Replacements Linked', key: 'replacementsLinked' }
        ];

        return (
            <View style={styles.checklistCard}>
                <View style={styles.checklistHeader}>
                    <MaterialCommunityIcons name="clipboard-list-outline" size={20} color="#002045" />
                    <Text style={styles.checklistTitle}>Pre-Assembly Quality Checklist</Text>
                </View>
                <View style={styles.checklistGrid}>
                    {items.map((item, index) => {
                        const status = checklist[item.key];
                        return (
                            <View key={index} style={styles.checkRow}>
                                <MaterialCommunityIcons 
                                    name={status ? "check-circle" : "close-circle"} 
                                    size={18} 
                                    color={status ? "#10b981" : "#ef4444"} 
                                />
                                <Text style={[styles.checkLabel, { color: status ? '#334155' : '#94a3b8' }]}>
                                    {item.label}
                                </Text>
                                <View style={[styles.checkBadge, { backgroundColor: status ? '#d1fae5' : '#fee2e2' }]}>
                                    <Text style={[styles.checkBadgeText, { color: status ? '#065f46' : '#991b1b' }]}>
                                        {status ? "OK" : "MISSING"}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafd' }} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
            >
                {/* Top Bar Header */}
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#002045" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Assembly & QC Verification</Text>
                    <View style={{ width: 24 }} />
                </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.accentBorder} />

                    {/* CTRB Selection Banner */}
                    <View style={styles.metaBanner}>
                        <View style={styles.metaMain}>
                            <Text style={styles.metaTitle}>Unit Serial: {currentCtrb?.ctrb_number}</Text>
                            <Text style={styles.metaSub}>Job ID: {currentCtrb?.job_id} | Manufacturer: {currentCtrb?.make.toUpperCase()}</Text>
                        </View>
                        <View style={styles.metaStatusBadge}>
                            <Text style={styles.metaStatusText}>{currentCtrb?.status.toUpperCase()}</Text>
                        </View>
                    </View>

                    {/* Checklist Card */}
                    {renderChecklistCard()}
 
                    {/* CTRB Dropdown List in case they want to switch */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>SELECT CTRB UNIT IN QUEUE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorGrid}>
                            {ctrbRecords.map((c) => {
                                const isActive = selectedCtrbId === c.id;
                                return (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.selectorButton, isActive && styles.selectorButtonActive]}
                                        onPress={() => setSelectedCtrbId(c.id)}
                                    >
                                        <Text style={[styles.selectorText, isActive && styles.selectorTextActive]}>
                                            {c.ctrb_number}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Grease Type */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>GREASE COMPOUND BRAND / TYPE</Text>
                        <View style={[styles.inputWrapper, focusedInput === 'greaseType' && styles.inputWrapperFocused]}>
                            <MaterialCommunityIcons name="oil" size={22} color={focusedInput === 'greaseType' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. AAR Approved M-942"
                                placeholderTextColor="#94a3b8"
                                value={greaseType}
                                onChangeText={setGreaseType}
                                onFocus={() => setFocusedInput('greaseType')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                    </View>

                    {/* Grease Qty */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>GREASE APPLIED QUANTITY (GRAMS)</Text>
                        <View style={[styles.inputWrapper, focusedInput === 'greaseQty' && styles.inputWrapperFocused]}>
                            <MaterialCommunityIcons name="scale" size={22} color={focusedInput === 'greaseQty' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="AAR Standard: 390g ± 20g"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={greaseQty}
                                onChangeText={setGreaseQty}
                                onFocus={() => setFocusedInput('greaseQty')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                        {greaseValid !== null && (
                            <View style={[styles.validationMsgBox, greaseValid ? styles.validBox : styles.invalidBox]}>
                                <MaterialCommunityIcons 
                                    name={greaseValid ? "check-circle" : "alert-circle"} 
                                    size={16} 
                                    color={greaseValid ? "#10b981" : "#ef4444"} 
                                />
                                <Text style={[styles.validationText, { color: greaseValid ? "#10b981" : "#ef4444" }]}>
                                    {greaseValid ? 'Grease quantity fits AAR specs (370g - 410g)' : 'OUT OF SPEC! Requirements require 370g - 410g'}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Lateral Device Selection */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>LATERAL PLAY MEASURING INSTRUMENT</Text>
                        <View style={styles.deviceRow}>
                            <TouchableOpacity
                                style={[styles.deviceBtn, lateralDevice === 'hand' && styles.deviceBtnActive]}
                                onPress={() => setLateralDevice('hand')}
                            >
                                <MaterialCommunityIcons name="hand-back-right-outline" size={22} color={lateralDevice === 'hand' ? 'white' : '#64748b'} />
                                <Text style={[styles.deviceBtnText, lateralDevice === 'hand' && styles.deviceBtnTextActive]}>HAND OPERATED</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.deviceBtn, lateralDevice === 'power' && styles.deviceBtnActive]}
                                onPress={() => setLateralDevice('power')}
                            >
                                <MaterialCommunityIcons name="power" size={22} color={lateralDevice === 'power' ? 'white' : '#64748b'} />
                                <Text style={[styles.deviceBtnText, lateralDevice === 'power' && styles.deviceBtnTextActive]}>POWER OPERATED</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Lateral Play Value */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>MEASURED LATERAL PLAY (MM)</Text>
                        <View style={[styles.inputWrapper, focusedInput === 'lateralPlay' && styles.inputWrapperFocused]}>
                            <MaterialCommunityIcons name="arrow-expand-horizontal" size={22} color={focusedInput === 'lateralPlay' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={lateralDevice === 'hand' ? 'Target Range: 0.510mm - 0.660mm' : 'Target Range: 0.580mm - 0.740mm'}
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={lateralPlay}
                                onChangeText={setLateralPlay}
                                onFocus={() => setFocusedInput('lateralPlay')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                        {playValid !== null && (
                            <View style={[styles.validationMsgBox, playValid ? styles.validBox : styles.invalidBox]}>
                                <MaterialCommunityIcons 
                                    name={playValid ? "check-circle" : "alert-circle"} 
                                    size={16} 
                                    color={playValid ? "#10b981" : "#ef4444"} 
                                />
                                <Text style={[styles.validationText, { color: playValid ? "#10b981" : "#ef4444" }]}>
                                    {playValid 
                                        ? `Lateral play fits specifications (${lateralDevice === 'hand' ? '0.510-0.660mm' : '0.580-0.740mm'})` 
                                        : `OUT OF SPEC! Target limits: ${lateralDevice === 'hand' ? '0.510-0.660mm' : '0.580-0.740mm'}`}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Inspector Sign-off ID */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>QC INSPECTOR DIGITAL SIGNATURE / PIN</Text>
                        <View style={[styles.inputWrapper, focusedInput === 'qcInspectorId' && styles.inputWrapperFocused]}>
                            <MaterialCommunityIcons name="badge-account-outline" size={22} color={focusedInput === 'qcInspectorId' ? '#002045' : '#64748b'} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter QC ID (e.g. qc301)"
                                placeholderTextColor="#94a3b8"
                                value={qcInspectorId}
                                onChangeText={setQcInspectorId}
                                onFocus={() => setFocusedInput('qcInspectorId')}
                                onBlur={() => setFocusedInput(null)}
                            />
                        </View>
                    </View>

                    {/* Remarks */}
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>ASSEMBLY / QC REMARKS</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Type assembly remarks..."
                            placeholderTextColor="#94a3b8"
                            multiline
                            numberOfLines={3}
                            value={remarks}
                            onChangeText={setRemarks}
                        />
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveBtn, (loading || !inspectionsValid) && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={loading || !inspectionsValid}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.saveBtnContent}>
                                <MaterialCommunityIcons name="file-sign" size={22} color="white" />
                                <Text style={styles.saveBtnText}>Verify specs & Submit Sign-off</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#faf9fd' 
    },
    scrollContainer: { 
        padding: 24, 
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
    card: {
        backgroundColor: '#ffffff',
        padding: 24,
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
    },
    accentBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        backgroundColor: '#ffb55c',
    },
    metaBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    metaMain: {
        flex: 1,
    },
    metaTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#002045',
    },
    metaSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    metaStatusBadge: {
        backgroundColor: '#ffb55c',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    metaStatusText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#002045',
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 1,
        marginBottom: 10,
    },
    selectorGrid: {
        gap: 8,
        paddingBottom: 4,
    },
    selectorButton: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    selectorButtonActive: {
        backgroundColor: '#002045',
        borderColor: '#002045',
    },
    selectorText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    selectorTextActive: {
        color: '#ffffff',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 12,
    },
    inputWrapperFocused: {
        borderColor: '#002045',
        borderWidth: 2,
        backgroundColor: '#ffffff',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1a1c1e',
    },
    validationMsgBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    validBox: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
    },
    invalidBox: {
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5',
    },
    validationText: {
        fontSize: 12,
        fontWeight: '700',
    },
    deviceRow: {
        flexDirection: 'row',
        gap: 12,
    },
    deviceBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
        gap: 8,
    },
    deviceBtnActive: {
        backgroundColor: '#002045',
        borderColor: '#002045',
    },
    deviceBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    deviceBtnTextActive: {
        color: '#ffffff',
    },
    textArea: {
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 8,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        color: '#1a1c1e',
        textAlignVertical: 'top',
    },
    saveBtn: {
        backgroundColor: '#002045',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#002045',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    saveBtnDisabled: {
        backgroundColor: '#adc7f7',
    },
    saveBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 32, 
        backgroundColor: '#faf9fd' 
    },
    emptyText: { 
        fontSize: 16, 
        fontWeight: 'bold', 
        color: '#475569', 
        textAlign: 'center', 
        marginTop: 12,
        marginBottom: 4 
    },
    subtext: { 
        fontSize: 13, 
        color: '#94a3b8', 
        textAlign: 'center', 
        marginBottom: 24 
    },
    backButton: { 
        backgroundColor: '#002045', 
        paddingVertical: 12, 
        paddingHorizontal: 20, 
        borderRadius: 8 
    },
    backButtonText: { 
        color: '#fff', 
        fontSize: 14, 
        fontWeight: 'bold' 
    },
    checklistCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
        marginBottom: 10,
    },
    checklistTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#002045',
        textTransform: 'uppercase',
    },
    checklistGrid: {
        gap: 10,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 2,
    },
    checkLabel: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },
    checkBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    checkBadgeText: {
        fontSize: 9,
        fontWeight: '800',
    }
});
