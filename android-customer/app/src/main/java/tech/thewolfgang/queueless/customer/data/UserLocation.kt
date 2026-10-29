package tech.thewolfgang.queueless.customer.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import androidx.core.os.CancellationSignal
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * The customer's approximate position, used only on the device to show how far
 * each branch is. It is never sent to the API or stored.
 */
class UserLocation(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("queueless_location", Context.MODE_PRIVATE)
    private val _current = MutableStateFlow<LatLng?>(null)
    val current: StateFlow<LatLng?> = _current.asStateFlow()

    val hasPermission: Boolean
        get() = ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** True once we've shown the system prompt, so we only ask on its own the first time. */
    var asked: Boolean
        get() = prefs.getBoolean(KEY_ASKED, false)
        set(value) = prefs.edit().putBoolean(KEY_ASKED, value).apply()

    @SuppressLint("MissingPermission")
    suspend fun refresh(): LatLng? {
        if (!hasPermission) return null
        val manager = appContext.getSystemService(LocationManager::class.java) ?: return null
        val enabled = runCatching { manager.getProviders(true) }.getOrDefault(emptyList())
        val lastKnown = enabled
            .mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
        val fresh = lastKnown?.takeIf { System.currentTimeMillis() - it.time < MAX_AGE_MS }
            ?: currentLocation(manager, enabled)
            ?: lastKnown
        fresh?.let { _current.value = LatLng(it.latitude, it.longitude) }
        return _current.value
    }

    /** Asks every enabled provider at once and takes the first fix; any one can be slow or silent. */
    @SuppressLint("MissingPermission")
    private suspend fun currentLocation(manager: LocationManager, enabled: List<String>): Location? {
        val providers = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(LocationManager.FUSED_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
            add(LocationManager.GPS_PROVIDER)
        }.filter { it in enabled }
        if (providers.isEmpty()) return null
        return withTimeoutOrNull(TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val signals = providers.map { CancellationSignal() }
                cont.invokeOnCancellation { signals.forEach(CancellationSignal::cancel) }
                var pending = providers.size
                providers.zip(signals).forEach { (provider, signal) ->
                    LocationManagerCompat.getCurrentLocation(
                        manager,
                        provider,
                        signal,
                        ContextCompat.getMainExecutor(appContext),
                    ) { location ->
                        // Callbacks run on the main thread, so this bookkeeping needs no lock.
                        pending--
                        if (!cont.isActive) return@getCurrentLocation
                        if (location != null) {
                            signals.forEach(CancellationSignal::cancel)
                            cont.resume(location)
                        } else if (pending == 0) {
                            cont.resume(null)
                        }
                    }
                }
            }
        }
    }

    private companion object {
        const val KEY_ASKED = "asked"
        const val MAX_AGE_MS = 10 * 60 * 1000L
        const val TIMEOUT_MS = 10_000L
    }
}
