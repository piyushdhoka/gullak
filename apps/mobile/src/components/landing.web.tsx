// The public website (web only): what signed-out visitors see. Every page has its own URL:
//   /               home
//   /how-it-works   the three steps
//   /features       what Gullak does
//   /faq            questions
//   /install        how to get it on an iPhone (QR code on laptops)
// Sign-in lives at /sign-in, /sign-up and /forgot-password (src/app/(site)).
// Plain DOM + a CSS module so the pages can use real CSS (grid, sticky, keyframes, media queries).
// The look is the app's "Matka" design system (docs/DESIGN.md), re-drawn in CSS: peach-cream page,
// sticker cards (2px outline + hard offset shadow), clay hero, the cream wave band, pixel type for numbers.
// Everything renders statically (expo export pre-renders it): no window/document access during render.

import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode, type RefObject } from 'react';

import { APP_NAME, MAKER, WORDMARK } from '@/lib/app';
import { faqLd, FAQS, howToLd, INSTALL_STEPS, organizationLd, STEPS, webApplicationLd } from '@/lib/seo';
import { BRAND_LOGOS } from '@/ui/brand-logos';

import { hasAuthLinkError } from './auth-link';
import { LandingPot } from './landing-pot';
import styles from './landing.module.css';

/* ---------------- routes ---------------- */

const NAV: { href: Href & string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/faq', label: 'FAQ' },
];

/** A real link (crawlable, opens in a new tab) that navigates inside the app on a normal click. */
function SiteLink({ href, className, children, label }: { href: Href & string; className?: string; children: ReactNode; label?: string }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Home is a full page load: inside the app "/" is the signed-in Summary (protected), so an in-app push
    // would bounce a visitor to sign-in. Loading "/" lets the server-rendered website home show.
    if (href === '/') return;
    e.preventDefault();
    router.push(href);
  };
  const current = typeof window !== 'undefined' && window.location.pathname === href;
  return (
    <a href={href} className={className} onClick={onClick} aria-label={label} aria-current={current ? 'page' : undefined}>
      {children}
    </a>
  );
}

/** Nav and footer shared by every public page. */
function Site({
  children,
  pageRef,
  ld = [],
}: {
  children: ReactNode;
  pageRef?: RefObject<HTMLDivElement | null>;
  /** schema.org objects for this page, written into the HTML as JSON-LD. */
  ld?: object[];
}) {
  return (
    <div className={styles.page} ref={pageRef}>
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }} />
      ))}
      <nav className={styles.nav} aria-label={APP_NAME}>
        <SiteLink className={styles.navBrand} href="/" label={`${APP_NAME} home`}>
          <Mascot size={34} eager />
          <Logotype />
        </SiteLink>
        <div className={styles.navLinks}>
          {NAV.map((n) => (
            <SiteLink key={n.href} href={n.href}>
              {n.label}
            </SiteLink>
          ))}
        </div>
        <SiteLink className={styles.navCta} href="/install">
          Get Gullak
        </SiteLink>
      </nav>

      {children}

      <footer className={styles.footer}>
        <Band className={styles.footerBand} waves={24} />
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Mascot size={120} className={styles.footerMascot} />
            <div>
              <p className={styles.footerMark}>
                <SiteLink href="/" className={styles.footerHome} label={`${APP_NAME} home`}>
                  <Logotype />
                </SiteLink>
              </p>
              <p className={styles.footerLine}>Every rupee, sorted on its own. Free for iPhone.</p>
            </div>
          </div>
          <GetIt onClay />
        </div>
        <Band className={styles.footerBand} waves={24} dots={false} />
        <div className={styles.footerLinks}>
          {NAV.map((n) => (
            <SiteLink key={n.href} href={n.href}>
              {n.label}
            </SiteLink>
          ))}
          <SiteLink href="/install">Install</SiteLink>
          <SiteLink href="/sign-in">Sign in</SiteLink>
        </div>
        <p className={styles.footerMaker}>
          Made by{' '}
          <a href={MAKER.url} target="_blank" rel="noopener" lang="en">
            {MAKER.name}
          </a>
        </p>
      </footer>
    </div>
  );
}

/** "Next: …" at the bottom of each page, so the site reads in order. */
function Next({ href, label }: { href: Href & string; label: string }) {
  return (
    <p className={styles.next}>
      <SiteLink href={href} className={styles.nextLink}>
        {label} <span aria-hidden>→</span>
      </SiteLink>
    </p>
  );
}

/** Title block for the subpages: a big pixel headline and one line under it. */
function PageHead({ id, title, lede, side }: { id: string; title: string; lede: string; side?: ReactNode }) {
  return (
    <header className={styles.pageHead}>
      <div>
        <h1 id={id} className={styles.pageTitle}>
          {title}
        </h1>
        <p className={styles.pageLede}>{lede}</p>
      </div>
      {side ? <div className={styles.pageSide}>{side}</div> : null}
    </header>
  );
}

/* ---------------- pages ---------------- */

/** "/" for signed-out visitors. */
export function Landing() {
  // A failed email link (expired / already used) lands on the home page: send it to sign-in, which explains.
  useEffect(() => {
    if (hasAuthLinkError()) router.replace('/sign-in');
  }, []);
  return (
    <Site ld={[webApplicationLd(), organizationLd()]}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden />
            Free for iPhone · no App Store needed
          </p>
          <h1 className={styles.h1}>Every rupee, sorted on its own.</h1>
          <p className={styles.lede}>
            Pay with GPay, PhonePe or a card. Your bank texts you, and Gullak turns that SMS into a sorted, totalled
            expense a few seconds later. Nothing to type.
          </p>
          <GetIt />
        </div>
        <HeroPhone />
      </header>

      <main>
        <section className={styles.logos} aria-label="Works with">
          <p className={styles.logosTitle}>Works with the SMS from every big Indian bank and UPI app</p>
          <Marquee items={BANKS} />
          <Marquee items={APPS} reverse />
        </section>

        <section className={styles.intro} aria-labelledby="intro-title">
          <h2 id="intro-title" className={styles.h2}>
            Your bank already writes it down
          </h2>
          <p className={styles.introText}>
            Gullak reads the SMS your bank already sends, files every payment under the right category, and shows you
            where your month went. No bank login, no forms, no end-of-month guesswork.
          </p>
          <div className={styles.transform}>
            <figure className={styles.tfSms}>
              <figcaption className={styles.tfCap}>The SMS from your bank</figcaption>
              <p className={styles.tfBubble}>
                Sent <b>Rs.250.00</b> From HDFC Bank A/C *1234 To <b>SWIGGY</b> On 22/11/26 Ref 528461234567
              </p>
            </figure>
            <PixelArrow className={styles.tfArrow} />
            <figure className={styles.tfOut}>
              <figcaption className={styles.tfCap}>What lands in Gullak</figcaption>
              <div className={styles.txnCard}>
                <BrandTile name="Swiggy" emoji="🍔" className={styles.txnEmoji} />
                <span className={styles.txnBody}>
                  <span className={styles.txnName}>Swiggy</span>
                  <span className={styles.txnMeta}>Food · HDFC Bank •1234</span>
                </span>
                <span className={styles.txnAmt}>₹250</span>
              </div>
            </figure>
          </div>
        </section>

        <section className={styles.note} aria-labelledby="note-title">
          <div className={styles.receiptWrap}>
            <article className={styles.receipt}>
              <p className={styles.receiptShop} aria-hidden>
                Gullak · since the first coin
              </p>
              <h2 id="note-title" className={styles.receiptTitle}>
                Why Gullak exists
              </h2>
              <hr className={styles.receiptRule} />
              <p>
                Every expense app we tried wanted the same thing: open me, type the amount, pick a category, do it again
                tomorrow. We never kept it up past the first week.
              </p>
              <p>
                But the bank already tells us about every rupee, the moment it leaves. So Gullak listens to that, sorts it,
                and only asks when it genuinely can’t tell, like a chai stall’s QR code.
              </p>
              <p>Like the clay gullak you fed coins into as a kid: you just drop them in. It keeps count.</p>
              <hr className={styles.receiptRule} />
              <dl className={styles.receiptLines}>
                <div>
                  <dt>Amounts you type</dt>
                  <dd>0</dd>
                </div>
                <div>
                  <dt>Categories you pick</dt>
                  <dd>only the unknowns</dd>
                </div>
                <div className={styles.receiptTotal}>
                  <dt>Rupees counted</dt>
                  <dd>all of them</dd>
                </div>
              </dl>
              <hr className={styles.receiptRule} />
              <p className={styles.noteSign}>Team Gullak</p>
              <span className={styles.barcode} aria-hidden />
            </article>
          </div>
        </section>
        <Next href="/how-it-works" label="See how it works" />
      </main>
    </Site>
  );
}

/** "/how-it-works" */
export function HowItWorksPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  return (
    <Site
      pageRef={pageRef}
      ld={[howToLd('How Gullak turns a bank SMS into a sorted expense', STEPS.map((x) => ({ name: x.title, text: x.text })), '/how-it-works')]}>
      <main className={styles.subpage}>
        <Story root={pageRef} />
        <Next href="/features" label="Features" />
      </main>
    </Site>
  );
}

/** "/features" */
export function FeaturesPage() {
  return (
    <Site>
      <main className={styles.subpage}>
        <PageHead
          id="features-title"
          title="From a bank SMS to a clear month"
          lede="Everything Gullak does starts with a message your bank already sends."
        />
        <section className={styles.bento} aria-labelledby="features-title">
          <article className={`${styles.tile} ${styles.span4}`}>
            <h2 className={styles.h3}>Reads the SMS, not your bank account</h2>
            <p className={styles.tileText}>Amount, payee, account and UPI reference, picked straight out of the message.</p>
            <div className={styles.parse}>
              <p className={styles.smsText}>
                Sent <mark className={styles.mAmount}>Rs.250.00</mark> From HDFC Bank A/C{' '}
                <mark className={styles.mAccount}>*1234</mark> To <mark className={styles.mPayee}>SWIGGY</mark> On 22/11/26
                Ref <mark className={styles.mRef}>528461234567</mark>
              </p>
              <dl className={styles.fields}>
                <div data-k="amount">
                  <dt>Spent</dt>
                  <dd className={styles.fAmount}>₹250.00</dd>
                </div>
                <div data-k="payee">
                  <dt>Paid to</dt>
                  <dd className={styles.fPayee}>
                    <BrandTile name="Swiggy" emoji="🍔" className={styles.fLogo} />
                    Swiggy
                  </dd>
                </div>
                <div data-k="account">
                  <dt>From</dt>
                  <dd>HDFC Bank •1234</dd>
                </div>
                <div data-k="cat">
                  <dt>Category</dt>
                  <dd>🍔 Food</dd>
                </div>
              </dl>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.span2} ${styles.tileStats}`} aria-label="Gullak in numbers">
            <Stat value={20} suffix="+" label="Indian banks read" />
            <Stat value={90} suffix="+" label="merchants recognised" />
            <Stat value={5} prefix="~" suffix="s" label="from SMS to sorted" />
          </article>

          <article className={`${styles.tile} ${styles.span3}`}>
            <h2 className={styles.h3}>A nudge for every payment</h2>
            <p className={styles.tileText}>
              A notification lands a few seconds after you pay. And a QR code isn’t a name: Gullak won’t guess what{' '}
              <code>paytmqr2810…</code> sold you. Pick once; every past and future payment there follows.
            </p>
            <div className={styles.notifStack}>
              <Notif title="₹250 at Swiggy 🍔" body="Food, noted. Gullak is hungry now." actions={['Change category', 'My month']} />
              <Notif
                title="₹40 to paytmqr2810… 🤔"
                body="Who is this? Pick a category once and Gullak never asks again."
                actions={['Pick category', 'Details']}
              />
            </div>
          </article>

          <article className={`${styles.tile} ${styles.span3}`}>
            <h2 className={styles.h3}>Ask Gullu</h2>
            <p className={styles.tileText}>Gullu is the chatbot inside Gullak. Ask about your money in plain words.</p>
            <div className={styles.chat} aria-label="A sample chat with Gullu" role="group">
              <p className={styles.chatMe}>How much did I spend on food this month?</p>
              <div className={styles.chatGullu}>
                <span className={styles.chatAvatar} aria-hidden>
                  <Mascot size={28} />
                </span>
                <p>
                  <b>₹4,320</b> on Food so far this month. Swiggy is ₹2,610 of it. 🍔
                </p>
              </div>
              <p className={styles.chatMe}>And last month?</p>
              <div className={styles.chatGullu}>
                <span className={styles.chatAvatar} aria-hidden>
                  <Mascot size={28} />
                </span>
                <p className={styles.typing} aria-label="Gullu is typing">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.span3}`}>
            <h2 className={styles.h3}>Gullak Jars</h2>
            <p className={styles.tileText}>Save towards something. The pot fills with coins, and sprouts when it’s full.</p>
            <JarDemo />
          </article>

          <article className={`${styles.tile} ${styles.span3}`}>
            <h2 className={styles.h3}>Budgets that fill up</h2>
            <p className={styles.tileText}>Set a limit per category. Each payment adds a block, so you see it coming.</p>
            <ul className={styles.budgets}>
              <Budget emoji="🛍️" name="Shopping" note="₹173 over" value={1.06} over />
              <Budget emoji="🍔" name="Food" note="₹1,525 left" value={0.7} />
              <Budget emoji="🛒" name="Groceries" note="₹3,222 left" value={0.36} />
            </ul>
          </article>

          <article className={`${styles.tile} ${styles.span6} ${styles.tilePrivacy}`}>
            <h2 className={styles.h3}>Your messages stay yours</h2>
            <p className={styles.tileText}>Gullak only needs your bank’s SMS. Everything else stays out.</p>
            <ul className={styles.promises}>
              <li>
                <PrivacyIcon kind="chat" />
                <span className={styles.promiseTitle}>Chats never kept</span>
                <span className={styles.promiseText}>Personal chats are dropped before they’re stored.</span>
              </li>
              <li>
                <PrivacyIcon kind="key" />
                <span className={styles.promiseTitle}>No bank login</span>
                <span className={styles.promiseText}>No bank passwords, no account linking.</span>
              </li>
              <li>
                <PrivacyIcon kind="server" />
                <span className={styles.promiseTitle}>Our own server</span>
                <span className={styles.promiseText}>Runs on Gullak’s own server, not an ad network.</span>
              </li>
            </ul>
          </article>
        </section>
        <Next href="/faq" label="Questions" />
      </main>
    </Site>
  );
}

/** "/faq" */
export function FaqPage() {
  return (
    <Site ld={[faqLd()]}>
      <main className={styles.subpage}>
        <PageHead
          id="faq-title"
          title="Your questions, answered"
          lede="Short answers to what people ask first."
          side={<Mascot size={140} className={styles.sideMascot} />}
        />
        <section className={styles.faq} aria-labelledby="faq-title">
          {FAQS.map((f) => (
            <Faq key={f.q} q={f.q}>
              {f.a}
            </Faq>
          ))}
        </section>
        <Next href="/install" label="Get Gullak" />
      </main>
    </Site>
  );
}

/** "/install": the three steps on a phone, a QR code on a laptop. */
export function InstallPage() {
  return (
    <Site ld={[howToLd('How to add Gullak to your iPhone', INSTALL_STEPS, '/install')]}>
      <main className={styles.subpage}>
        <PageHead
          id="install-title"
          title="Add Gullak to your iPhone"
          lede="No App Store, no download. It installs from Safari in three taps and updates itself."
          side={<Mascot size={140} eager className={styles.sideMascot} />}
        />
        <section className={styles.installCard} aria-labelledby="install-title">
          <ol className={styles.steps}>
            <li>
              Open this site in <strong>Safari</strong> on your iPhone.
            </li>
            <li>
              Tap <strong>Share</strong> <ShareIcon />, choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
            <li>
              Open <strong>Gullak</strong> from your Home Screen and create your account.
            </li>
          </ol>
          <GetIt hideInstall />
        </section>
      </main>
    </Site>
  );
}

/* ---------------- pieces ---------------- */

/** "Gulलक": one word, Latin then Devanagari. Screen readers hear "Gullak". */
function Logotype() {
  return (
    <span className={styles.logotype} aria-label={APP_NAME} role="img">
      <span aria-hidden>{WORDMARK.latin}</span>
      <span aria-hidden lang="hi" className={styles.logotypeHi}>
        {WORDMARK.devanagari}
      </span>
    </span>
  );
}

/**
 * The mascot, decorative (empty alt). WebP with a PNG fallback; small spots get the 96 px file
 * (enough for 3× screens), larger ones 192 px / 384 px by pixel density. Lazy unless `eager`.
 */
function Mascot({ size, className, eager }: { size: number; className?: string; eager?: boolean }) {
  const small = size <= 48;
  const webp = small ? '/mascot-96.webp' : '/mascot-192.webp 1x, /mascot-384.webp 2x';
  const pngSet = small ? '/mascot-96.png' : '/mascot-192.png 1x, /mascot-384.png 2x';
  return (
    <picture className={styles.mascotPic}>
      <source type="image/webp" srcSet={webp} />
      <img
        src={small ? '/mascot-96.png' : '/mascot-192.png'}
        srcSet={pngSet}
        alt=""
        width={size}
        height={size}
        className={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </picture>
  );
}

/** The cream wave with dots from the pot's belly (the app's MatkaBand). Stretches to its box. Decorative. */
function Band({ className, waves = 7, dots = true }: { className?: string; waves?: number; dots?: boolean }) {
  const w = waves * 20;
  let d = 'M0 7';
  for (let i = 0; i < waves; i++) {
    const x = i * 20;
    d += ` Q${x + 5} 1 ${x + 10} 7 Q${x + 15} 13 ${x + 20} 7`;
  }
  return (
    <svg className={className} viewBox={`0 0 ${w} 14`} preserveAspectRatio="none" aria-hidden focusable="false">
      <path d={d} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {dots ? Array.from({ length: waves }, (_, i) => <circle key={i} cx={i * 20 + 15} cy={3} r={1.8} fill="currentColor" />) : null}
    </svg>
  );
}

/** The mascot's coin (the app's Coin glyph). */
function Coin({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden focusable="false" className={styles.coin}>
      <circle cx={11} cy={11} r={9.5} fill="#F5A90F" stroke="#1C0F0C" strokeWidth={2} />
      <circle cx={11} cy={11} r={5.8} fill="none" stroke="#FFE08A" strokeWidth={1.6} />
      <path
        d="M8.6 7.6h4.8M8.6 9.6h4.8M10 7.6c2.6 0 2.6 4-0.2 4H8.8l3.6 3.4"
        stroke="#A8341A"
        strokeWidth={1.3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A chunky pixel arrow: points right on wide screens, down when stacked (rotated in CSS). */
function PixelArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 9" width={48} height={36} aria-hidden focusable="false" shapeRendering="crispEdges">
      <path d="M0 3h7V0h1v1h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1H8v1H7V6H0z" fill="currentColor" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className={styles.shareIcon} viewBox="0 0 20 24" width={16} height={19} aria-label="(the square with an arrow)" role="img">
      <path d="M10 1v14M5 6l5-5 5 5" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10H3v12h14V10h-3" stroke="currentColor" strokeWidth={2} fill="none" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * How to get Gullak. Touch screens get "Add to iPhone" (→ /install) + "Sign in" (→ /sign-in); laptops get
 * a QR code and no sign-in. Chosen with CSS (pointer/hover media queries), so the first paint is already right.
 */
function GetIt({ hideInstall, onClay }: { hideInstall?: boolean; onClay?: boolean }) {
  return (
    <div className={`${styles.getIt} ${onClay ? styles.getItOnClay : ''}`}>
      <div className={styles.onTouch}>
        {hideInstall ? null : (
          <SiteLink href="/install" className={styles.primary}>
            Add to iPhone
          </SiteLink>
        )}
        <SiteLink href="/sign-in" className={styles.textButton}>
          Already set up? Sign in
        </SiteLink>
      </div>
      <div className={styles.onDesktop}>
        <div className={styles.qrCard}>
          <span className={styles.qrTile}>
            <img src="/qr.svg" alt="QR code that opens gullak.sparkstudio.co.in" width={104} height={104} />
          </span>
          <div>
            <p className={styles.qrTitle}>Scan with your iPhone camera</p>
            <p className={styles.qrText}>Gullak opens in Safari. Tap Share, then Add to Home Screen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A lock-screen notification in Gullak's voice (the app's NotifPreview, in CSS). */
function Notif({ title, body, actions, className }: { title: string; body: string; actions?: string[]; className?: string }) {
  return (
    <div className={`${styles.notif} ${className ?? ''}`}>
      <span className={styles.notifIcon} aria-hidden>
        <Mascot size={30} eager />
      </span>
      <span className={styles.notifBody}>
        <span className={styles.notifHead}>
          <span className={styles.notifApp}>Gullak</span>
          <span className={styles.notifWhen}>· now</span>
        </span>
        <span className={styles.notifTitle}>{title}</span>
        <span className={styles.notifText}>{body}</span>
      </span>
      {actions?.length ? (
        <span className={styles.notifActions}>
          {actions.map((a, i) => (
            <span key={a} className={i === 0 ? styles.notifChipOn : styles.notifChip}>
              {a}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** Progress as a row of pixel blocks, like the app's PixelBar. */
function PixelBar({ value, blocks = 20, tone }: { value: number; blocks?: number; tone?: 'over' | 'gold' }) {
  const v = Math.max(0, value);
  const lit = v > 0 ? Math.max(1, Math.min(blocks, Math.round(v * blocks))) : 0;
  return (
    <span className={`${styles.pixelBar} ${tone === 'over' ? styles.pixelBarOver : tone === 'gold' ? styles.pixelBarGold : ''}`} aria-hidden>
      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} data-on={i < lit || undefined} />
      ))}
    </span>
  );
}

function Budget({ emoji, name, note, value, over }: { emoji: string; name: string; note: string; value: number; over?: boolean }) {
  return (
    <li className={styles.budget}>
      <span className={styles.budgetTile} aria-hidden>
        {emoji}
      </span>
      <span className={styles.budgetBody}>
        <span className={styles.budgetTop}>
          <span className={styles.budgetName}>{name}</span>
          <span className={over ? styles.budgetOver : styles.budgetLeft}>
            {over ? '▲ ' : ''}
            {note}
          </span>
        </span>
        <PixelBar value={value} tone={over ? 'over' : undefined} />
      </span>
    </li>
  );
}

/** A Jar that fills with coins once it scrolls into view. */
function JarDemo() {
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);
  const reduce = useReducedMotion();
  const [filling, setFilling] = useState(0.2);
  const target = 0.62;
  useEffect(() => {
    if (!seen || reduce) return;
    const id = setInterval(() => setFilling((x) => (x >= target ? x : Math.min(target, x + 0.06))), 110);
    return () => clearInterval(id);
  }, [seen, reduce]);
  const p = seen && reduce ? target : filling;
  const saved = Math.round((20000 * p) / 100) * 100;
  return (
    <div className={styles.jar} ref={ref}>
      <LandingPot progress={p} size={104} className={styles.jarPot} />
      <div className={styles.jarBody}>
        <p className={styles.jarName}>🏖️ Goa trip</p>
        <p className={styles.jarAmount}>
          ₹{inr.format(saved)} <span className={styles.jarOf}>of ₹20,000</span>
        </p>
        <PixelBar value={p} blocks={16} tone="gold" />
        <p className={styles.jarHint}>{Math.round(p * 100)}% full. Keep feeding it.</p>
      </div>
    </div>
  );
}

function Stat({ value, prefix, suffix, label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div className={styles.stat} ref={ref}>
      <span className={styles.statN}>
        <NumberTicker value={seen ? value : 0} prefix={prefix} suffix={suffix} />
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className={styles.faqItem}>
      <summary>
        <span>{q}</span>
        <span className={styles.faqMark} aria-hidden />
      </summary>
      <p>{children}</p>
    </details>
  );
}

/* ---------------- effects ---------------- */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** True once the element has been on screen (IntersectionObserver works through the page's scroller). */
/* ---------------- brand logos & privacy icons ---------------- */

/** A merchant's real logo on its brand colour (Simple Icons, CC0); the emoji tile when there isn't one. */
function BrandTile({ name, emoji, className }: { name: string; emoji: string; className?: string }) {
  const logo = BRAND_LOGOS[name];
  if (!logo) {
    return (
      <span className={className} aria-hidden>
        {emoji}
      </span>
    );
  }
  const hex = logo.hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
  return (
    <span className={`${className ?? ''} ${styles.brandTile}`} style={{ background: logo.hex }} aria-hidden>
      <svg viewBox="0 0 24 24" width="58%" height="58%">
        <path d={logo.path} fill={light ? '#1c0f0c' : '#ffffff'} />
      </svg>
    </span>
  );
}

/** Line icons for the privacy promises: a chat being dropped, a key crossed out, a server. */
function PrivacyIcon({ kind }: { kind: 'chat' | 'key' | 'server' }) {
  return (
    <span className={styles.promiseIcon} aria-hidden>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'chat' ? (
          <>
            <path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <path d="M9 8l6 4M15 8l-6 4" />
          </>
        ) : kind === 'key' ? (
          <>
            <circle cx="8" cy="15" r="4" />
            <path d="M11 12l8-8M16 7l2 2M14 9l2 2" />
            <path d="M3 3l18 18" />
          </>
        ) : (
          <>
            <rect x="4" y="3.5" width="16" height="7" rx="2" />
            <rect x="4" y="13.5" width="16" height="7" rx="2" />
            <path d="M8 7h.01M8 17h.01M12 7h4M12 17h4" />
          </>
        )}
      </svg>
    </span>
  );
}

function useSeen<T extends Element>(threshold = 0.4) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** prefers-reduced-motion, read after mount (false during the static render). */
const REDUCE = '(prefers-reduced-motion: reduce)';
function subscribeReduce(on: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/** Counts from the last value to the new one (jumps straight there with reduced motion). */
function NumberTicker({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const a = from.current;
    if (a === value) return;
    if (reduce) {
      from.current = value;
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, reduce]);
  return (
    <span className={styles.ticker}>
      {prefix}
      {inr.format(Math.round(reduce ? value : shown))}
      {suffix}
    </span>
  );
}

/** Two copies of a row of outlined chips slide sideways forever; the copy is hidden from screen readers. */
function Marquee({ items, reverse }: { items: string[]; reverse?: boolean }) {
  return (
    <div className={`${styles.marquee} ${reverse ? styles.marqueeReverse : ''}`}>
      {/* Three copies: each slides by its own width, so two always cover the strip, however wide. */}
      {[0, 1, 2].map((copy) => (
        <ul key={copy} className={styles.marqueeTrack} aria-hidden={copy > 0 || undefined}>
          {items.map((item) => (
            <li key={item} className={styles.marqueePill}>
              {item}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

const BANKS = ['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank', 'Kotak', 'IDFC FIRST', 'Yes Bank', 'PNB', 'Bank of Baroda', 'Canara Bank', 'Union Bank', 'IndusInd', 'Federal Bank', 'AU Bank', 'RBL Bank'];
const APPS = ['Google Pay', 'PhonePe', 'Paytm', 'CRED', 'BHIM', 'Amazon Pay', 'Credit cards', 'Debit cards', 'NEFT · IMPS', 'ATM cash', 'Refunds', 'Salary credits'];

/* ---------------- hero phone: payments land one after another, in Gullak's notification voice ---------------- */

// Titles and lines follow packages/core/src/push-voice.ts (paymentPush).
const FEED = [
  { emoji: '🍔', who: 'Swiggy', cat: 'Food', amt: 250, line: 'Food, noted. Gullak is hungry now.' },
  { emoji: '🛺', who: 'Uber', cat: 'Transport', amt: 186, line: 'Filed under Transport. Safe ride!' },
  { emoji: '🛒', who: 'Zepto', cat: 'Groceries', amt: 374, line: 'Filed under Groceries. Fridge: restocked.' },
  { emoji: '🍔', who: 'Chai Point', cat: 'Food', amt: 40, line: 'Into the Food jar. Chai counts too.' },
  { emoji: '💊', who: 'Apollo Pharmacy', cat: 'Health', amt: 512, line: 'Filed under Health. Get well soon.' },
  { emoji: '📈', who: 'Groww SIP', cat: 'Investments', amt: 2000, line: 'Filed under Investments. Future you says thanks.' },
];
const START_TOTAL = 18430;

function HeroPhone() {
  const [ticks, setCount] = useState(1);
  const reduce = useReducedMotion();
  const count = reduce ? 3 : ticks;
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setCount((c) => (c >= FEED.length ? 1 : c + 1)), 2600);
    return () => clearInterval(id);
  }, [reduce]);
  const landed = FEED.slice(0, count);
  const total = START_TOTAL + landed.reduce((sum, f) => sum + f.amt, 0);
  const latest = landed[landed.length - 1];

  return (
    <div className={styles.stage}>
      <div
        className={styles.phone}
        role="img"
        aria-label="A phone's lock screen: Gullak notifications arrive one after another, each payment already sorted, and the month's total goes up">
        <div className={styles.screen}>
          <span className={styles.island} />
          <div className={styles.lockTop}>
            <span className={styles.lockDate}>Today</span>
            <span className={styles.clock}>9:41</span>
          </div>
          <ol className={styles.feed}>
            {[...landed]
              .reverse()
              .slice(0, 3)
              .map((f, i) => (
                <li key={f.who} className={styles.feedItem}>
                  <Notif
                    title={`₹${inr.format(f.amt)} at ${f.who} ${f.emoji}`}
                    body={f.line}
                    actions={i === 0 ? ['Change category', 'My month'] : undefined}
                  />
                </li>
              ))}
          </ol>
          <div className={styles.potCard}>
            <span className={styles.potTop}>
              <span>Spent this month</span>
              <Coin size={24} />
            </span>
            <span className={styles.potAmount}>
              <NumberTicker value={total} prefix="₹" />
            </span>
            <Band className={styles.potBand} waves={8} />
            <span className={styles.potFoot}>
              <span className={styles.potPill} key={latest.who}>
                +₹{inr.format(latest.amt)}
              </span>
              <span>{latest.cat}, just now</span>
            </span>
          </div>
        </div>
      </div>
      <div className={styles.heroMascot} aria-hidden>
        <Mascot size={220} eager />
      </div>
    </div>
  );
}

/* ---------------- story: sticky screen that changes with the step in view ---------------- */


function Story({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  // The active step is the one whose middle is closest to the middle of the screen.
  useEffect(() => {
    const scroller = root.current;
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root]);

  return (
    <section className={styles.story} aria-labelledby="how-title">
      <PageHead
        id="how-title"
        title="Set it up once. Then forget it."
        lede="Three things happen every time you pay. You only ever do the first one."
      />
      <div className={styles.storyGrid}>
        <ol className={styles.storySteps}>
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              data-step={i}
              className={`${styles.storyStep} ${i === active ? styles.storyStepOn : ''}`}>
              <span className={styles.storyNum} aria-hidden>
                {i + 1}
              </span>
              <h2 className={styles.storyTitle}>
                <span className={styles.srOnly}>Step {i + 1}: </span>
                {s.title}
              </h2>
              <p className={styles.storyText}>{s.text}</p>
              <div className={styles.storyInline}>
                <StoryScreen step={i} />
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.storySticky} aria-hidden>
          <div className={styles.revealCard}>
            <div className={styles.revealTabs}>
              {STEPS.map((s, i) => (
                <span key={s.title} className={i === active ? styles.revealTabOn : styles.revealTab}>
                  {i + 1}
                </span>
              ))}
            </div>
            {STEPS.map((s, i) => (
              <div key={s.title} className={`${styles.scrSlot} ${i === active ? styles.scrSlotOn : ''}`}>
                <StoryScreen step={i} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** What the reveal card shows for each step: the SMS, the automation, the sorted result. */
function StoryScreen({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className={styles.scr}>
        <p className={styles.scrApp}>
          <span className={styles.scrAvatar}>H</span> HDFCBK <span className={styles.scrMuted}>· Messages</span>
        </p>
        <p className={styles.scrTime}>Today 9:41</p>
        <p className={styles.bubble}>
          Sent <b>Rs.250.00</b> From HDFC Bank A/C *1234 To <b>SWIGGY</b> On 22/11/26 Ref 528461234567. Not You? Call
          18002586161
        </p>
        <p className={styles.bubble}>
          Rs.374.00 debited from A/c XX1234 to VPA <b>bigbasket@ybl</b>. UPI Ref 532117765409.
        </p>
        <p className={styles.scrHint}>Your bank sends these anyway. Nothing new to install there.</p>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className={styles.scr}>
        <p className={styles.scrApp}>
          <span className={styles.scrAvatar} data-kind="shortcut">
            ⌘
          </span>{' '}
          Shortcuts <span className={styles.scrMuted}>· Automation</span>
        </p>
        <div className={styles.flowCard}>
          <span className={styles.flowLabel}>When</span>
          <span className={styles.flowTitle}>A message arrives</span>
          <span className={styles.flowSub}>Run Immediately · no notification</span>
        </div>
        <PixelArrow className={styles.flowArrow} />
        <div className={styles.flowCard}>
          <span className={styles.flowLabel}>Do</span>
          <span className={styles.flowTitle}>Send it to Gullak</span>
          <span className={styles.flowSub}>Get Contents of URL · POST</span>
        </div>
        <p className={styles.flowDone}>✓ Ran just now, on its own</p>
      </div>
    );
  }
  return (
    <div className={styles.scr}>
      <Notif title="₹250 at Swiggy 🍔" body="Food, noted. Gullak is hungry now." />
      <p className={styles.scrTime}>Today · ₹664 spent</p>
      <div className={styles.rows}>
        {[
          { e: '🍔', name: 'Swiggy', cat: 'Food', amt: '₹250' },
          { e: '🛒', name: 'BigBasket', cat: 'Groceries', amt: '₹374' },
          { e: '🤔', name: 'paytmqr2810…', cat: 'Tap to pick a category', amt: '₹40', warn: true },
        ].map((r) => (
          <div key={r.name} className={styles.row}>
            {r.warn ? <span className={styles.rowEmoji}>{r.e}</span> : <BrandTile name={r.name} emoji={r.e} className={styles.rowEmoji} />}
            <span className={styles.rowBody}>
              <span className={styles.rowName}>{r.name}</span>
              <span className={r.warn ? styles.rowWarn : styles.rowCat}>{r.cat}</span>
            </span>
            <span className={styles.rowAmt}>{r.amt}</span>
          </div>
        ))}
      </div>
      <div className={styles.split} aria-hidden>
        <span style={{ flex: 250 }} data-c="food" />
        <span style={{ flex: 374 }} data-c="groceries" />
        <span style={{ flex: 40 }} data-c="other" />
      </div>
    </div>
  );
}
