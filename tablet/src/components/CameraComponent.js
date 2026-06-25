import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import * as FileSystem from 'expo-file-system';

export default function CameraComponent({ onCapture, onCancel }) {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);

    React.useEffect(() => {
        if (!permission) return;
        if (!permission.granted && permission.canAskAgain) {
            requestPermission();
        }
    }, [permission]);

    const takePicture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
            onCapture(photo.uri);
        }
    };

    if (!permission) return <View />;
    if (!permission.granted) return <Text>No access to camera</Text>;

    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} facing="back" ref={cameraRef} />
            <View style={styles.overlayContainer}>
                <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                    <Text style={styles.captureText}>Snap Defect</Text>
                </TouchableOpacity>
                {onCancel && (
                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                        <Text style={styles.cancelText}>Cancel Camera</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, position: 'relative' },
    camera: { flex: 1 },
    overlayContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
    },
    captureButton: { 
        backgroundColor: '#ef4444', 
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    captureText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    cancelButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    cancelText: { color: 'white', fontSize: 15, fontWeight: 'bold' }
});
