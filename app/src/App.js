import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import AdminScreen from './screens/AdminScreen';
import DriverChecklistScreen from './screens/DriverChecklistScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0f172a',
    card: '#1f2937',
    text: '#e2e8f0',
    border: '#1f2937'
  }
};

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#e2e8f0',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0f172a' }
      }}
    >
      {!user ? (
        <Stack.Screen name="Auth" component={LoginScreen} options={{ headerShown: false }} />
      ) : user.role === 'admin' ? (
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Panel administratora' }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Panel kierowcy' }} />
          <Stack.Screen name="DailyChecklist" component={DriverChecklistScreen} options={{ title: 'Poranna checklista' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
