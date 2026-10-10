package tech.thewolfgang.queueless.vendor.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.vendor.data.ApiException
import tech.thewolfgang.queueless.vendor.data.BusinessGroup
import tech.thewolfgang.queueless.vendor.data.OnboardingBranch
import tech.thewolfgang.queueless.vendor.data.OnboardingRequest
import tech.thewolfgang.queueless.vendor.data.VendorRepository
import tech.thewolfgang.queueless.vendor.ui.components.LocationFieldController
import tech.thewolfgang.queueless.vendor.ui.components.LocationFieldState

enum class LoginStep {
    Phone,
    Pin,
    Otp,
    SetPin,
    Onboarding,
    PendingActivation,
}

data class OnboardingForm(
    val token: String = "",
    val loadingGroups: Boolean = false,
    val groups: List<BusinessGroup> = emptyList(),
    val businessName: String = "",
    val groupId: Int? = null,
    val branchName: String = "Main",
    val location: LocationFieldState = LocationFieldState(),
    val landmark: String = "",
    val branchPhone: String = "",
)

data class LoginUiState(
    val step: LoginStep = LoginStep.Phone,
    val phone: String = "",
    val pin: String = "",
    val confirmPin: String = "",
    val otp: String = "",
    val purpose: String = "setup",
    val verifiedOtp: String? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val info: String? = null,
    val loggedIn: Boolean = false,
    val onboarding: OnboardingForm = OnboardingForm(),
)

class LoginViewModel(
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    val onboardingLocation = LocationFieldController(
        scope = viewModelScope,
        search = { repository.searchPlaces(it, bearer = _uiState.value.onboarding.token) },
        reverse = { lat, lon -> repository.reverseGeocode(lat, lon, bearer = _uiState.value.onboarding.token) },
        update = { transform ->
            _uiState.update { it.copy(onboarding = it.onboarding.copy(location = transform(it.onboarding.location))) }
        },
        onMessage = { error, info -> _uiState.update { it.copy(error = error, info = info) } },
    )

    fun onPhoneChange(value: String) {
        _uiState.update {
            it.copy(phone = value.filter { ch -> ch.isDigit() }.take(15), error = null, info = null)
        }
    }

    fun onPinChange(value: String) {
        _uiState.update {
            it.copy(pin = value.filter { ch -> ch.isDigit() }.take(4), error = null, info = null)
        }
    }

    fun onConfirmPinChange(value: String) {
        _uiState.update {
            it.copy(confirmPin = value.filter { ch -> ch.isDigit() }.take(4), error = null, info = null)
        }
    }

    fun onOtpChange(value: String) {
        _uiState.update {
            it.copy(otp = value.filter { ch -> ch.isDigit() }.take(4), error = null, info = null)
        }
    }

    fun backToPhone() {
        _uiState.update {
            LoginUiState(phone = it.phone)
        }
    }

    fun continueWithPhone() {
        val phone = _uiState.value.phone.trim()
        if (phone.length < 9) {
            _uiState.update { it.copy(error = "Enter a valid phone number.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                val status = repository.phoneStatus(phone)
                if (status.pendingActivation && status.hasPin && !status.needsOnboarding) {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            phone = status.phone,
                            step = LoginStep.PendingActivation,
                            info = "Your account is waiting for admin activation. We'll notify you on this device when it's ready.",
                        )
                    }
                    return@launch
                }
                if (status.hasPin) {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            phone = status.phone,
                            step = LoginStep.Pin,
                            purpose = "setup",
                        )
                    }
                    return@launch
                }
                val otpResult = repository.requestOtp(status.phone, "setup")
                _uiState.update {
                    it.copy(
                        loading = false,
                        phone = status.phone,
                        step = LoginStep.Otp,
                        purpose = "setup",
                        info = otpResult.message,
                    )
                }
            } catch (e: ApiException) {
                _uiState.update { it.copy(loading = false, error = e.message) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not continue.")
                }
            }
        }
    }

    fun loginWithPin() {
        val state = _uiState.value
        if (state.pin.length != 4) {
            _uiState.update { it.copy(error = "Enter your 4-digit PIN.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                repository.login(state.phone, state.pin)
                _uiState.update { it.copy(loading = false, loggedIn = true) }
            } catch (e: ApiException) {
                val onboardingToken = e.payload?.onboardingToken
                if (e.payload?.pendingActivation == true && e.payload?.needsOnboarding == true && !onboardingToken.isNullOrBlank()) {
                    startOnboarding(onboardingToken)
                } else if (e.payload?.pendingActivation == true) {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            step = LoginStep.PendingActivation,
                            error = null,
                            info = e.message
                                ?: "Your account is waiting for admin activation. We'll notify you on this device when it's ready.",
                        )
                    }
                } else if (e.payload?.needsOtp == true || e.payload?.needsPinSetup == true) {
                    try {
                        val otpResult = repository.requestOtp(state.phone, "setup")
                        _uiState.update {
                            it.copy(
                                loading = false,
                                step = LoginStep.Otp,
                                purpose = "setup",
                                info = otpResult.message,
                                error = null,
                            )
                        }
                    } catch (otpError: Exception) {
                        _uiState.update {
                            it.copy(loading = false, error = otpError.message ?: e.message)
                        }
                    }
                } else {
                    _uiState.update { it.copy(loading = false, error = e.message) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Login failed.")
                }
            }
        }
    }

    fun forgotPin() {
        val phone = _uiState.value.phone
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                val otpResult = repository.requestOtp(phone, "forgot")
                _uiState.update {
                    it.copy(
                        loading = false,
                        step = LoginStep.Otp,
                        purpose = "forgot",
                        pin = "",
                        confirmPin = "",
                        otp = "",
                        info = otpResult.message,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not send code.")
                }
            }
        }
    }

    fun resendOtp() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val otpResult = repository.resendOtp(state.phone, state.purpose)
                _uiState.update {
                    it.copy(loading = false, info = otpResult.message)
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not resend code.")
                }
            }
        }
    }

    fun verifyOtp() {
        val state = _uiState.value
        if (state.otp.length != 4) {
            _uiState.update { it.copy(error = "Enter the 4-digit SMS code.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                repository.verifyOtp(state.phone, state.otp)
                _uiState.update {
                    it.copy(
                        loading = false,
                        step = LoginStep.SetPin,
                        verifiedOtp = state.otp,
                        pin = "",
                        confirmPin = "",
                        info = "Create your 4-digit PIN.",
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not verify code.")
                }
            }
        }
    }

    fun savePin() {
        val state = _uiState.value
        if (state.pin.length != 4 || state.confirmPin.length != 4) {
            _uiState.update { it.copy(error = "PIN must be exactly 4 digits.") }
            return
        }
        if (state.pin != state.confirmPin) {
            _uiState.update { it.copy(error = "PIN and confirmation do not match.") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                val session = repository.setPin(
                    phone = state.phone,
                    pin = state.pin,
                    confirmPin = state.confirmPin,
                    otp = state.verifiedOtp,
                )
                val onboardingToken = session.onboardingToken
                if (session.needsOnboarding && !onboardingToken.isNullOrBlank()) {
                    startOnboarding(onboardingToken)
                } else if (session.pendingActivation || session.token.isNullOrBlank()) {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            step = LoginStep.PendingActivation,
                            info = session.message
                                ?: "PIN saved. Your account is waiting for admin activation. We'll notify you on this device when it's ready.",
                        )
                    }
                } else {
                    _uiState.update { it.copy(loading = false, loggedIn = true) }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not save PIN.")
                }
            }
        }
    }

    private fun updateOnboarding(transform: (OnboardingForm) -> OnboardingForm) {
        _uiState.update { it.copy(onboarding = transform(it.onboarding), error = null) }
    }

    fun onBusinessNameChange(value: String) = updateOnboarding { it.copy(businessName = value.take(120)) }

    fun onGroupSelected(groupId: Int) = updateOnboarding { it.copy(groupId = groupId) }

    fun onBranchNameChange(value: String) = updateOnboarding { it.copy(branchName = value) }

    fun onLandmarkChange(value: String) = updateOnboarding { it.copy(landmark = value) }

    fun onBranchPhoneChange(value: String) = updateOnboarding { it.copy(branchPhone = value) }

    private fun startOnboarding(token: String) {
        onboardingLocation.cancel()
        _uiState.update {
            it.copy(
                loading = false,
                step = LoginStep.Onboarding,
                error = null,
                info = null,
                onboarding = OnboardingForm(token = token, loadingGroups = true),
            )
        }
        viewModelScope.launch {
            try {
                val info = repository.onboardingInfo(token)
                if (!info.needsOnboarding) {
                    _uiState.update {
                        it.copy(
                            step = LoginStep.PendingActivation,
                            info = "Your business is already waiting for admin approval.",
                        )
                    }
                    return@launch
                }
                updateOnboarding { it.copy(loadingGroups = false, groups = info.groups) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        onboarding = it.onboarding.copy(loadingGroups = false),
                        error = onboardingError(e) ?: "Could not load business categories.",
                    )
                }
            }
        }
    }

    private fun onboardingError(e: Exception): String? =
        if (e is ApiException && e.statusCode == 401) {
            "Your setup link expired. Go back and sign in again to continue."
        } else {
            e.message
        }

    fun submitOnboarding() {
        val form = _uiState.value.onboarding
        val error = when {
            form.businessName.isBlank() -> "Enter your business name."
            form.groupId == null -> "Pick a business category."
            form.location.text.isBlank() ->
                "Add your branch location: search, use your current location, or tap the map."
            else -> null
        }
        if (error != null) {
            _uiState.update { it.copy(error = error, info = null) }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                val result = repository.submitOnboarding(
                    form.token,
                    OnboardingRequest(
                        businessName = form.businessName.trim(),
                        businessGroupId = form.groupId!!,
                        branch = OnboardingBranch(
                            name = form.branchName.trim().ifBlank { "Main" },
                            location = form.location.text.trim(),
                            landmark = form.landmark.trim().ifBlank { null },
                            phone = form.branchPhone.trim().ifBlank { null },
                            latitude = form.location.latitude,
                            longitude = form.location.longitude,
                        ),
                    ),
                )
                onboardingLocation.cancel()
                _uiState.update {
                    it.copy(
                        loading = false,
                        step = LoginStep.PendingActivation,
                        info = result.message
                            ?: "Thanks! An admin will review your business and activate your account.",
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = onboardingError(e) ?: "Could not save your business.")
                }
            }
        }
    }

    companion object {
        fun factory(repository: VendorRepository) =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return LoginViewModel(repository) as T
                }
            }
    }
}
