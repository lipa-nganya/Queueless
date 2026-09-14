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
import tech.thewolfgang.queueless.vendor.data.VendorRepository

enum class LoginStep {
    Phone,
    Pin,
    Otp,
    SetPin,
}

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
)

class LoginViewModel(
    private val repository: VendorRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

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
                if (e.payload?.needsOtp == true || e.payload?.needsPinSetup == true) {
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
                repository.setPin(
                    phone = state.phone,
                    pin = state.pin,
                    confirmPin = state.confirmPin,
                    otp = state.verifiedOtp,
                )
                _uiState.update { it.copy(loading = false, loggedIn = true) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not save PIN.")
                }
            }
        }
    }

    companion object {
        fun factory(repository: VendorRepository) = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return LoginViewModel(repository) as T
            }
        }
    }
}
