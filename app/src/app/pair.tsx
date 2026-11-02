/**
 * Pair screen — step 2 of the flow.
 *
 * Native Cloud styling with PIN entry and device metadata.
 */

import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { ApiError, displayOrigin } from '@/api/client';
import { AppHeader, IconButton } from '@/components/app-header';
import { Banner, Card, MonoLabel } from '@/components/typography';
import { Button } from '@/components/button';
import { Field } from '@/components/field';
import { Screen } from '@/components/screen';
import { useSession } from '@/auth/session';
import { MAX_DEVICE_NAME_LENGTH, PIN_LENGTH } from '@/config/constants';

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message !== '') return error.message;
  return 'Pairing failed. Try again.';
}

function defaultDeviceName(): string {
  const parts = [Device.manufacturer, Device.modelName].filter(
    (part): part is string =>
      typeof part === 'string' && part.trim() !== '',
  );

  const name = parts.join(' ').trim();
  return name === '' ? 'Android device' : name;
}

export default function PairScreen() {
  const router = useRouter();
  const session = useSession();

  const {
    status,
    pendingOrigin,
    pendingPin,
    cancelConnect,
    pair,
  } = session;

  const [pin, setPin] = useState(pendingPin ?? '');
  const [name, setName] = useState(defaultDeviceName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const metadata = useMemo(
    () => ({
      name: name.trim(),
      model:
        [Device.manufacturer, Device.modelName]
          .filter(
            (part): part is string =>
              typeof part === 'string' && part.trim() !== '',
          )
          .join(' ')
          .trim() || undefined,
      osVersion: Device.osVersion ?? undefined,
      platform: Platform.OS,
    }),
    [name],
  );

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'paired') {
      router.replace('/(tabs)/trackpad');
      return;
    }

    if (pendingOrigin === null) {
      router.replace('/connect');
    }
  }, [status, pendingOrigin, router]);

  if (pendingOrigin === null) {
    return null;
  }

  const submit = async () => {
    const trimmedPin = pin.trim();

    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(trimmedPin)) {
      setError(`The PIN is ${PIN_LENGTH} digits.`);
      return;
    }

    if (
      metadata.name.length < 1 ||
      metadata.name.length > MAX_DEVICE_NAME_LENGTH
    ) {
      setError(
        `Device name must be 1-${MAX_DEVICE_NAME_LENGTH} characters.`,
      );
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await pair(trimmedPin, metadata);
      router.replace('/(tabs)/trackpad');
    } catch (pairError) {
      setError(messageOf(pairError));
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <AppHeader
        accessory={
          <IconButton
            icon="arrow-left"
            label="Back to connect"
            onPress={() => {
              cancelConnect();
              router.replace('/connect');
            }}
          />
        }
      />

      {/* Pairing header */}
      <View className="gap-2 py-2">
        <Text className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Device setup
        </Text>

        <Text className="mt-1 text-3xl font-bold text-slate-900">
          Pair device
        </Text>

        <Text
          className="mt-1 text-sm text-slate-500"
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {displayOrigin(pendingOrigin)}
        </Text>
      </View>

      {/* Pairing form */}
      <Card>
        <Field
          label="Pairing PIN"
          value={pin}
          onChangeText={(text) => {
            setPin(text.replace(/[^\d]/g, '').slice(0, PIN_LENGTH));
            if (error !== null) setError(null);
          }}
          placeholder="••••••"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="off"
          maxLength={PIN_LENGTH}
          mono
          autoFocus={pendingPin === null}
          hint={`The ${PIN_LENGTH}-digit PIN is shown on your PC when pairing starts.`}
          accessibilityLabel={`Pairing PIN, ${PIN_LENGTH} digits`}
          testID="pairing-pin"
        />

        <Field
          label="Device name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (error !== null) setError(null);
          }}
          maxLength={MAX_DEVICE_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          hint="Shown to the PC user in the paired-device list."
          accessibilityLabel="Device name"
          testID="device-name"
        />

        {error !== null && <Banner message={error} />}

        <Button
          label="Pair device"
          icon="link"
          loading={submitting}
          onPress={() => {
            submit();
          }}
          testID="pair-submit"
        />
      </Card>

      {/* Security information */}
      <Text className="px-2 text-center text-sm leading-5 text-slate-500">
        Only this PIN can authorize the device, and it expires a few
        minutes after the pairing window opens on the PC.
      </Text>
    </Screen>
  );
}