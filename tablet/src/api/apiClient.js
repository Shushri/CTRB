import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Extract the development machine's local IP address to support real device API debugging
const getBaseUrl = () => {
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
        console.log(`Using environment API endpoint: ${process.env.EXPO_PUBLIC_API_BASE_URL}`);
        return process.env.EXPO_PUBLIC_API_BASE_URL;
    }
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const hostIp = hostUri.split(':')[0];
        console.log(`Resolved local API endpoint: http://${hostIp}:5000/api/v1`);
        return `http://${hostIp}:5000/api/v1`;
    }
    console.log(`Using production API endpoint: https://ctrb-tims-backend.onrender.com/api/v1`);
    return `https://ctrb-tims-backend.onrender.com/api/v1`;
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
});

// Automate Auth token injection
apiClient.interceptors.request.use(async (config) => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (err) {
        console.error("Error reading token");
    }
    return config;
});

export default apiClient;
