// Email + password accounts, with 6-digit email codes for confirming sign-up and resetting a password.
// Codes work inside the installed apps; email links (also sent) open the browser instead.

import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/wordmark';
import {
  resendSignupCode,
  resetPasswordWithCode,
  sendPasswordReset,
  setNewPassword,
  signIn,
  signUp,
  verifySignupCode,
} from '@/lib/api';
import { TAGLINE_EN } from '@/lib/app';
import { Button, Field } from '@/ui/controls';
import { BackChevron } from '@/ui/icons';
import { Section } from '@/ui/list';
import { Text } from '@/ui/text';
import { layout, useColors } from '@/ui/theme';

/**
 * signin / signup: the usual forms.
 * verify: enter the code from the sign-up email.
 * forgot: ask for a reset email. resetCode: code + new password.
 * recovery: opened from the reset link instead; just the new password.
 */
type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'resetCode' | 'recovery';

const COPY: Record<Mode, { title: string; en: string; button: string }> = {
  signin: { title: 'Welcome back', en: TAGLINE_EN, button: 'Sign In' },
  signup: { title: 'Start your Gullak', en: 'Create your account with your email and a password.', button: 'Create Account' },
  verify: { title: 'One more step', en: 'Enter the 6-digit code we emailed you.', button: 'Confirm Email' },
  forgot: { title: 'Forgot your password?', en: 'We’ll email you a code to set a new password.', button: 'Send Code' },
  resetCode: { title: 'Set a new password', en: 'Enter the code from the email and your new password.', button: 'Save Password' },
  recovery: { title: 'Set a new password', en: 'Choose a new password for your account.', button: 'Save Password' },
};

const MIN_PASSWORD = 8;

export function SignIn({ onBack, recovering = false }: { onBack?: () => void; recovering?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [chosen, setMode] = useState<Mode>('signin');
  const mode: Mode = recovering ? 'recovery' : chosen;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const go = (next: Mode, note?: { text: string; ok: boolean }) => {
    setMode(next);
    setMessage(note ?? null);
    setCode('');
    if (next !== 'verify') setPassword('');
  };

  const addr = email.trim();

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      switch (mode) {
        case 'signin':
          try {
            await signIn(addr, password);
          } catch (e) {
            // Signed up but never confirmed: send a fresh code and ask for it.
            if (/confirm your email/i.test((e as Error).message)) {
              await resendSignupCode(addr).catch(() => {});
              go('verify', { ok: true, text: `We sent a new code to ${addr}.` });
              return;
            }
            throw e;
          }
          break;
        case 'signup': {
          const { needsConfirmation } = await signUp(addr, password);
          if (needsConfirmation) go('verify', { ok: true, text: `Code sent to ${addr}. Check spam if it isn’t there in a minute.` });
          break;
        }
        case 'verify':
          await verifySignupCode(addr, code);
          break;
        case 'forgot':
          await sendPasswordReset(addr);
          go('resetCode', { ok: true, text: `If ${addr} has an account, a code is on its way.` });
          break;
        case 'resetCode':
          await resetPasswordWithCode(addr, code, password);
          break;
        case 'recovery':
          await setNewPassword(password);
          break;
      }
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setMessage(null);
    try {
      if (mode === 'verify') await resendSignupCode(addr);
      else await sendPasswordReset(addr);
      setMessage({ ok: true, text: `New code sent to ${addr}.` });
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  };

  const needsEmail = mode === 'signin' || mode === 'signup' || mode === 'forgot';
  const needsCode = mode === 'verify' || mode === 'resetCode';
  const needsPassword = mode === 'signin' || mode === 'signup' || mode === 'resetCode' || mode === 'recovery';
  const newPassword = mode === 'signup' || mode === 'resetCode' || mode === 'recovery';
  const valid =
    (!needsEmail || /.+@.+\..+/.test(addr)) &&
    (!needsCode || code.replace(/\D/g, '').length >= 6) &&
    (!needsPassword || password.length >= (newPassword ? MIN_PASSWORD : 1));
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
        <Text variant="title3" weight="600" align="center" style={styles.taglineHi}>
          {copy.title}
        </Text>
        <Text variant="body" color="secondaryLabel" align="center" style={styles.tagline}>
          {needsCode ? `${copy.en} (${addr})` : copy.en}
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
          {needsCode ? (
            <Field
              label="Code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^\d ]/g, '').slice(0, 8))}
              placeholder="6-digit code"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              onSubmitEditing={mode === 'verify' ? submit : undefined}
            />
          ) : null}
          {needsPassword ? (
            <Field
              label={newPassword && mode !== 'signup' ? 'New password' : 'Password'}
              value={password}
              onChangeText={setPassword}
              placeholder={newPassword ? `At least ${MIN_PASSWORD} characters` : 'Required'}
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
              ) : needsCode ? (
                <>
                  <Button title="Send a new code" kind="plain" size="small" onPress={resend} />
                  <Button title="Use a different email" kind="plain" size="small" onPress={() => go(mode === 'verify' ? 'signup' : 'forgot')} />
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
