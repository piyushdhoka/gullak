// Native (iOS/Android) build: real system tab bar. The web build uses app-tabs.web.tsx.

import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useData } from '@/lib/data';
import { hasSmsPermission, smsMark, smsSupported, syncSms } from '@/lib/sms';
import { bodyFont, useColors } from '@/ui/theme';

/** Android: send new bank SMS whenever the app opens or comes back, once the first import was done in Setup. */
function useSmsAutoSync() {
  const { session, refresh } = useData();
  const userId = session?.userId;
  useEffect(() => {
    if (!smsSupported || !userId) return;
    const run = async () => {
      if (!(await smsMark(userId)) || !(await hasSmsPermission())) return;
      const r = await syncSms(userId);
      if (r.saved) refresh();
    };
    run().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run().catch(() => {});
    });
    return () => sub.remove();
  }, [userId, refresh]);
}

export default function AppTabs() {
  const c = useColors();
  useSmsAutoSync();
  return (
    <NativeTabs
      tintColor={c.tint}
      backgroundColor={c.groupedBackground}
      iconColor={{ default: c.secondaryLabel, selected: c.tint }}
      labelStyle={{ fontFamily: bodyFont('600'), fontSize: 11, color: c.secondaryLabel }}
      indicatorColor={`${c.tint}26`}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Summary</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="pie_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="setup">
        <NativeTabs.Trigger.Label>Setup</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bolt.fill" md="bolt" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
