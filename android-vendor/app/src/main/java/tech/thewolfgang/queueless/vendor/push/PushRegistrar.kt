package tech.thewolfgang.queueless.vendor.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import tech.thewolfgang.queueless.vendor.BuildConfig
import tech.thewolfgang.queueless.vendor.data.VendorRepository

object PushRegistrar {
    const val CHANNEL_ID = "queueless_vendor"
    private const val TAG = "QueuelessPush"

    fun ensureNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Queueless alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Activation, trial, and queue alerts"
            },
        )
    }

    fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun firebaseReady(context: Context): Boolean {
        if (!BuildConfig.PUSH_ENABLED) return false
        return try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }
            FirebaseApp.getApps(context).isNotEmpty()
        } catch (error: Exception) {
            Log.w(TAG, "Firebase not available: ${error.message}")
            false
        }
    }

    suspend fun register(
        context: Context,
        repository: VendorRepository,
        phoneForPending: String? = null,
    ) = withContext(Dispatchers.IO) {
        if (!firebaseReady(context)) return@withContext
        ensureNotificationChannel(context)
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            if (token.isNullOrBlank()) return@withContext
            when {
                repository.hasSession() -> repository.registerPushToken(token)
                !phoneForPending.isNullOrBlank() ->
                    repository.registerPendingPushToken(phoneForPending, token)
                else -> Unit
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not register FCM token: ${error.message}")
        }
    }
}
