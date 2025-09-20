
import React from 'react';
import { View, Text, Button } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Driver Home</Text>
      <Button title="Dzienne sprawdzenie" onPress={() => navigation.navigate('Daily Checklist')} />
    </View>
  );
}
