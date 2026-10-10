package tech.thewolfgang.queueless.vendor.ui.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.TextField
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import tech.thewolfgang.queueless.vendor.data.QueueBranchOption
import tech.thewolfgang.queueless.vendor.ui.theme.SheetShape
import tech.thewolfgang.queueless.vendor.ui.theme.queuelessFieldColors
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import tech.thewolfgang.queueless.vendor.ui.theme.GhostButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.QueueEntry
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.vendor.ui.components.liveStatus
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
import tech.thewolfgang.queueless.vendor.ui.theme.ChipShape
import tech.thewolfgang.queueless.vendor.ui.theme.OnDanger
import tech.thewolfgang.queueless.vendor.ui.theme.LimeSoft
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.TealInk
import tech.thewolfgang.queueless.vendor.ui.theme.Teal
import tech.thewolfgang.queueless.vendor.ui.theme.limeCard

@Composable
fun QueueScreen(
    viewModel: QueueViewModel,
    onBack: () -> Unit,
    onOpenBranches: () -> Unit,
    onOpenServices: () -> Unit,
    onOpenProfile: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner, viewModel) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> viewModel.startPolling()
                Lifecycle.Event.ON_STOP -> viewModel.stopPolling()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            viewModel.stopPolling()
        }
    }

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
            TopBar(
                showBack = true,
                showBrand = false,
                onBack = onBack,
            )
            Spacer(Modifier.height(8.dp))

            when {
                state.loading && state.data == null -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(
                            color = LimeDim,
                            modifier = Modifier.semantics { contentDescription = "Loading queue" },
                        )
                        Text("Loading queue…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
                    }
                }

                state.data == null && !state.error.isNullOrBlank() -> {
                    Text(
                        text = state.error ?: "",
                        color = Danger,
                        modifier = Modifier.liveStatus(),
                    )
                }

                state.data != null -> {
                    val data = state.data!!
                    val business = data.business
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        item {
                            val title = listOfNotNull(
                                business.name.takeIf { it.isNotBlank() },
                                business.branchName?.takeIf { it.isNotBlank() && it != "Main" },
                            ).joinToString(" · ")
                            Text(
                                text = title.ifBlank { business.name },
                                color = TextPrimary,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            val meta = listOfNotNull(
                                business.businessGroupName?.takeIf { it.isNotBlank() },
                                business.location?.takeIf { it.isNotBlank() },
                            ).joinToString(" · ")
                            if (meta.isNotBlank()) {
                                Text(text = meta, color = TextMuted, modifier = Modifier.padding(top = 4.dp))
                            }
                        }

                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                StatCard("Total waiting", "${business.waitingTotal}", Modifier.weight(1f))
                                StatCard("In app", "${business.appWaiting}", Modifier.weight(1f))
                                StatCard("Walk-ins", "${business.walkInWaiting}", Modifier.weight(1f))
                            }
                        }

                        item {
                            QueuePauseCard(
                                branchName = business.branchName?.takeIf { it.isNotBlank() } ?: "This branch",
                                otherBranches = data.branches.count { it.isActive } > 1,
                                paused = business.queuePaused,
                                enabled = !state.actionBusy,
                                onToggle = viewModel::toggleQueuePause,
                            )
                        }

                        item {
                            QueueToolbar(
                                filter = state.filter,
                                counts = mapOf(
                                    QueueFilter.All to data.entries.size,
                                    QueueFilter.WalkIns to data.entries.count { it.isWalkIn },
                                    QueueFilter.App to data.entries.count { !it.isWalkIn },
                                ),
                                onFilter = viewModel::setFilter,
                                onAddWalkIn = viewModel::openAddWalkIn,
                            )
                        }

                        if (!state.notice.isNullOrBlank()) {
                            item {
                                Text(
                                    text = state.notice ?: "",
                                    color = LimeInk,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.liveStatus(),
                                )
                            }
                        }

                        if (!state.error.isNullOrBlank()) {
                            item {
                                Text(
                                    text = state.error ?: "",
                                    color = Danger,
                                    modifier = Modifier.liveStatus(),
                                )
                            }
                        }

                        val visible = when (state.filter) {
                            QueueFilter.All -> data.entries
                            QueueFilter.WalkIns -> data.entries.filter { it.isWalkIn }
                            QueueFilter.App -> data.entries.filter { !it.isWalkIn }
                        }
                        val frontId = data.entries.firstOrNull()?.id
                        if (visible.isEmpty()) {
                            item {
                                Text(
                                    text = when (state.filter) {
                                        QueueFilter.All -> "Queue is clear. Waiting for the next customer."
                                        QueueFilter.WalkIns -> "No walk-ins waiting."
                                        QueueFilter.App -> "No app customers waiting."
                                    },
                                    color = TextMuted,
                                    modifier = Modifier
                                        .padding(vertical = 24.dp)
                                        .liveStatus(),
                                )
                            }
                        } else {
                            items(visible, key = { entry -> entry.id }) { entry ->
                                QueueCard(
                                    entry = entry,
                                    isNow = entry.id == frontId,
                                    busy = state.actionBusy,
                                    onServe = { viewModel.serve(entry) },
                                    onNoShow = { viewModel.noShow(entry) },
                                    onEdit = { viewModel.openEditWalkIn(entry) },
                                )
                            }
                        }

                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
        state.walkInSheet?.let { sheet ->
            WalkInSheet(
                sheet = sheet,
                branches = state.data?.branches.orEmpty()
                    .filter { it.isActive || it.id == sheet.branchId },
                onDismiss = viewModel::closeWalkInSheet,
                onBranch = viewModel::onSheetBranch,
                onService = viewModel::onSheetService,
                onName = viewModel::onSheetName,
                onPhone = viewModel::onSheetPhone,
                onPartySize = viewModel::onSheetPartySize,
                onSubmit = viewModel::submitWalkIn,
            )
        }
        VendorBottomBar(
            selected = VendorTab.Queue,
            onQueue = {},
            onBranches = onOpenBranches,
            onServices = onOpenServices,
            onProfile = onOpenProfile,
            onSignOut = onSignOut,
        )
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(SurfaceCard, RoundedCornerShape(16.dp))
            .semantics(mergeDescendants = true) {
                contentDescription = "$label: $value"
            }
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = value, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(text = label, color = TextMuted, fontSize = 12.sp)
    }
}

@Composable
private fun QueuePauseCard(
    branchName: String,
    otherBranches: Boolean,
    paused: Boolean,
    enabled: Boolean,
    onToggle: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (paused) Danger.copy(alpha = 0.12f) else SurfaceCard,
                CardShape,
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column {
            Text(
                text = if (paused) "$branchName queue paused" else "$branchName queue open",
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = buildString {
                    append(
                        if (paused) {
                            "Customers cannot join this branch right now. You can still serve people already waiting."
                        } else {
                            "Customers can join this branch. Pause to take a short break."
                        },
                    )
                    if (otherBranches) append(" Your other branches are not affected.")
                },
                color = TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        if (paused) {
            Button(
                onClick = onToggle,
                enabled = enabled,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Lime,
                    contentColor = Navy,
                ),
                shape = ButtonShape,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text("Resume $branchName")
            }
        } else {
            GhostButton(
                onClick = onToggle,
                enabled = enabled,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                Text("Pause $branchName")
            }
        }
    }
}

@Composable
private fun QueueCard(
    entry: QueueEntry,
    isNow: Boolean,
    busy: Boolean,
    onServe: () -> Unit,
    onNoShow: () -> Unit,
    onEdit: () -> Unit,
) {
    val name = entry.customerFirstName ?: if (entry.isWalkIn) "Walk-in guest" else "Customer"
    val partyLabel = if (entry.partySize > 1) ", party of ${entry.partySize}" else ""
    val accessibilityNote = entry.accessibilityNote?.trim()
    val hasAccessibility =
        entry.accessibilityNeedLabels.isNotEmpty() || !accessibilityNote.isNullOrEmpty()
    val muted = if (isNow) Navy.copy(alpha = 0.72f) else TextMuted
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (isNow) Modifier.limeCard() else Modifier.background(SurfaceCard, CardShape))
            .semantics(mergeDescendants = true) {
                contentDescription = buildString {
                    append(if (entry.isWalkIn) "Walk-in: " else "App: ")
                    append(name)
                    append(partyLabel)
                    entry.serviceName?.let { append(", $it") }
                    append(if (isNow) ", now serving" else ", position ${entry.position}")
                    append(", estimated wait ${formatWaitMinutes(entry.estimatedWaitMinutes)}")
                    if (entry.accessibilityNeedLabels.isNotEmpty()) {
                        append(", accessibility needs: ")
                        append(entry.accessibilityNeedLabels.joinToString(", "))
                    }
                    if (!accessibilityNote.isNullOrEmpty()) append(", note: $accessibilityNote")
                }
            }
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = if (isNow) "Now serving" else "Position #${entry.position}",
                        color = if (isNow) Navy else LimeInk,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .background(
                                if (isNow) PageBackground.copy(alpha = 0.55f) else LimeSoft,
                                ChipShape,
                            )
                            .padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                    Text(
                        text = if (entry.isWalkIn) "Walk-in" else "App",
                        color = if (entry.isWalkIn) TealInk else muted,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .background(
                                if (entry.isWalkIn) Teal.copy(alpha = 0.14f) else Navy.copy(alpha = 0.06f),
                                ChipShape,
                            )
                            .padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                }
                Text(
                    text = buildString {
                        append(name)
                        if (entry.partySize > 1) append(" +${entry.partySize - 1}")
                    },
                    color = TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp),
                )
                if (!entry.customerPhone.isNullOrBlank()) {
                    Text(
                        text = "+${entry.customerPhone}",
                        color = muted,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                entry.serviceName?.let { service ->
                    Text(
                        text = service,
                        color = if (isNow) Navy else LimeInk,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (entry.partySize > 1 || entry.partyNames.size > 1) {
                    Text(
                        text = buildString {
                            if (entry.partySize > 1) append("Party of ${entry.partySize}")
                            if (entry.partyNames.isNotEmpty()) {
                                if (isNotEmpty()) append(" · ")
                                append(entry.partyNames.joinToString(", "))
                            }
                        },
                        color = muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatWaitMinutes(entry.estimatedWaitMinutes),
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text(text = "est. wait", color = muted, fontSize = 12.sp)
            }
        }
        if (hasAccessibility) {
            Column(
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .background(if (isNow) PageBackground.copy(alpha = 0.7f) else Teal.copy(alpha = 0.12f), FieldShape)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Text(
                    text = "Accessibility needs",
                    color = TealInk,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
                if (entry.accessibilityNeedLabels.isNotEmpty()) {
                    Text(
                        text = entry.accessibilityNeedLabels.joinToString(" · "),
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                if (!accessibilityNote.isNullOrEmpty()) {
                    Text(
                        text = "\u201C$accessibilityNote\u201D",
                        color = muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        run {
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onServe,
                    enabled = !busy,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                        .semantics { contentDescription = "Serve $name" },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Navy,
                        contentColor = Lime,
                    ),
                    shape = ButtonShape,
                ) {
                    Text("Serve", fontWeight = FontWeight.SemiBold)
                }
                if (entry.isWalkIn) {
                    GhostButton(
                        onClick = onEdit,
                        enabled = !busy,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .semantics { contentDescription = "Edit $name: service or branch" },
                    ) {
                        Text("Edit")
                    }
                }
                Button(
                    onClick = onNoShow,
                    enabled = !busy,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                        .semantics { contentDescription = "Mark $name as no-show" },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Danger,
                        contentColor = OnDanger,
                    ),
                    shape = ButtonShape,
                ) {
                    Text("No-show", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun QueueToolbar(
    filter: QueueFilter,
    counts: Map<QueueFilter, Int>,
    onFilter: (QueueFilter) -> Unit,
    onAddWalkIn: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
            onClick = onAddWalkIn,
            colors = ButtonDefaults.buttonColors(containerColor = Lime, contentColor = Navy),
            shape = ButtonShape,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            Icon(Icons.Rounded.PersonAdd, contentDescription = null)
            Spacer(Modifier.padding(start = 8.dp))
            Text("Add walk-in", fontWeight = FontWeight.SemiBold)
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .selectableGroup(),
        ) {
            QueueFilter.entries.forEach { option ->
                val count = counts[option] ?: 0
                FilterChip(
                    selected = filter == option,
                    onClick = { onFilter(option) },
                    label = { Text("${option.label} ($count)") },
                    shape = ChipShape,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Navy,
                        selectedLabelColor = PageBackground,
                    ),
                    modifier = Modifier.semantics {
                        contentDescription = "Show ${option.label.lowercase()}, $count"
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WalkInSheet(
    sheet: WalkInSheetState,
    branches: List<QueueBranchOption>,
    onDismiss: () -> Unit,
    onBranch: (Int) -> Unit,
    onService: (Int) -> Unit,
    onName: (String) -> Unit,
    onPhone: (String) -> Unit,
    onPartySize: (Int) -> Unit,
    onSubmit: () -> Unit,
) {
    val editing = sheet.editingEntryId != null
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape = SheetShape,
        containerColor = PageBackground,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = if (editing) "Edit walk-in" else "Add walk-in",
                color = TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
            if (branches.size > 1) {
                SheetLabel("Branch")
                Column(Modifier.selectableGroup()) {
                    branches.forEach { branch ->
                        ChoiceRow(
                            label = branch.name + if (branch.queuePaused) " (paused)" else "",
                            selected = branch.id == sheet.branchId,
                            onSelect = { onBranch(branch.id) },
                        )
                    }
                }
            }
            SheetLabel("Service")
            when {
                sheet.loadingServices -> Text("Loading services…", color = TextMuted)
                sheet.services.isEmpty() -> Text("No services set up at this branch.", color = TextMuted)
                else -> Column(Modifier.selectableGroup()) {
                    sheet.services.forEach { service ->
                        ChoiceRow(
                            label = "${service.name} · ${service.durationMinutes} min",
                            selected = service.id == sheet.serviceId,
                            onSelect = { onService(service.id) },
                        )
                    }
                }
            }
            if (!editing) {
                TextField(
                    shape = FieldShape,
                    value = sheet.name,
                    onValueChange = onName,
                    label = { Text("Name (optional)") },
                    singleLine = true,
                    colors = queuelessFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                TextField(
                    shape = FieldShape,
                    value = sheet.phone,
                    onValueChange = onPhone,
                    label = { Text("Phone (optional)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    colors = queuelessFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("Party size", color = TextPrimary, modifier = Modifier.weight(1f))
                    GhostButton(
                        onClick = { onPartySize(sheet.partySize - 1) },
                        enabled = sheet.partySize > 1,
                        shape = ChipShape,
                        modifier = Modifier.semantics { contentDescription = "Fewer people" },
                    ) { Text("−", fontSize = 20.sp) }
                    Text(
                        text = "${sheet.partySize}",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        modifier = Modifier.semantics {
                            contentDescription = "Party of ${sheet.partySize}"
                            liveRegion = LiveRegionMode.Polite
                        },
                    )
                    GhostButton(
                        onClick = { onPartySize(sheet.partySize + 1) },
                        enabled = sheet.partySize < 10,
                        shape = ChipShape,
                        modifier = Modifier.semantics { contentDescription = "More people" },
                    ) { Text("+", fontSize = 20.sp) }
                }
            }
            if (!sheet.error.isNullOrBlank()) {
                Text(text = sheet.error, color = Danger, modifier = Modifier.liveStatus())
            }
            Button(
                onClick = onSubmit,
                enabled = !sheet.saving && !sheet.loadingServices,
                colors = ButtonDefaults.buttonColors(containerColor = Navy, contentColor = Lime),
                shape = ButtonShape,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text(
                    text = when {
                        sheet.saving -> "Saving…"
                        editing -> "Save"
                        else -> "Add to queue"
                    },
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun SheetLabel(text: String) {
    Text(text = text, color = TextMuted, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
}

@Composable
private fun ChoiceRow(label: String, selected: Boolean, onSelect: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onSelect, role = Role.RadioButton)
            .padding(vertical = 4.dp),
    ) {
        RadioButton(
            selected = selected,
            onClick = null,
            colors = RadioButtonDefaults.colors(selectedColor = LimeInk),
        )
        Text(text = label, color = TextPrimary, modifier = Modifier.padding(start = 8.dp))
    }
}
