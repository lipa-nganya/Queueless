package tech.thewolfgang.queueless.customer.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.ApiException
import tech.thewolfgang.queueless.customer.data.CustomerRepository

enum class LoginStep { Phone, Pin, SignUp, Otp }

data class LoginUiState(
    val step: LoginStep = LoginStep.Phone,
    val phone: String = "",
    val firstName: String = "",
    val pin: String = "",
    val confirmPin: String = "",
    val otp: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val info: String? = null,
    val signedIn: Boolean = false,
)

class LoginViewModel(private val repository: CustomerRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private fun digits(value: String, max: Int) = value.filter { it.isDigit() }.take(max)

    fun onPhone(value: String) = _uiState.update { it.copy(phone = digits(value, 13), error = null) }
    fun onFirstName(value: String) = _uiState.update { it.copy(firstName = value.take(60), error = null) }
    fun onPin(value: String) = _uiState.update { it.copy(pin = digits(value, 4), error = null) }
    fun onConfirmPin(value: String) = _uiState.update { it.copy(confirmPin = digits(value, 4), error = null) }
    fun onOtp(value: String) = _uiState.update { it.copy(otp = digits(value, 4), error = null) }

    fun back() = _uiState.update { LoginUiState(phone = it.phone) }

    private fun run(block: suspend () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, info = null) }
            try {
                block()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Something went wrong. Try again.") }
            } finally {
                _uiState.update { it.copy(loading = false) }
            }
        }
    }

    fun continueWithPhone() {
        val phone = _uiState.value.phone
        if (phone.length < 9) {
            _uiState.update { it.copy(error = "Enter a valid Kenyan phone number.") }
            return
        }
        run {
            val status = repository.phoneStatus(phone)
            when {
                !status.registered -> _uiState.update {
                    it.copy(step = LoginStep.SignUp, info = "New here? Create your account in a few seconds.")
                }
                status.needsOtp -> sendCodeAndVerify()
                else -> _uiState.update {
                    it.copy(
                        step = LoginStep.Pin,
                        info = status.firstName?.let { name -> "Welcome back, $name." },
                    )
                }
            }
        }
    }

    private suspend fun sendCodeAndVerify() {
        val message = try {
            repository.resendOtp(_uiState.value.phone).message
        } catch (e: ApiException) {
            e.message
        }
        _uiState.update { it.copy(step = LoginStep.Otp, otp = "", info = message) }
    }

    fun login() {
        val state = _uiState.value
        if (state.pin.length != 4) {
            _uiState.update { it.copy(error = "Enter your 4-digit PIN.") }
            return
        }
        run {
            try {
                repository.login(state.phone, state.pin)
                _uiState.update { it.copy(signedIn = true) }
            } catch (e: ApiException) {
                when {
                    e.payload?.needsOtp == true -> sendCodeAndVerify()
                    e.payload?.notRegistered == true -> _uiState.update {
                        it.copy(step = LoginStep.SignUp, error = e.message)
                    }
                    else -> throw e
                }
            }
        }
    }

    fun signUp() {
        val state = _uiState.value
        val error = when {
            state.firstName.isBlank() -> "Enter your first name."
            state.pin.length != 4 -> "PIN must be exactly 4 digits."
            state.pin != state.confirmPin -> "PIN and confirm PIN do not match."
            else -> null
        }
        if (error != null) {
            _uiState.update { it.copy(error = error) }
            return
        }
        run {
            val result = repository.signup(state.firstName.trim(), state.phone, state.pin, state.confirmPin)
            _uiState.update { it.copy(step = LoginStep.Otp, otp = "", info = result.message) }
        }
    }

    fun verify() {
        val state = _uiState.value
        if (state.otp.length != 4) {
            _uiState.update { it.copy(error = "Enter the 4-digit code.") }
            return
        }
        run {
            repository.verifyOtp(state.phone, state.otp)
            _uiState.update { it.copy(signedIn = true) }
        }
    }

    fun resend() {
        run {
            val result = repository.resendOtp(_uiState.value.phone)
            _uiState.update { it.copy(info = result.message) }
        }
    }
}
