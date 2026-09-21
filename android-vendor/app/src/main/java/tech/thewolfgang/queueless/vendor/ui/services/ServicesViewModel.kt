package tech.thewolfgang.queueless.vendor.ui.services

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.data.BusinessService
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class ServicesUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val branchId: Int = 0,
    val branchName: String = "",
    val businessName: String? = null,
    val location: String? = null,
    val siblingBranches: List<BusinessProfile> = emptyList(),
    val services: List<BusinessService> = emptyList(),
    val editingId: Int? = null,
    val name: String = "",
    val durationMinutes: String = "15",
    val description: String = "",
    val isActive: Boolean = true,
    val error: String? = null,
    val savedMessage: String? = null,
    val unauthorized: Boolean = false,
) {
    val branchMeta: String?
        get() = listOfNotNull(businessName, location)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString(" · ")
            .ifBlank { null }
}

class ServicesViewModel(
    private val branchId: Int,
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ServicesUiState(branchId = branchId))
    val uiState: StateFlow<ServicesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val businessDeferred = async { repository.business(branchId) }
                val branchesDeferred = async { repository.branches(branchId) }
                val servicesDeferred = async { repository.services(branchId) }
                val business = businessDeferred.await()
                val branches = branchesDeferred.await()
                val services = servicesDeferred.await()
                _uiState.update {
                    it.copy(
                        loading = false,
                        branchId = business.id,
                        branchName = business.name,
                        businessName = business.businessName ?: branches.businessName,
                        location = business.location,
                        siblingBranches = branches.branches,
                        services = services,
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
                    it.copy(loading = false, error = e.message ?: "Could not load services.")
                }
            }
        }
    }

    fun startCreate() {
        _uiState.update {
            it.copy(
                editingId = null,
                name = "",
                durationMinutes = "15",
                description = "",
                isActive = true,
                error = null,
                savedMessage = null,
            )
        }
    }

    fun startEdit(service: BusinessService) {
        _uiState.update {
            it.copy(
                editingId = service.id,
                name = service.name,
                durationMinutes = service.durationMinutes.toString(),
                description = service.description.orEmpty(),
                isActive = service.isActive,
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onNameChange(value: String) {
        _uiState.update { it.copy(name = value, error = null, savedMessage = null) }
    }

    fun onDurationChange(value: String) {
        _uiState.update {
            it.copy(
                durationMinutes = value.filter { ch -> ch.isDigit() }.take(4),
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onDescriptionChange(value: String) {
        _uiState.update { it.copy(description = value, error = null, savedMessage = null) }
    }

    fun onActiveChange(value: Boolean) {
        _uiState.update { it.copy(isActive = value, error = null, savedMessage = null) }
    }

    fun save() {
        val state = _uiState.value
        val name = state.name.trim()
        val duration = state.durationMinutes.toIntOrNull()
        if (name.isBlank()) {
            _uiState.update { it.copy(error = "Service name is required.") }
            return
        }
        if (duration == null || duration < 1 || duration > 1440) {
            _uiState.update { it.copy(error = "Service period must be 1–1440 minutes.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, savedMessage = null) }
            try {
                if (state.editingId != null) {
                    repository.updateService(
                        branchId = branchId,
                        serviceId = state.editingId,
                        name = name,
                        durationMinutes = duration,
                        description = state.description.trim().ifBlank { null },
                        isActive = state.isActive,
                    )
                } else {
                    repository.createService(
                        branchId = branchId,
                        name = name,
                        durationMinutes = duration,
                        description = state.description.trim().ifBlank { null },
                        isActive = state.isActive,
                    )
                }
                val services = repository.services(branchId)
                _uiState.update {
                    it.copy(
                        saving = false,
                        services = services,
                        editingId = null,
                        name = "",
                        durationMinutes = "15",
                        description = "",
                        isActive = true,
                        savedMessage = if (state.editingId != null) "Service updated." else "Service added.",
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
                    it.copy(saving = false, error = e.message ?: "Could not save service.")
                }
            }
        }
    }

    fun delete(serviceId: Int) {
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, savedMessage = null) }
            try {
                repository.deleteService(branchId, serviceId)
                val services = repository.services(branchId)
                _uiState.update {
                    it.copy(
                        saving = false,
                        services = services,
                        editingId = if (it.editingId == serviceId) null else it.editingId,
                        savedMessage = "Service deleted.",
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
                    it.copy(saving = false, error = e.message ?: "Could not delete service.")
                }
            }
        }
    }

    companion object {
        fun factory(branchId: Int, repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return ServicesViewModel(branchId, repository) as T
                }
            }
    }
}
