package tech.thewolfgang.queueless.vendor.ui.businesses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessSummary
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class BusinessesUiState(
    val loading: Boolean = true,
    val businesses: List<BusinessSummary> = emptyList(),
    val error: String? = null,
    val autoOpenId: Int? = null,
    val unauthorized: Boolean = false,
)

class BusinessesViewModel(
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(BusinessesUiState())
    val uiState: StateFlow<BusinessesUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, autoOpenId = null) }
            try {
                val businesses = repository.businesses()
                val autoOpen = businesses.singleOrNull()?.id
                _uiState.update {
                    it.copy(
                        loading = false,
                        businesses = businesses,
                        autoOpenId = autoOpen,
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
                    it.copy(loading = false, error = e.message ?: "Could not load businesses.")
                }
            }
        }
    }

    fun consumeAutoOpen() {
        _uiState.update { it.copy(autoOpenId = null) }
    }

    companion object {
        fun factory(repository: VendorRepository) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return BusinessesViewModel(repository) as T
            }
        }
    }
}
