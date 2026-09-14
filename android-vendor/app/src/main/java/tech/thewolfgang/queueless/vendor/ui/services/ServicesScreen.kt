package tech.thewolfgang.queueless.vendor.ui.services

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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.BusinessService
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

@Composable
fun ServicesScreen(
    viewModel: ServicesViewModel,
    onOpenQueue: () -> Unit,
    onOpenBranches: () -> Unit,
    onOpenProfile: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

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
            TopBar(title = "Services", showBrand = true)
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading services…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
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
                            text = "Business services",
                            color = TextPrimary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Shared across branches. Service period is used for wait estimates.",
                            color = TextMuted,
                        )

                        if (state.services.isEmpty()) {
                            Text(text = "No services yet.", color = TextMuted)
                        } else {
                            state.services.forEach { service ->
                                ServiceRow(
                                    service = service,
                                    busy = state.saving,
                                    onEdit = { viewModel.startEdit(service) },
                                    onDelete = { viewModel.delete(service.id) },
                                )
                            }
                        }

                        Text(
                            text = if (state.editingId != null) "Edit service" else "Add service",
                            color = TextPrimary,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 8.dp),
                        )

                        OutlinedTextField(
                            value = state.name,
                            onValueChange = viewModel::onNameChange,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Service name") },
                            singleLine = true,
                            colors = fieldColors(),
                        )
                        OutlinedTextField(
                            value = state.durationMinutes,
                            onValueChange = viewModel::onDurationChange,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Service period (minutes)") },
                            singleLine = true,
                            colors = fieldColors(),
                        )
                        OutlinedTextField(
                            value = state.description,
                            onValueChange = viewModel::onDescriptionChange,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Description (optional)") },
                            minLines = 2,
                            colors = fieldColors(),
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceCard, RoundedCornerShape(14.dp))
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Service active", color = TextPrimary, fontWeight = FontWeight.Medium)
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

                        if (!state.error.isNullOrBlank()) {
                            Text(text = state.error ?: "", color = Danger)
                        }
                        if (!state.savedMessage.isNullOrBlank()) {
                            Text(text = state.savedMessage ?: "", color = Lime)
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (state.editingId != null) {
                                OutlinedButton(
                                    onClick = viewModel::startCreate,
                                    enabled = !state.saving,
                                    modifier = Modifier.weight(1f).height(48.dp),
                                    shape = RoundedCornerShape(10.dp),
                                ) {
                                    Text("Cancel")
                                }
                            }
                            Button(
                                onClick = viewModel::save,
                                enabled = !state.saving,
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Lime,
                                    contentColor = Navy,
                                    disabledContainerColor = Lime.copy(alpha = 0.5f),
                                ),
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                if (state.saving) {
                                    CircularProgressIndicator(
                                        color = Navy,
                                        strokeWidth = 2.dp,
                                        modifier = Modifier.height(22.dp),
                                    )
                                } else {
                                    Text(
                                        text = if (state.editingId != null) "Save service" else "Add service",
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(24.dp))
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Services,
            onQueue = onOpenQueue,
            onBranches = onOpenBranches,
            onServices = {},
            onProfile = onOpenProfile,
            onSignOut = onSignOut,
        )
    }
}

@Composable
private fun ServiceRow(
    service: BusinessService,
    busy: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text(text = service.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                if (!service.description.isNullOrBlank()) {
                    Text(
                        text = service.description.orEmpty(),
                        color = TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Text(
                text = "${service.durationMinutes} min",
                color = Lime,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            text = if (service.isActive) "Active" else "Inactive",
            color = if (service.isActive) Lime else TextMuted,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = onEdit,
                enabled = !busy,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("Edit")
            }
            Button(
                onClick = onDelete,
                enabled = !busy,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Danger,
                    contentColor = TextPrimary,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("Delete")
            }
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Lime,
    unfocusedBorderColor = TextMuted.copy(alpha = 0.4f),
    focusedLabelColor = Lime,
    unfocusedLabelColor = TextMuted,
    cursorColor = Lime,
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    focusedPlaceholderColor = TextMuted,
    unfocusedPlaceholderColor = TextMuted,
)
