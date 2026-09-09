package tech.thewolfgang.queueless.vendor.ui.profile

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
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onOpenQueue: () -> Unit,
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
            TopBar(title = "Profile", showBrand = true)
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading profile…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
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
                            text = "Branch profile",
                            color = TextPrimary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        if (!state.groupName.isNullOrBlank()) {
                            Text(text = state.groupName ?: "", color = TextMuted)
                        }

                    OutlinedTextField(
                        value = state.name,
                        onValueChange = viewModel::onNameChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Branch name") },
                        singleLine = true,
                        colors = fieldColors(),
                    )

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceCard, RoundedCornerShape(14.dp))
                                .padding(16.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                                    Text(
                                        text = "Branch active",
                                        color = TextPrimary,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        text = "Inactive branches stay hidden from customers.",
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
                                        uncheckedTrackColor = SurfaceCard,
                                    ),
                                )
                            }
                        }

                        OutlinedTextField(
                            value = state.operatingHours,
                            onValueChange = viewModel::onOperatingHoursChange,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp),
                            label = { Text("Operating hours") },
                            placeholder = {
                                Text("e.g. Mon–Fri: 8:00 AM–6:00 PM\nSat: 9:00 AM–2:00 PM\nSun: Closed")
                            },
                            colors = fieldColors(),
                        )

                        if (!state.error.isNullOrBlank()) {
                            Text(text = state.error ?: "", color = Danger)
                        }
                        if (!state.savedMessage.isNullOrBlank()) {
                            Text(text = state.savedMessage ?: "", color = Lime)
                        }

                        Button(
                            onClick = viewModel::save,
                            enabled = !state.saving,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
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
                                Text("Save changes", fontWeight = FontWeight.SemiBold)
                            }
                        }

                        Spacer(Modifier.height(24.dp))
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Profile,
            onQueue = onOpenQueue,
            onProfile = {},
            onSignOut = onSignOut,
        )
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
