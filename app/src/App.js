
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import AdminScreen from './screens/AdminScreen';
import DriverChecklistScreen from './screens/DriverChecklistScreen';
import { api } from './api';

const Stack = createNativeStackNavigator();

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api('/me');
        setRole(user.role);
      } catch { setRole(null); }
    })();
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!role ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        ) : role === 'admin' ? (
          <>
            <Stack.Screen name="Admin" component={AdminScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Daily Checklist" component={DriverChecklistScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
