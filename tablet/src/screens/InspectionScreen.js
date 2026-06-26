import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import CameraComponent from '../components/CameraComponent';
import apiClient from '../api/apiClient';

export default function InspectionScreen({ route, navigation }) {
    const insets = useSafeAreaInsets();
    const [ctrbRecords, setCtrbRecords] = useState([]);
    const [selectedCtrbId, setSelectedCtrbId] = useState('');
    const [component, setComponent] = useState('cone');
    const [type, setType] = useState('visual'); // 'visual' or 'dimensional'
    const [operatorId, setOperatorId] = useState('');
    const [loading, setLoading] = useState(false);

    // Camera State
    const [showCamera, setShowCamera] = useState(false);
    const [photos, setPhotos] = useState([]);

    // Dimensional Values by Parameter Key
    const [dimensionalValues, setDimensionalValues] = useState({});
    const [paramKey, setParamKey] = useState('cone_bore');
    const [measuredValue, setMeasuredValue] = useState('');

    // Component-level Visual Results
    const [visualResults, setVisualResults] = useState({}); // { cone: 'accepted', cup: 'accepted', ... }
    const [defectsByComponent, setDefectsByComponent] = useState({}); // { cone: ['pitting'], ... }
    const [remarksByComponent, setRemarksByComponent] = useState({}); // { cone: 'some remarks', ... }
    const [replacementsByComponent, setReplacementsByComponent] = useState({}); // { cone: { sn: 'SN123', cause: 'reason' }, ... }

    // Helpers to get component-specific values
    const getVisualResultForComp = (comp) => visualResults[comp] !== undefined ? visualResults[comp] : null;
    const getDefectsForComp = (comp) => defectsByComponent[comp] || [];
    const getRemarksForComp = (comp) => remarksByComponent[comp] || '';
    const getReplacementSnForComp = (comp) => replacementsByComponent[comp]?.sn || '';
    const getReplacementCauseForComp = (comp) => replacementsByComponent[comp]?.cause || '';

    // Database savers
    const saveVisualField = async (comp, currentVisResults, currentDefects, currentRemarks, currentReps) => {
        if (!selectedCtrbId) return;

        const visResult = currentVisResults[comp];
        if (visResult === undefined || visResult === null) {
            console.log(`Skipping auto-save visual field for ${comp} since decision is not set yet.`);
            return;
        }
        const defects = currentDefects[comp] || [];
        const rems = currentRemarks[comp] || '';
        
        const AUTO_REJECT_DEFECTS = ['electric_burn', 'spalling', 'cage_damage', 'vent_holes', 'backing_ring_cracked', 'broken'];
        const hasCriticalDefect = defects.some(d => AUTO_REJECT_DEFECTS.includes(d));
        const isPassed = visResult === 'accepted' && !hasCriticalDefect;

        const payload = {
            ctrb_id: selectedCtrbId,
            component: comp,
            is_present: true,
            defects: defects,
            remarks: rems,
            overall_result: isPassed ? 'accepted' : 'rejected',
            operator_id: operatorId || 'mock-operator-id',
            photos: photos
        };

        const rep = currentReps[comp];
        if (!isPassed && rep?.sn?.trim()) {
            payload.replacement = {
                component: comp,
                rejection_cause: `Visual defects: ${defects.join(', ') || rems}`,
                replacement_part_number: rep.sn.trim(),
                notes: rep.cause?.trim() || ''
            };
        }

        try {
            const inspectionsRef = database.collections.get('inspections');
            const existing = await inspectionsRef.query().fetch();
            const matchedRecord = existing.find(i => 
                i.ctrb_id === selectedCtrbId && 
                i.type === 'visual' && 
                i.component === comp
            );

            await database.write(async () => {
                if (matchedRecord) {
                    await matchedRecord.update(record => {
                        record.payload = JSON.stringify(payload);
                    });
                } else {
                    await inspectionsRef.create(record => {
                        record.ctrb_id = selectedCtrbId;
                        record.component = comp;
                        record.type = 'visual';
                        record.payload = JSON.stringify(payload);
                        record.is_synced = false;
                    });
                }
            });
            console.log(`Auto-saved visual check for ${comp}`);
        } catch (err) {
            console.error('Failed to auto-save visual field', err);
        }
    };

    const saveDimensionalField = async (pKey, valStr, currentReps) => {
        const val = parseFloat(valStr);
        if (isNaN(val) || !selectedCtrbId) return;

        const spec = specs[pKey];
        if (!spec) return;

        const isPassed = val >= spec.min && val <= spec.max;
        
        let comp = 'cone';
        if (['cup_counter_bore', 'cup_od', 'cup_roundness'].includes(pKey)) comp = 'cup';
        else if (['spacer_width', 'spacer_parallelity'].includes(pKey)) comp = 'spacer';
        else if (['seal_groove_depth', 'grease_seal_roundness'].includes(pKey)) comp = 'seal';
        else if (['backing_ring_id'].includes(pKey)) comp = 'backing_ring';

        const payload = {
            ctrb_id: selectedCtrbId,
            component: comp,
            param_key: pKey,
            measured_value: val,
            result: isPassed ? 'accepted' : 'rejected',
            operator_id: operatorId || 'mock-operator-id'
        };

        const rep = (currentReps || replacementsByComponent)[comp];
        if (!isPassed && rep?.sn?.trim()) {
            payload.replacement = {
                component: comp,
                rejection_cause: `Dimensional check failed: ${pKey} = ${val} (Spec: ${spec.min}-${spec.max})`,
                replacement_part_number: rep.sn.trim(),
                notes: rep.cause?.trim() || ''
            };
        }

        try {
            const inspectionsRef = database.collections.get('inspections');
            const existing = await inspectionsRef.query().fetch();
            const matchedRecord = existing.find(i => 
                i.ctrb_id === selectedCtrbId && 
                i.type === 'dimensional' && 
                i.component === comp &&
                JSON.parse(i.payload).param_key === pKey
            );

            await database.write(async () => {
                if (matchedRecord) {
                    await matchedRecord.update(record => {
                        record.payload = JSON.stringify(payload);
                    });
                } else {
                    await inspectionsRef.create(record => {
                        record.ctrb_id = selectedCtrbId;
                        record.component = comp;
                        record.type = 'dimensional';
                        record.payload = JSON.stringify(payload);
                        record.is_synced = false;
                    });
                }
            });
            console.log(`Auto-saved dimensional field ${pKey}`);
        } catch (err) {
            console.error('Failed to auto-save dimensional field', err);
        }
    };

    const saveAllDimensionalFieldsForComponent = async (comp, currentDims, currentReps) => {
        const dims = currentDims || dimensionalValues;
        for (const pKey of Object.keys(dims)) {
            let pComp = 'cone';
            if (['cup_counter_bore', 'cup_od', 'cup_roundness'].includes(pKey)) pComp = 'cup';
            else if (['spacer_width', 'spacer_parallelity'].includes(pKey)) pComp = 'spacer';
            else if (['seal_groove_depth', 'grease_seal_roundness'].includes(pKey)) pComp = 'seal';
            else if (['backing_ring_id'].includes(pKey)) pComp = 'backing_ring';

            if (pComp === comp) {
                await saveDimensionalField(pKey, dims[pKey], currentReps);
            }
        }
    };

    // Component-level Visual Setters
    const setVisualResultForComp = (comp, val) => {
        setVisualResults(prev => {
            const next = { ...prev, [comp]: val };
            saveVisualField(comp, next, defectsByComponent, remarksByComponent, replacementsByComponent);
            return next;
        });
    };

    const setDefectsForComp = (comp, val) => {
        setDefectsByComponent(prev => {
            const next = { ...prev, [comp]: val };
            saveVisualField(comp, visualResults, next, remarksByComponent, replacementsByComponent);
            return next;
        });
    };

    const setRemarksForComp = (comp, val) => {
        setRemarksByComponent(prev => {
            const next = { ...prev, [comp]: val };
            saveVisualField(comp, visualResults, defectsByComponent, next, replacementsByComponent);
            return next;
        });
    };

    const setReplacementSnForComp = (comp, snVal) => {
        setReplacementsByComponent(prev => {
            const next = { ...prev, [comp]: { ...prev[comp], sn: snVal } };
            saveVisualField(comp, visualResults, defectsByComponent, remarksByComponent, next);
            saveAllDimensionalFieldsForComponent(comp, dimensionalValues, next);
            return next;
        });
    };

    const setReplacementCauseForComp = (comp, causeVal) => {
        setReplacementsByComponent(prev => {
            const next = { ...prev, [comp]: { ...prev[comp], cause: causeVal } };
            saveVisualField(comp, visualResults, defectsByComponent, remarksByComponent, next);
            saveAllDimensionalFieldsForComponent(comp, dimensionalValues, next);
            return next;
        });
    };

    // Find the currently selected CTRB make
    const currentCtrb = ctrbRecords.find(c => c.id === selectedCtrbId);
    const currentMake = currentCtrb ? currentCtrb.make : 'timken';

    // Get brand-specific G-81 specs
    const getSpecsForMake = (makeName) => {
        const make = (makeName || 'timken').toLowerCase();
        
        let cupOdMin = 220.345;
        let cupOdMax = 220.650;
        if (make === 'timken') {
            cupOdMin = 220.408;
        } else if (make === 'koyo') {
            cupOdMin = 220.662;
            cupOdMax = 220.800;
        }

        let backingRingIdMax = 178.511; // Timken, NEI, FAG
        if (make === 'skf') {
            backingRingIdMax = 178.562;
        }

        return {
            'cone_bore': { label: 'Cone Inner Diameter', min: 144.450, max: 144.488, unit: 'mm', gauge: 'Dial Bore Gauge' },
            'cone_bore_roundness': { label: 'Cone Bore Out of Roundness', min: 0, max: 0.076, unit: 'mm', gauge: 'Dial Bore Gauge' },
            'cage_roller_gap': { label: 'Cage & Roller Gap', min: 0, max: 1.500, unit: 'mm', gauge: 'Feeler Gauge' },
            'cage_flange_gap': { label: 'Cone Inner Race & Cage Gap', min: 0, max: 2.300, unit: 'mm', gauge: 'Feeler Gauge' },
            'cup_counter_bore': { label: 'Cup Counter Bore Diameter', min: 209.423, max: 209.677, unit: 'mm', gauge: 'Dial Bore Gauge' },
            'cup_od': { label: 'Cup Outside Diameter', min: cupOdMin, max: cupOdMax, unit: 'mm', gauge: 'Outside Micrometer' },
            'cup_roundness': { label: 'Cup Outer Dia Out of Roundness', min: 0, max: 0.127, unit: 'mm', gauge: 'Dial Bore Gauge' },
            'spacer_width': { label: 'Spacer Width', min: 38.100, max: 38.150, unit: 'mm', gauge: 'Micrometer' },
            'spacer_parallelity': { label: 'Spacer End Face Parallelity', min: 0, max: 0.025, unit: 'mm', gauge: 'Comparator' },
            'seal_groove_depth': { label: 'Bearing Seal Wear Groove Depth', min: 0, max: 0.130, unit: 'mm', gauge: 'Dial Indicator' },
            'grease_seal_roundness': { label: 'Grease Seal Out of Roundness', min: 0, max: 0.260, unit: 'mm', gauge: 'Mechanical Comparator' },
            'backing_ring_id': { label: 'Backing Ring ID', min: 178.384, max: backingRingIdMax, unit: 'mm', gauge: 'Dial Bore Gauge' }
        };
    };

    const specs = getSpecsForMake(currentMake);

    // Auto-update parameter key when component changes
    useEffect(() => {
        if (component === 'cone') setParamKey('cone_bore');
        else if (component === 'cup') setParamKey('cup_counter_bore');
        else if (component === 'spacer') setParamKey('spacer_width');
        else if (component === 'seal') setParamKey('seal_groove_depth');
        else if (component === 'backing_ring') setParamKey('backing_ring_id');
    }, [component]);

    // Live validation status
    const getValidationStatus = () => {
        const val = parseFloat(measuredValue);
        if (isNaN(val)) return null;

        const spec = specs[paramKey];
        if (!spec) return null;

        const passed = val >= spec.min && val <= spec.max;
        return passed ? 'PASSED' : 'FAILED';
    };

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load operator ID
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setOperatorId(user.id);
                }

                // Fetch local received CTRBs
                let records = await database.collections.get('ctrb_records').query().fetch();
                
                // Fetch recent records from the backend first to sync with local DB
                try {
                    const apiRes = await apiClient.get('/ctrb/recent?limit=50');
                    const backendRecords = apiRes.data?.data || [];
                    if (backendRecords.length > 0) {
                        await database.write(async () => {
                            const ctrbCollection = database.collections.get('ctrb_records');
                            for (const backendRecord of backendRecords) {
                                // Check if we already have it locally
                                const matched = records.find(r => r.id === backendRecord.id);
                                if (!matched) {
                                    await ctrbCollection.create(record => {
                                        record.id = backendRecord.id;
                                        record.ctrb_number = backendRecord.ctrb_number;
                                        record.job_id = backendRecord.job_id;
                                        record.make = backendRecord.make;
                                        record.date_received = backendRecord.date_received;
                                        record.status = backendRecord.status;
                                    });
                                } else if (matched.status !== backendRecord.status) {
                                    // Update status to sync
                                    await matched.update(record => {
                                        record.status = backendRecord.status;
                                    });
                                }
                            }
                        });
                        // Re-fetch local records after sync
                        records = await database.collections.get('ctrb_records').query().fetch();
                    }
                } catch (apiErr) {
                    console.log('Failed to sync recent CTRBs from backend in InspectionScreen:', apiErr.message);
                }

                // Read auto-selection parameter from dashboard
                const autoSelectId = route.params?.autoSelectId;
                if (autoSelectId) {
                    const existsLocally = records.some(r => r.id === autoSelectId);
                    if (!existsLocally) {
                        try {
                            const apiRes = await apiClient.get(`/ctrb/${autoSelectId}`);
                            const backendRecord = apiRes.data?.data;
                            if (backendRecord) {
                                await database.write(async () => {
                                    await database.collections.get('ctrb_records').create(record => {
                                        record.id = backendRecord.id;
                                        record.ctrb_number = backendRecord.ctrb_number;
                                        record.job_id = backendRecord.job_id;
                                        record.make = backendRecord.make;
                                        record.date_received = backendRecord.date_received;
                                        record.status = backendRecord.status;
                                    });
                                });
                                // Re-fetch local records
                                records = await database.collections.get('ctrb_records').query().fetch();
                            }
                        } catch (apiErr) {
                            console.log('Failed to fetch CTRB record from backend for local upsert:', apiErr.message);
                        }
                    }
                    setSelectedCtrbId(autoSelectId);
                } else {
                    setSelectedCtrbId('');
                }
                
                const filtered = records.filter(r => ['received', 'under_inspection', 'assembly'].includes(r.status));
                setCtrbRecords(filtered);
            } catch (err) {
                console.error('Failed to load data', err);
            }
        };
        loadInitialData();
    }, [route.params]);

    useEffect(() => {
        const fetchSavedInspections = async () => {
            if (!selectedCtrbId) return;
            try {
                const inspections = await database.collections.get('inspections').query().fetch();
                const matched = inspections.filter(i => i.ctrb_id === selectedCtrbId);

                const loadedDims = {};
                const loadedVisResults = {};
                const loadedDefects = {};
                const loadedRemarks = {};
                const loadedReps = {};

                matched.forEach(item => {
                    try {
                        const payload = JSON.parse(item.payload);
                        if (item.type === 'dimensional') {
                            if (payload.param_key) {
                                loadedDims[payload.param_key] = payload.measured_value.toString();
                            }
                        } else if (item.type === 'visual') {
                            const comp = item.component;
                            loadedVisResults[comp] = payload.overall_result;
                            loadedDefects[comp] = payload.defects || [];
                            loadedRemarks[comp] = payload.remarks || '';
                        }
                        
                        if (payload.replacement) {
                            loadedReps[item.component] = {
                                sn: payload.replacement.replacement_part_number || '',
                                cause: payload.replacement.notes || ''
                            };
                        }
                    } catch (e) {
                        console.error(e);
                    }
                });

                setDimensionalValues(loadedDims);
                setVisualResults(loadedVisResults);
                setDefectsByComponent(loadedDefects);
                setRemarksByComponent(loadedRemarks);
                setReplacementsByComponent(loadedReps);

                setMeasuredValue(loadedDims[paramKey] || '');
            } catch (err) {
                console.error('Failed to load saved inspections', err);
            }
        };
        fetchSavedInspections();
    }, [selectedCtrbId]);

    useEffect(() => {
        setMeasuredValue(dimensionalValues[paramKey] || '');
    }, [paramKey, dimensionalValues]);

    const handleMeasuredValueChange = (text) => {
        setMeasuredValue(text);
        setDimensionalValues(prev => {
            const next = { ...prev, [paramKey]: text };
            saveDimensionalField(paramKey, text);
            return next;
        });
    };

    const handleMeasuredValueBlur = () => {
        saveDimensionalField(paramKey, measuredValue);
    };

    // Defect checklist options by component
    const getDefectsForComponent = () => {
        switch (component) {
            case 'cone':
                return ['pitting', 'corrosion', 'spalling', 'cage_damage', 'smearing_discolor', 'electric_burn'];
            case 'cup':
                return ['water_mark_rust', 'indentation', 'oversize', 'pitted_corrosion', 'brinelling', 'spalls_flaking', 'broken', 'electric_burn'];
            case 'backing_ring':
                return ['vent_holes', 'backing_ring_cracked', 'corrosion', 'wear'];
            case 'spacer':
                return ['parallelity_failed', 'cracked', 'rust'];
            case 'seal':
                return ['lips_damaged', 'lip_worn', 'out_of_round'];
            default:
                return ['pitting', 'corrosion', 'spalling', 'wear', 'cracks', 'heavy_rust'];
        }
    };

    const toggleDefect = (defect) => {
        const compDefects = defectsByComponent[component] || [];
        let nextDefects;
        if (compDefects.includes(defect)) {
            nextDefects = compDefects.filter(d => d !== defect);
        } else {
            nextDefects = [...compDefects, defect];
        }
        setDefectsForComp(component, nextDefects);
    };

    const handleCameraCapture = (uri) => {
        setPhotos([...photos, uri]);
        setShowCamera(false);
    };

    const removePhoto = (index) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const visualResult = getVisualResultForComp(component);
    const selectedDefects = getDefectsForComp(component);
    const remarks = getRemarksForComp(component);
    const replacementSn = getReplacementSnForComp(component);
    const replacementCause = getReplacementCauseForComp(component);

    // Compute isFormReady for G-81 save block (Fix 2)
    const isFormReady = (() => {
        if (!selectedCtrbId) return false;
        if (type === 'visual') {
            if (visualResult !== 'accepted' && visualResult !== 'rejected') return false;
            if (visualResult === 'rejected') {
                const hasDefectsOrRemarks = selectedDefects.length > 0 || (remarks && remarks.trim() !== '');
                if (!hasDefectsOrRemarks) return false;
                const hasReplacementSn = replacementSn && replacementSn.trim() !== '';
                if (!hasReplacementSn) return false;
            }
            return true;
        } else if (type === 'dimensional') {
            if (!measuredValue || !measuredValue.trim()) return false;
            const val = parseFloat(measuredValue);
            return !isNaN(val);
        }
        return false;
    })();

    const setVisualResult = (val) => setVisualResultForComp(component, val);
    const setRemarks = (val) => setRemarksForComp(component, val);
    const setReplacementSn = (val) => setReplacementSnForComp(component, val);
    const setReplacementCause = (val) => setReplacementCauseForComp(component, val);

    const isComponentFailed = (comp) => {
        if (visualResults[comp] === 'rejected') {
            return true;
        }

        const defects = defectsByComponent[comp] || [];
        const AUTO_REJECT_DEFECTS = ['electric_burn', 'spalling', 'cage_damage', 'vent_holes', 'backing_ring_cracked', 'broken'];
        if (defects.some(d => AUTO_REJECT_DEFECTS.includes(d))) {
            return true;
        }

        for (const pKey of Object.keys(specs)) {
            let pComp = 'cone';
            if (['cup_counter_bore', 'cup_od', 'cup_roundness'].includes(pKey)) pComp = 'cup';
            else if (['spacer_width', 'spacer_parallelity'].includes(pKey)) pComp = 'spacer';
            else if (['seal_groove_depth', 'grease_seal_roundness'].includes(pKey)) pComp = 'seal';
            else if (['backing_ring_id'].includes(pKey)) pComp = 'backing_ring';

            if (pComp === comp) {
                const valStr = dimensionalValues[pKey];
                if (valStr) {
                    const val = parseFloat(valStr);
                    if (!isNaN(val)) {
                        const spec = specs[pKey];
                        if (spec && (val < spec.min || val > spec.max)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    const isFormComplete = () => {
        if (!selectedCtrbId) return false;
        
        if (type === 'visual') {
            const result = visualResults[component];
            if (!result) return false;
            if (isComponentFailed(component)) {
                const repSn = replacementsByComponent[component]?.sn;
                if (!repSn || !repSn.trim()) return false;
            }
            return true;
        } else if (type === 'dimensional') {
            if (!measuredValue || !measuredValue.trim()) return false;
            const val = parseFloat(measuredValue);
            if (isNaN(val)) return false;
            if (isComponentFailed(component)) {
                const repSn = replacementsByComponent[component]?.sn;
                if (!repSn || !repSn.trim()) return false;
            }
            return true;
        }
        return false;
    };

    const handleSave = async () => {
        if (!selectedCtrbId) {
            Alert.alert('Error', 'Please select a CTRB record.');
            return;
        }

        if (!isFormComplete()) {
            let errorMsg = '';
            if (type === 'visual') {
                const result = visualResults[component];
                if (!result) {
                    errorMsg = `Visual inspection decision for ${component.toUpperCase()} is required. Please select ACCEPTABLE or REJECT / REWORK.`;
                } else if (result === 'rejected' || isComponentFailed(component)) {
                    errorMsg = `Component ${component.toUpperCase()} has failed G-81 checks. You must record a Replacement Component Serial Number to establish G-81 traceability linking.`;
                }
            } else if (type === 'dimensional') {
                if (!measuredValue || !measuredValue.trim()) {
                    errorMsg = `A measured value is required for ${specs[paramKey]?.label || paramKey}.`;
                } else {
                    const val = parseFloat(measuredValue);
                    if (isNaN(val)) {
                        errorMsg = `A valid numeric value is required for ${specs[paramKey]?.label || paramKey}.`;
                    } else if (isComponentFailed(component)) {
                        errorMsg = `Component ${component.toUpperCase()} has failed G-81 checks. You must record a Replacement Component Serial Number to establish G-81 traceability linking.`;
                    }
                }
            }
            Alert.alert('Incomplete Form', errorMsg || 'Please complete all required fields before saving.');
            return;
        }

        setLoading(true);

        try {
            // First, make sure the currently open inputs are flushed/saved
            if (type === 'dimensional' && measuredValue) {
                await saveDimensionalField(paramKey, measuredValue);
            } else if (type === 'visual') {
                await saveVisualField(component, visualResults, defectsByComponent, remarksByComponent, replacementsByComponent);
            }

            // Attempt backend API post immediately (Fix 3a)
            try {
                if (type === 'dimensional') {
                    await apiClient.post('/inspections/dimensional', {
                        ctrb_id: selectedCtrbId,
                        cycle_id: 'OFFLINE-CYCLE',
                        component: component,
                        measurements: [
                            {
                                param_key: paramKey,
                                measured_value: parseFloat(measuredValue)
                            }
                        ]
                    });
                } else if (type === 'visual') {
                    await apiClient.post('/inspections/visual', {
                        ctrb_id: selectedCtrbId,
                        cycle_id: 'OFFLINE-CYCLE',
                        component: component,
                        is_present: true,
                        defects: selectedDefects,
                        remarks: remarks || ''
                    });
                }
                console.log('Successfully posted G-81 inspection to backend');
            } catch (apiErr) {
                console.log('Failed to post G-81 inspection to backend (offline mode fallback):', apiErr.message);
            }

            if (isComponentFailed(component) && replacementSn && replacementSn.trim() !== '') {
                try {
                    const cause = type === 'visual'
                        ? `Visual defects: ${selectedDefects.join(', ') || remarks}`
                        : `Dimensional check failed: ${paramKey} = ${measuredValue} (Spec: ${currentSpec?.min}-${currentSpec?.max})`;
                    
                    await apiClient.post('/assembly/replacements', {
                        ctrb_id: selectedCtrbId,
                        component: component,
                        rejection_cause: cause,
                        replacement_part_number: replacementSn.trim(),
                        notes: replacementCause?.trim() || ''
                    });
                    console.log('Successfully posted replacement link to backend');
                } catch (repErr) {
                    console.log('Failed to post replacement link to backend:', repErr.message);
                }
            }

            // Fetch all inspections for this CTRB to run compliance checks
            const inspectionsRef = database.collections.get('inspections');
            const inspections = await inspectionsRef.query().fetch();
            const ctrbInspections = inspections.filter(i => i.ctrb_id === selectedCtrbId);

            let hasFailedWithoutReplacement = false;
            let failedComponent = '';

            for (const i of ctrbInspections) {
                const payload = JSON.parse(i.payload);
                const isPassed = i.type === 'visual' ? payload.overall_result === 'accepted' : payload.result === 'accepted';
                if (!isPassed && !payload.replacement?.replacement_part_number) {
                    hasFailedWithoutReplacement = true;
                    failedComponent = i.component;
                    break;
                }
            }

            if (hasFailedWithoutReplacement) {
                Alert.alert(
                    'Traceability Error',
                    `G-81 compliance rejection triggered on component ${failedComponent.toUpperCase()}! You must record the Replacement Component Serial Number to establish traceability linking.`,
                    [{ text: 'OK', onPress: () => setLoading(false) }]
                );
                return;
            }

            // Write photo paths into local queue if present
            if (photos.length > 0) {
                await database.write(async () => {
                    for (let photoUri of photos) {
                        await database.collections.get('photo_queue').create(pq => {
                            pq.ctrb_id = selectedCtrbId;
                            pq.local_uri = photoUri;
                            pq.is_uploaded = false;
                        });
                    }
                });
            }

            // Update local CTRB status
            const ctrb = await database.collections.get('ctrb_records').find(selectedCtrbId);
            await database.write(async () => {
                await ctrb.update(record => {
                    record.status = 'under_inspection';
                });
            });

            Alert.alert(
                'Inspection Saved', 
                'Component inspections saved successfully and ready for next stage.', 
                [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
            );
        } catch (err) {
            Alert.alert('Error', 'Failed to store inspections.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (ctrbRecords.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="database-alert" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No CTRB records found in local database.</Text>
                <Text style={styles.subtext}>Please perform a new CTRB intake first.</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Dashboard')}>
                    <Text style={styles.backButtonText}>Back to Dashboard</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (showCamera) {
        return (
            <View style={{ flex: 1 }}>
                <CameraComponent onCapture={handleCameraCapture} onCancel={() => setShowCamera(false)} />
            </View>
        );
    }

    const getParamDotColor = (key) => {
        const valStr = dimensionalValues[key];
        if (!valStr || valStr.trim() === '') return '#94a3b8'; // Grey (not filled)
        const val = parseFloat(valStr);
        if (isNaN(val)) return '#94a3b8';
        const spec = specs[key];
        if (!spec) return '#94a3b8';
        const passed = val >= spec.min && val <= spec.max;
        return passed ? '#10b981' : '#ef4444'; // Green vs Red
    };

    const currentSpec = specs[paramKey];
    const validationStatus = getValidationStatus();

    // Render visual gauge for tolerances
    const renderToleranceGauge = () => {
        const val = parseFloat(measuredValue);
        if (isNaN(val) || !currentSpec) return null;

        const { min, max, unit } = currentSpec;
        const range = max - min;
        let color = '#10b981'; // Passed green
        let label = 'IN SPEC';

        if (val < min) {
            color = '#ef4444'; // Red (Under)
            label = 'UNDERSIZE';
        } else if (val > max) {
            color = '#ef4444'; // Red (Over)
            label = 'OVERSIZE';
        }

        let cursorPct = 50;
        if (val < min) {
            const delta = min - val;
            const rel = Math.min(delta / (min * 0.05 || 1), 1); // scale up to 5% dev
            cursorPct = 20 - (rel * 15);
        } else if (val > max) {
            const delta = val - max;
            const rel = Math.min(delta / (max * 0.05 || 1), 1);
            cursorPct = 80 + (rel * 15);
        } else {
            const fraction = range === 0 ? 0.5 : (val - min) / range;
            cursorPct = 20 + (fraction * 60);
        }

        return (
            <View style={styles.gaugeContainer}>
                <Text style={styles.gaugeCurrentText}>
                    Measured Value: <Text style={[styles.bold, { color }]}>{val} {unit}</Text>
                </Text>
                <View style={{ height: 16, borderRadius: 8, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#e2e8f0', position: 'relative', marginVertical: 12 }}>
                    <View style={{ flex: 2, backgroundColor: '#fecaca' }} />
                    <View style={{ flex: 6, backgroundColor: '#d1fae5' }} />
                    <View style={{ flex: 2, backgroundColor: '#fecaca' }} />
                    <View style={{
                        position: 'absolute',
                        top: -2,
                        bottom: -2,
                        left: `${Math.min(Math.max(cursorPct, 0), 100)}%`,
                        width: 6,
                        backgroundColor: color,
                        borderRadius: 3,
                        borderWidth: 1,
                        borderColor: '#ffffff',
                        transform: [{ translateX: -3 }]
                    }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                    <View style={{ alignItems: 'flex-start' }}>
                        <View style={{ height: 6, width: 2, backgroundColor: '#94a3b8', alignSelf: 'center' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 2 }}>{min} (Min)</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color, textTransform: 'uppercase' }}>{label}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ height: 6, width: 2, backgroundColor: '#94a3b8', alignSelf: 'center' }} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 2 }}>{max} (Max)</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderSummaryPanel = () => {
        if (!selectedCtrbId) return null;
        
        const enteredParams = Object.keys(specs).filter(key => dimensionalValues[key] !== undefined && dimensionalValues[key] !== '');
        
        return (
            <View style={styles.summaryPanel}>
                <View style={styles.summaryHeader}>
                    <MaterialCommunityIcons name="playlist-check" size={20} color="#002045" />
                    <Text style={styles.summaryTitle}>Dimensional Spec Checklist ({enteredParams.length} / {Object.keys(specs).length})</Text>
                </View>
                {enteredParams.length === 0 ? (
                    <Text style={styles.summaryEmptyText}>No measurement values recorded yet.</Text>
                ) : (
                    <View style={styles.summaryTable}>
                        {enteredParams.map(key => {
                            const spec = specs[key];
                            const valStr = dimensionalValues[key];
                            const val = parseFloat(valStr);
                            const specPassed = !isNaN(val) && val >= spec.min && val <= spec.max;
                            return (
                                <View key={key} style={styles.summaryTableRow}>
                                    <Text style={styles.summaryParamLabel}>{spec.label}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.summaryParamVal}>{valStr} {spec.unit}</Text>
                                        <View style={[styles.summaryBadge, { backgroundColor: specPassed ? '#d1fae5' : '#fee2e2' }]}>
                                            <Text style={[styles.summaryBadgeText, { color: specPassed ? '#065f46' : '#991b1b' }]}>
                                                {specPassed ? 'PASS' : 'FAIL'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafd' }} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.container}
            >
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#002045" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>G-81 Inspections Console</Text>
                    <View style={{ width: 24 }} />
                </View>

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.accentBorder} />

                    {selectedCtrbId ? (
                        <View style={styles.metaBanner}>
                            <View style={styles.metaMain}>
                                <Text style={styles.metaTitle}>Selected Bearings: {currentCtrb?.ctrb_number}</Text>
                                <Text style={styles.metaSub}>Job Ref: {currentCtrb?.job_id} | Brand: {currentMake.toUpperCase()}</Text>
                            </View>
                            <View style={styles.metaStatusBadge}>
                                <Text style={styles.metaStatusText}>{currentCtrb?.status.toUpperCase()}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.metaBanner, { borderColor: '#b45309', backgroundColor: '#fffbeb' }]}>
                            <View style={styles.metaMain}>
                                <Text style={[styles.metaTitle, { color: '#b45309' }]}>No Bearing Selected</Text>
                                <Text style={[styles.metaSub, { color: '#b45309' }]}>Please select a CTRB unit from the list below to begin component inspection.</Text>
                            </View>
                        </View>
                    )}

                    {!route.params?.autoSelectId ? (
                        <View style={styles.formGroup}>
                            <Text style={styles.sectionHeading}>SELECT CTRB UNIT IN QUEUE</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compSelectorRow}>
                                {ctrbRecords.map((c) => {
                                    const isActive = selectedCtrbId === c.id;
                                    return (
                                        <TouchableOpacity
                                            key={c.id}
                                            style={[styles.compButton, isActive && styles.compButtonActive]}
                                            onPress={() => setSelectedCtrbId(c.id)}
                                        >
                                            <Text style={[styles.compButtonText, isActive && styles.compButtonTextActive]}>
                                                {c.ctrb_number}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    ) : (
                        <View style={styles.formGroup}>
                            <Text style={styles.sectionHeading}>CTRB UNIT (LOCKED FOR INSPECTION)</Text>
                            <View style={[styles.compButton, styles.compButtonActive, { opacity: 0.6, alignSelf: 'flex-start' }]}>
                                <Text style={styles.compButtonTextActive}>{currentCtrb?.ctrb_number}</Text>
                            </View>
                        </View>
                    )}

                    {selectedCtrbId ? (
                        <>

                    <View style={styles.formGroup}>
                        <Text style={styles.sectionHeading}>SELECT TARGET COMPONENT</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compSelectorRow}>
                            {['cone', 'cup', 'spacer', 'seal', 'backing_ring'].map((comp) => {
                                const isActive = component === comp;
                                return (
                                    <TouchableOpacity
                                        key={comp}
                                        style={[styles.compButton, isActive && styles.compButtonActive]}
                                        onPress={() => {
                                            setComponent(comp);
                                        }}
                                    >
                                        <Text style={[styles.compButtonText, isActive && styles.compButtonTextActive]}>
                                            {comp.replace('_', ' ').toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, type === 'visual' && styles.tabButtonActive]}
                            onPress={() => setType('visual')}
                        >
                            <MaterialCommunityIcons name="eye-outline" size={18} color={type === 'visual' ? '#002045' : '#64748b'} />
                            <Text style={[styles.tabText, type === 'visual' && styles.tabTextActive]}>Visual Check</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabButton, type === 'dimensional' && styles.tabButtonActive]}
                            onPress={() => setType('dimensional')}
                        >
                            <MaterialCommunityIcons name="ruler-square" size={18} color={type === 'dimensional' ? '#002045' : '#64748b'} />
                            <Text style={[styles.tabText, type === 'dimensional' && styles.tabTextActive]}>Dimensional Gauging</Text>
                        </TouchableOpacity>
                    </View>

                    {type === 'visual' ? (
                        <View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>VISUAL INSPECTION DECISION</Text>
                                <View style={styles.decisionRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.decisionBtn,
                                            visualResult === 'accepted' && styles.decisionBtnAccept
                                        ]}
                                        onPress={() => setVisualResult('accepted')}
                                    >
                                        <MaterialCommunityIcons 
                                            name="check" 
                                            size={20} 
                                            color={visualResult === 'accepted' ? '#065F46' : '#64748B'} 
                                        />
                                        <Text style={[
                                            styles.decisionText, 
                                            visualResult === 'accepted' && styles.decisionTextAccept
                                        ]}>ACCEPTABLE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.decisionBtn,
                                            visualResult === 'rejected' && styles.decisionBtnReject
                                        ]}
                                        onPress={() => setVisualResult('rejected')}
                                    >
                                        <MaterialCommunityIcons 
                                            name="close" 
                                            size={20} 
                                            color={visualResult === 'rejected' ? '#991B1B' : '#64748B'} 
                                        />
                                        <Text style={[
                                            styles.decisionText, 
                                            visualResult === 'rejected' && styles.decisionTextReject
                                        ]}>REJECT / REWORK</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>SELECT REGISTERED DEFECTS</Text>
                                <View style={styles.defectGrid}>
                                    {getDefectsForComponent().map((def) => {
                                        const isChecked = selectedDefects.includes(def);
                                        return (
                                            <TouchableOpacity
                                                key={def}
                                                style={[styles.defectCard, isChecked && styles.defectCardChecked]}
                                                onPress={() => toggleDefect(def)}
                                            >
                                                <MaterialCommunityIcons 
                                                    name={isChecked ? "checkbox-marked" : "checkbox-blank-outline"} 
                                                    size={20} 
                                                    color={isChecked ? "#ef4444" : "#cbd5e1"} 
                                                />
                                                <Text style={[styles.defectCardText, isChecked && styles.defectCardTextChecked]}>
                                                    {def.replace(/_/g, ' ').toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>DOCUMENTED PHOTOS OF COMPONENT</Text>
                                <ScrollView horizontal contentContainerStyle={styles.photoContainer} showsHorizontalScrollIndicator={false}>
                                    <TouchableOpacity style={styles.snapButton} onPress={() => setShowCamera(true)}>
                                        <MaterialCommunityIcons name="camera-outline" size={24} color="#002045" />
                                        <Text style={styles.snapText}>Camera</Text>
                                    </TouchableOpacity>
                                    {photos.map((uri, index) => (
                                        <View key={uri} style={styles.photoPreviewWrapper}>
                                            <Image source={{ uri }} style={styles.photoPreview} />
                                            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(index)}>
                                                <MaterialCommunityIcons name="close-circle" size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>DEFECT REMARKS</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Type structural, wear, or cosmetic comments..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    numberOfLines={3}
                                    value={remarks}
                                    onChangeText={setRemarks}
                                />
                            </View>
                        </View>
                    ) : (
                        <View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>SELECT MEASUREMENT PARAMETER</Text>
                                <View style={styles.paramGrid}>
                                    {Object.keys(specs).map((key) => {
                                        const spec = specs[key];
                                        const isSelected = paramKey === key;
                                        const dotColor = getParamDotColor(key);
                                        return (
                                            <TouchableOpacity
                                                key={key}
                                                style={[styles.paramButton, isSelected && styles.paramButtonActive]}
                                                onPress={() => {
                                                    setParamKey(key);
                                                    setMeasuredValue(dimensionalValues[key] || '');
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
                                                    <Text style={[styles.paramButtonText, isSelected && styles.paramButtonTextActive]}>
                                                         {spec.label}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {currentSpec && (
                                <View style={styles.specCard}>
                                    <View style={styles.specCardHeader}>
                                        <MaterialCommunityIcons name="shield-check" size={20} color="#1e40af" />
                                        <Text style={styles.specCardTitle}>G-81 Standards & Gauge Tool</Text>
                                    </View>
                                    <Text style={styles.specText}>
                                        Allowed Limits: <Text style={styles.bold}>{currentSpec.min}</Text> to <Text style={styles.bold}>{currentSpec.max} {currentSpec.unit}</Text>
                                    </Text>
                                    <Text style={styles.gaugeText}>
                                        Required Calibration Instrument: <Text style={styles.bold}>{currentSpec.gauge}</Text>
                                    </Text>
                                </View>
                            )}

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>ENTER MEASURED VALUE ({currentSpec?.unit})</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={`Enter dimension (Range: ${currentSpec?.min}-${currentSpec?.max})`}
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="numeric"
                                    value={measuredValue}
                                    onChangeText={handleMeasuredValueChange}
                                    onBlur={handleMeasuredValueBlur}
                                />
                            </View>

                            {renderToleranceGauge()}
                        </View>
                    )}

                    {isComponentFailed(component) && (
                        <View style={styles.replacementCard}>
                            <View style={styles.replacementHeader}>
                                <MaterialCommunityIcons name="link-variant" size={18} color="#b45309" />
                                <Text style={styles.replacementTitle}>TRACEABILITY REPLACEMENT LINK</Text>
                            </View>
                            <Text style={styles.replacementSub}>
                                This component has failed G-81 verification. You must link it to a replacement serial number.
                            </Text>
                            
                            <View style={styles.replacementFormGroup}>
                                <Text style={styles.replacementLabel}>REPLACEMENT SERIAL NUMBER</Text>
                                <TextInput
                                    style={styles.replacementInput}
                                    placeholder="Enter replacement part serial/barcode"
                                    placeholderTextColor="#b45309"
                                    value={replacementSn}
                                    onChangeText={setReplacementSn}
                                />
                            </View>
                            
                            <View style={styles.replacementFormGroup}>
                                <Text style={styles.replacementLabel}>ADDITIONAL NOTES</Text>
                                <TextInput
                                    style={styles.replacementInput}
                                    placeholder="Rework or scrap disposition details..."
                                    placeholderTextColor="#b45309"
                                    value={replacementCause}
                                    onChangeText={setReplacementCause}
                                />
                            </View>
                        </View>
                    )}

                    {type === 'dimensional' && renderSummaryPanel()}

                    <TouchableOpacity
                        style={[
                            styles.saveBtnAction,
                            { 
                                backgroundColor: isFormReady ? '#002045' : '#94a3b8',
                                opacity: isFormReady ? 1.0 : 0.7
                            },
                            loading && styles.saveBtnActionDisabled
                        ]}
                        onPress={handleSave}
                        disabled={loading || !isFormReady}
                        pointerEvents={isFormReady ? 'auto' : 'none'}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View style={styles.saveBtnContent}>
                                <MaterialCommunityIcons name="content-save-check" size={22} color="white" />
                                <Text style={styles.saveBtnText}>Save G-81 Inspection Log</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                        </>
                    ) : null}
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
    sectionHeading: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 1,
        marginBottom: 10,
    },
    compSelectorRow: {
        gap: 8,
    },
    compButton: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    compButtonActive: {
        backgroundColor: '#002045',
        borderColor: '#002045',
    },
    compButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    compButtonTextActive: {
        color: '#ffffff',
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 1,
        marginBottom: 12,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#efedf1',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    tabButton: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderRadius: 8,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#002045',
    },
    decisionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    decisionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 52,
        padding: 14,
        gap: 8,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
    },
    decisionBtnAccept: {
        backgroundColor: '#D1FAE5',
        borderColor: '#059669',
    },
    decisionBtnReject: {
        backgroundColor: '#FEE2E2',
        borderColor: '#DC2626',
    },
    decisionText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
    },
    decisionTextAccept: {
        color: '#065F46',
    },
    decisionTextReject: {
        color: '#991B1B',
    },
    defectGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    defectCard: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '48%',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    defectCardChecked: {
        borderColor: '#fca5a5',
        backgroundColor: '#fef2f2',
    },
    defectCardText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    defectCardTextChecked: {
        color: '#ef4444',
    },
    photoContainer: {
        gap: 12,
        alignItems: 'center',
    },
    snapButton: {
        width: 80,
        height: 80,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    },
    snapText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#002045',
        marginTop: 4,
    },
    photoPreviewWrapper: {
        position: 'relative',
    },
    photoPreview: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    removePhotoBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: 'white',
        borderRadius: 10,
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
    paramGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    paramButton: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    paramButtonActive: {
        backgroundColor: '#002045',
        borderColor: '#002045',
    },
    paramButtonText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    paramButtonTextActive: {
        color: '#ffffff',
    },
    specCard: {
        backgroundColor: '#eff6ff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginBottom: 20,
    },
    specCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    specCardTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e40af',
    },
    specText: {
        fontSize: 15,
        color: '#1e3a8a',
        marginTop: 2,
    },
    gaugeText: {
        fontSize: 12,
        color: '#2563eb',
        marginTop: 6,
    },
    bold: {
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        color: '#1a1c1e',
    },
    gaugeContainer: {
        marginTop: 8,
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    gaugeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    gaugeLim: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    gaugeLabel: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    gaugeTrackBg: {
        height: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        position: 'relative',
        marginVertical: 6,
    },
    gaugeTrackFill: {
        height: '100%',
        borderRadius: 4,
    },
    gaugeCursor: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#002045',
        borderWidth: 2,
        borderColor: 'white',
        top: -3,
        marginLeft: -7,
    },
    gaugeCurrentText: {
        fontSize: 13,
        color: '#475569',
        textAlign: 'center',
        marginTop: 8,
    },
    replacementCard: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#f59e0b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        marginTop: 12,
    },
    replacementHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    replacementTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#b45309',
        letterSpacing: 0.5,
    },
    replacementSub: {
        fontSize: 12,
        color: '#b45309',
        marginBottom: 12,
    },
    replacementFormGroup: {
        marginBottom: 12,
    },
    replacementLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b45309',
        marginBottom: 6,
    },
    replacementInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f59e0b',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        color: '#78350f',
    },
    saveBtnAction: {
        width: '100%',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#002045',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    saveBtnActionDisabled: {
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
    cancelCameraBtn: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    cancelCameraTxt: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
    },
    summaryPanel: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        marginTop: 8,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
        marginBottom: 10,
    },
    summaryTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#002045',
    },
    summaryEmptyText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 8,
    },
    summaryTable: {
        gap: 8,
    },
    summaryTableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    summaryParamLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
        marginRight: 8,
    },
    summaryParamVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    summaryBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    summaryBadgeText: {
        fontSize: 9,
        fontWeight: '800',
    }
});
