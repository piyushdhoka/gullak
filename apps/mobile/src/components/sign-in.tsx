// Email + password accounts, with 6-digit email codes for confirming sign-up and resetting a password.
// Codes work inside the installed apps; email links (also sent) open the browser instead.

import { router } from 'expo-router';
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
import { isStandalone } from '@/lib/push';
import { useClientValue } from '@/lib/use-client';
import { Button, Field } from '@/ui/controls';
import { BackChevron } from '@/ui/icons';
import { MatkaBand } from '@/ui/sticker';
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

/** The three forms that have their own URL. The code steps stay on the page that started them. */
type Start = 'signin' | 'signup' | 'forgot';
const ROUTE: Record<Start, '/sign-in' | '/sign-up' | '/forgot-password'> = {
  signin: '/sign-in',
  signup: '/sign-up',
  forgot: '/forgot-password',
};

export function SignIn({ start = 'signin', recovering = false }: { start?: Start; recovering?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [chosen, setMode] = useState<Mode>(start);
  const mode: Mode = recovering ? 'recovery' : chosen;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  // In a browser tab (not the installed app) the website is one tap back.
  const standalone = useClientValue(isStandalone, false);
  const showHome = Platform.OS === 'web' && !standalone && !recovering;

  const go = (next: Mode, note?: { text: string; ok: boolean }) => {
    if (next in ROUTE && next !== start) {
      router.replace(ROUTE[next as Start]);
      return;
    }
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* The pot's clay with its cream wave band; the mascot sits on the edge. */}
        <View style={[styles.clay, { backgroundColor: c.tint, paddingTop: insets.top + 12, borderBottomColor: c.outline }]}>
          <View style={styles.clayInner}>
            {showHome ? (
              <Pressable
                onPress={() => router.replace('/')}
                accessibilityRole="link"
                accessibilityLabel="Back to the Gullak website"
                hitSlop={10}
                style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}>
                <BackChevron color={c.onTint} size={18} />
                <Text weight="600" style={{ color: c.onTint }}>
                  Home
                </Text>
              </Pressable>
            ) : (
              <View style={{ height: 24 }} />
            )}
            <Wordmark size={44} color="onTint" />
            <MatkaBand color={c.cream} style={styles.band} />
          </View>
          <View style={[styles.iconWrap, { backgroundColor: c.cream, borderColor: c.outline }]}>
            <Image source={require('../../assets/images/logo-192.png')} style={styles.icon} accessibilityIgnoresInvertColors />
          </View>
        </View>

        <View style={styles.wrap}>
          <Text display variant="title1" align="center" style={styles.title} accessibilityRole="header">
            {copy.title}
          </Text>
          <Text variant="body" color="secondaryLabel" align="center" style={styles.tagline}>
            {needsCode ? `${copy.en} (${addr})` : copy.en}
          </Text>

          <View style={styles.form}>
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
                placeholder={newPassword ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                secureTextEntry
                autoComplete={newPassword ? 'new-password' : 'current-password'}
                textContentType={newPassword ? 'newPassword' : 'password'}
                onSubmitEditing={submit}
              />
            ) : null}
          </View>
          <View style={styles.actions}>
            <Button title={copy.button} onPress={submit} loading={busy} disabled={!valid} />
            {message ? (
              <View
                style={[styles.note, { borderColor: message.ok ? c.green : c.red, backgroundColor: `${message.ok ? c.green : c.red}14` }]}
                accessibilityLiveRegion="polite">
                <Text variant="footnote" weight="500" color={message.ok ? 'green' : 'red'} align="center">
                  {message.text}
                </Text>
              </View>
            ) : null}
            {mode === 'recovery' ? null : (
              <View style={styles.links}>
                {mode === 'signin' ? (
                  <>
                    <Button title="New here? Create an account" kind="plain" size="small" onPress={() => go('signup')} />
                    <Button title="Forgot password?" kind="plain" size="small" tint="secondaryLabel" onPress={() => go('forgot')} />
                  </>
                ) : needsCode ? (
                  <>
                    <Button title="Send a new code" kind="plain" size="small" onPress={resend} />
                    <Button title="Use a different email" kind="plain" size="small" tint="secondaryLabel" onPress={() => go(mode === 'verify' ? 'signup' : 'forgot')} />
                  </>
                ) : (
                  <Button title="I have an account. Sign in" kind="plain" size="small" onPress={() => go('signin')} />
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 40, flexGrow: 1 },
  clay: { borderBottomWidth: 2, alignItems: 'center', marginBottom: 56 },
  clayInner: { width: '100%', maxWidth: 440, paddingHorizontal: layout.inset, alignItems: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 8, minHeight: 24 },
  band: { width: '100%', marginTop: 6, marginBottom: 60, opacity: 0.9 },
  iconWrap: {
    position: 'absolute',
    bottom: -48,
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { width: 88, height: 88 },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { marginTop: 4, paddingHorizontal: 24 },
  tagline: { marginTop: 4, marginBottom: 26, paddingHorizontal: 32 },
  form: { marginBottom: 14 },
  actions: { marginHorizontal: layout.inset, marginTop: 4 },
  note: { marginTop: 14, borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  links: { marginTop: 18, alignItems: 'center', gap: 4 },
});
