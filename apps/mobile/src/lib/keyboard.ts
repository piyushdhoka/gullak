// How much of the bottom of the screen the on-screen keyboard covers, in px (0 when it is closed).
// Native: the Keyboard events (iOS fires "will" so the input moves with the keyboard). Web: the visual viewport,
// because iOS Safari and the installed Home Screen app don't resize the page when the keyboard opens; they only
// shrink the visual viewport. KeyboardAvoidingView does nothing on web, which left the composer under or away from it.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (!vv) return;
      const update = () => {
        // Layout bottom minus the visible bottom. Small differences are browser chrome, not a keyboard.
        const covered = window.innerHeight - (vv.height + vv.offsetTop);
        setHeight(covered > 80 ? Math.round(covered) : 0);
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
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
