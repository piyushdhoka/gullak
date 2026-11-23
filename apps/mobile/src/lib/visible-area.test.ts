import { describe, expect, it } from 'vitest';

import { visibleArea } from './visible-area';

describe('visibleArea', () => {
  it('is null when no keyboard covers the page', () => {
    expect(visibleArea(844, null)).toBeNull();
    expect(visibleArea(844, { height: 844, pageTop: 0 })).toBeNull();
    // Browser chrome (e.g. Safari's bottom bar) is not a keyboard.
    expect(visibleArea(844, { height: 790, pageTop: 0 })).toBeNull();
    expect(visibleArea(844, { height: 0, pageTop: 0 })).toBeNull();
  });

  it('fits the screen to what is visible above the keyboard', () => {
    // iPhone: 844 px page, keyboard + accessory bar cover 380 px, nothing panned yet.
    expect(visibleArea(844, { height: 464, pageTop: 0 })).toEqual({ height: 464, top: 0 });
  });

  it('follows the page when iOS pans it up to reveal the input', () => {
    expect(visibleArea(844, { height: 464.4, pageTop: 379.6 })).toEqual({ height: 464, top: 380 });
  });

  it('never moves the screen above the top of the page', () => {
    expect(visibleArea(844, { height: 464, pageTop: -12 })).toEqual({ height: 464, top: 0 });
  });
});
