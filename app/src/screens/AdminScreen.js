import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import dayjs from 'dayjs';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const Card = ({ title, description, children }) => (
  <View style={styles.card}>
    <View style={{ gap: 4 }}>
      <Text style={styles.cardTitle}>{title}</Text>
      {description ? <Text style={styles.cardDescription}>{description}</Text> : null}
    </View>
    <View style={{ gap: 12 }}>{children}</View>
  </View>
);

const Input = props => <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#64748b" />;

const PrimaryButton = ({ label, onPress }) => (
  <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
    <Text style={styles.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

export default function AdminScreen() {
  const { signOut } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [vehicleForm, setVehicleForm] = useState({ registration: '', model: '' });
  const [trailerForm, setTrailerForm] = useState({ number: '' });
  const [assignmentForm, setAssignmentForm] = useState({ user_id: '', vehicle_id: '', trailer_id: '', active: true });
  const [driverForm, setDriverForm] = useState({ email: '', password: '' });

  const refresh = useCallback(async () => {
    try {
      const [v, t, a, tpl] = await Promise.all([
        api('/admin/vehicles'),
        api('/admin/trailers'),
        api('/admin/assignments'),
        api('/admin/checklist-templates')
      ]);
      setVehicles(v.vehicles || []);
      setTrailers(t.trailers || []);
      setAssignments(a.assignments || []);
      setTemplates(tpl.templates || []);
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się pobrać danych administracyjnych');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreateVehicle() {
    try {
      await api('/admin/vehicles', { method: 'POST', body: vehicleForm });
      setVehicleForm({ registration: '', model: '' });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się dodać pojazdu');
    }
  }

  async function handleCreateTrailer() {
    try {
      await api('/admin/trailers', { method: 'POST', body: trailerForm });
      setTrailerForm({ number: '' });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się dodać naczepy');
    }
  }

  async function handleCreateAssignment() {
    try {
      await api('/admin/assignments', {
        method: 'POST',
        body: {
          user_id: Number(assignmentForm.user_id),
          vehicle_id: Number(assignmentForm.vehicle_id),
          trailer_id: assignmentForm.trailer_id ? Number(assignmentForm.trailer_id) : null,
          active: assignmentForm.active
        }
      });
      setAssignmentForm({ user_id: '', vehicle_id: '', trailer_id: '', active: true });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się przypisać kierowcy');
    }
  }

  async function handleCreateDriver() {
    try {
      await api('/auth/register', {
        method: 'POST',
        body: { email: driverForm.email, password: driverForm.password, role: 'driver' }
      });
      Alert.alert('Sukces', 'Nowy kierowca został utworzony');
      setDriverForm({ email: '', password: '' });
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się utworzyć konta kierowcy');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Panel administratora</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Wyloguj</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subheading}>Zarządzaj flotą, przydzieleniami oraz checklistami kierowców.</Text>

      <Card title="Dodaj pojazd" description="Po dodaniu automatycznie utworzy się folder na Dysku Google (jeśli skonfigurowano).">
        <Input
          placeholder="Rejestracja"
          value={vehicleForm.registration}
          onChangeText={value => setVehicleForm(prev => ({ ...prev, registration: value }))}
        />
        <Input placeholder="Model" value={vehicleForm.model} onChangeText={value => setVehicleForm(prev => ({ ...prev, model: value }))} />
        <PrimaryButton label="Zapisz pojazd" onPress={handleCreateVehicle} />
      </Card>

      <Card title="Dodaj naczepę" description="Rejestr / numer naczepy będzie dostępny przy przypisywaniu kierowcy.">
        <Input placeholder="Nr naczepy" value={trailerForm.number} onChangeText={value => setTrailerForm({ number: value })} />
        <PrimaryButton label="Zapisz naczepę" onPress={handleCreateTrailer} />
      </Card>

      <Card title="Nowy kierowca" description="Tworzy konto z rolą kierowcy i wysyła dane logowania użytkownikowi.">
        <Input placeholder="Email" value={driverForm.email} onChangeText={value => setDriverForm(prev => ({ ...prev, email: value }))} />
        <Input placeholder="Hasło" secureTextEntry value={driverForm.password} onChangeText={value => setDriverForm(prev => ({ ...prev, password: value }))} />
        <PrimaryButton label="Utwórz konto kierowcy" onPress={handleCreateDriver} />
      </Card>

      <Card title="Przypisz pojazd kierowcy" description="Podaj identyfikatory użytkownika i pojazdu (sprawdź listę poniżej).">
        <Input placeholder="ID użytkownika" keyboardType="numeric" value={assignmentForm.user_id} onChangeText={value => setAssignmentForm(prev => ({ ...prev, user_id: value }))} />
        <Input placeholder="ID pojazdu" keyboardType="numeric" value={assignmentForm.vehicle_id} onChangeText={value => setAssignmentForm(prev => ({ ...prev, vehicle_id: value }))} />
        <Input placeholder="ID naczepy (opcjonalnie)" keyboardType="numeric" value={assignmentForm.trailer_id} onChangeText={value => setAssignmentForm(prev => ({ ...prev, trailer_id: value }))} />
        <PrimaryButton label="Przypisz kierowcę" onPress={handleCreateAssignment} />
      </Card>

      <Card title="Pojazdy" description="Lista ostatnio dodanych pojazdów.">
        {vehicles.length ? (
          vehicles.map(item => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.listPrimary}>{item.registration}</Text>
              <Text style={styles.listSecondary}>{item.model}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak pojazdów</Text>
        )}
      </Card>

      <Card title="Naczepy">
        {trailers.length ? (
          trailers.map(item => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.listPrimary}>{item.number}</Text>
              <Text style={styles.listSecondary}>{dayjs(item.created_at).format('DD.MM.YYYY')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak naczep</Text>
        )}
      </Card>

      <Card title="Przydziały kierowców">
        {assignments.length ? (
          assignments.map(item => (
            <View key={item.id} style={styles.assignmentRow}>
              <Text style={styles.listPrimary}>{item.user_email}</Text>
              <Text style={styles.listSecondary}>Pojazd: {item.registration}</Text>
              <Text style={styles.listSecondary}>Naczepa: {item.trailer_number || 'brak'}</Text>
              <Text style={styles.listSecondary}>Status: {item.active ? 'Aktywny' : 'Nieaktywny'}</Text>
              <Text style={styles.listTertiary}>ID użytkownika: {item.user_id} • ID pojazdu: {item.vehicle_id}</Text>
              <Text style={styles.listTertiary}>Przypisano: {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak przydzielonych kierowców</Text>
        )}
      </Card>

      <Card title="Szablony checklist">
        {templates.length ? (
          templates.map(item => (
            <View key={item.id} style={styles.templateRow}>
              <Text style={styles.listPrimary}>{item.name}</Text>
              <Text style={styles.listSecondary}>Pozycji: {item.items.length}</Text>
              <Text style={styles.listTertiary}>Ostatnia aktualizacja: {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak aktywnych szablonów</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc'
  },
  subheading: {
    color: '#94a3b8',
    marginBottom: 6
  },
  signOut: {
    color: '#38bdf8',
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  cardTitle: {
    color: '#cbd5f5',
    fontWeight: '600',
    fontSize: 16
  },
  cardDescription: {
    color: '#94a3b8',
    fontSize: 13
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700'
  },
  listRow: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    gap: 2
  },
  assignmentRow: {
    backgroundColor: '#1f2937',
    padding: 14,
    borderRadius: 14,
    gap: 4
  },
  templateRow: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    gap: 2
  },
  listPrimary: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  listSecondary: {
    color: '#cbd5f5',
    fontSize: 13
  },
  listTertiary: {
    color: '#94a3b8',
    fontSize: 12
  },
  emptyLabel: {
    color: '#64748b'
  }
});
