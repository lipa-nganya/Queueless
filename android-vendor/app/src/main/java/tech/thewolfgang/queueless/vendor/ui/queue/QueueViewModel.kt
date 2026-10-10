package tech.thewolfgang.queueless.vendor.ui.queue

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.AddWalkInRequest
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessService
import tech.thewolfgang.queueless.vendor.data.QueueEntry
import tech.thewolfgang.queueless.vendor.data.QueueResponse
import tech.thewolfgang.queueless.vendor.data.UpdateWalkInRequest
import tech.thewolfgang.queueless.vendor.data.VendorRepository

enum class QueueFilter(val label: String) {
    All("All"),
    WalkIns("Walk-ins"),
    App("App"),
}

data class WalkInSheetState(
    val editingEntryId: Int? = null,
    val branchId: Int,
    val serviceId: Int? = null,
    val services: List<BusinessService> = emptyList(),
    val loadingServices: Boolean = false,
    val name: String = "",
    val phone: String = "",
    val partySize: Int = 1,
    val saving: Boolean = false,
    val error: String? = null,
)

data class QueueUiState(
    val loading: Boolean = true,
    val data: QueueResponse? = null,
    val error: String? = null,
    val notice: String? = null,
    val actionBusy: Boolean = false,
    val unauthorized: Boolean = false,
    val filter: QueueFilter = QueueFilter.All,
    val walkInSheet: WalkInSheetState? = null,
)

class QueueViewModel(
    private val businessId: Int,
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(QueueUiState())
    val uiState: StateFlow<QueueUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null
    private var pollingEnabled = false

    fun startPolling() {
        if (pollingEnabled) return
        pollingEnabled = true
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            refresh(initial = true)
            while (isActive && pollingEnabled) {
                delay(pollDelayMs(_uiState.value.data))
                if (pollingEnabled) refresh(initial = false)
            }
        }
    }

    fun stopPolling() {
        pollingEnabled = false
        pollJob?.cancel()
        pollJob = null
    }

    private fun pollDelayMs(data: QueueResponse?): Long {
        val waiting = data?.business?.waitingTotal
            ?: data?.entries?.sumOf { it.partySize.coerceAtLeast(1) }
            ?: 0
        return when {
            waiting <= 0 -> POLL_MS_EMPTY
            waiting <= 3 -> POLL_MS
            else -> POLL_MS_BUSY
        }
    }

    fun refresh(initial: Boolean) {
        viewModelScope.launch {
            if (initial) {
                _uiState.update { it.copy(loading = true, error = null) }
            }
            try {
                val data = repository.queue(businessId)
                if (!initial && _uiState.value.data == data) return@launch
                _uiState.update {
                    it.copy(loading = false, data = data, error = null)
                }
            } catch (e: ApiException) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        error = e.message,
                        unauthorized = e.statusCode == 401,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        error = e.message ?: "Could not load the queue.",
                    )
                }
            }
        }
    }

    fun setFilter(filter: QueueFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    fun openAddWalkIn() {
        _uiState.update { it.copy(walkInSheet = WalkInSheetState(branchId = businessId), notice = null) }
        loadSheetServices(businessId, preselect = null)
    }

    fun openEditWalkIn(entry: QueueEntry) {
        val branchId = entry.branchId ?: businessId
        _uiState.update {
            it.copy(
                walkInSheet = WalkInSheetState(
                    editingEntryId = entry.id,
                    branchId = branchId,
                    serviceId = entry.serviceId,
                ),
                notice = null,
            )
        }
        loadSheetServices(branchId, preselect = entry.serviceId)
    }

    fun closeWalkInSheet() {
        _uiState.update { it.copy(walkInSheet = null) }
    }

    fun onSheetBranch(branchId: Int) {
        updateSheet { it.copy(branchId = branchId, serviceId = null) }
        loadSheetServices(branchId, preselect = null)
    }

    fun onSheetService(serviceId: Int) = updateSheet { it.copy(serviceId = serviceId, error = null) }

    fun onSheetName(value: String) = updateSheet { it.copy(name = value.take(80)) }

    fun onSheetPhone(value: String) = updateSheet { it.copy(phone = value.take(16)) }

    fun onSheetPartySize(value: Int) = updateSheet { it.copy(partySize = value.coerceIn(1, 10)) }

    fun submitWalkIn() {
        val sheet = _uiState.value.walkInSheet ?: return
        if (sheet.services.isNotEmpty() && sheet.serviceId == null) {
            updateSheet { it.copy(error = "Choose the service this guest is here for.") }
            return
        }
        viewModelScope.launch {
            updateSheet { it.copy(saving = true, error = null) }
            try {
                if (sheet.editingEntryId != null) {
                    repository.updateWalkIn(
                        sheet.editingEntryId,
                        UpdateWalkInRequest(branchId = sheet.branchId, serviceId = sheet.serviceId),
                    )
                } else {
                    repository.addWalkIn(
                        businessId,
                        AddWalkInRequest(
                            branchId = sheet.branchId,
                            serviceId = sheet.serviceId,
                            name = sheet.name.trim().ifBlank { null },
                            phone = sheet.phone.trim().ifBlank { null },
                            partySize = sheet.partySize,
                        ),
                    )
                }
                val branchName = _uiState.value.data?.branches?.find { it.id == sheet.branchId }?.name
                val notice = when {
                    sheet.editingEntryId != null -> "Walk-in updated."
                    sheet.branchId == businessId || branchName == null -> "Walk-in added to the queue."
                    else -> "Walk-in added to $branchName."
                }
                _uiState.update { it.copy(walkInSheet = null, notice = notice) }
                refresh(initial = false)
            } catch (e: Exception) {
                updateSheet { it.copy(saving = false, error = e.message ?: "Could not save the walk-in.") }
            }
        }
    }

    private fun updateSheet(change: (WalkInSheetState) -> WalkInSheetState) {
        _uiState.update { state -> state.copy(walkInSheet = state.walkInSheet?.let(change)) }
    }

    private fun loadSheetServices(branchId: Int, preselect: Int?) {
        val cached = _uiState.value.data?.takeIf { branchId == businessId }?.services
        if (cached != null) {
            applySheetServices(branchId, cached, preselect)
            return
        }
        updateSheet { it.copy(loadingServices = true, services = emptyList()) }
        viewModelScope.launch {
            try {
                val services = repository.services(branchId).filter { it.isActive }
                applySheetServices(branchId, services, preselect)
            } catch (e: Exception) {
                updateSheet { it.copy(loadingServices = false, error = e.message ?: "Could not load services.") }
            }
        }
    }

    private fun applySheetServices(branchId: Int, services: List<BusinessService>, preselect: Int?) {
        updateSheet { sheet ->
            if (sheet.branchId != branchId) return@updateSheet sheet
            sheet.copy(
                services = services,
                loadingServices = false,
                serviceId = preselect?.takeIf { id -> services.any { it.id == id } }
                    ?: services.singleOrNull()?.id,
            )
        }
    }

    fun toggleQueuePause() {
        val paused = _uiState.value.data?.business?.queuePaused ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(actionBusy = true, error = null) }
            try {
                repository.setQueuePaused(businessId, !paused)
                refresh(initial = false)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Could not update queue pause.") }
            } finally {
                _uiState.update { it.copy(actionBusy = false) }
            }
        }
    }

    fun serve(entry: QueueEntry) {
        viewModelScope.launch {
            _uiState.update { it.copy(actionBusy = true, error = null) }
            try {
                repository.serve(entry.id)
                refresh(initial = false)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Serve failed.") }
            } finally {
                _uiState.update { it.copy(actionBusy = false) }
            }
        }
    }

    fun noShow(entry: QueueEntry) {
        viewModelScope.launch {
            _uiState.update { it.copy(actionBusy = true, error = null) }
            try {
                repository.noShow(entry.id)
                refresh(initial = false)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "No-show failed.") }
            } finally {
                _uiState.update { it.copy(actionBusy = false) }
            }
        }
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }

    companion object {
        private const val POLL_MS = 12_000L
        private const val POLL_MS_EMPTY = 45_000L
        private const val POLL_MS_BUSY = 15_000L

        fun factory(businessId: Int, repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return QueueViewModel(businessId, repository) as T
                }
            }
    }
}
