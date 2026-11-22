import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sendPasswordReset, setNewPassword, signIn, signUp } from '@/lib/api';
import { Wordmark } from '@/components/wordmark';
import { TAGLINE_EN, TAGLINE_HI } from '@/lib/app';
import { Button, Field } from '@/ui/controls';
import { BackChevron } from '@/ui/icons';
import { Section } from '@/ui/list';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';

const COPY: Record<Mode, { hi: string; en: string; button: string }> = {
  signin: { hi: TAGLINE_HI, en: TAGLINE_EN, button: 'Sign In' },
  signup: { hi: 'अपना गुल्लक बनाइए।', en: 'Create your account. Free, and your payments stay yours.', button: 'Create Account' },
  forgot: { hi: 'कोई बात नहीं।', en: 'We’ll email you a link to choose a new password.', button: 'Send Reset Link' },
  recovery: { hi: 'नया पासवर्ड।', en: 'Choose a new password for your account.', button: 'Save Password' },
};

export function SignIn({ onBack, recovering = false }: { onBack?: () => void; recovering?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [chosen, setMode] = useState<Mode>('signin');
  const mode: Mode = recovering ? 'recovery' : chosen;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const go = (next: Mode) => {
    setMode(next);
    setMessage(null);
    setPassword('');
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setMode('signin');
          setPassword('');
          setMessage({ ok: true, text: `Almost there. Open the link we sent to ${email.trim()}, then sign in here.` });
        }
      } else if (mode === 'forgot') {
        await sendPasswordReset(email.trim());
        setMode('signin');
        setMessage({ ok: true, text: `If ${email.trim()} has an account, a reset link is on its way.` });
      } else {
        await setNewPassword(password);
      }
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const needsEmail = mode !== 'recovery';
  const needsPassword = mode !== 'forgot';
  const newPassword = mode === 'signup' || mode === 'recovery';
  const valid = (!needsEmail || email.includes('@')) && (!needsPassword || password.length >= (newPassword ? 8 : 1));
  const copy = COPY[mode];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.groupedBackground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + (onBack ? 12 : 60) }]} keyboardShouldPersistTaps="handled">
        {onBack && !recovering ? (
          <Pressable onPress={onBack} accessibilityRole="button" hitSlop={10} style={({ pressed }) => [styles.back, pressed && { opacity: 0.4 }]}>
            <BackChevron color={c.tint} size={18} />
            <Text color="tint">Home</Text>
          </Pressable>
        ) : null}
        <Image source={require('../../assets/images/logo-192.png')} style={styles.icon} accessibilityIgnoresInvertColors />
        <Wordmark size={46} />
        <Text variant="title3" weight="600" align="center" style={styles.taglineHi} lang="hi">
          {copy.hi}
        </Text>
        <Text variant="body" color="secondaryLabel" align="center" style={styles.tagline}>
          {copy.en}
        </Text>

        <Section inset={false}>
          {needsEmail ? (
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType={newPassword ? 'username' : 'emailAddress'}
              onSubmitEditing={mode === 'forgot' ? submit : undefined}
            />
          ) : null}
          {needsPassword ? (
            <Field
              label={mode === 'recovery' ? 'New password' : 'Password'}
              value={password}
              onChangeText={setPassword}
              placeholder={newPassword ? 'At least 8 characters' : 'Required'}
              secureTextEntry
              autoComplete={newPassword ? 'new-password' : 'current-password'}
              textContentType={newPassword ? 'newPassword' : 'password'}
              onSubmitEditing={submit}
            />
          ) : null}
        </Section>
        <View style={styles.actions}>
          <Button title={copy.button} onPress={submit} loading={busy} disabled={!valid} />
          {message ? (
            <Text variant="footnote" color={message.ok ? 'green' : 'red'} align="center" style={{ marginTop: 12 }}>
              {message.text}
            </Text>
          ) : null}
          {mode === 'recovery' ? null : (
            <View style={styles.links}>
              {mode === 'signin' ? (
                <>
                  <Button title="New here? Create an account" kind="plain" size="small" onPress={() => go('signup')} />
                  <Button title="Forgot password?" kind="plain" size="small" onPress={() => go('forgot')} />
                </>
              ) : (
                <Button title="I have an account. Sign in" kind="plain" size="small" onPress={() => go('signin')} />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingBottom: 40 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    alignSelf: 'center',
    marginBottom: 18,
    borderWidth: 2,
    borderColor: '#1C0F0C',
    shadowColor: '#1C0F0C',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: layout.inset, marginBottom: 32 },
  taglineHi: { marginTop: 4, paddingHorizontal: 32 },
  tagline: { marginTop: 2, marginBottom: 30, paddingHorizontal: 32 },
  actions: { marginHorizontal: layout.inset, marginTop: -16 },
  links: { marginTop: 18, alignItems: 'center', gap: 4 },
});
