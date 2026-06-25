import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import NewCTRBScreen from './src/screens/NewCTRBScreen';
import InspectionScreen from './src/screens/InspectionScreen';
import AssemblyScreen from './src/screens/AssemblyScreen';
import TraceabilityScreen from './src/screens/TraceabilityScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="NewCTRB" component={NewCTRBScreen} />
          <Stack.Screen name="Inspection" component={InspectionScreen} />
          <Stack.Screen name="Assembly" component={AssemblyScreen} />
          <Stack.Screen name="Traceability" component={TraceabilityScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
