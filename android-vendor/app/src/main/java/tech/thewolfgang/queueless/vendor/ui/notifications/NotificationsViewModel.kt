package tech.thewolfgang.queueless.vendor.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.VendorNotification
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class NotificationsUiState(
    val loading: Boolean = true,
    val notifications: List<VendorNotification> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null,
    val unauthorized: Boolean = false,
)

class NotificationsViewModel(
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = it.notifications.isEmpty(), error = null) }
            try {
                val result = repository.notifications()
                _uiState.update {
                    it.copy(
                        loading = false,
                        notifications = result.notifications,
                        unreadCount = result.unreadCount,
                    )
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
                    it.copy(loading = false, error = e.message ?: "Could not load notifications.")
                }
            }
        }
    }

    fun markRead(notification: VendorNotification) {
        if (notification.read) return
        _uiState.update { state ->
            state.copy(
                notifications = state.notifications.map {
                    if (it.id == notification.id) it.copy(read = true) else it
                },
                unreadCount = (state.unreadCount - 1).coerceAtLeast(0),
            )
        }
        viewModelScope.launch {
            runCatching { repository.markNotificationsRead(listOf(notification.id)) }
        }
    }

    fun markAllRead() {
        _uiState.update { state ->
            state.copy(
                notifications = state.notifications.map { it.copy(read = true) },
                unreadCount = 0,
            )
        }
        viewModelScope.launch {
            runCatching { repository.markNotificationsRead() }
                .onFailure { refresh() }
        }
    }

    companion object {
        fun factory(repository: VendorRepository) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return NotificationsViewModel(repository) as T
            }
        }
    }
}
