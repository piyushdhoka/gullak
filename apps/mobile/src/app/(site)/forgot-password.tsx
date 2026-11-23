import { SignIn } from '@/components/sign-in';

import { accountMetadata } from '@/lib/seo';

export const generateMetadata = () => accountMetadata('Reset password');

export default function Screen() {
  return <SignIn start="forgot" />;
}
