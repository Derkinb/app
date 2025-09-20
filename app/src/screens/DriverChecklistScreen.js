
import React, { useEffect, useState } from 'react';
import { View, Text, Button, Switch, TextInput, ScrollView, Alert } from 'react-native';
import { api } from '../api';

export default function DriverChecklistScreen() {
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/driver/daily');
        setPayload(data);
        if (data?.template?.items) {
          setAnswers(data.template.items.map(label => ({ label, checked: false, note: '' })));
        }
      } catch (e) { Alert.alert('Error', e.message); }
    })();
  }, []);

  if (!payload) return <View style={{ padding: 16 }}><Text>Loading...</Text></View>;
  if (!payload.assignment) return <View style={{ padding: 16 }}><Text>Brak aktywnego przydziału pojazdu.</Text></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '700' }}>Dzienne sprawdzenie</Text>
      <Text>Pojazd: {payload.assignment.registration} ({payload.assignment.model})</Text>
      <Text>Trailer: {payload.assignment.trailer_number || '-'}</Text>

      {answers.map((a, i) => (
        <View key={i} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}>
          <Text style={{ fontWeight: '600' }}>{i+1}. {a.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text>OK</Text>
            <Switch value={a.checked} onValueChange={(v)=>{
              const next = [...answers];
              next[i] = { ...next[i], checked: v };
              setAnswers(next);
            }} />
          </View>
          <Text>Notatka (opcjonalnie)</Text>
          <TextInput value={a.note} onChangeText={(v)=>{
            const next = [...answers];
            next[i] = { ...next[i], note: v };
            setAnswers(next);
          }} style={{ borderWidth: 1, padding: 6, borderRadius: 8 }} />
        </View>
      ))}

      <Button title="Wyślij i wygeneruj PDF" onPress={async () => {
        try {
          await api('/driver/submit', { method: 'POST', body: JSON.stringify({
            template_id: payload.template.id,
            answers
          })});
          Alert.alert('Sukces', 'Checklista zapisana i wysłana (jeśli skonfigurowano Dysk Google).');
        } catch (e) { Alert.alert('Błąd', e.message); }
      }} />
    </ScrollView>
  );
}
