package tech.thewolfgang.queueless.customer.data

import java.util.Locale
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class LatLng(val latitude: Double, val longitude: Double)

/** Rough travel estimate; keep the speeds and wording in step with the web app (customer/app.js). */
data class Travel(val km: Double, val minutes: Int, val walking: Boolean) {
    val summary: String
        get() {
            val distance = if (km < 1) "${max(50, (km * 1000).roundToInt())} m" else if (km < 10) String.format(Locale.US, "%.1f km", km) else "${km.roundToInt()} km"
            return "$distance · $minutes min ${if (walking) "walk" else "drive"}"
        }

    companion object {
        private const val WALK_KMH = 5.0
        private const val DRIVE_KMH = 25.0
        private const val WALK_MAX_KM = 1.5

        fun between(from: LatLng?, latitude: Double?, longitude: Double?): Travel? {
            if (from == null || latitude == null || longitude == null) return null
            val km = distanceKm(from.latitude, from.longitude, latitude, longitude)
            val walking = km <= WALK_MAX_KM
            val minutes = max(1, (km / (if (walking) WALK_KMH else DRIVE_KMH) * 60).roundToInt())
            return Travel(km, minutes, walking)
        }

        private fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = sin(dLat / 2).let { it * it } +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).let { it * it }
            return 2 * 6371 * asin(sqrt(a))
        }
    }
}

fun Branch.travelFrom(origin: LatLng?): Travel? = Travel.between(origin, latitude, longitude)

/** Travel to the business's nearest branch, or to the business itself when it has no mapped branches. */
fun Business.nearestTravelFrom(origin: LatLng?): Travel? =
    branches.mapNotNull { it.travelFrom(origin) }.minByOrNull { it.km }
        ?: Travel.between(origin, latitude, longitude)
