// Public landing page (web only). Signed-out visitors see this at "/".
// Laptop/desktop: no sign-in at all; a QR code sends people to their iPhone.
// Phones: "Add to iPhone" opens a 3-step guide; a small "Sign in" link leads to the app.
// Plain DOM + a CSS module so the page can use real CSS (grid, sticky, keyframes, media queries).

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { APP_NAME, WORDMARK } from '@/lib/app';

import styles from './landing.module.css';

export function Landing({ onOpen }: { onOpen: () => void }) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [guide, setGuide] = useState(false);

  return (
    <div className={styles.page} ref={pageRef}>
      <Sky />

      <nav className={styles.nav} aria-label={APP_NAME}>
        <a className={styles.navBrand} href="#top" aria-label={`${APP_NAME} home`}>
          <Mascot size={30} eager />
          <Logotype />
        </a>
        <div className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className={styles.navCta} href="#get">
          Get Gullak
        </a>
      </nav>

      <header className={styles.hero} id="top">
        <div className={styles.spotlight} aria-hidden />
        <p className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden />
          <span className={styles.shiny}>
            New <span className={styles.badgeSoft}>· free for iPhone</span>
          </span>
        </p>
        <h1 className={styles.h1}>Every rupee, sorted on its own.</h1>
        <p className={styles.lede}>
          Pay with GPay, PhonePe or a card. Your bank texts you, and Gullak turns that SMS into a sorted, totalled
          expense a few seconds later. Nothing to type.
        </p>
        <GetIt onOpen={onOpen} onGuide={() => setGuide(true)} id="get" />
        <HeroPhone />
      </header>

      <main>
        <section className={styles.logos} aria-label="Works with">
          <p className={styles.logosTitle}>Works with the SMS from every big Indian bank and UPI app</p>
          <Marquee items={BANKS} />
          <Marquee items={APPS} reverse />
        </section>

        <section className={styles.intro} aria-label="What Gullak does">
          <p className={styles.kicker}>Intro</p>
          <RevealText
            parts={[
              { text: 'Gullak reads the ' },
              { text: 'SMS your bank already sends,', em: true },
              { text: ' files every payment under the right ' },
              { text: 'category,', em: true },
              { text: ' and shows you ' },
              { text: 'where your month went.', em: true },
              { text: ' No bank login, no forms, no end-of-month guesswork.' },
            ]}
          />
        </section>

        <Story root={pageRef} />

        <section className={styles.section} id="features" aria-labelledby="features-title">
          <p className={styles.kicker}>Features</p>
          <h2 id="features-title" className={styles.h2}>
            From a bank SMS to a clear month
          </h2>
          <div className={styles.bento} onPointerMove={onMagicMove}>
            <article className={`${styles.tile} ${styles.tileWide}`}>
              <h3 className={styles.h3}>Reads the SMS, not your bank account</h3>
              <p className={styles.tileText}>Amount, payee, account and UPI reference, picked straight out of the message.</p>
              <div className={styles.parse}>
                <p className={styles.smsText}>
                  Sent <mark className={styles.mAmount}>Rs.250.00</mark> From HDFC Bank A/C{' '}
                  <mark className={styles.mAccount}>*1234</mark> To <mark className={styles.mPayee}>SWIGGY</mark> On 22/11/26
                  Ref <mark className={styles.mRef}>528461234567</mark>
                </p>
                <dl className={styles.fields}>
                  <div>
                    <dt>Spent</dt>
                    <dd className={styles.fAmount}>₹250.00</dd>
                  </div>
                  <div>
                    <dt>Paid to</dt>
                    <dd>Swiggy</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>
                      <span className={styles.chip}>🍔 Food</span>
                    </dd>
                  </div>
                  <div>
                    <dt>From</dt>
                    <dd>HDFC Bank •1234</dd>
                  </div>
                </dl>
              </div>
            </article>

            <article className={styles.tile}>
              <h3 className={styles.h3}>A QR code isn’t a name</h3>
              <p className={styles.tileText}>
                Gullak won’t guess what <code>paytmqr2810…</code> sold you. Pick once; every past and future payment there follows.
              </p>
              <div className={styles.chips}>
                <span className={`${styles.chip} ${styles.chipOn}`}>🍔 Food</span>
                <span className={styles.chip}>🛒 Groceries</span>
                <span className={styles.chip}>💊 Health</span>
              </div>
            </article>

            <article className={`${styles.tile} ${styles.tileStats}`}>
              <Stat value={20} suffix="+" label="Indian banks read" />
              <Stat value={90} suffix="+" label="merchants recognised" />
              <Stat value={5} prefix="~" suffix="s" label="from SMS to sorted" />
            </article>

            <article className={styles.tile}>
              <h3 className={styles.h3}>Your messages stay yours</h3>
              <ul className={styles.ticks}>
                <li>Personal chats are dropped before they’re stored.</li>
                <li>No bank passwords, no account linking.</li>
                <li>Runs on Gullak’s own server, not an ad network.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.section} id="faq" aria-labelledby="faq-title">
          <p className={styles.kicker}>FAQ</p>
          <h2 id="faq-title" className={styles.h2}>
            Your questions, answered
          </h2>
          <div className={styles.faq}>
            <Faq q="Does Gullak read my personal messages?">
              Your iPhone forwards incoming messages, and Gullak keeps only the ones that look like bank or payment SMS.
              Everything else is dropped immediately, without being saved.
            </Faq>
            <Faq q="Which banks and apps does it work with?">
              Any UPI app (GPay, PhonePe, Paytm, CRED, BHIM) and cards, because it reads the SMS your bank sends. HDFC, SBI,
              ICICI, Axis, Kotak, Yes, IDFC FIRST and more are supported. If a message isn’t understood, it’s kept aside so
              nothing is lost.
            </Faq>
            <Faq q="Is it on Android?">
              Not yet. The iPhone version is first. Android can read bank SMS directly, so it’s next.
            </Faq>
            <Faq q="Why isn’t it in the App Store?">
              Gullak installs straight from Safari: open this page on your iPhone, tap Share, then Add to Home Screen. It
              updates itself and never expires.
            </Faq>
            <Faq q="What about UPI Lite and cash?">
              UPI Lite payments usually don’t send an SMS, so they can’t be picked up automatically. You can add those by
              hand.
            </Faq>
          </div>
        </section>

        <section className={styles.note} aria-labelledby="note-title">
          <p className={styles.kicker}>A note</p>
          <h2 id="note-title" className={styles.noteTitle}>
            Why Gullak exists
          </h2>
          <div className={styles.noteBody}>
            <p>
              Every expense app we tried wanted the same thing: open me, type the amount, pick a category, do it again
              tomorrow. We never kept it up past the first week.
            </p>
            <p>
              But the bank already tells us about every rupee, the moment it leaves. So Gullak listens to that, sorts it,
              and only asks when it genuinely can’t tell, like a chai stall’s QR code.
            </p>
            <p>Like the clay gullak you fed coins into as a kid: you just drop them in. It keeps count.</p>
            <p className={styles.noteSign}>Team Gullak</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Mascot size={96} />
        <p className={styles.footerMark}>
          <Logotype />
        </p>
        <GetIt onOpen={onOpen} onGuide={() => setGuide(true)} />
      </footer>

      {guide ? <InstallGuide onClose={() => setGuide(false)} onOpen={onOpen} /> : null}
    </div>
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

/**
 * How to get Gullak. Touch screens get "Add to iPhone" + a small "Sign in"; laptops get a QR code
 * and no sign-in. Chosen with CSS (pointer/hover media queries), so the first paint is already right.
 */
function GetIt({ onOpen, onGuide, id }: { onOpen: () => void; onGuide: () => void; id?: string }) {
  return (
    <div className={styles.getIt} id={id}>
      <div className={styles.onTouch}>
        <button type="button" className={styles.primary} onClick={onGuide}>
          Add to iPhone
        </button>
        <button type="button" className={styles.textButton} onClick={onOpen}>
          Already set up? Sign in
        </button>
      </div>
      <div className={styles.onDesktop}>
        <div className={styles.qrCard}>
          <span className={styles.beam} aria-hidden />
          <img src="/qr.svg" alt="QR code that opens gullak.sparkstudio.co.in" width={112} height={112} />
          <div>
            <p className={styles.qrTitle}>Scan with your iPhone camera</p>
            <p className={styles.qrText}>Gullak opens in Safari. Tap Share, then Add to Home Screen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstallGuide({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} aria-hidden />
        <Mascot size={64} eager />
        <h2 id="guide-title" className={styles.sheetTitle}>
          Add Gullak to your iPhone
        </h2>
        <ol className={styles.sheetSteps}>
          <li>
            Tap <strong>Share</strong> <span aria-hidden>⬆︎</span> in Safari’s toolbar.
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
          <li>
            Open <strong>Gullak</strong> from your Home Screen and create your account.
          </li>
        </ol>
        <div className={styles.sheetActions}>
          <button type="button" className={styles.primary} onClick={onClose}>
            Got it
          </button>
          <button type="button" className={styles.textButton} onClick={onOpen}>
            Already added? Sign in
          </button>
        </div>
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
      <summary>{q}</summary>
      <p>{children}</p>
    </details>
  );
}

/** Soft pixel clouds, drawn as SVG rects to match the mascot's pixel art. Decorative. */
function Sky() {
  return (
    <div className={styles.sky} aria-hidden>
      <PixelCloud className={styles.cloudA} />
      <PixelCloud className={styles.cloudB} />
      <PixelCloud className={styles.cloudC} />
    </div>
  );
}

function PixelCloud({ className }: { className: string }) {
  // 16×7 grid: 1 = cloud, drawn as 10px "pixels".
  const rows = ['0000011110000000', '0001111111100000', '0011111111111100', '0111111111111110', '1111111111111111', '1111111111111111', '0111111111111110'];
  return (
    <svg className={className} viewBox="0 0 160 70" shapeRendering="crispEdges">
      {rows.flatMap((r, y) =>
        [...r].map((v, x) => (v === '1' ? <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width={10} height={10} /> : null)),
      )}
    </svg>
  );
}

/* ---------------- effects (Magic UI / Aceternity patterns, ported to plain CSS) ---------------- */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** True once the element has been on screen (IntersectionObserver works through the page's scroller). */
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

/** Magic UI "Number Ticker": counts from the last value to the new one. */
function NumberTicker({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current;
    if (a === value) return;
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
  }, [value]);
  return (
    <span className={styles.ticker}>
      {prefix}
      {inr.format(Math.round(shown))}
      {suffix}
    </span>
  );
}

/** Magic UI "Marquee": two copies of the row slide left forever; the copy is hidden from screen readers. */
function Marquee({ items, reverse }: { items: string[]; reverse?: boolean }) {
  return (
    <div className={`${styles.marquee} ${reverse ? styles.marqueeReverse : ''}`}>
      {[0, 1].map((copy) => (
        <ul key={copy} className={styles.marqueeTrack} aria-hidden={copy === 1 || undefined}>
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

/** Magic UI "Text Reveal": words brighten as they scroll into view (CSS scroll-driven animation where supported). */
function RevealText({ parts }: { parts: { text: string; em?: boolean }[] }) {
  return (
    <p className={styles.introText}>
      {parts.flatMap((part, i) =>
        part.text
          .split(/(\s+)/)
          .map((word, j) =>
            /^\s+$/.test(word) || !word ? word : (
              <span key={`${i}-${j}`} className={`${styles.word} ${part.em ? styles.wordEm : ''}`}>
                {word}
              </span>
            ),
          ),
      )}
    </p>
  );
}

/** Magic UI "Magic Card": a soft coin-coloured glow follows the pointer across each tile. */
function onMagicMove(e: React.PointerEvent<HTMLElement>) {
  const tile = (e.target as HTMLElement).closest<HTMLElement>(`.${styles.tile}`);
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
  tile.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/* ---------------- hero phone: payments land one after another (Magic UI "Animated List") ---------------- */

const FEED = [
  { icon: '🍔', who: 'Swiggy', cat: 'Food', amt: 250, from: 'HDFC Bank •1234' },
  { icon: '🚕', who: 'Uber', cat: 'Transport', amt: 186, from: 'ICICI Card •4402' },
  { icon: '🛒', who: 'Zepto', cat: 'Groceries', amt: 374, from: 'HDFC Bank •1234' },
  { icon: '☕', who: 'Chai Point', cat: 'Food', amt: 40, from: 'SBI •0921' },
  { icon: '💊', who: 'Apollo Pharmacy', cat: 'Health', amt: 512, from: 'HDFC Bank •1234' },
  { icon: '📈', who: 'Groww SIP', cat: 'Investments', amt: 2000, from: 'Axis Bank •7781' },
];
const START_TOTAL = 18430;

function HeroPhone() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c >= FEED.length ? 1 : c + 1)), 2400);
    return () => clearInterval(id);
  }, []);
  const landed = FEED.slice(0, count);
  const total = START_TOTAL + landed.reduce((sum, f) => sum + f.amt, 0);
  const latest = landed[landed.length - 1];

  return (
    <div className={styles.heroPhoneWrap}>
      <div className={styles.perch} aria-hidden>
        <Mascot size={84} eager />
      </div>
      <div className={styles.phone} role="img" aria-label="Payments arrive in Gullak one after another, already sorted, and the month's total goes up">
        <div className={styles.island} />
        <div className={styles.phoneTop}>
          <span className={styles.clock}>9:41</span>
          <span className={styles.date}>Saturday 22 November</span>
        </div>
        <ol className={styles.feed}>
          {[...landed]
            .reverse()
            .slice(0, 4)
            .map((f) => (
              <li key={f.who} className={styles.notif}>
                <span className={styles.notifIcon}>
                  <Mascot size={26} eager />
                </span>
                <span className={styles.notifBody}>
                  <span className={styles.notifHead}>
                    <span className={styles.notifApp}>GULLAK</span>
                    <span className={styles.notifWhen}>now</span>
                  </span>
                  <span className={styles.notifTitle}>
                    −₹{inr.format(f.amt)} · {f.who}
                  </span>
                  <span className={styles.notifText}>
                    {f.icon} {f.cat} · {f.from}
                  </span>
                </span>
              </li>
            ))}
        </ol>
        <div className={styles.monthCard}>
          <span className={styles.monthLabel}>Spent this month</span>
          <NumberTicker value={total} prefix="₹" />
          <span className={styles.monthLast} key={latest.who}>
            +₹{inr.format(latest.amt)} {latest.cat.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- story: sticky phone that changes with the step in view ---------------- */

const STEPS = [
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
    <section className={styles.story} id="how" aria-labelledby="how-title">
      <div className={styles.storyHead}>
        <p className={styles.kicker}>How it works</p>
        <h2 id="how-title" className={styles.h2}>
          Set it up once. Then forget it.
        </h2>
      </div>
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
              <span className={styles.storyNum}>0{i + 1}</span>
              <h3 className={styles.storyTitle}>{s.title}</h3>
              <p className={styles.storyText}>{s.text}</p>
              <div className={styles.storyInline}>
                <StoryScreen step={i} />
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.storySticky} aria-hidden>
          <div className={styles.revealCard} data-step={active}>
            {STEPS.map((s, i) => (
              <div key={s.title} className={`${styles.screen} ${i === active ? styles.screenOn : ''}`}>
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
          Rs.374.00 debited from A/c XX1234 to VPA <b>zepto@ybl</b>. UPI Ref 532117765409.
        </p>
        <p className={styles.scrHint}>Your bank sends these anyway. Nothing new to install there.</p>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className={styles.scr}>
        <p className={styles.scrApp}>
          <span className={styles.scrAvatar} data-kind="shortcut">⌘</span> Shortcuts <span className={styles.scrMuted}>· Automation</span>
        </p>
        <div className={styles.flowCard}>
          <span className={styles.flowLabel}>When</span>
          <span className={styles.flowTitle}>A message arrives</span>
          <span className={styles.flowSub}>Run Immediately · no notification</span>
        </div>
        <span className={styles.flowArrow} aria-hidden />
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
      <p className={styles.scrApp}>
        <span className={styles.scrAvatar} data-kind="gullak">
          <Mascot size={22} />
        </span>
        Gullak <span className={styles.scrMuted}>· Activity</span>
      </p>
      <p className={styles.scrTime}>Today · ₹664 spent</p>
      {[
        { e: '🍔', name: 'Swiggy', cat: 'Food', amt: '−₹250' },
        { e: '🛒', name: 'Zepto', cat: 'Groceries', amt: '−₹374' },
        { e: '📦', name: 'paytmqr2810…', cat: 'Tap to pick a category', amt: '−₹40', warn: true },
      ].map((r) => (
        <div key={r.name} className={styles.row}>
          <span className={styles.rowEmoji}>{r.e}</span>
          <span className={styles.rowBody}>
            <span className={styles.rowName}>{r.name}</span>
            <span className={r.warn ? styles.rowWarn : styles.rowCat}>{r.cat}</span>
          </span>
          <span className={styles.rowAmt}>{r.amt}</span>
        </div>
      ))}
      <div className={styles.bars} aria-hidden>
        <span style={{ flex: 250 }} data-c="food" />
        <span style={{ flex: 374 }} data-c="groceries" />
        <span style={{ flex: 40 }} data-c="other" />
      </div>
    </div>
  );
}
