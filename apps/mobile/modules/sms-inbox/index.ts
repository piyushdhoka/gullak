// Reads bank SMS from the Android inbox (see android/.../SmsInboxModule.kt).
// Null where the native code isn't there: web, iOS and Expo Go.
import { requireOptionalNativeModule } from 'expo';

export interface InboxSms {
  /** Sender ID, e.g. "VM-HDFCBK". */
  address: string;
  body: string;
  /** When the phone received it, in milliseconds. */
  date: number;
}

interface SmsInboxModule {
  readInbox(sinceMs: number, limit: number): Promise<InboxSms[]>;
}

export const SmsInbox = requireOptionalNativeModule<SmsInboxModule>('SmsInbox');
