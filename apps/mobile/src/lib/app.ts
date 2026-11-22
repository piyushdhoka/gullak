/** Plain name, for sentences and screen readers. */
export const APP_NAME = 'Gullak';

/**
 * The logotype: one word, half Latin, half Devanagari ("Gul" + "लक" = Gullak).
 * Swap the parts to change the split, e.g. ['गुल्', 'lak'].
 */
export const WORDMARK = { latin: 'Gul', devanagari: 'लक' } as const;
export const WORDMARK_TEXT = `${WORDMARK.latin}${WORDMARK.devanagari}`;

export const TAGLINE_EN = 'Every rupee you spend, recorded on its own.';
