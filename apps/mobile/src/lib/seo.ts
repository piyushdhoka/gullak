// Search/share metadata for the public website. Pure data and helpers (no React, no browser APIs):
// route files use pageMetadata() in generateMetadata(), the landing pages use the JSON-LD builders.
// Facts here must match the page copy: Gullak reads bank SMS forwarded by an iPhone Shortcut, there is no bank
// login, it is free, and Android is not released yet.

import type { Metadata } from 'expo-router/server';

import { APP_NAME, MAKER } from './app';

export const SITE_URL = 'https://gullak.sparkstudio.co.in';
export const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  alt: 'Gullak: every rupee, sorted on its own.',
};

export const SITE_DESCRIPTION =
  'Gullak turns the SMS your bank already sends into sorted expenses. Pay with GPay, PhonePe or a card and it is recorded automatically. No bank login, free, installs from Safari on iPhone.';

export type PageKey = 'home' | 'how-it-works' | 'features' | 'faq' | 'install';

export const PAGES: Record<PageKey, { path: string; title: string; description: string }> = {
  home: {
    path: '/',
    title: 'Gullak: expense tracker that reads your bank SMS',
    description: SITE_DESCRIPTION,
  },
  'how-it-works': {
    path: '/how-it-works',
    title: 'How Gullak works: bank SMS to sorted expenses',
    description:
      'You pay, your bank sends its usual SMS, your iPhone forwards it with a Shortcuts automation, and Gullak sorts the amount, payee and category for you.',
  },
  features: {
    path: '/features',
    title: 'Features: automatic expenses, budgets, jars and Gullu',
    description:
      'Automatic categories from bank SMS, a notification for every payment, budgets that fill up, savings jars, and Gullu, a chat assistant for your spending. No bank login.',
  },
  faq: {
    path: '/faq',
    title: 'Gullak FAQ: privacy, banks, Android and installing',
    description:
      'Does Gullak read personal messages? Which banks work? Is there an Android app? Why is it not in the App Store? Short answers.',
  },
  install: {
    path: '/install',
    title: 'Install Gullak on your iPhone from Safari',
    description:
      'No App Store and no download. Open Gullak in Safari, tap Share, Add to Home Screen, and create your account. It updates itself.',
  },
};

const maker = { name: MAKER.name, url: MAKER.url };

/** Everything a route's generateMetadata() needs: title, description, canonical, Open Graph, Twitter and the maker credit. */
export function pageMetadata(key: PageKey): Metadata {
  const p = PAGES[key];
  const url = p.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${p.path}`;
  return {
    title: p.title,
    description: p.description,
    applicationName: APP_NAME,
    authors: maker,
    creator: MAKER.name,
    robots: 'index, follow, max-image-preview:large',
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: APP_NAME,
      locale: 'en_IN',
      url,
      title: p.title,
      description: p.description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: p.title,
      description: p.description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}

/** Sign-in and account pages: useful to people, not worth indexing. */
export function accountMetadata(title: string): Metadata {
  return {
    title: `${title} · ${APP_NAME}`,
    description: SITE_DESCRIPTION,
    authors: maker,
    creator: MAKER.name,
    robots: 'noindex, nofollow',
  };
}

/** Pages inside the signed-in app. */
export function appMetadata(title: string): Metadata {
  return { title: `${title} · ${APP_NAME}`, robots: 'noindex, nofollow', authors: maker, creator: MAKER.name };
}

/* ---------------- shared copy (rendered on the pages and in the structured data) ---------------- */

export const STEPS = [
  { title: 'You pay', text: 'GPay, PhonePe, a card, anything. Your bank sends its usual SMS a moment later.' },
  {
    title: 'Your iPhone passes it on',
    text: 'A Shortcuts automation forwards the message to Gullak. It runs on its own: no tap, no app to open.',
  },
  {
    title: 'Gullak sorts it',
    text: 'Amount, payee and category are read out, duplicates skipped, and a notification confirms it.',
  },
];

export const FAQS = [
  {
    q: 'Does Gullak read my personal messages?',
    a: 'Your iPhone forwards incoming messages, and Gullak keeps only the ones that look like bank or payment SMS. Everything else is dropped immediately, without being saved.',
  },
  {
    q: 'Which banks and apps does it work with?',
    a: 'Any UPI app (GPay, PhonePe, Paytm, CRED, BHIM) and cards, because it reads the SMS your bank sends. HDFC, SBI, ICICI, Axis, Kotak, Yes, IDFC FIRST and more are supported. If a message isn’t understood, it’s kept aside so nothing is lost.',
  },
  { q: 'Is it on Android?', a: 'Not yet. The iPhone version is first. Android can read bank SMS directly, so it’s next.' },
  {
    q: 'Why isn’t it in the App Store?',
    a: 'Gullak installs straight from Safari: open this site on your iPhone, tap Share, then Add to Home Screen. It updates itself and never expires.',
  },
  {
    q: 'What about UPI Lite and cash?',
    a: 'UPI Lite payments usually don’t send an SMS, so they can’t be picked up automatically. You can add those by hand.',
  },
];

export const INSTALL_STEPS = [
  { name: 'Open Gullak in Safari', text: 'Open this site in Safari on your iPhone.' },
  { name: 'Add to Home Screen', text: 'Tap Share, choose Add to Home Screen, then Add.' },
  { name: 'Create your account', text: 'Open Gullak from your Home Screen and create your account.' },
];

/* ---------------- JSON-LD ---------------- */

const person = { '@type': 'Person', ...maker };

export function webApplicationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE_URL}/#app`,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'iOS, Web',
    browserRequirements: 'Safari on iPhone (installs to the Home Screen)',
    inLanguage: 'en-IN',
    image: OG_IMAGE.url,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    creator: person,
    author: person,
  };
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#org`,
    name: APP_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    founder: person,
  };
}

export function faqLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function howToLd(name: string, steps: { name: string; text: string }[], path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    url: `${SITE_URL}${path}`,
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
    author: person,
  };
}
