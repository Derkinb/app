import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import dayjs from 'dayjs';
import { api } from '../api';

const statusOptions = [
  { key: 'ok', label: 'OK', color: '#22c55e' },
  { key: 'issue', label: 'Uwaga', color: '#f97316' },
  { key: 'na', label: 'N/A', color: '#94a3b8' }
];

const Card = ({ title, children, footer }) => (
  <View style={styles.card}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
    {footer ? <View style={styles.cardFooter}>{footer}</View> : null}
  </View>
);

export default function DriverChecklistScreen({ navigation }) {
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api('/driver/daily');
        setPayload(data);
        if (data?.template?.items) {
          setAnswers(
            data.template.items.map(label => ({
              label,
              status: null,
              note: ''
            }))
          );
        }
        if (Array.isArray(data?.metricsSchema)) {
          const defaults = data.metricsSchema.reduce((acc, field) => {
            acc[field.key] = '';
            return acc;
          }, {});
          setMetrics(defaults);
        }
      } catch (err) {
        Alert.alert('Błąd', err.message || 'Nie udało się pobrać checklisty.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const readyToSubmit = useMemo(() => answers.every(item => item.status), [answers]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!payload?.assignment) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Brak aktywnego przydziału</Text>
        <Text style={styles.emptySubtitle}>Skontaktuj się z dyspozytorem, aby przypisać pojazd i rozpocząć checklistę.</Text>
      </View>
    );
  }

  if (!payload?.template) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Brak aktywnego szablonu</Text>
        <Text style={styles.emptySubtitle}>Administrator musi aktywować szablon checklisty, aby rozpocząć raport.</Text>
      </View>
    );
  }

  function updateAnswer(index, patch) {
    setAnswers(prev => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function updateMetric(key, value) {
    setMetrics(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!readyToSubmit) {
      Alert.alert('Uzupełnij checklistę', 'Oceń każdą pozycję przed wysłaniem raportu.');
      return;
    }

    try {
      setSubmitting(true);
      await api('/driver/submit', {
        method: 'POST',
        body: {
          template_id: payload.template.id,
          answers,
          metrics,
          date
        }
      });
      Alert.alert('Sukces', 'Raport zapisany i wygenerowany. PDF został wysłany na Dysk Google (jeśli skonfigurowano).', [
        {
          text: 'Wróć',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (err) {
      Alert.alert('Błąd', err.message || 'Nie udało się zapisać checklisty.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
      <Card title="Dane pojazdu">
        <Text style={styles.value}>Pojazd: {payload.assignment.registration} ({payload.assignment.model})</Text>
        <Text style={styles.caption}>Naczepa: {payload.assignment.trailer_number || 'brak / solo'}</Text>
        <Text style={styles.caption}>Szablon: {payload.template.name}</Text>
        <View style={[styles.inputGroup, { marginTop: 12 }]}>
          <Text style={styles.label}>Data checklisty</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            style={styles.input}
            placeholder="RRRR-MM-DD"
            placeholderTextColor="#64748b"
          />
        </View>
      </Card>

      <Card title="Poranne odczyty">
        {payload.metricsSchema?.map(field => (
          <View key={field.key} style={styles.inputGroup}>
            <Text style={styles.label}>{field.label}</Text>
            {field.type === 'select' || field.type === 'status' ? (
              <View style={styles.chipRow}>
                {(field.options || []).map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, metrics[field.key] === option && styles.chipActive]}
                    onPress={() => updateMetric(field.key, option)}
                  >
                    <Text style={[styles.chipText, metrics[field.key] === option && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : field.type === 'textarea' ? (
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                multiline
                value={metrics[field.key]}
                onChangeText={value => updateMetric(field.key, value)}
                placeholder="Notatka"
                placeholderTextColor="#64748b"
              />
            ) : (
              <TextInput
                style={styles.input}
                value={metrics[field.key]}
                onChangeText={value => updateMetric(field.key, value)}
                placeholder={field.type === 'number' ? '0' : '—'}
                placeholderTextColor="#64748b"
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}
          </View>
        ))}
      </Card>

      <Card
        title="Walkaround checklist"
        footer={
          <TouchableOpacity onPress={() => setAnswers(prev => prev.map(item => ({ ...item, status: 'ok' })))}>
            <Text style={styles.footerLink}>Oznacz wszystko jako OK</Text>
          </TouchableOpacity>
        }
      >
        {answers.map((item, index) => (
          <View key={index} style={styles.checkRow}>
            <Text style={styles.checkLabel}>{index + 1}. {item.label}</Text>
            <View style={styles.statusRow}>
              {statusOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.statusPill, item.status === option.key && { borderColor: option.color, backgroundColor: '#172554' }]}
                  onPress={() => updateAnswer(index, { status: option.key })}
                >
                  <Text style={[styles.statusText, { color: item.status === option.key ? option.color : '#94a3b8' }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={item.note}
              onChangeText={value => updateAnswer(index, { note: value })}
              placeholder="Notatka / uwagi"
              placeholderTextColor="#64748b"
            />
          </View>
        ))}
      </Card>

      <TouchableOpacity
        style={[styles.submitButton, (!readyToSubmit || submitting) && { opacity: 0.7 }]}
        disabled={!readyToSubmit || submitting}
        onPress={handleSubmit}
      >
        <Text style={styles.submitText}>{submitting ? 'Wysyłanie…' : 'Zapisz raport i generuj PDF'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  cardTitle: {
    color: '#cbd5f5',
    fontWeight: '600',
    fontSize: 16
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 12
  },
  footerLink: {
    color: '#38bdf8',
    fontWeight: '600'
  },
  value: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600'
  },
  caption: {
    color: '#94a3b8',
    fontSize: 13
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
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  chipActive: {
    borderColor: '#38bdf8'
  },
  chipText: {
    color: '#94a3b8',
    fontWeight: '600'
  },
  chipTextActive: {
    color: '#e2e8f0'
  },
  checkRow: {
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937'
  },
  checkLabel: {
    color: '#f8fafc',
    fontWeight: '600'
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  statusText: {
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center'
  },
  submitText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    padding: 32
  },
  emptyTitle: {
    fontSize: 22,
    color: '#f8fafc',
    fontWeight: '700'
  },
  emptySubtitle: {
    color: '#94a3b8',
    textAlign: 'center'
  }
});
