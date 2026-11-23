// Windows builds: AGP's CMake 3.22.1 ships a ninja without long-path support, and React Native's generated C++
// folders pass 260 characters ("ninja: error: mkdir(...): No such file or directory"). Expo passes
// CMAKE_OBJECT_PATH_MAX=1024, so CMake never shortens them; at 240 it swaps the long middle of a path for a hash.
// shortcut: still fails from very deep folders; then install CMake 3.31.6 (SDK Manager) and set android.cmakeVersion.
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'expo.android.cmakeObjectPathMax';

module.exports = (config) =>
  process.platform !== 'win32'
    ? config
    : withGradleProperties(config, (c) => {
        c.modResults = c.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
        c.modResults.push({ type: 'property', key: KEY, value: '240' });
        return c;
      });
