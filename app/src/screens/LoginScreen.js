import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';

const roles = [
  { key: 'driver', label: 'Kierowca' },
  { key: 'admin', label: 'Administrator' }
];

export default function LoginScreen() {
  const { signIn, register, bootError } = useAuth();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('driver');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    try {
      setLoading(true);
      if (mode === 'login') {
        await signIn({ email, password });
      } else {
        await register({ email, password, role });
        Alert.alert('Konto utworzone', 'Możesz się teraz zalogować i korzystać z aplikacji.');
        setMode('login');
      }
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się uwierzytelnić');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0f172a' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>CODEX Fleet</Text>
          <Text style={styles.subtitle}>Poranny walkaround i raport PDF</Text>
          {bootError ? <Text style={styles.warning}>Sesja wygasła: {bootError}</Text> : null}

          <View style={styles.modeSwitch}>
            {['login', 'register'].map(value => (
              <TouchableOpacity
                key={value}
                style={[styles.modeButton, mode === value && styles.modeButtonActive]}
                onPress={() => setMode(value)}
              >
                <Text style={[styles.modeButtonText, mode === value && styles.modeButtonTextActive]}>
                  {value === 'login' ? 'Logowanie' : 'Rejestracja'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <View style={styles.roleRow}>
              {roles.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleChip, role === r.key && styles.roleChipActive]}
                  onPress={() => setRole(r.key)}
                >
                  <Text style={[styles.roleText, role === r.key && styles.roleTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email służbowy</Text>
            <TextInput
              style={styles.input}
              placeholder="jan.kowalski@firma.pl"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hasło</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.7 }]} disabled={loading} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}</Text>
          </TouchableOpacity>

          <Text style={styles.helperText}>
            Dostęp administracyjny pozwala zarządzać pojazdami i przydziałami kierowców. Kierowca po zalogowaniu otrzyma swój
            przydział oraz checklistę.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center'
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc'
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8'
  },
  warning: {
    fontSize: 12,
    color: '#f97316'
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 4
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center'
  },
  modeButtonActive: {
    backgroundColor: '#2563eb'
  },
  modeButtonText: {
    color: '#94a3b8',
    fontWeight: '600'
  },
  modeButtonTextActive: {
    color: '#f8fafc'
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12
  },
  roleChip: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  roleChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a'
  },
  roleText: {
    color: '#94a3b8',
    fontWeight: '600'
  },
  roleTextActive: {
    color: '#e2e8f0'
  },
  inputGroup: {
    gap: 6
  },
  label: {
    color: '#cbd5f5',
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16
  },
  helperText: {
    color: '#64748b',
    fontSize: 12
  }
});
