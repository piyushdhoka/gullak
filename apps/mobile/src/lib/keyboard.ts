// Where the on-screen keyboard is, so a screen can keep its input directly on top of it.
//
// Native: Keyboard events give the keyboard's height (iOS fires "will" so the input moves with the keyboard).
//
// Web (iPhone Home Screen app, iOS Safari, Android Chrome): the page is NOT resized when the keyboard opens.
// Only the visual viewport (the part you can actually see) shrinks, and iOS also pans the page upward to reveal
// the focused input. Padding the page by the keyboard height therefore counts the keyboard twice: it leaves a gap
// under the input and pushes the header and messages off the top. Instead, the screen should occupy exactly the
// visual viewport: its height, starting at its top (pageTop), so it follows iOS's pan.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { visibleArea } from './visible-area';

export interface KeyboardState {
  /** Px of the screen covered by the keyboard (0 when closed). Native only; 0 on web. */
  height: number;
  /** Web only, while the keyboard is open: the visible area to fit the screen into. */
  viewport: { height: number; top: number } | null;
}

const CLOSED: KeyboardState = { height: 0, viewport: null };

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>(CLOSED);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const update = () => {
        const viewport = visibleArea(window.innerHeight, vv);
        setState((prev) =>
          prev.viewport?.height === viewport?.height && prev.viewport?.top === viewport?.top ? prev : { height: 0, viewport },
        );
      };
      update();
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setState({ height: e.endCoordinates.height, viewport: null }),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setState(CLOSED));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

/** Kept for callers that only need a number: the keyboard's height on native, the covered height on web. */
export function useKeyboardHeight(): number {
  const { height, viewport } = useKeyboard();
  return viewport && typeof window !== 'undefined' ? Math.max(0, window.innerHeight - viewport.height) : height;
}
