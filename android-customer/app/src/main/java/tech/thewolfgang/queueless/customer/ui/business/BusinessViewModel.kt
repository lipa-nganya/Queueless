package tech.thewolfgang.queueless.customer.ui.business

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.ApiException
import tech.thewolfgang.queueless.customer.data.BookingRequest
import tech.thewolfgang.queueless.customer.data.Branch
import tech.thewolfgang.queueless.customer.data.Business
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.data.JoinQueueRequest
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

val NAIROBI: ZoneId = ZoneId.of("Africa/Nairobi")
private const val BOOKING_WINDOW_DAYS = 14L
private const val MAX_PARTY_SIZE = 10

enum class VisitMode { Join, Book }

data class BusinessUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val message: String? = null,
    val business: Business? = null,
    val branchId: Int? = null,
    val serviceId: Int? = null,
    val mode: VisitMode = VisitMode.Join,
    val partySize: Int = 1,
    val needs: List<String> = emptyList(),
    val note: String = "",
    val saveNeeds: Boolean = true,
    val bookingDay: LocalDate? = null,
    val bookingTime: LocalTime? = null,
    val submitting: Boolean = false,
    val alreadyQueued: Boolean = false,
    val profileLoaded: Boolean = false,
) {
    val branch: Branch? get() = business?.branches?.firstOrNull { it.id == branchId }
}

sealed interface BusinessEvent {
    data class RequireLogin(val reason: String) : BusinessEvent
    data object Joined : BusinessEvent
    data object Booked : BusinessEvent
}

class BusinessViewModel(
    private val businessId: Int,
    private val repository: CustomerRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(BusinessUiState())
    val uiState: StateFlow<BusinessUiState> = _uiState.asStateFlow()

    private val _events = MutableStateFlow<BusinessEvent?>(null)
    val events: StateFlow<BusinessEvent?> = _events.asStateFlow()

    val signedIn get() = repository.signedIn

    init {
        load()
    }

    fun consumeEvent() {
        _events.value = null
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = it.business == null, error = null) }
            try {
                val business = repository.business(businessId)
                val me = if (repository.hasSession()) runCatching { repository.me() }.getOrNull() else null
                _uiState.update { state ->
                    val keepBranch = business.branches.firstOrNull { it.id == state.branchId }
                    val branch = keepBranch
                        ?: business.branches.firstOrNull { !it.queuePaused }
                        ?: business.branches.firstOrNull()
                    state.copy(
                        loading = false,
                        business = business,
                        branchId = branch?.id,
                        serviceId = defaultService(branch, state.serviceId),
                        needs = if (!state.profileLoaded && me != null) me.accessibilityNeeds else state.needs,
                        note = if (!state.profileLoaded && me != null) me.accessibilityNote.orEmpty() else state.note,
                        profileLoaded = state.profileLoaded || me != null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load this business.") }
            }
        }
    }

    /** Prefills saved accessibility needs after the customer logs in from this screen. */
    fun refreshProfile() {
        if (!repository.hasSession() || _uiState.value.profileLoaded) return
        viewModelScope.launch {
            val me = runCatching { repository.me() }.getOrNull() ?: return@launch
            _uiState.update {
                if (it.profileLoaded) it else it.copy(
                    needs = me.accessibilityNeeds,
                    note = me.accessibilityNote.orEmpty(),
                    profileLoaded = true,
                )
            }
        }
    }

    private fun defaultService(branch: Branch?, current: Int?): Int? {
        val services = branch?.services.orEmpty()
        return when {
            services.any { it.id == current } -> current
            services.size == 1 -> services.first().id
            else -> null
        }
    }

    fun selectBranch(branchId: Int) = _uiState.update { state ->
        val branch = state.business?.branches?.firstOrNull { it.id == branchId }
        state.copy(
            branchId = branchId,
            serviceId = defaultService(branch, null),
            error = null,
            message = null,
            alreadyQueued = false,
        )
    }

    fun selectService(serviceId: Int) = _uiState.update { it.copy(serviceId = serviceId, error = null) }

    fun setMode(mode: VisitMode) = _uiState.update { it.copy(mode = mode, error = null, message = null) }

    fun changePartySize(delta: Int) = _uiState.update {
        it.copy(partySize = (it.partySize + delta).coerceIn(1, MAX_PARTY_SIZE))
    }

    fun toggleNeed(id: String) = _uiState.update {
        it.copy(needs = if (id in it.needs) it.needs - id else it.needs + id)
    }

    fun onNote(value: String) = _uiState.update { it.copy(note = value) }

    fun onSaveNeeds(value: Boolean) = _uiState.update { it.copy(saveNeeds = value) }

    fun selectDay(day: LocalDate) = _uiState.update {
        val time = it.bookingTime?.takeIf { t -> t in timeSlots(day) }
        it.copy(bookingDay = day, bookingTime = time, error = null)
    }

    fun selectTime(time: LocalTime) = _uiState.update { it.copy(bookingTime = time, error = null) }

    fun bookingDays(): List<LocalDate> {
        val today = LocalDate.now(NAIROBI)
        return (0 until BOOKING_WINDOW_DAYS).map { today.plusDays(it) }.filter { timeSlots(it).isNotEmpty() }
    }

    /** Half-hour slots 07:00–19:30, at least 15 minutes from now. */
    fun timeSlots(day: LocalDate): List<LocalTime> {
        val earliest = ZonedDateTime.now(NAIROBI).plusMinutes(15)
        return (14..39).map { LocalTime.of(it / 2, (it % 2) * 30) }
            .filter { ZonedDateTime.of(day, it, NAIROBI).isAfter(earliest) }
    }

    private fun validateService(state: BusinessUiState): String? {
        val services = state.branch?.services.orEmpty()
        return if (services.size > 1 && services.none { it.id == state.serviceId }) "Choose a service first." else null
    }

    fun join() {
        val state = _uiState.value
        val branch = state.branch ?: return
        if (!repository.hasSession()) {
            _events.value = BusinessEvent.RequireLogin("Log in to join the queue.")
            return
        }
        if (branch.queuePaused) {
            _uiState.update { it.copy(error = "${branch.name} is on a short break. Pick another branch or try again shortly.") }
            return
        }
        validateService(state)?.let { msg -> _uiState.update { it.copy(error = msg) }; return }
        viewModelScope.launch {
            _uiState.update { it.copy(submitting = true, error = null, message = null) }
            try {
                val note = state.note.trim().ifBlank { null }
                repository.joinQueue(
                    businessId,
                    JoinQueueRequest(
                        branchId = branch.id,
                        serviceId = state.serviceId,
                        partySize = state.partySize,
                        accessibilityNeeds = state.needs,
                        accessibilityNote = note,
                    ),
                )
                if (state.saveNeeds) runCatching { repository.saveAccessibility(state.needs, note) }
                _uiState.update { it.copy(submitting = false) }
                _events.value = BusinessEvent.Joined
            } catch (e: ApiException) {
                _uiState.update {
                    it.copy(
                        submitting = false,
                        error = e.message,
                        alreadyQueued = e.statusCode == 409 && e.payload?.queuePaused != true,
                    )
                }
                if (e.statusCode == 401) _events.value = BusinessEvent.RequireLogin("Log in again to join the queue.")
            } catch (e: Exception) {
                _uiState.update { it.copy(submitting = false, error = e.message ?: "Could not join the queue.") }
            }
        }
    }

    fun book() {
        val state = _uiState.value
        val branch = state.branch ?: return
        if (!repository.hasSession()) {
            _events.value = BusinessEvent.RequireLogin("Log in to book a visit.")
            return
        }
        validateService(state)?.let { msg -> _uiState.update { it.copy(error = msg) }; return }
        val day = state.bookingDay
        val time = state.bookingTime
        if (day == null || time == null) {
            _uiState.update { it.copy(error = "Pick a day and time for your visit.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(submitting = true, error = null, message = null) }
            try {
                repository.book(
                    businessId,
                    BookingRequest(
                        branchId = branch.id,
                        serviceId = state.serviceId,
                        scheduledFor = ZonedDateTime.of(day, time, NAIROBI).toOffsetDateTime().toString(),
                    ),
                )
                _uiState.update { it.copy(submitting = false) }
                _events.value = BusinessEvent.Booked
            } catch (e: ApiException) {
                _uiState.update { it.copy(submitting = false, error = e.message) }
                if (e.statusCode == 401) _events.value = BusinessEvent.RequireLogin("Log in again to book a visit.")
            } catch (e: Exception) {
                _uiState.update { it.copy(submitting = false, error = e.message ?: "Could not book this visit.") }
            }
        }
    }

    fun imageUrl(path: String?) = repository.imageUrl(path)
}
