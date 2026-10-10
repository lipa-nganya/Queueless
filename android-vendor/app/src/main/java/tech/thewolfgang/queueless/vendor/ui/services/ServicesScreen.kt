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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import tech.thewolfgang.queueless.vendor.ui.theme.GhostButton
import androidx.compose.material3.TextField
import tech.thewolfgang.queueless.vendor.ui.theme.queuelessFieldColors
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.BusinessService
import tech.thewolfgang.queueless.vendor.ui.components.BranchSwitcherCard
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.LimeDim
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.CardShape
import tech.thewolfgang.queueless.vendor.ui.theme.ButtonShape
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.OnDanger
import tech.thewolfgang.queueless.vendor.ui.theme.LimeSoft
import tech.thewolfgang.queueless.vendor.ui.theme.ChipShape
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceMuted

@Composable
fun ServicesScreen(
    viewModel: ServicesViewModel,
    onOpenQueue: () -> Unit,
    onOpenBranches: () -> Unit,
    onOpenProfile: () -> Unit,
    onSwitchBranch: (Int) -> Unit,
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
            .background(PageBackground),
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
                        CircularProgressIndicator(color = LimeDim)
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
                            text = state.branchName.ifBlank { "Branch services" },
                            color = TextPrimary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = state.businessName?.takeIf { it.isNotBlank() }?.let {
                                "$it — branch services"
                            } ?: "Services for this location. Service time feeds wait estimates.",
                            color = TextMuted,
                        )

                        BranchSwitcherCard(
                            branchName = state.branchName.ifBlank { "Untitled branch" },
                            meta = state.branchMeta,
                            allBranches = state.siblingBranches,
                            selectedId = state.branchId,
                            onSelect = onSwitchBranch,
                        )

                        if (state.services.isEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SurfaceCard, CardShape)
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(
                                    text = "No services yet",
                                    color = TextPrimary,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 18.sp,
                                )
                                Text(
                                    text = "Add the first service for ${state.branchName.ifBlank { "this branch" }}.",
                                    color = TextMuted,
                                )
                            }
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
                        Text(
                            text = "Adding or editing services for ${state.branchName.ifBlank { "this branch" }}.",
                            color = TextMuted,
                        )

                        TextField(
                            shape = FieldShape,
                            value = state.name,
                            onValueChange = viewModel::onNameChange,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Service name") },
                            singleLine = true,
                            colors = fieldColors(),
                        )
                        TextField(
                            shape = FieldShape,
                            value = state.durationMinutes,
                            onValueChange = viewModel::onDurationChange,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Service time (minutes)") },
                            singleLine = true,
                            colors = fieldColors(),
                        )
                        TextField(
                            shape = FieldShape,
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
                                .background(SurfaceCard, CardShape)
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                                Text("Service active", color = TextPrimary, fontWeight = FontWeight.Medium)
                                Text(
                                    text = "Inactive services stay hidden from customers.",
                                    color = TextMuted,
                                    fontSize = 13.sp,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
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
                            Text(text = state.savedMessage ?: "", color = LimeInk)
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            if (state.editingId != null) {
                                GhostButton(
                                    onClick = viewModel::startCreate,
                                    enabled = !state.saving,
                                    modifier = Modifier.weight(1f).height(48.dp),
                                    shape = ButtonShape,
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
                                shape = ButtonShape,
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
            .background(SurfaceCard, CardShape)
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
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                modifier = Modifier
                    .background(PageBackground, ChipShape)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
        Text(
            text = if (service.isActive) "Active" else "Inactive",
            color = if (service.isActive) LimeInk else TextMuted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            modifier = Modifier
                .background(if (service.isActive) LimeSoft else SurfaceMuted, ChipShape)
                .padding(horizontal = 10.dp, vertical = 3.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GhostButton(
                onClick = onEdit,
                enabled = !busy,
                modifier = Modifier.weight(1f),
                shape = ButtonShape,
            ) {
                Text("Edit")
            }
            Button(
                onClick = onDelete,
                enabled = !busy,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Danger,
                    contentColor = OnDanger,
                ),
                shape = ButtonShape,
            ) {
                Text("Delete")
            }
        }
    }
}

@Composable
private fun fieldColors() = queuelessFieldColors()
