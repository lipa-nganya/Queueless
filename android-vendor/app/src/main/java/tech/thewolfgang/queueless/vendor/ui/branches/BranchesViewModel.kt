package tech.thewolfgang.queueless.vendor.ui.branches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class BranchesUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val businessName: String? = null,
    val branches: List<BusinessProfile> = emptyList(),
    val editingId: Int? = null,
    val name: String = "",
    val location: String = "",
    val phone: String = "",
    val isActive: Boolean = true,
    val error: String? = null,
    val savedMessage: String? = null,
    val unauthorized: Boolean = false,
)

class BranchesViewModel(
    private val branchId: Int,
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(BranchesUiState())
    val uiState: StateFlow<BranchesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val data = repository.branches(branchId)
                _uiState.update {
                    it.copy(
                        loading = false,
                        businessName = listOfNotNull(data.businessName, data.businessGroupName)
                            .joinToString(" · ")
                            .ifBlank { null },
                        branches = data.branches,
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
                    it.copy(loading = false, error = e.message ?: "Could not load branches.")
                }
            }
        }
    }

    fun startCreate() {
        _uiState.update {
            it.copy(
                editingId = null,
                name = "",
                location = "",
                phone = "",
                isActive = true,
                error = null,
                savedMessage = null,
            )
        }
    }

    fun startEdit(branch: BusinessProfile) {
        _uiState.update {
            it.copy(
                editingId = branch.id,
                name = branch.name,
                location = branch.location.orEmpty(),
                phone = branch.phone.orEmpty(),
                isActive = branch.isActive,
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onNameChange(value: String) {
        _uiState.update { it.copy(name = value, error = null, savedMessage = null) }
    }

    fun onLocationChange(value: String) {
        _uiState.update { it.copy(location = value, error = null, savedMessage = null) }
    }

    fun onPhoneChange(value: String) {
        _uiState.update { it.copy(phone = value, error = null, savedMessage = null) }
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
                if (state.editingId != null) {
                    repository.updateBranchDetails(
                        branchId = state.editingId,
                        name = name,
                        location = state.location.trim().ifBlank { null },
                        phone = state.phone.trim().ifBlank { null },
                        isActive = state.isActive,
                    )
                } else {
                    repository.createBranch(
                        branchId = branchId,
                        name = name,
                        location = state.location.trim().ifBlank { null },
                        phone = state.phone.trim().ifBlank { null },
                        isActive = state.isActive,
                    )
                }
                val data = repository.branches(branchId)
                _uiState.update {
                    it.copy(
                        saving = false,
                        branches = data.branches,
                        businessName = listOfNotNull(data.businessName, data.businessGroupName)
                            .joinToString(" · ")
                            .ifBlank { null },
                        editingId = null,
                        name = "",
                        location = "",
                        phone = "",
                        isActive = true,
                        savedMessage = if (state.editingId != null) "Branch updated." else "Branch added.",
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
                    it.copy(saving = false, error = e.message ?: "Could not save branch.")
                }
            }
        }
    }

    companion object {
        fun factory(branchId: Int, repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return BranchesViewModel(branchId, repository) as T
                }
            }
    }
}
