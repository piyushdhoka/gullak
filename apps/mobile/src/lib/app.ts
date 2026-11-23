/** Plain name, for sentences and screen readers. */
export const APP_NAME = 'Gullak';

/**
 * The logotype: one word, half Latin, half Devanagari ("Gul" + "लक" = Gullak).
 * Swap the parts to change the split, e.g. ['गुल्', 'lak'].
 */
export const WORDMARK = { latin: 'Gul', devanagari: 'लक' } as const;
export const WORDMARK_TEXT = `${WORDMARK.latin}${WORDMARK.devanagari}`;

/** Who made Gullak (credited in the website footer, Settings > About and the SEO metadata). */
export const MAKER = { name: 'Piyush Dhoka', url: 'https://piyush.sparkstudio.co.in/' } as const;

/** Everyone credited in the website footer ("Made by …, … and …"). A url makes the name a link. */
export const MAKERS: readonly { name: string; url?: string }[] = [
  MAKER,
  { name: 'Vedant Pandhare', url: 'https://vedant.sparkstudio.co.in/' },
  { name: 'Aadarsh Pathre', url: 'https://aadarsh.sparkstudio.co.in/' },
];

export const TAGLINE_EN = 'Every rupee you spend, recorded on its own.';
