import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '@/api/client';
import { checkHealth } from '@/api/health';
import { API_URL } from '@/config';

/** Walking-skeleton health screen: proves the app can reach the API. */
export default function HealthScreen() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkHealth(createApiClient(API_URL)).then((line) => {
      if (!cancelled) setStatus(line);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      {status === null ? <ActivityIndicator /> : <Text style={styles.status}>{status}</Text>}
      <Text style={styles.url}>{API_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  status: { fontSize: 20, fontWeight: '600' },
  url: { fontSize: 12, opacity: 0.6 },
});
