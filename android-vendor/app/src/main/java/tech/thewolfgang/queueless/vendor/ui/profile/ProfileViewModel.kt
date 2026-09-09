package tech.thewolfgang.queueless.vendor.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class ProfileUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val name: String = "",
    val operatingHours: String = "",
    val isActive: Boolean = true,
    val groupName: String? = null,
    val error: String? = null,
    val savedMessage: String? = null,
    val unauthorized: Boolean = false,
)

class ProfileViewModel(
    private val businessId: Int,
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, savedMessage = null) }
            try {
                val business = repository.business(businessId)
                _uiState.update {
                    it.copy(
                        loading = false,
                        name = business.name,
                        operatingHours = business.operatingHours.orEmpty(),
                        isActive = business.isActive,
                        groupName = business.businessGroupName,
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
                    it.copy(loading = false, error = e.message ?: "Could not load profile.")
                }
            }
        }
    }

    fun onNameChange(value: String) {
        _uiState.update { it.copy(name = value, error = null, savedMessage = null) }
    }

    fun onOperatingHoursChange(value: String) {
        _uiState.update { it.copy(operatingHours = value, error = null, savedMessage = null) }
    }

    fun onActiveChange(value: Boolean) {
        _uiState.update { it.copy(isActive = value, error = null, savedMessage = null) }
    }

    fun save() {
        val state = _uiState.value
        val name = state.name.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(error = "Branch name is required.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, savedMessage = null) }
            try {
                val updated = repository.updateBusiness(
                    businessId = businessId,
                    name = name,
                    operatingHours = state.operatingHours.trim().ifBlank { null },
                    isActive = state.isActive,
                )
                _uiState.update {
                    it.copy(
                        saving = false,
                        name = updated.name,
                        operatingHours = updated.operatingHours.orEmpty(),
                        isActive = updated.isActive,
                        groupName = updated.businessGroupName,
                        savedMessage = "Saved.",
                    )
                }
            } catch (e: ApiException) {
                _uiState.update {
                    it.copy(
                        saving = false,
                        error = e.message,
                        unauthorized = e.statusCode == 401,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(saving = false, error = e.message ?: "Could not save profile.")
                }
            }
        }
    }

    companion object {
        fun factory(businessId: Int, repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return ProfileViewModel(businessId, repository) as T
                }
            }
    }
}
