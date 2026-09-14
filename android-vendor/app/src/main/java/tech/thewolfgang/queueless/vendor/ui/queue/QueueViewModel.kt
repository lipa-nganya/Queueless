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
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.QueueEntry
import tech.thewolfgang.queueless.vendor.data.QueueResponse
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class QueueUiState(
    val loading: Boolean = true,
    val data: QueueResponse? = null,
    val error: String? = null,
    val actionBusy: Boolean = false,
    val unauthorized: Boolean = false,
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

    fun adjustWalkIns(delta: Int) {
        val current = _uiState.value.data?.business?.queueSize ?: return
        val next = (current + delta).coerceIn(0, 500)
        viewModelScope.launch {
            _uiState.update { it.copy(actionBusy = true, error = null) }
            try {
                repository.setWalkIns(businessId, next)
                refresh(initial = false)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Could not update walk-ins.") }
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
        private const val POLL_MS = 8_000L
        private const val POLL_MS_EMPTY = 20_000L
        private const val POLL_MS_BUSY = 12_000L

        fun factory(businessId: Int, repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return QueueViewModel(businessId, repository) as T
                }
            }
    }
}
