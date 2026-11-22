package expo.modules.smsinbox

import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsInboxModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsInbox")

    // Received SMS newer than `sinceMs`, oldest first, at most `limit`. Only senders with a hyphen, the shape of
    // registered business IDs ("VM-HDFCBK", "AD-AXISBK-S"): personal chats are never read. Needs READ_SMS.
    AsyncFunction("readInbox") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val out = mutableListOf<Map<String, Any>>()
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.TextBasedSmsColumns.ADDRESS, Telephony.TextBasedSmsColumns.BODY, Telephony.TextBasedSmsColumns.DATE),
        "${Telephony.TextBasedSmsColumns.DATE} > ? AND ${Telephony.TextBasedSmsColumns.ADDRESS} LIKE ?",
        arrayOf(sinceMs.toLong().toString(), "%-%"),
        "${Telephony.TextBasedSmsColumns.DATE} ASC"
      )?.use { cursor ->
        while (out.size < limit && cursor.moveToNext()) {
          out.add(
            mapOf(
              "address" to (cursor.getString(0) ?: ""),
              "body" to (cursor.getString(1) ?: ""),
              "date" to cursor.getLong(2).toDouble()
            )
          )
        }
      }
      out
    }
  }
}
