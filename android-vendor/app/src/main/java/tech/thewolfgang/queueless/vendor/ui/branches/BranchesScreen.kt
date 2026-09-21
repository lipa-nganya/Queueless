package tech.thewolfgang.queueless.vendor.ui.branches

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BranchesScreen(
    viewModel: BranchesViewModel,
    onOpenQueue: () -> Unit,
    onOpenServices: () -> Unit,
    onOpenHours: (Int) -> Unit,
    onOpenProfile: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val fusedLocationClient = remember {
        LocationServices.getFusedLocationProviderClient(context)
    }

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun fetchCurrentLocation() {
        scope.launch {
            viewModel.beginLocating()
            readDeviceLocation(fusedLocationClient)?.let { (lat, lon) ->
                viewModel.applyCurrentLocation(lat, lon)
            } ?: viewModel.onLocationUnavailable()
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            fetchCurrentLocation()
        } else {
            viewModel.onLocationPermissionDenied()
        }
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = TextPrimary,
        unfocusedTextColor = TextPrimary,
        focusedBorderColor = Lime,
        unfocusedBorderColor = TextMuted.copy(alpha = 0.4f),
        focusedLabelColor = Lime,
        unfocusedLabelColor = TextMuted,
        cursorColor = Lime,
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            TopBar(title = "Branches", showBrand = true)
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading branches…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
                    }
                }

                else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Text(
                            text = "Branches",
                            color = TextPrimary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = state.businessName?.let {
                                "Locations for $it. Services and settings are managed per branch."
                            } ?: "Add and manage locations for this business.",
                            color = TextMuted,
                        )

                        if (!state.error.isNullOrBlank()) {
                            Text(text = state.error ?: "", color = Danger)
                        }
                        if (!state.savedMessage.isNullOrBlank()) {
                            Text(text = state.savedMessage ?: "", color = Lime)
                        }

                        if (state.branches.isEmpty()) {
                            Text(text = "No branches yet.", color = TextMuted)
                        } else {
                            state.branches.forEach { branch ->
                                BranchCard(
                                    branch = branch,
                                    onEdit = { viewModel.startEdit(branch) },
                                    onHours = { onOpenHours(branch.id) },
                                )
                            }
                        }

                        Text(
                            text = if (state.editingId != null) "Edit branch" else "Add branch",
                            color = TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 8.dp),
                        )

                        OutlinedTextField(
                            value = state.name,
                            onValueChange = viewModel::onNameChange,
                            label = { Text("Branch name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )

                        ExposedDropdownMenuBox(
                            expanded = state.locationMenuExpanded,
                            onExpandedChange = { /* driven by suggestions */ },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            OutlinedTextField(
                                value = state.location,
                                onValueChange = viewModel::onLocationChange,
                                label = { Text("Location") },
                                placeholder = { Text("Start typing a Kenya place…") },
                                singleLine = true,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(MenuAnchorType.PrimaryEditable),
                                colors = fieldColors,
                            )
                            ExposedDropdownMenu(
                                expanded = state.locationMenuExpanded && state.locationSuggestions.isNotEmpty(),
                                onDismissRequest = viewModel::dismissLocationSuggestions,
                            ) {
                                state.locationSuggestions.forEach { place ->
                                    DropdownMenuItem(
                                        text = { Text(place.label, color = TextPrimary) },
                                        onClick = { viewModel.onPlaceSelected(place) },
                                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                                    )
                                }
                            }
                        }

                        OutlinedButton(
                            onClick = {
                                if (!hasLocationPermission()) {
                                    permissionLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                            Manifest.permission.ACCESS_COARSE_LOCATION,
                                        ),
                                    )
                                } else {
                                    fetchCurrentLocation()
                                }
                            },
                            enabled = !state.locating && !state.saving,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                if (state.locating) "Finding location…" else "Use my current location",
                            )
                        }

                        OutlinedTextField(
                            value = state.landmark,
                            onValueChange = viewModel::onLandmarkChange,
                            label = { Text("Landmark (optional)") },
                            placeholder = { Text("e.g. Opposite Naivas, next to the blue gate") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )

                        OutlinedTextField(
                            value = state.phone,
                            onValueChange = viewModel::onPhoneChange,
                            label = { Text("Phone") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Branch active", color = TextPrimary)
                            Switch(
                                checked = state.isActive,
                                onCheckedChange = viewModel::onActiveChange,
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Navy,
                                    checkedTrackColor = Lime,
                                    uncheckedThumbColor = TextMuted,
                                    uncheckedTrackColor = TextMuted.copy(alpha = 0.3f),
                                ),
                            )
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (state.editingId != null) {
                                OutlinedButton(
                                    onClick = viewModel::startCreate,
                                    enabled = !state.saving,
                                ) {
                                    Text("Cancel")
                                }
                            }
                            Button(
                                onClick = viewModel::save,
                                enabled = !state.saving,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Lime,
                                    contentColor = Navy,
                                ),
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(
                                    if (state.saving) {
                                        "Saving…"
                                    } else if (state.editingId != null) {
                                        "Save branch"
                                    } else {
                                        "Add branch"
                                    },
                                )
                            }
                        }
                        Spacer(Modifier.height(24.dp))
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Branches,
            onQueue = onOpenQueue,
            onBranches = {},
            onServices = onOpenServices,
            onProfile = onOpenProfile,
            onSignOut = onSignOut,
        )
    }
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

@Composable
private fun BranchCard(
    branch: BusinessProfile,
    onEdit: () -> Unit,
    onHours: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = branch.name,
            color = TextPrimary,
            fontWeight = FontWeight.SemiBold,
            fontSize = 18.sp,
        )
        Text(
            text = listOfNotNull(
                branch.location?.takeIf { it.isNotBlank() } ?: "No location set",
                branch.landmark?.takeIf { it.isNotBlank() },
                branch.phone?.takeIf { it.isNotBlank() },
            ).joinToString(" · "),
            color = TextMuted,
        )
        Text(
            text = if (branch.isActive) "Active" else "Inactive",
            color = if (branch.isActive) Lime else TextMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onEdit) {
                Text("Edit")
            }
            OutlinedButton(onClick = onHours) {
                Text("Settings")
            }
        }
    }
}
