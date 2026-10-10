package tech.thewolfgang.queueless.vendor.ui.components

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.view.MotionEvent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import tech.thewolfgang.queueless.vendor.data.PlaceSuggestion
import tech.thewolfgang.queueless.vendor.ui.theme.CardShape
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.GhostButton
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import tech.thewolfgang.queueless.vendor.ui.theme.queuelessFieldColors
import kotlin.math.abs
import kotlin.math.max

private const val NAIROBI_LAT = -1.286389
private const val NAIROBI_LON = 36.817223

/** `pinned` coords came from the map pin or GPS, so editing the label keeps them. */
data class LocationFieldState(
    val text: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val pinned: Boolean = false,
    val suggestions: List<PlaceSuggestion> = emptyList(),
    val menuExpanded: Boolean = false,
    val locating: Boolean = false,
)

/** Place search, GPS and pin drops for one location field, shared by branch forms and onboarding. */
class LocationFieldController(
    private val scope: CoroutineScope,
    private val search: suspend (String) -> List<PlaceSuggestion>,
    private val reverse: suspend (Double, Double) -> PlaceSuggestion,
    private val update: ((LocationFieldState) -> LocationFieldState) -> Unit,
    private val onMessage: (error: String?, info: String?) -> Unit,
) {
    private var searchJob: Job? = null
    private var reverseJob: Job? = null

    fun cancel() {
        searchJob?.cancel()
        reverseJob?.cancel()
    }

    fun onTextChange(value: String) {
        update {
            if (it.pinned) {
                it.copy(text = value)
            } else {
                it.copy(text = value, latitude = null, longitude = null)
            }
        }
        searchJob?.cancel()
        val query = value.trim()
        if (query.length < 2) {
            update { it.copy(suggestions = emptyList(), menuExpanded = false) }
            return
        }
        searchJob = scope.launch {
            delay(300)
            val places = runCatching { search(query) }.getOrDefault(emptyList())
            update { it.copy(suggestions = places, menuExpanded = places.isNotEmpty()) }
        }
    }

    fun onPlaceSelected(place: PlaceSuggestion) {
        searchJob?.cancel()
        update {
            it.copy(
                text = place.label,
                latitude = place.latitude,
                longitude = place.longitude,
                pinned = false,
                suggestions = emptyList(),
                menuExpanded = false,
            )
        }
    }

    fun dismissSuggestions() {
        update { it.copy(menuExpanded = false) }
    }

    fun beginLocating() {
        update { it.copy(locating = true, menuExpanded = false) }
        onMessage(null, null)
    }

    fun onPermissionDenied() {
        update { it.copy(locating = false) }
        onMessage("Allow location access to use your current position.", null)
    }

    fun onLocationUnavailable() {
        update { it.copy(locating = false) }
        onMessage("Could not read your current location. Try again outdoors or search instead.", null)
    }

    fun applyDeviceLocation(latitude: Double, longitude: Double) =
        pin(latitude, longitude, "Current location set. Move the pin if it's slightly off.")

    fun onPinMoved(latitude: Double, longitude: Double) =
        pin(latitude, longitude, "Pin set. You can edit the place name without moving the pin.")

    private fun pin(latitude: Double, longitude: Double, info: String) {
        reverseJob?.cancel()
        update {
            it.copy(
                latitude = latitude,
                longitude = longitude,
                pinned = true,
                suggestions = emptyList(),
                menuExpanded = false,
            )
        }
        reverseJob = scope.launch {
            val label = runCatching { reverse(latitude, longitude).label }.getOrNull()
            update {
                it.copy(
                    locating = false,
                    text = label?.takeIf { l -> l.isNotBlank() }
                        ?: it.text.ifBlank { "Near ${"%.5f".format(latitude)}, ${"%.5f".format(longitude)}" },
                )
            }
            onMessage(null, info)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BranchLocationField(
    state: LocationFieldState,
    controller: LocationFieldController,
    enabled: Boolean = true,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    val fieldColors = queuelessFieldColors()

    fun hasLocationPermission(): Boolean =
        listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION).any {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    fun fetchCurrentLocation() {
        scope.launch {
            controller.beginLocating()
            readDeviceLocation(fusedLocationClient)?.let { (lat, lon) ->
                controller.applyDeviceLocation(lat, lon)
            } ?: controller.onLocationUnavailable()
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        if (grants.values.any { it }) fetchCurrentLocation() else controller.onPermissionDenied()
    }

    Column {
        ExposedDropdownMenuBox(
            expanded = state.menuExpanded,
            onExpandedChange = { /* driven by suggestions */ },
            modifier = Modifier.fillMaxWidth(),
        ) {
            TextField(
                shape = FieldShape,
                value = state.text,
                onValueChange = controller::onTextChange,
                label = { Text("Location") },
                placeholder = { Text("Start typing a Kenya place…") },
                singleLine = true,
                enabled = enabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryEditable),
                colors = fieldColors,
            )
            ExposedDropdownMenu(
                expanded = state.menuExpanded && state.suggestions.isNotEmpty(),
                onDismissRequest = controller::dismissSuggestions,
            ) {
                state.suggestions.forEach { place ->
                    DropdownMenuItem(
                        text = { Text(place.label, color = TextPrimary) },
                        onClick = { controller.onPlaceSelected(place) },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        GhostButton(
            onClick = {
                if (hasLocationPermission()) {
                    fetchCurrentLocation()
                } else {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION,
                        ),
                    )
                }
            },
            enabled = enabled && !state.locating,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.Rounded.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(if (state.locating) "Finding location…" else "Use my current location")
        }
        Spacer(Modifier.height(10.dp))
        MapPinPicker(
            latitude = state.latitude,
            longitude = state.longitude,
            onPinMoved = controller::onPinMoved,
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
                .clip(CardShape)
                .border(1.dp, TextMuted.copy(alpha = 0.25f), CardShape),
        )
        Text(
            text = "Tap the map, or long-press and drag the pin, to mark the exact entrance.",
            color = TextMuted,
            fontSize = 13.sp,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** OpenStreetMap view with one pin. Tapping moves the pin; long-press drags it. */
@SuppressLint("ClickableViewAccessibility")
@Composable
fun MapPinPicker(
    latitude: Double?,
    longitude: Double?,
    onPinMoved: (Double, Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val currentOnPinMoved by rememberUpdatedState(onPinMoved)
    val start = GeoPoint(latitude ?: NAIROBI_LAT, longitude ?: NAIROBI_LON)

    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.SHOW_AND_FADEOUT)
            controller.setZoom(if (latitude != null) 16.0 else 12.0)
            controller.setCenter(start)
            contentDescription = "Map for the branch location. Search or use your current location if you can't use the map."
            // Keep the parent scroll from stealing pans and pinches.
            setOnTouchListener { view, event ->
                if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                    view.parent?.requestDisallowInterceptTouchEvent(true)
                }
                false
            }
        }
    }
    val marker = remember {
        Marker(mapView).apply {
            position = start
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            isDraggable = true
            title = "Branch location"
            setOnMarkerDragListener(object : Marker.OnMarkerDragListener {
                override fun onMarkerDrag(marker: Marker) = Unit
                override fun onMarkerDragStart(marker: Marker) = Unit
                override fun onMarkerDragEnd(marker: Marker) {
                    currentOnPinMoved(marker.position.latitude, marker.position.longitude)
                }
            })
        }
    }

    DisposableEffect(mapView, lifecycle) {
        mapView.overlays.add(
            MapEventsOverlay(object : MapEventsReceiver {
                override fun singleTapConfirmedHelper(point: GeoPoint): Boolean {
                    marker.position = point
                    mapView.invalidate()
                    currentOnPinMoved(point.latitude, point.longitude)
                    return true
                }

                override fun longPressHelper(point: GeoPoint): Boolean = false
            }),
        )
        mapView.overlays.add(marker)
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        mapView.onResume()
        onDispose {
            lifecycle.removeObserver(observer)
            mapView.onPause()
            mapView.onDetach()
        }
    }

    LaunchedEffect(latitude, longitude) {
        if (latitude == null || longitude == null) return@LaunchedEffect
        val current = marker.position
        if (abs(current.latitude - latitude) > 1e-6 || abs(current.longitude - longitude) > 1e-6) {
            val point = GeoPoint(latitude, longitude)
            marker.position = point
            mapView.controller.animateTo(point, max(mapView.zoomLevelDouble, 16.0), 400L)
            mapView.invalidate()
        }
    }

    AndroidView(factory = { mapView }, modifier = modifier)
}

@SuppressLint("MissingPermission")
private suspend fun readDeviceLocation(
    client: FusedLocationProviderClient,
): Pair<Double, Double>? {
    val cancellation = CancellationTokenSource()
    return try {
        val location = client
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
            .await()
        if (location != null) location.latitude to location.longitude else null
    } catch (_: Exception) {
        null
    } finally {
        cancellation.cancel()
    }
}
