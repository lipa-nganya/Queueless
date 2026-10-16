package tech.thewolfgang.queueless.customer.ui.queue

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.ApiException
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.data.QueueEntry
import tech.thewolfgang.queueless.customer.ui.components.InfoChip
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.PrimaryButton
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.customer.ui.components.peopleLabel
import tech.thewolfgang.queueless.customer.ui.theme.Danger
import tech.thewolfgang.queueless.customer.ui.theme.GhostButton
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.Navy
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import tech.thewolfgang.queueless.customer.ui.theme.limeCard
import androidx.compose.foundation.layout.Box

/** Same cadence as the customer web app: poll faster only when someone is near the front. */
private fun queuePollDelay(entries: List<QueueEntry>): Long {
    if (entries.isEmpty()) return 45_000L
    val soonest = entries.minOf { it.position }
    return when {
        soonest <= 3 -> 12_000L
        soonest <= 8 -> 25_000L
        else -> 60_000L
    }
}

data class MyQueueUiState(
    val loading: Boolean = true,
    val entries: List<QueueEntry> = emptyList(),
    val error: String? = null,
    val message: String? = null,
    val leavingId: Int? = null,
    val unauthorized: Boolean = false,
)

class MyQueueViewModel(private val repository: CustomerRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(MyQueueUiState())
    val uiState: StateFlow<MyQueueUiState> = _uiState.asStateFlow()

    suspend fun refresh() {
        try {
            val entries = repository.myQueue()
            _uiState.update { it.copy(loading = false, entries = entries, error = null, unauthorized = false) }
        } catch (e: ApiException) {
            _uiState.update { it.copy(loading = false, error = e.message, unauthorized = e.statusCode == 401) }
        } catch (e: Exception) {
            _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load your queue.") }
        }
    }

    fun dismissMessage() {
        _uiState.update { it.copy(message = null) }
    }

    fun leave(entry: QueueEntry) {
        viewModelScope.launch {
            _uiState.update { it.copy(leavingId = entry.id, error = null, message = null) }
            try {
                repository.leaveQueue(entry.id)
                _uiState.update {
                    it.copy(
                        leavingId = null,
                        entries = it.entries.filterNot { e -> e.id == entry.id },
                        message = "You left the queue at ${entry.businessName}.",
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(leavingId = null, error = e.message ?: "Could not leave the queue.") }
            }
        }
    }
}

@Composable
fun MyQueueScreen(
    viewModel: MyQueueViewModel,
    onDiscover: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var confirmLeave by remember { mutableStateOf<QueueEntry?>(null) }

    LaunchedEffect(lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                viewModel.refresh()
                delay(queuePollDelay(viewModel.uiState.value.entries))
            }
        }
    }
    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    Column(Modifier.fillMaxSize()) {
        TopBar()
        if (state.loading) {
            LoadingState("Loading your queue…")
            return@Column
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ScreenTitle(
                    title = "My queue",
                    subtitle = "Your place updates automatically. Head over when you're close to the front.",
                )
            }
            item { StatusBanner(state.error, isError = true) }
            item { StatusBanner(state.message, isError = false) }
            if (state.entries.isEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("You're not in any queue right now.", color = TextMuted)
                        PrimaryButton(label = "Find a place", onClick = onDiscover)
                    }
                }
            }
            items(state.entries, key = { it.id }) { entry ->
                QueueEntryCard(
                    entry = entry,
                    leaving = state.leavingId == entry.id,
                    onLeave = { confirmLeave = entry },
                )
            }
            item { Spacer(Modifier.height(12.dp)) }
        }
    }

    confirmLeave?.let { entry ->
        AlertDialog(
            onDismissRequest = { confirmLeave = null },
            title = { Text("Leave this queue?") },
            text = { Text("You'll lose your place at ${entry.businessName}.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmLeave = null
                    viewModel.leave(entry)
                }) { Text("Leave queue", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { confirmLeave = null }) { Text("Stay", color = LimeInk) }
            },
        )
    }
}

@Composable
private fun QueueEntryCard(entry: QueueEntry, leaving: Boolean, onLeave: () -> Unit) {
    val atFront = entry.peopleAhead == 0
    val positionText = if (atFront) "You're next" else "Position ${entry.position}"
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .limeCard()
            .padding(18.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(entry.businessName, color = Navy, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            Text(
                listOfNotNull(entry.branchName, entry.serviceName).joinToString(" · "),
                color = Navy.copy(alpha = 0.75f),
            )
            Text(
                text = positionText,
                color = Navy,
                fontWeight = FontWeight.Bold,
                fontSize = 30.sp,
                modifier = Modifier.semantics {
                    contentDescription = if (atFront) {
                        "You're next at ${entry.businessName}"
                    } else {
                        "Position ${entry.position}, ${peopleLabel(entry.peopleAhead)} ahead of you"
                    }
                },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (!atFront) InfoChip("${peopleLabel(entry.peopleAhead)} ahead")
                InfoChip("About ${formatWaitMinutes(entry.estimatedWaitMinutes)}")
                if (entry.partySize > 1) InfoChip("Party of ${entry.partySize}")
            }
            entry.location?.let { Text(it, color = Navy.copy(alpha = 0.7f), fontSize = 13.sp) }
            if (entry.accessibilityNeedLabels.isNotEmpty()) {
                Text(
                    "Shared needs: ${entry.accessibilityNeedLabels.joinToString(", ")}",
                    color = Navy.copy(alpha = 0.7f),
                    fontSize = 13.sp,
                )
            }
            GhostButton(onClick = onLeave, enabled = !leaving, modifier = Modifier.padding(top = 6.dp)) {
                Text(if (leaving) "Leaving…" else "Leave queue", color = TextPrimary)
            }
        }
    }
}
