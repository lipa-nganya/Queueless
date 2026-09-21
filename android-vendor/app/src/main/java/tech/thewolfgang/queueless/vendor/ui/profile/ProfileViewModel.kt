package tech.thewolfgang.queueless.vendor.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.AccessibilityOptions
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.data.DayHours
import tech.thewolfgang.queueless.vendor.data.OperatingHours
import tech.thewolfgang.queueless.vendor.data.VendorRepository

data class ProfileUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val branchId: Int = 0,
    val branchName: String = "",
    val businessName: String? = null,
    val location: String? = null,
    val siblingBranches: List<BusinessProfile> = emptyList(),
    val name: String = "",
    val schedule: List<DayHours> = OperatingHours.defaultSchedule(),
    val isActive: Boolean = true,
    val accessibilityOptions: Set<String> = emptySet(),
    val groupName: String? = null,
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

class ProfileViewModel(
    private val businessId: Int,
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState(branchId = businessId))
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, savedMessage = null) }
            try {
                val businessDeferred = async { repository.business(businessId) }
                val branchesDeferred = async { repository.branches(businessId) }
                val business = businessDeferred.await()
                val branches = branchesDeferred.await()
                _uiState.update {
                    it.copy(
                        loading = false,
                        branchId = business.id,
                        branchName = business.name,
                        businessName = business.businessName ?: branches.businessName,
                        location = business.location,
                        siblingBranches = branches.branches,
                        name = business.name,
                        schedule = OperatingHours.parse(
                            business.operatingSchedule,
                            business.operatingHours,
                        ),
                        isActive = business.isActive,
                        accessibilityOptions = AccessibilityOptions.normalize(
                            business.accessibilityOptions.ifEmpty {
                                business.accessibility.map { info -> info.id }
                            },
                        ).toSet(),
                        groupName = business.businessGroupName ?: branches.businessGroupName,
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

    fun onActiveChange(value: Boolean) {
        _uiState.update { it.copy(isActive = value, error = null, savedMessage = null) }
    }

    fun onAccessibilityToggle(id: String, enabled: Boolean) {
        _uiState.update { state ->
            val next = state.accessibilityOptions.toMutableSet()
            if (enabled) next.add(id) else next.remove(id)
            state.copy(
                accessibilityOptions = AccessibilityOptions.normalize(next.toList()).toSet(),
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onDayOpenChange(day: String, open: Boolean) {
        _uiState.update { state ->
            state.copy(
                schedule = state.schedule.map {
                    if (it.day == day) it.copy(open = open) else it
                },
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onDayStartChange(day: String, start: String) {
        _uiState.update { state ->
            state.copy(
                schedule = state.schedule.map {
                    if (it.day == day) it.copy(start = OperatingHours.normalizeTime(start)) else it
                },
                error = null,
                savedMessage = null,
            )
        }
    }

    fun onDayEndChange(day: String, end: String) {
        _uiState.update { state ->
            state.copy(
                schedule = state.schedule.map {
                    if (it.day == day) it.copy(end = OperatingHours.normalizeTime(end, "18:00")) else it
                },
                error = null,
                savedMessage = null,
            )
        }
    }

    fun save() {
        val state = _uiState.value
        val name = state.name.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(error = "Branch name is required.") }
            return
        }
        val hoursError = OperatingHours.validate(state.schedule)
        if (hoursError != null) {
            _uiState.update { it.copy(error = hoursError) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, savedMessage = null) }
            try {
                val updated = repository.updateBusiness(
                    businessId = businessId,
                    name = name,
                    operatingSchedule = state.schedule,
                    isActive = state.isActive,
                    accessibilityOptions = AccessibilityOptions.normalize(
                        state.accessibilityOptions.toList(),
                    ),
                )
                _uiState.update {
                    it.copy(
                        saving = false,
                        branchName = updated.name,
                        businessName = updated.businessName ?: it.businessName,
                        location = updated.location ?: it.location,
                        name = updated.name,
                        schedule = OperatingHours.parse(
                            updated.operatingSchedule,
                            updated.operatingHours,
                        ),
                        isActive = updated.isActive,
                        accessibilityOptions = AccessibilityOptions.normalize(
                            updated.accessibilityOptions.ifEmpty {
                                updated.accessibility.map { info -> info.id }
                            },
                        ).toSet(),
                        groupName = updated.businessGroupName ?: it.groupName,
                        siblingBranches = it.siblingBranches.map { branch ->
                            if (branch.id == updated.id) {
                                branch.copy(
                                    name = updated.name,
                                    isActive = updated.isActive,
                                    location = updated.location ?: branch.location,
                                )
                            } else {
                                branch
                            }
                        },
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
