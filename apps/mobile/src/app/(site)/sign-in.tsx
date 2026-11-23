import { SignIn } from '@/components/sign-in';

import { accountMetadata } from '@/lib/seo';

export const generateMetadata = () => accountMetadata('Sign in');

export default function Screen() {
  return <SignIn start="signin" />;
}
