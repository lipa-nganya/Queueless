package tech.thewolfgang.queueless.customer.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.customer.BuildConfig
import tech.thewolfgang.queueless.customer.ui.components.AppVersionLabel
import tech.thewolfgang.queueless.customer.ui.components.PrimaryButton
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.theme.FieldShape
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import tech.thewolfgang.queueless.customer.ui.theme.queuelessFieldColors

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    reason: String?,
    onSignedIn: () -> Unit,
    onBrowse: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(state.signedIn) {
        if (state.signedIn) onSignedIn()
    }

    fun submit() {
        focusManager.clearFocus()
        when (state.step) {
            LoginStep.Phone -> viewModel.continueWithPhone()
            LoginStep.Pin -> viewModel.login()
            LoginStep.SignUp -> viewModel.signUp()
            LoginStep.Otp -> viewModel.verify()
        }
    }

    Column(Modifier.fillMaxSize()) {
        TopBar()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ScreenTitle(
                title = when (state.step) {
                    LoginStep.Phone -> "Log in or sign up"
                    LoginStep.Pin -> "Enter your PIN"
                    LoginStep.SignUp -> "Create your account"
                    LoginStep.Otp -> "Verify your number"
                },
                subtitle = when (state.step) {
                    LoginStep.Phone -> reason ?: "Use your phone number. New here? We'll set you up."
                    LoginStep.Otp -> "Enter the 4-digit code we sent to +${state.phone}."
                    else -> "+${state.phone}"
                },
            )
            Spacer(Modifier.height(4.dp))

            when (state.step) {
                LoginStep.Phone -> Field(
                    value = state.phone,
                    onChange = viewModel::onPhone,
                    label = "Phone number",
                    placeholder = "07XXXXXXXX",
                    keyboard = KeyboardType.Phone,
                    onDone = ::submit,
                )
                LoginStep.Pin -> Field(
                    value = state.pin,
                    onChange = viewModel::onPin,
                    label = "PIN",
                    keyboard = KeyboardType.NumberPassword,
                    secret = true,
                    onDone = ::submit,
                )
                LoginStep.SignUp -> {
                    Field(
                        value = state.firstName,
                        onChange = viewModel::onFirstName,
                        label = "First name",
                        keyboard = KeyboardType.Text,
                        capitalize = true,
                        last = false,
                    )
                    Field(
                        value = state.pin,
                        onChange = viewModel::onPin,
                        label = "Create a 4-digit PIN",
                        keyboard = KeyboardType.NumberPassword,
                        secret = true,
                        last = false,
                    )
                    Field(
                        value = state.confirmPin,
                        onChange = viewModel::onConfirmPin,
                        label = "Confirm PIN",
                        keyboard = KeyboardType.NumberPassword,
                        secret = true,
                        onDone = ::submit,
                    )
                    SignupDisclaimer()
                }
                LoginStep.Otp -> Field(
                    value = state.otp,
                    onChange = viewModel::onOtp,
                    label = "SMS code",
                    keyboard = KeyboardType.NumberPassword,
                    onDone = ::submit,
                )
            }

            StatusBanner(state.info, isError = false)
            StatusBanner(state.error, isError = true)

            PrimaryButton(
                label = when (state.step) {
                    LoginStep.Phone -> "Continue"
                    LoginStep.Pin -> "Log in"
                    LoginStep.SignUp -> "Create account"
                    LoginStep.Otp -> "Verify"
                },
                onClick = ::submit,
                loading = state.loading,
            )
            if (state.step == LoginStep.Otp) {
                TextButton(onClick = viewModel::resend, enabled = !state.loading) {
                    Text("Resend code", color = LimeInk)
                }
            }
            if (state.step != LoginStep.Phone) {
                TextButton(onClick = viewModel::back, enabled = !state.loading) {
                    Text("Use a different number", color = TextMuted)
                }
            }
            TextButton(onClick = onBrowse) {
                Text("Browse businesses without logging in", color = TextPrimary, fontWeight = FontWeight.Medium)
            }
            AppVersionLabel(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
            )
        }
    }
}

@Composable
private fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboard: KeyboardType,
    placeholder: String? = null,
    secret: Boolean = false,
    capitalize: Boolean = false,
    last: Boolean = true,
    onDone: () -> Unit = {},
) {
    TextField(
        value = value,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth(),
        shape = FieldShape,
        singleLine = true,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = keyboard,
            capitalization = if (capitalize) KeyboardCapitalization.Words else KeyboardCapitalization.None,
            imeAction = if (last) ImeAction.Done else ImeAction.Next,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        colors = queuelessFieldColors(),
    )
}

@Composable
private fun SignupDisclaimer() {
    val linkStyle = TextLinkStyles(SpanStyle(color = LimeInk, fontWeight = FontWeight.SemiBold))
    val base = BuildConfig.LANDING_BASE_URL.trimEnd('/')
    Text(
        text = buildAnnotatedString {
            append("By signing up, you agree to our ")
            withLink(LinkAnnotation.Url("$base/legal/customers/terms", linkStyle)) {
                append("terms of service")
            }
            append(" and ")
            withLink(LinkAnnotation.Url("$base/legal/customers/privacy", linkStyle)) {
                append("privacy policy")
            }
            append(".")
        },
        color = TextMuted,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    )
}
