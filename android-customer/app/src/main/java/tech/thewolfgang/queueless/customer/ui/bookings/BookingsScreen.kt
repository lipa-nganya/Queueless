package tech.thewolfgang.queueless.customer.ui.bookings

import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.ApiException
import tech.thewolfgang.queueless.customer.data.Booking
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.data.JoinQueueRequest
import tech.thewolfgang.queueless.customer.ui.business.NAIROBI
import tech.thewolfgang.queueless.customer.ui.components.InfoChip
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.PrimaryButton
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.theme.CardShape
import tech.thewolfgang.queueless.customer.ui.theme.Danger
import tech.thewolfgang.queueless.customer.ui.theme.GhostButton
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import tech.thewolfgang.queueless.customer.ui.theme.limeButtonColors
import androidx.compose.material3.Button
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val WHEN_FORMAT = DateTimeFormatter.ofPattern("EEE d MMM, h:mm a", Locale.ENGLISH)

data class BookingsUiState(
    val loading: Boolean = true,
    val bookings: List<Booking> = emptyList(),
    val error: String? = null,
    val message: String? = null,
    val busyId: Int? = null,
    val unauthorized: Boolean = false,
)

class BookingsViewModel(private val repository: CustomerRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(BookingsUiState())
    val uiState: StateFlow<BookingsUiState> = _uiState.asStateFlow()

    private val _checkedIn = MutableStateFlow(false)
    val checkedIn: StateFlow<Boolean> = _checkedIn.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            try {
                val bookings = repository.bookings()
                _uiState.update { it.copy(loading = false, bookings = bookings, error = null) }
            } catch (e: ApiException) {
                _uiState.update { it.copy(loading = false, error = e.message, unauthorized = e.statusCode == 401) }
            } catch (e: Exception) {
                _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load your bookings.") }
            }
        }
    }

    fun cancel(booking: Booking) {
        viewModelScope.launch {
            _uiState.update { it.copy(busyId = booking.id, error = null, message = null) }
            try {
                repository.cancelBooking(booking.id)
                _uiState.update {
                    it.copy(
                        busyId = null,
                        bookings = it.bookings.filterNot { b -> b.id == booking.id },
                        message = "Booking cancelled.",
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(busyId = null, error = e.message ?: "Could not cancel the booking.") }
            }
        }
    }

    fun checkIn(booking: Booking) {
        val branchId = booking.branchId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(busyId = booking.id, error = null, message = null) }
            try {
                repository.joinQueue(booking.businessId, JoinQueueRequest(branchId = branchId, bookingId = booking.id))
                _uiState.update { it.copy(busyId = null, bookings = it.bookings.filterNot { b -> b.id == booking.id }) }
                _checkedIn.value = true
            } catch (e: Exception) {
                _uiState.update { it.copy(busyId = null, error = e.message ?: "Could not check in.") }
            }
        }
    }

    fun consumeCheckedIn() {
        _checkedIn.value = false
    }
}

fun formatBookingTime(iso: String): String =
    runCatching { OffsetDateTime.parse(iso).atZoneSameInstant(NAIROBI).format(WHEN_FORMAT) }.getOrDefault(iso)

@Composable
fun BookingsScreen(
    viewModel: BookingsViewModel,
    onDiscover: () -> Unit,
    onCheckedIn: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val checkedIn by viewModel.checkedIn.collectAsStateWithLifecycle()
    var confirmCancel by remember { mutableStateOf<Booking?>(null) }

    LaunchedEffect(checkedIn) {
        if (checkedIn) {
            viewModel.consumeCheckedIn()
            onCheckedIn()
        }
    }
    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    Column(Modifier.fillMaxSize()) {
        TopBar()
        if (state.loading) {
            LoadingState("Loading your bookings…")
            return@Column
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ScreenTitle(title = "Bookings", subtitle = "Check in when you arrive to join the live queue.")
            }
            item { StatusBanner(state.error, isError = true) }
            item { StatusBanner(state.message, isError = false) }
            if (state.bookings.isEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("No upcoming bookings.", color = TextMuted)
                        PrimaryButton(label = "Find a place", onClick = onDiscover)
                    }
                }
            }
            items(state.bookings, key = { it.id }) { booking ->
                BookingCard(
                    booking = booking,
                    busy = state.busyId == booking.id,
                    onCheckIn = { viewModel.checkIn(booking) },
                    onCancel = { confirmCancel = booking },
                )
            }
            item { Spacer(Modifier.height(12.dp)) }
        }
    }

    confirmCancel?.let { booking ->
        AlertDialog(
            onDismissRequest = { confirmCancel = null },
            title = { Text("Cancel this booking?") },
            text = { Text("${booking.businessName.orEmpty()} · ${formatBookingTime(booking.scheduledFor)}") },
            confirmButton = {
                TextButton(onClick = {
                    confirmCancel = null
                    viewModel.cancel(booking)
                }) { Text("Cancel booking", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { confirmCancel = null }) { Text("Keep it", color = LimeInk) }
            },
        )
    }
}

@Composable
private fun BookingCard(booking: Booking, busy: Boolean, onCheckIn: () -> Unit, onCancel: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(SurfaceCard)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(booking.businessName.orEmpty(), color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        Text(formatBookingTime(booking.scheduledFor), color = TextPrimary, fontWeight = FontWeight.Medium)
        Text(
            listOfNotNull(
                booking.branchName?.takeIf { booking.branchCount > 1 },
                booking.serviceName,
                booking.location,
            ).joinToString(" · "),
            color = TextMuted,
        )
        if (booking.branchQueuePaused) InfoChip("Branch on a short break", warning = true)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
            Button(
                onClick = onCheckIn,
                enabled = !busy && !booking.branchQueuePaused,
                colors = limeButtonColors(),
                modifier = Modifier.weight(1f),
            ) { Text(if (busy) "Working…" else "Check in") }
            GhostButton(onClick = onCancel, enabled = !busy, modifier = Modifier.weight(1f)) {
                Text("Cancel")
            }
        }
    }
}
