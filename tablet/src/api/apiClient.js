import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:5000/api/v1'; // Should be driven by environment variables on deployment

const apiClient = axios.create({
    baseURL: API_BASE_URL,
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
