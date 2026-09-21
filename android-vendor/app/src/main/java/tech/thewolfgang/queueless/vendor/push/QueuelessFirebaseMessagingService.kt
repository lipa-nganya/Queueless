package tech.thewolfgang.queueless.vendor.push

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import tech.thewolfgang.queueless.vendor.MainActivity
import tech.thewolfgang.queueless.vendor.QueuelessVendorApp
import tech.thewolfgang.queueless.vendor.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class QueuelessFirebaseMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val app = application as? QueuelessVendorApp ?: return
        scope.launch {
            runCatching {
                if (app.repository.hasSession()) {
                    app.repository.registerPushToken(token)
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        PushRegistrar.ensureNotificationChannel(this)

        val title =
            message.notification?.title
                ?: message.data["title"]
                ?: "Queueless"
        val body =
            message.notification?.body
                ?: message.data["body"]
                ?: message.data["message"]
                ?: return

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            message.data["type"]?.let { putExtra("push_type", it) }
            message.data["business_id"]?.let { putExtra("business_id", it) }
        }
        val pending = PendingIntent.getActivity(
            this,
            title.hashCode() xor body.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, PushRegistrar.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .build()

        if (!PushRegistrar.hasNotificationPermission(this)) return
        NotificationManagerCompat.from(this).notify(
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            notification,
        )
    }
}
