/**
 * Bootstrap route: plays the boot sequence while the stored session loads,
 * then sends the user to the paired dashboard or the connect flow.
 *
 * The animation itself lives in `components/boot-sequence.tsx`; this file
 * only decides when the screen is allowed to leave. A short floor keeps the
 * brand frame from flashing for a single frame when the secure store answers
 * instantly — it never delays a slow read, because the floor and the session
 * load run in parallel and the screen leaves when **both** are done.
 */

import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { useSession } from '@/auth/session';
import { BootSequence } from '@/components/boot-sequence';

/** Minimum time the boot frame stays visible (parallel with the session read). */
const MIN_BOOT_MS = 450;

export default function Index() {
  const { status } = useSession();
  const [minElapsed, setMinElapsed] = useState(false);

  // Deferred: state is set from the timer callback, never in the effect body.
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_BOOT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status !== 'loading' && minElapsed) {
    return (
      <Redirect href={status === 'paired' ? '/(tabs)/trackpad' : '/connect'} />
    );
  }

  return <BootSequence status={status} />;
}
