import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const Card = ({ title, children }) => (
  <View style={styles.card}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

const QuickAction = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <Text style={styles.quickActionIcon}>{icon}</Text>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDaily = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api('/driver/daily');
      setData(response);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDaily();
    }, [fetchDaily])
  );

  const assignment = data?.assignment;
  const lastSubmission = data?.lastSubmission;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl tintColor="#38bdf8" refreshing={loading} onRefresh={fetchDaily} />}
    >
      <Text style={styles.heading}>Dzień dobry, {user?.email?.split('@')[0] || 'kierowco'} 👋</Text>
      <Text style={styles.subheading}>Przed wyjazdem upewnij się, że pojazd jest gotowy do pracy.</Text>

      <Card title="Aktualny przydział">
        {assignment ? (
          <>
            <Text style={styles.value}>Pojazd: {assignment.registration}</Text>
            <Text style={styles.caption}>{assignment.model}</Text>
            <Text style={styles.value}>Naczepa: {assignment.trailer_number || 'brak / solo'}</Text>
            <Text style={styles.caption}>Przydzielono: {dayjs(assignment.created_at).format('DD.MM.YYYY HH:mm')}</Text>
          </>
        ) : (
          <Text style={styles.caption}>Brak aktywnego przydziału. Skontaktuj się z dyspozytorem.</Text>
        )}
      </Card>

      {lastSubmission ? (
        <Card title="Ostatni raport">
          <Text style={styles.value}>Data checklisty: {dayjs(lastSubmission.date).format('DD.MM.YYYY')}</Text>
          <Text style={styles.caption}>Wysłano: {dayjs(lastSubmission.created_at).format('DD.MM.YYYY HH:mm')}</Text>
          <Text style={[styles.caption, { marginTop: 8 }]}>Statusy:</Text>
          {lastSubmission.answers.slice(0, 3).map((item, idx) => (
            <Text key={idx} style={styles.bullet}>
              • {item.label} — {item.status === 'ok' ? 'OK' : item.status === 'na' ? 'N/A' : 'Wymaga uwagi'}
            </Text>
          ))}
          {lastSubmission.answers.length > 3 ? (
            <Text style={styles.caption}>… oraz {lastSubmission.answers.length - 3} pozostałych pozycji.</Text>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.quickActionsRow}>
        <QuickAction icon="📝" label="Nowa checklista" onPress={() => navigation.navigate('DailyChecklist')} />
        <QuickAction icon="📄" label="Historia" onPress={() => Alert.alert('Wkrótce', 'Historia raportów pojawi się w kolejnej wersji.')} />
        <QuickAction icon="🚪" label="Wyloguj" onPress={signOut} />
      </View>

      <Card title="Poranny briefing">
        <Text style={styles.bullet}>• Sprawdź plan trasy i okna załadunku.</Text>
        <Text style={styles.bullet}>• Uzupełnij poziom paliwa i AdBlue zanim wyruszysz.</Text>
        <Text style={styles.bullet}>• Po zakończeniu checklisty raport PDF zapisze się na Dysku Google firmy.</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc'
  },
  subheading: {
    fontSize: 14,
    color: '#94a3b8'
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  cardTitle: {
    color: '#cbd5f5',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 16
  },
  value: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600'
  },
  caption: {
    color: '#94a3b8',
    fontSize: 13
  },
  bullet: {
    color: '#e2e8f0',
    fontSize: 13
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 18,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e3a8a'
  },
  quickActionIcon: {
    fontSize: 22
  },
  quickActionLabel: {
    color: '#bfdbfe',
    fontWeight: '600'
  }
});
