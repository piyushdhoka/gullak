// Native builds have no public website; the web pages live in landing.web.tsx.
// These stubs keep the (site) routes compiling on Android and iOS, where they are never shown.
export function Landing() {
  return null;
}
export const HowItWorksPage = Landing;
export const FeaturesPage = Landing;
export const FaqPage = Landing;
export const InstallPage = Landing;
