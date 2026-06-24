import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Camera, CameraType } from 'expo-camera/legacy'; // Using expo-camera
import * as FileSystem from 'expo-file-system';

export default function CameraComponent({ onCapture }) {
    const [hasPermission, setHasPermission] = useState(null);
    const cameraRef = useRef(null);

    React.useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        })();
    }, []);

    const takePicture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
            onCapture(photo.uri);
        }
    };

    if (hasPermission === null) return <View />;
    if (hasPermission === false) return <Text>No access to camera</Text>;

    return (
        <View style={styles.container}>
            <Camera style={styles.camera} type={CameraType.back} ref={cameraRef}>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                        <Text style={styles.captureText}>Snap Defect</Text>
                    </TouchableOpacity>
                </View>
            </Camera>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    camera: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
    buttonContainer: { marginBottom: 30 },
    captureButton: { backgroundColor: '#ef4444', padding: 20, borderRadius: 10 },
    captureText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});
