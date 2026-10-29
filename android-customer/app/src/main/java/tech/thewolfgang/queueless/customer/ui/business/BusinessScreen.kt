package tech.thewolfgang.queueless.customer.ui.business

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import tech.thewolfgang.queueless.customer.data.AccessibilityOptions
import tech.thewolfgang.queueless.customer.data.Travel
import tech.thewolfgang.queueless.customer.data.UserLocation
import tech.thewolfgang.queueless.customer.data.travelFrom
import tech.thewolfgang.queueless.customer.ui.components.AccessibilityNeedsPicker
import tech.thewolfgang.queueless.customer.ui.components.ChoiceRow
import tech.thewolfgang.queueless.customer.ui.components.InfoChip
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.MutedChip
import tech.thewolfgang.queueless.customer.ui.components.PrimaryButton
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.SectionTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.customer.ui.components.peopleLabel
import tech.thewolfgang.queueless.customer.ui.components.placeholderBusinessImage
import tech.thewolfgang.queueless.customer.ui.theme.CardShape
import tech.thewolfgang.queueless.customer.ui.theme.ChipShape
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.LimeSoft
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY_FORMAT = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH)
private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BusinessScreen(
    viewModel: BusinessViewModel,
    userLocation: UserLocation,
    onBack: () -> Unit,
    onRequireLogin: (reason: String) -> Unit,
    onJoined: () -> Unit,
    onBooked: () -> Unit,
    onOpenQueue: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val event by viewModel.events.collectAsStateWithLifecycle()
    val signedIn by viewModel.signedIn.collectAsStateWithLifecycle()
    val origin by userLocation.current.collectAsStateWithLifecycle()

    // Opened straight from a link: Discover hasn't located the customer yet.
    LaunchedEffect(Unit) {
        if (origin == null && userLocation.hasPermission) userLocation.refresh()
    }

    LaunchedEffect(signedIn) {
        if (signedIn) viewModel.refreshProfile()
    }

    LaunchedEffect(event) {
        when (val current = event) {
            is BusinessEvent.RequireLogin -> onRequireLogin(current.reason)
            BusinessEvent.Joined -> onJoined()
            BusinessEvent.Booked -> onBooked()
            null -> return@LaunchedEffect
        }
        viewModel.consumeEvent()
    }

    Column(Modifier.fillMaxSize()) {
        TopBar(onBack = onBack)
        val business = state.business
        if (state.loading || business == null) {
            if (state.loading) {
                LoadingState("Loading…")
            } else {
                Column(Modifier.padding(16.dp)) {
                    StatusBanner(state.error ?: "Business not found.", isError = true)
                    TextButton(onClick = viewModel::load) { Text("Try again", color = LimeInk) }
                }
            }
            return@Column
        }
        val branch = state.branch

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            AsyncImage(
                    model = viewModel.imageUrl(business.imageUrl) ?: placeholderBusinessImage(business.id),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(170.dp)
                        .clip(CardShape)
                        .background(SurfaceMuted),
                )
            ScreenTitle(
                title = business.name,
                subtitle = listOfNotNull(business.businessGroupName, business.description).joinToString(" · "),
            )

            if (business.branches.size > 1) {
                SectionTitle("Choose a branch")
                business.branches.forEach { option ->
                    ChoiceRow(
                        selected = option.id == state.branchId,
                        title = option.name,
                        subtitle = listOfNotNull(
                            option.travelFrom(origin)?.summary,
                            option.location,
                            if (option.queuePaused) "On a short break" else "${peopleLabel(option.queueSize)} waiting",
                        ).joinToString(" · "),
                        onClick = { viewModel.selectBranch(option.id) },
                    )
                }
            }

            if (branch != null) {
                BranchSummary(branch, branch.travelFrom(origin))

                if (branch.services.isNotEmpty()) {
                    SectionTitle(if (branch.services.size > 1) "Choose a service" else "Service")
                    branch.services.forEach { service ->
                        ChoiceRow(
                            selected = service.id == state.serviceId,
                            title = service.name,
                            subtitle = listOfNotNull(
                                service.durationMinutes?.let { "About $it min" },
                                service.description,
                            ).joinToString(" · ").ifBlank { null },
                            onClick = { viewModel.selectService(service.id) },
                        )
                    }
                }

                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    VisitMode.entries.forEachIndexed { index, mode ->
                        SegmentedButton(
                            selected = state.mode == mode,
                            onClick = { viewModel.setMode(mode) },
                            shape = SegmentedButtonDefaults.itemShape(index, VisitMode.entries.size),
                            colors = SegmentedButtonDefaults.colors(
                                activeContainerColor = LimeSoft,
                                activeContentColor = LimeInk,
                            ),
                        ) {
                            Text(if (mode == VisitMode.Join) "Join now" else "Book a visit")
                        }
                    }
                }

                if (state.mode == VisitMode.Join) {
                    PartySizeStepper(state.partySize, viewModel::changePartySize)
                    // Only offer needs this branch says it supports; none selected means no section.
                    if (signedIn && branch.accessibilityOptions.isNotEmpty()) {
                        SectionTitle("Accessibility needs")
                        Text(
                            "Optional. We share these with ${branch.name} so they can be ready for you.",
                            color = TextMuted,
                        )
                        AccessibilityNeedsPicker(
                            selected = state.needs,
                            note = state.note,
                            onToggle = viewModel::toggleNeed,
                            onNoteChange = viewModel::onNote,
                            offered = branch.accessibilityOptions,
                        )
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .toggleable(
                                    value = state.saveNeeds,
                                    role = Role.Checkbox,
                                    onValueChange = viewModel::onSaveNeeds,
                                ),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(
                                checked = state.saveNeeds,
                                onCheckedChange = null,
                                colors = CheckboxDefaults.colors(checkedColor = LimeInk),
                            )
                            Text("Remember these for next time", color = TextPrimary)
                        }
                    }
                    StatusBanner(state.error, isError = true)
                    if (state.alreadyQueued) {
                        TextButton(onClick = onOpenQueue) { Text("Go to My queue", color = LimeInk) }
                    }
                    PrimaryButton(
                        label = when {
                            !signedIn -> "Log in to join the queue"
                            branch.queuePaused -> "On a short break"
                            else -> "Join the queue"
                        },
                        onClick = viewModel::join,
                        loading = state.submitting,
                        enabled = !branch.queuePaused || !signedIn,
                    )
                } else {
                    SectionTitle("Pick a day")
                    val days = viewModel.bookingDays()
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(days, key = { it.toString() }) { day ->
                            SelectChip(
                                label = dayLabel(day),
                                selected = day == state.bookingDay,
                                onClick = { viewModel.selectDay(day) },
                            )
                        }
                    }
                    state.bookingDay?.let { day ->
                        SectionTitle("Pick a time")
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            viewModel.timeSlots(day).forEach { time ->
                                SelectChip(
                                    label = time.format(TIME_FORMAT),
                                    selected = time == state.bookingTime,
                                    onClick = { viewModel.selectTime(time) },
                                )
                            }
                        }
                    }
                    Text(
                        "Bookings hold your spot for the day. Check in from Bookings when you arrive to join the live queue.",
                        color = TextMuted,
                        fontSize = 13.sp,
                    )
                    StatusBanner(state.error, isError = true)
                    PrimaryButton(
                        label = if (signedIn) "Book this visit" else "Log in to book a visit",
                        onClick = viewModel::book,
                        loading = state.submitting,
                    )
                }
            } else {
                Text("This business has no open branches right now.", color = TextMuted)
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

private fun dayLabel(day: LocalDate): String {
    val today = LocalDate.now(NAIROBI)
    return when (day) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        else -> day.format(DAY_FORMAT)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BranchSummary(branch: tech.thewolfgang.queueless.customer.data.Branch, travel: Travel?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(SurfaceCard)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(branch.name, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        travel?.let { Text(it.summary, color = TextPrimary, fontWeight = FontWeight.Medium) }
        listOfNotNull(branch.location, branch.landmark?.let { "Near $it" }, branch.phone).forEach {
            Text(it, color = TextMuted)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (branch.queuePaused) {
                InfoChip("On a short break", warning = true)
            } else {
                InfoChip(if (branch.queueSize == 0) "No wait" else "${peopleLabel(branch.queueSize)} waiting")
                branch.avgWaitMinutes?.takeIf { branch.queueSize > 0 }?.let {
                    MutedChip("~${formatWaitMinutes(it * branch.queueSize)} wait")
                }
            }
        }
        val features = branch.accessibilityOptions.mapNotNull { AccessibilityOptions.byId(it) }
        if (features.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                features.forEach { MutedChip(it.label) }
            }
        }
    }
}

@Composable
private fun PartySizeStepper(size: Int, onChange: (Int) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(SurfaceCard)
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .semantics(mergeDescendants = false) { stateDescription = peopleLabel(size) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text("Party size", color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Text("Including you", color = TextMuted, fontSize = 13.sp)
        }
        IconButton(onClick = { onChange(-1) }, enabled = size > 1) {
            Icon(Icons.Filled.Remove, contentDescription = "Fewer people")
        }
        Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
            Text("$size", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }
        IconButton(onClick = { onChange(1) }, enabled = size < 10) {
            Icon(Icons.Filled.Add, contentDescription = "More people")
        }
    }
}

@Composable
private fun SelectChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        shape = ChipShape,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = LimeSoft,
            selectedLabelColor = LimeInk,
        ),
    )
}
