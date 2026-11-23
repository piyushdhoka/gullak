import { SignIn } from '@/components/sign-in';

import { accountMetadata } from '@/lib/seo';

export const generateMetadata = () => accountMetadata('Create account');

export default function Screen() {
  return <SignIn start="signup" />;
}
