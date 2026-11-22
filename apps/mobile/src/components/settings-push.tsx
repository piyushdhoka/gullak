// Settings › Push notifications: one switch. On = this device is subscribed and saved on the server.
// When the switch can't do anything (not installed, blocked, unsupported) the row says why instead.

import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { isDemo } from '@/lib/api';
import { disablePush, enablePush, hasSubscription, pushState, type PushState } from '@/lib/push';
import { useClientValue } from '@/lib/use-client';
import { Glyph } from '@/ui/glyphs';
import { IconTile, Row } from '@/ui/list';
import { useColors } from '@/ui/theme';

const WHY: Partial<Record<PushState, { value: string; subtitle: string }>> = {
  'needs-install': { value: 'Install first', subtitle: 'Add Gullak to your Home Screen and open it from there.' },
  denied: { value: 'Blocked', subtitle: 'Turn them on in iPhone Settings › Notifications › Gullak.' },
  unsupported: { value: 'Not here', subtitle: 'This browser can’t show notifications.' },
};

export function PushToggle() {
  const c = useColors();
  const state = useClientValue(pushState, 'unsupported' as PushState);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== 'granted') return;
    let alive = true;
    hasSubscription().then((s) => alive && setOn(s));
    return () => {
      alive = false;
    };
  }, [state]);

  const icon = (
    <IconTile color={c.gold}>
      <Glyph name="bell" size={18} color="#1C0F0C" />
    </IconTile>
  );

  const why = isDemo ? { value: 'Demo', subtitle: 'Sign in to get notifications.' } : WHY[state];
  if (why) return <Row left={icon} title="Push notifications" subtitle={why.subtitle} value={why.value} />;

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    setOn(next); // move the switch straight away; put it back if it fails
    const result = next ? await enablePush() : await disablePush();
    if (!result.ok) {
      setOn(!next);
      setError(result.message);
    }
    setBusy(false);
  };

  return (
    <Row
      left={icon}
      title="Push notifications"
      subtitle={error ?? (on ? 'A heads-up a few seconds after every payment.' : 'Off. Payments still get recorded.')}
      right={
        <Switch
          value={on}
          disabled={busy}
          onValueChange={toggle}
          accessibilityLabel="Push notifications"
          trackColor={{ false: c.fill, true: c.green }}
          thumbColor="#FFFFFF"
          {...({ activeThumbColor: '#FFFFFF' } as object)}
        />
      }
    />
  );
}
