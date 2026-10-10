package tech.thewolfgang.queueless.vendor.ui.branches

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
import androidx.compose.material3.ExperimentalMaterial3Api
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
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.ui.components.BranchLocationField
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
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.LimeSoft
import tech.thewolfgang.queueless.vendor.ui.theme.ButtonShape
import tech.thewolfgang.queueless.vendor.ui.theme.ChipShape
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceMuted

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
    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    val fieldColors = queuelessFieldColors()

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
            TopBar(title = "Branches", showBrand = true)
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = LimeDim)
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
                            Text(text = state.savedMessage ?: "", color = LimeInk)
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

                        TextField(
                            shape = FieldShape,
                            value = state.name,
                            onValueChange = viewModel::onNameChange,
                            label = { Text("Branch name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )

                        BranchLocationField(
                            state = state.location,
                            controller = viewModel.location,
                            enabled = !state.saving,
                        )

                        TextField(
                            shape = FieldShape,
                            value = state.landmark,
                            onValueChange = viewModel::onLandmarkChange,
                            label = { Text("Landmark (optional)") },
                            placeholder = { Text("e.g. Opposite Naivas, next to the blue gate") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )

                        TextField(
                            shape = FieldShape,
                            value = state.phone,
                            onValueChange = viewModel::onPhoneChange,
                            label = { Text("Phone") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = fieldColors,
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceCard, CardShape)
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Branch active", color = TextPrimary, fontWeight = FontWeight.Medium)
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
                                GhostButton(
                                    onClick = viewModel::startCreate,
                                    enabled = !state.saving,
                                    modifier = Modifier.height(52.dp),
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
                                shape = ButtonShape,
                                modifier = Modifier.weight(1f).height(52.dp),
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

@Composable
private fun BranchCard(
    branch: BusinessProfile,
    onEdit: () -> Unit,
    onHours: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, CardShape)
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
            color = if (branch.isActive) LimeInk else TextMuted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            modifier = Modifier
                .background(if (branch.isActive) LimeSoft else SurfaceMuted, ChipShape)
                .padding(horizontal = 10.dp, vertical = 3.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton(onClick = onEdit) {
                Text("Edit")
            }
            GhostButton(onClick = onHours) {
                Text("Settings")
            }
        }
    }
}
