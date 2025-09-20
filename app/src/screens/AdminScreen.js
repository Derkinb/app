import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import dayjs from 'dayjs';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { key: 'overview', label: 'Przegląd' },
  { key: 'fleet', label: 'Flota' },
  { key: 'drivers', label: 'Kierowcy' },
  { key: 'templates', label: 'Checklisty' }
];

const Card = ({ title, subtitle, children }) => (
  <View style={styles.card}>
    {(title || subtitle) && (
      <View style={{ gap: 4 }}>
        {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
    )}
    {children}
  </View>
);

const Input = props => (
  <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#64748b" />
);

const PrimaryButton = ({ label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.primaryButton, disabled && { opacity: 0.6 }]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </TouchableOpacity>
);

const SegmentedControl = ({ value, onChange }) => (
  <View style={styles.tabs}>
    {tabs.map(tab => {
      const isActive = tab.key === value;
      return (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabItem, isActive && styles.tabItemActive]}
          onPress={() => onChange(tab.key)}
        >
          <Text style={[styles.tabItemLabel, isActive && styles.tabItemLabelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const StatCard = ({ label, value, meta }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {meta ? <Text style={styles.statMeta}>{meta}</Text> : null}
  </View>
);

const SelectField = ({ label, placeholder, value, onChange, options }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = option => {
    setOpen(false);
    onChange(option);
  };

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.select} onPress={() => setOpen(true)}>
        <View style={{ gap: 4 }}>
          <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
            {value ? value.label : placeholder}
          </Text>
          <Text style={styles.selectCaption}>
            {value?.caption || (options.length ? 'Dotknij, aby wybrać' : 'Brak dostępnych opcji')}
          </Text>
        </View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView contentContainerStyle={{ paddingVertical: 12, gap: 12 }}>
              {options.length ? (
                options.map(option => {
                  const isActive = value?.key === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.modalOption, isActive && styles.modalOptionActive]}
                      onPress={() => handleSelect(option)}
                    >
                      <Text style={styles.modalOptionLabel}>{option.label}</Text>
                      {option.caption ? <Text style={styles.modalOptionCaption}>{option.caption}</Text> : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyLabel}>Brak pozycji do wyboru</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AdminScreen() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicleForm, setVehicleForm] = useState({ registration: '', model: '' });
  const [trailerForm, setTrailerForm] = useState({ number: '' });
  const [driverForm, setDriverForm] = useState({ email: '', password: '' });
  const [assignmentForm, setAssignmentForm] = useState({ driver: null, vehicle: null, trailer: null });

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const [driversRes, vehiclesRes, trailersRes, assignmentsRes, templatesRes] = await Promise.all([
        api('/admin/drivers'),
        api('/admin/vehicles'),
        api('/admin/trailers'),
        api('/admin/assignments'),
        api('/admin/checklist-templates')
      ]);
      setDrivers(driversRes.drivers || []);
      setVehicles(vehiclesRes.vehicles || []);
      setTrailers(trailersRes.trailers || []);
      setAssignments(assignmentsRes.assignments || []);
      setTemplates(templatesRes.templates || []);
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się pobrać danych administracyjnych');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeAssignments = useMemo(() => assignments.filter(item => item.active), [assignments]);
  const availableVehicles = useMemo(() => {
    const taken = new Set(activeAssignments.map(item => item.vehicle_id));
    return vehicles.filter(vehicle => !taken.has(vehicle.id));
  }, [vehicles, activeAssignments]);
  const availableTrailers = useMemo(() => {
    const taken = new Set(activeAssignments.filter(item => item.trailer_id).map(item => item.trailer_id));
    return trailers.filter(trailer => !taken.has(trailer.id));
  }, [trailers, activeAssignments]);

  const driverOptions = useMemo(
    () =>
      drivers.map(driver => ({
        key: String(driver.id),
        label: driver.email,
        caption: driver.assignment
          ? `Aktywny: ${driver.assignment.registration}${driver.assignment.trailer_number ? ` + ${driver.assignment.trailer_number}` : ''}`
          : 'Brak aktywnego przydziału',
        value: driver
      })),
    [drivers]
  );

  const vehicleOptions = useMemo(
    () =>
      availableVehicles.map(vehicle => ({
        key: String(vehicle.id),
        label: vehicle.registration,
        caption: vehicle.model,
        value: vehicle
      })),
    [availableVehicles]
  );

  const trailerOptions = useMemo(() => {
    const base = [
      { key: 'none', label: 'Brak naczepy', caption: 'Kierowca jedzie solo', value: null }
    ];
    availableTrailers.forEach(trailer => {
      base.push({
        key: String(trailer.id),
        label: trailer.number,
        caption: `Dodano: ${dayjs(trailer.created_at).format('DD.MM.YYYY')}`,
        value: trailer
      });
    });
    return base;
  }, [availableTrailers]);

  useEffect(() => {
    setAssignmentForm(prev => {
      if (!trailerOptions.length) {
        return { ...prev, trailer: null };
      }
      if (prev.trailer && trailerOptions.some(option => option.key === prev.trailer.key)) {
        return prev;
      }
      return { ...prev, trailer: trailerOptions[0] };
    });
  }, [trailerOptions]);

  async function handleCreateVehicle() {
    if (!vehicleForm.registration.trim() || !vehicleForm.model.trim()) {
      Alert.alert('Uzupełnij dane pojazdu', 'Podaj rejestrację oraz model pojazdu.');
      return;
    }
    try {
      await api('/admin/vehicles', {
        method: 'POST',
        body: { registration: vehicleForm.registration.trim(), model: vehicleForm.model.trim() }
      });
      setVehicleForm({ registration: '', model: '' });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się dodać pojazdu');
    }
  }

  async function handleCreateTrailer() {
    if (!trailerForm.number.trim()) {
      Alert.alert('Uzupełnij dane', 'Podaj numer naczepy.');
      return;
    }
    try {
      await api('/admin/trailers', {
        method: 'POST',
        body: { number: trailerForm.number.trim() }
      });
      setTrailerForm({ number: '' });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się dodać naczepy');
    }
  }

  async function handleCreateDriver() {
    if (!driverForm.email.trim() || !driverForm.password.trim()) {
      Alert.alert('Uzupełnij dane', 'Podaj adres e-mail oraz tymczasowe hasło.');
      return;
    }
    try {
      await api('/auth/register', {
        method: 'POST',
        body: { email: driverForm.email.trim(), password: driverForm.password.trim(), role: 'driver' }
      });
      Alert.alert('Sukces', 'Nowy kierowca został utworzony.');
      setDriverForm({ email: '', password: '' });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się utworzyć konta kierowcy');
    }
  }

  async function handleCreateAssignment() {
    if (!assignmentForm.driver) {
      Alert.alert('Wybierz kierowcę', 'Najpierw wybierz kierowcę z listy.');
      return;
    }
    if (!assignmentForm.vehicle) {
      Alert.alert('Brak wolnego pojazdu', 'Dodaj pojazd lub zwolnij istniejący przydział, aby kontynuować.');
      return;
    }
    try {
      await api('/admin/assignments', {
        method: 'POST',
        body: {
          user_id: assignmentForm.driver.value.id,
          vehicle_id: assignmentForm.vehicle.value.id,
          trailer_id: assignmentForm.trailer ? assignmentForm.trailer.value?.id || null : null,
          active: true
        }
      });
      Alert.alert('Przydział zapisany', 'Kierowca otrzymał dostęp do checklisty dla wybranego zestawu.');
      setAssignmentForm({ driver: null, vehicle: null, trailer: trailerOptions[0] || null });
      refresh();
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się przypisać kierowcy');
    }
  }

  function confirmDeactivateAssignment(id) {
    Alert.alert('Zakończyć przydział?', 'Pojazd i naczepa wrócą do puli dostępnych.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Zakończ',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/admin/assignments/${id}`, { method: 'PATCH', body: { active: false } });
            refresh();
          } catch (err) {
            Alert.alert('Błąd', err.message || 'Nie udało się zaktualizować przydziału');
          }
        }
      }
    ]);
  }

  const overviewContent = (
    <>
      <View style={styles.statsGrid}>
        <StatCard
          label="Kierowcy"
          value={drivers.length}
          meta={`${drivers.filter(driver => driver.assignment).length} z aktywnym przydziałem`}
        />
        <StatCard
          label="Aktywne przydziały"
          value={activeAssignments.length}
          meta={assignments.length ? `${assignments.length} zapisanych w historii` : 'Brak zapisów'}
        />
        <StatCard
          label="Wolne pojazdy"
          value={availableVehicles.length}
          meta={`${vehicles.length} w bazie`}
        />
        <StatCard
          label="Wolne naczepy"
          value={availableTrailers.length}
          meta={`${trailers.length} w bazie`}
        />
      </View>

      <Card title="Ostatnie przydziały" subtitle="Podgląd pięciu najnowszych zmian">
        {assignments.length ? (
          assignments.slice(0, 5).map(item => (
            <View key={item.id} style={styles.listRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.listPrimary}>{item.user_email}</Text>
                <Text style={styles.listSecondary}>
                  {item.registration} {item.model ? `• ${item.model}` : ''}
                </Text>
                <Text style={styles.listSecondary}>
                  Naczepa: {item.trailer_number || 'brak / solo'}
                </Text>
                <Text style={styles.listTertiary}>
                  {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}
                </Text>
              </View>
              <View style={[styles.badge, item.active ? styles.badgeSuccess : styles.badgeMuted]}>
                <Text style={styles.badgeText}>{item.active ? 'Aktywny' : 'Archiwum'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak zapisanych przydziałów</Text>
        )}
      </Card>
    </>
  );

  const fleetContent = (
    <>
      <Card
        title="Dodaj pojazd"
        subtitle="Nowy ciągnik trafi od razu na listę wolnych pojazdów"
      >
        <Input
          placeholder="Rejestracja"
          value={vehicleForm.registration}
          onChangeText={value => setVehicleForm(prev => ({ ...prev, registration: value }))}
        />
        <Input
          placeholder="Model / opis"
          value={vehicleForm.model}
          onChangeText={value => setVehicleForm(prev => ({ ...prev, model: value }))}
        />
        <PrimaryButton label="Zapisz pojazd" onPress={handleCreateVehicle} />
      </Card>

      <Card
        title="Dodaj naczepę"
        subtitle="Uzupełnij numer, aby kierowcy mogli ją wybrać"
      >
        <Input
          placeholder="Nr naczepy"
          value={trailerForm.number}
          onChangeText={value => setTrailerForm({ number: value })}
        />
        <PrimaryButton label="Zapisz naczepę" onPress={handleCreateTrailer} />
      </Card>

      <Card title="Lista pojazdów" subtitle="Status dostępności aktualizuje się automatycznie">
        {vehicles.length ? (
          vehicles.map(item => {
            const isBusy = activeAssignments.some(assignment => assignment.vehicle_id === item.id);
            return (
              <View key={item.id} style={styles.listRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.listPrimary}>{item.registration}</Text>
                  <Text style={styles.listSecondary}>{item.model}</Text>
                  <Text style={styles.listTertiary}>Dodano: {dayjs(item.created_at).format('DD.MM.YYYY')}</Text>
                  {item.driver_email ? (
                    <Text style={styles.listTertiary}>Przydzielony kierowca: {item.driver_email}</Text>
                  ) : null}
                </View>
                <View style={[styles.badge, isBusy ? styles.badgeMuted : styles.badgeSuccess]}>
                  <Text style={styles.badgeText}>{isBusy ? 'Zajęty' : 'Wolny'}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyLabel}>Brak pojazdów w bazie</Text>
        )}
      </Card>

      <Card title="Lista naczep" subtitle="Widok obejmuje aktywne i wolne naczepy">
        {trailers.length ? (
          trailers.map(item => {
            const isBusy = activeAssignments.some(assignment => assignment.trailer_id === item.id);
            return (
              <View key={item.id} style={styles.listRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.listPrimary}>{item.number}</Text>
                  <Text style={styles.listTertiary}>Dodano: {dayjs(item.created_at).format('DD.MM.YYYY')}</Text>
                  {item.driver_email ? (
                    <Text style={styles.listTertiary}>
                      Zestaw: {item.vehicle_registration || '—'} • {item.driver_email}
                    </Text>
                  ) : null}
                </View>
                <View style={[styles.badge, isBusy ? styles.badgeMuted : styles.badgeSuccess]}>
                  <Text style={styles.badgeText}>{isBusy ? 'Zajęta' : 'Wolna'}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyLabel}>Brak naczep w bazie</Text>
        )}
      </Card>
    </>
  );

  const driversContent = (
    <>
      <Card title="Nowy kierowca" subtitle="Tworzy konto z rolą kierowcy i hasłem startowym">
        <Input
          placeholder="Adres e-mail"
          value={driverForm.email}
          onChangeText={value => setDriverForm(prev => ({ ...prev, email: value }))}
        />
        <Input
          placeholder="Hasło startowe"
          secureTextEntry
          value={driverForm.password}
          onChangeText={value => setDriverForm(prev => ({ ...prev, password: value }))}
        />
        <PrimaryButton label="Utwórz konto" onPress={handleCreateDriver} />
      </Card>

      <Card
        title="Przydziel flotę kierowcy"
        subtitle="Krok po kroku: kierowca → dostępny pojazd → opcjonalnie naczepa"
      >
        <SelectField
          label="Kierowca"
          placeholder="Wybierz kierowcę"
          value={assignmentForm.driver}
          onChange={option => setAssignmentForm(prev => ({ ...prev, driver: option }))}
          options={driverOptions}
        />
        {vehicleOptions.length ? (
          <SelectField
            label="Pojazd"
            placeholder="Wybierz dostępny pojazd"
            value={assignmentForm.vehicle}
            onChange={option => setAssignmentForm(prev => ({ ...prev, vehicle: option }))}
            options={vehicleOptions}
          />
        ) : (
          <Text style={styles.emptyLabel}>Brak wolnych pojazdów. Dodaj nowy lub zwolnij przydział.</Text>
        )}
        <SelectField
          label="Naczepa"
          placeholder="Brak naczepy"
          value={assignmentForm.trailer}
          onChange={option => setAssignmentForm(prev => ({ ...prev, trailer: option }))}
          options={trailerOptions}
        />
        <PrimaryButton
          label="Zapisz przydział"
          onPress={handleCreateAssignment}
          disabled={!assignmentForm.driver || !assignmentForm.vehicle}
        />
      </Card>

      <Card title="Wszyscy kierowcy" subtitle="Podgląd kont i przydziałów">
        {drivers.length ? (
          drivers.map(driver => (
            <View key={driver.id} style={styles.driverRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.listPrimary}>{driver.email}</Text>
                <Text style={styles.listTertiary}>Dodano: {dayjs(driver.created_at).format('DD.MM.YYYY')}</Text>
                {driver.assignment ? (
                  <Text style={styles.listSecondary}>
                    {driver.assignment.registration} • {driver.assignment.trailer_number || 'brak naczepy'}
                  </Text>
                ) : (
                  <Text style={styles.listSecondary}>Brak aktywnego przydziału</Text>
                )}
              </View>
              {driver.assignment ? (
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={() => confirmDeactivateAssignment(driver.assignment.id)}
                >
                  <Text style={styles.ghostButtonText}>Zakończ</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyLabel}>Brak kierowców w bazie</Text>
        )}
      </Card>
    </>
  );

  const templatesContent = (
    <Card
      title="Aktywne checklisty"
      subtitle="Szablon wykorzystywany jest przy każdej porannej odprawie"
    >
      {templates.length ? (
        templates.map(item => (
          <View key={item.id} style={styles.listRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.listPrimary}>{item.name}</Text>
              <Text style={styles.listSecondary}>Pozycji: {item.items.length}</Text>
              <Text style={styles.listTertiary}>Aktualizacja: {dayjs(item.created_at).format('DD.MM.YYYY HH:mm')}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyLabel}>Brak aktywnych szablonów</Text>
      )}
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'fleet':
        return fleetContent;
      case 'drivers':
        return driversContent;
      case 'templates':
        return templatesContent;
      case 'overview':
      default:
        return overviewContent;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heading}>Centrum zarządzania flotą</Text>
          <Text style={styles.subheading}>Monitoruj kierowców, pojazdy i checklisty w jednym miejscu.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, refreshing && { opacity: 0.6 }]}
            onPress={refresh}
            disabled={refreshing}
          >
            <Text style={styles.headerButtonText}>{refreshing ? 'Odświeżanie…' : 'Odśwież'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerSignOut} onPress={signOut}>
            <Text style={styles.headerSignOutText}>Wyloguj</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SegmentedControl value={activeTab} onChange={setActiveTab} />

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#38bdf8" size="large" />
          <Text style={styles.loadingText}>Ładowanie panelu administracyjnego…</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {renderContent()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b1220',
    paddingHorizontal: 20,
    paddingTop: 24
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingBottom: 40,
    gap: 18
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc'
  },
  subheading: {
    color: '#94a3b8',
    fontSize: 14
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12
  },
  headerButton: {
    backgroundColor: '#1f2937',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#1e3a8a'
  },
  headerButtonText: {
    color: '#cbd5f5',
    fontWeight: '600'
  },
  headerSignOut: {
    backgroundColor: '#f87171',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  headerSignOutText: {
    color: '#0b1220',
    fontWeight: '700'
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center'
  },
  tabItemActive: {
    backgroundColor: '#1e3a8a'
  },
  tabItemLabel: {
    color: '#94a3b8',
    fontWeight: '600'
  },
  tabItemLabelActive: {
    color: '#e2e8f0'
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
  cardSubtitle: {
    color: '#64748b',
    fontSize: 13
  },
  input: {
    backgroundColor: '#0b1220',
    borderRadius: 14,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  inputGroup: {
    gap: 6
  },
  label: {
    color: '#cbd5f5',
    fontWeight: '600'
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#0b1220',
    fontWeight: '700',
    fontSize: 15
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc'
  },
  statLabel: {
    color: '#cbd5f5',
    fontWeight: '600'
  },
  statMeta: {
    color: '#64748b',
    fontSize: 12
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937'
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
    color: '#64748b',
    fontSize: 12
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1
  },
  badgeSuccess: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.4)'
  },
  badgeMuted: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.4)'
  },
  badgeText: {
    color: '#cbd5f5',
    fontWeight: '600'
  },
  emptyLabel: {
    color: '#64748b'
  },
  select: {
    backgroundColor: '#0b1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14
  },
  selectValue: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  selectPlaceholder: {
    color: '#64748b',
    fontWeight: '600'
  },
  selectCaption: {
    color: '#64748b',
    fontSize: 12
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  modalTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16
  },
  modalOption: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  modalOptionActive: {
    borderColor: '#38bdf8'
  },
  modalOptionLabel: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  modalOptionCaption: {
    color: '#94a3b8',
    fontSize: 12
  },
  modalClose: {
    backgroundColor: '#1e3a8a',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalCloseText: {
    color: '#e2e8f0',
    fontWeight: '600'
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  ghostButton: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f87171'
  },
  ghostButtonText: {
    color: '#fca5a5',
    fontWeight: '600'
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingText: {
    color: '#94a3b8'
  }
});
