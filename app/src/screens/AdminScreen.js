
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Alert, Platform } from 'react-native';
import { api } from '../api';

export default function AdminScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [registration, setRegistration] = useState('');
  const [model, setModel] = useState('');
  const [trailerNumber, setTrailerNumber] = useState('');
  const [assign, setAssign] = useState({ user_id: '', vehicle_id: '', trailer_id: '' });

  async function refresh() {
    try {
      const v = await api('/admin/vehicles');
      const t = await api('/admin/trailers');
      setVehicles(v.vehicles);
      setTrailers(t.trailers);
    } catch (e) { Alert.alert('Error', e.message); }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <View style={{ padding: 16, gap: 16, maxWidth: 800, width: '100%' }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Admin Panel</Text>

      <Text style={{ fontWeight: '600' }}>Dodaj pojazd</Text>
      <TextInput placeholder="Rejestracja" value={registration} onChangeText={setRegistration} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <TextInput placeholder="Model" value={model} onChangeText={setModel} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Button title="Dodaj pojazd" onPress={async () => {
        try {
          await api('/admin/vehicles', { method: 'POST', body: JSON.stringify({ registration, model }) });
          setRegistration(''); setModel(''); refresh();
        } catch (e) { Alert.alert('Error', e.message); }
      }} />

      <Text style={{ fontWeight: '600', marginTop: 12 }}>Dodaj trailer</Text>
      <TextInput placeholder="Nr trailera" value={trailerNumber} onChangeText={setTrailerNumber} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Button title="Dodaj trailer" onPress={async () => {
        try {
          await api('/admin/trailers', { method: 'POST', body: JSON.stringify({ number: trailerNumber }) });
          setTrailerNumber(''); refresh();
        } catch (e) { Alert.alert('Error', e.message); }
      }} />

      <Text style={{ fontWeight: '600', marginTop: 12 }}>Przypisz użytkownikowi</Text>
      <TextInput placeholder="user_id" value={assign.user_id} onChangeText={(v)=>setAssign({ ...assign, user_id: v })} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <TextInput placeholder="vehicle_id" value={assign.vehicle_id} onChangeText={(v)=>setAssign({ ...assign, vehicle_id: v })} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <TextInput placeholder="trailer_id (opcjonalnie)" value={assign.trailer_id} onChangeText={(v)=>setAssign({ ...assign, trailer_id: v })} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }} />
      <Button title="Przypisz" onPress={async () => {
        try {
          await api('/admin/assignments', { method: 'POST', body: JSON.stringify({
            user_id: Number(assign.user_id), vehicle_id: Number(assign.vehicle_id), trailer_id: assign.trailer_id ? Number(assign.trailer_id) : null
          })});
          setAssign({ user_id: '', vehicle_id: '', trailer_id: '' }); refresh();
        } catch (e) { Alert.alert('Error', e.message); }
      }} />

      <Text style={{ fontWeight: '600', marginTop: 12 }}>Pojazdy</Text>
      <FlatList data={vehicles} keyExtractor={(item)=>String(item.id)} renderItem={({item})=><Text>{item.id}. {item.registration} — {item.model}</Text>} />

      <Text style={{ fontWeight: '600', marginTop: 12 }}>Trailery</Text>
      <FlatList data={trailers} keyExtractor={(item)=>String(item.id)} renderItem={({item})=><Text>{item.id}. {item.number}</Text>} />
    </View>
  );
}
