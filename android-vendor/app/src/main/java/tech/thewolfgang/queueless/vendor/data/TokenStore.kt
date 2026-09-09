package tech.thewolfgang.queueless.vendor.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import tech.thewolfgang.queueless.vendor.BuildConfig

class TokenStore(context: Context) {
    private val prefsName = "queueless_vendor_secure_${BuildConfig.ENV_NAME}"
    private val prefsFallbackName = "queueless_vendor_prefs_${BuildConfig.ENV_NAME}"

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            prefsName,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Exception) {
        // Fallback for emulators / devices where Keystore setup fails in debug.
        context.getSharedPreferences(prefsFallbackName, Context.MODE_PRIVATE)
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    fun setToken(token: String) {
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    companion object {
        private const val KEY_TOKEN = "jwt"
    }
}
