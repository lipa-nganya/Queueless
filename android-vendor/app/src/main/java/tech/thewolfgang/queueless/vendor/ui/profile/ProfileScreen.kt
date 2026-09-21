package tech.thewolfgang.queueless.vendor.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.AccessibilityOptions
import tech.thewolfgang.queueless.vendor.data.DayHours
import tech.thewolfgang.queueless.vendor.data.OperatingHours
import tech.thewolfgang.queueless.vendor.ui.components.BranchSwitcherCard
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.components.liveStatus
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

private data class TimePickerTarget(val day: String, val field: String)

private object ProfileTabRetainer {
    var index: Int = 0
}

private val profileTabs = listOf("Details", "Hours", "Accessibility")

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onOpenQueue: () -> Unit,
    onOpenBranches: () -> Unit,
    onOpenServices: () -> Unit,
    onSwitchBranch: (Int) -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var timePickerTarget by remember { mutableStateOf<TimePickerTarget?>(null) }
    var selectedTab by remember { mutableIntStateOf(ProfileTabRetainer.index) }

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
            TopBar(title = "Settings", showBrand = true)
            Spacer(Modifier.height(12.dp))

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading settings…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
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
                            text = state.branchName.ifBlank { "Branch settings" },
                            color = TextPrimary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = state.businessName?.takeIf { it.isNotBlank() }?.let {
                                "$it — branch settings"
                            } ?: "Details, hours, and accessibility for this location.",
                            color = TextMuted,
                        )

                        BranchSwitcherCard(
                            branchName = state.branchName.ifBlank { "Untitled branch" },
                            meta = state.branchMeta,
                            branches = state.siblingBranches,
                            selectedId = state.branchId,
                            onSelect = { id ->
                                ProfileTabRetainer.index = selectedTab
                                onSwitchBranch(id)
                            },
                        )

                        ScrollableTabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = SurfaceCard,
                            contentColor = TextPrimary,
                            edgePadding = 8.dp,
                            divider = {},
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceCard, RoundedCornerShape(14.dp)),
                        ) {
                            profileTabs.forEachIndexed { index, title ->
                                Tab(
                                    selected = selectedTab == index,
                                    onClick = {
                                        selectedTab = index
                                        ProfileTabRetainer.index = index
                                    },
                                    selectedContentColor = Navy,
                                    unselectedContentColor = TextMuted,
                                    text = {
                                        Text(
                                            text = title,
                                            fontWeight = if (selectedTab == index) {
                                                FontWeight.Bold
                                            } else {
                                                FontWeight.SemiBold
                                            },
                                        )
                                    },
                                    modifier = Modifier
                                        .padding(vertical = 4.dp)
                                        .background(
                                            if (selectedTab == index) Lime else Color.Transparent,
                                            RoundedCornerShape(10.dp),
                                        ),
                                )
                            }
                        }

                        when (selectedTab) {
                            0 -> DetailsTab(state = state, viewModel = viewModel)
                            1 -> HoursTab(
                                state = state,
                                onOpenChange = viewModel::onDayOpenChange,
                                onPickStart = { day ->
                                    timePickerTarget = TimePickerTarget(day, "start")
                                },
                                onPickEnd = { day ->
                                    timePickerTarget = TimePickerTarget(day, "end")
                                },
                            )
                            else -> AccessibilityTab(state = state, viewModel = viewModel)
                        }

                        if (!state.error.isNullOrBlank()) {
                            Text(
                                text = state.error ?: "",
                                color = Danger,
                                modifier = Modifier.liveStatus(),
                            )
                        }
                        if (!state.savedMessage.isNullOrBlank()) {
                            Text(
                                text = state.savedMessage ?: "",
                                color = Lime,
                                modifier = Modifier.liveStatus(),
                            )
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
            onBranches = onOpenBranches,
            onServices = onOpenServices,
            onProfile = {},
            onSignOut = onSignOut,
        )
    }

    val picker = timePickerTarget
    if (picker != null) {
        val current = state.schedule.find { it.day == picker.day }
        val initial = if (picker.field == "start") {
            current?.start ?: "08:00"
        } else {
            current?.end ?: "18:00"
        }
        TimePickerDialog(
            initial = initial,
            title = if (picker.field == "start") "Start time" else "End time",
            onDismiss = { timePickerTarget = null },
            onConfirm = { value ->
                if (picker.field == "start") {
                    viewModel.onDayStartChange(picker.day, value)
                } else {
                    viewModel.onDayEndChange(picker.day, value)
                }
                timePickerTarget = null
            },
        )
    }
}

@Composable
private fun DetailsTab(
    state: ProfileUiState,
    viewModel: ProfileViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
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
    }
}

@Composable
private fun HoursTab(
    state: ProfileUiState,
    onOpenChange: (String, Boolean) -> Unit,
    onPickStart: (String) -> Unit,
    onPickEnd: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Weekly hours",
            color = TextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = "Set open days and times for ${state.branchName.ifBlank { "this branch" }}.",
            color = TextMuted,
        )
        state.schedule.forEach { day ->
            DayHoursRow(
                day = day,
                onOpenChange = { open -> onOpenChange(day.day, open) },
                onPickStart = { onPickStart(day.day) },
                onPickEnd = { onPickEnd(day.day) },
            )
        }
    }
}

@Composable
private fun AccessibilityTab(
    state: ProfileUiState,
    viewModel: ProfileViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            text = "Accessibility",
            color = TextPrimary,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            text = "Select the options ${state.branchName.ifBlank { "this branch" }} can offer customers.",
            color = TextMuted,
        )
        AccessibilityOptions.all.forEach { option ->
            val checked = option.id in state.accessibilityOptions
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceCard, RoundedCornerShape(14.dp))
                    .clickable {
                        viewModel.onAccessibilityToggle(option.id, !checked)
                    }
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .semantics(mergeDescendants = true) {
                        role = Role.Checkbox
                        selected = checked
                        contentDescription = "${option.label}. ${option.description}"
                        stateDescription = if (checked) "Selected" else "Not selected"
                    },
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Checkbox(
                    checked = checked,
                    onCheckedChange = { enabled ->
                        viewModel.onAccessibilityToggle(option.id, enabled)
                    },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Lime,
                        checkmarkColor = Navy,
                        uncheckedColor = TextMuted,
                    ),
                )
                Icon(
                    imageVector = option.icon,
                    contentDescription = null,
                    tint = TextPrimary,
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .size(22.dp),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = option.label,
                        color = TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = option.description,
                        color = TextMuted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayHoursRow(
    day: DayHours,
    onOpenChange: (Boolean) -> Unit,
    onPickStart: () -> Unit,
    onPickEnd: () -> Unit,
) {
    val label = OperatingHours.weekDays.find { it.key == day.day }?.label ?: day.day
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text(text = label, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                Text(
                    text = if (day.open) "Open" else "Closed",
                    color = if (day.open) Lime else TextMuted,
                    fontSize = 13.sp,
                )
            }
            Button(
                onClick = { onOpenChange(!day.open) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (day.open) Lime else Navy.copy(alpha = 0.35f),
                    contentColor = if (day.open) Navy else TextMuted,
                ),
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier
                    .height(36.dp)
                    .semantics {
                        role = Role.Switch
                        contentDescription = "$label ${if (day.open) "Open" else "Closed"}"
                        stateDescription = if (day.open) "Open" else "Closed"
                    },
            ) {
                Text(
                    text = if (day.open) "Open" else "Closed",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TimeChip(
                label = "Start",
                value = day.start,
                enabled = day.open,
                onClick = onPickStart,
                modifier = Modifier.weight(1f),
            )
            Text(text = "to", color = TextMuted)
            TimeChip(
                label = "End",
                value = day.end,
                enabled = day.open,
                onClick = onPickEnd,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun TimeChip(
    label: String,
    value: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(
                if (enabled) Navy.copy(alpha = 0.35f) else Navy.copy(alpha = 0.15f),
                RoundedCornerShape(10.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = "$label ${OperatingHours.formatDisplay(value)}"
                if (!enabled) stateDescription = "Disabled"
            }
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(text = label, color = TextMuted, fontSize = 12.sp)
        Text(
            text = OperatingHours.formatDisplay(value),
            color = if (enabled) TextPrimary else TextMuted,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimePickerDialog(
    initial: String,
    title: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    val normalized = OperatingHours.normalizeTime(initial)
    val hour = normalized.substring(0, 2).toInt()
    val minute = normalized.substring(3).toInt()
    val pickerState = rememberTimePickerState(
        initialHour = hour,
        initialMinute = minute,
        is24Hour = false,
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            TimePicker(state = pickerState)
        },
        confirmButton = {
            TextButton(
                onClick = {
                    val value = "%02d:%02d".format(pickerState.hour, pickerState.minute)
                    onConfirm(value)
                },
            ) {
                Text("Set")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
    )
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
