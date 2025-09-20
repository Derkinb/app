
import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { api, setToken } from '../api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password');

  async function handle(endpoint) {
    try {
      const data = await api(`/auth/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, role: endpoint==='register' ? 'admin' : undefined })
      });
      await setToken(data.token);
      navigation.reset({ index: 0, routes: [{ name: 'Admin' }]});
    } catch (e) { Alert.alert('Error', e.message); }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>Sign in / Register</Text>
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Button title="Register admin" onPress={() => handle('register')} />
      <Button title="Login" onPress={() => handle('login')} />
    </View>
  );
}
