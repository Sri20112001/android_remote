/**
 * Bootstrap route: shows a holding frame while the stored session loads,
 * then sends the user to the paired dashboard or the connect flow.
 */

import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useSession } from '@/auth/session';

export default function Index() {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0E14',
          gap: 16,
        }}
        accessibilityLabel="Loading TUF Remote"
      >
        {/* Brand mark */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: '#1E293B',
            borderWidth: 1,
            borderColor: '#334155',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: '#CAF300',
            }}
          />
        </View>

        {/* Brand */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            letterSpacing: 2,
            color: '#F1F5F9',
            fontFamily: 'JetBrains Mono',
          }}
        >
          TUF REMOTE
        </Text>

        {/* Loading indicator */}
        <ActivityIndicator color="#CAF300" size="small" />
      </View>
    );
  }

  return <Redirect href={status === 'paired' ? '/(tabs)/trackpad' : '/connect'} />;
}