package tech.thewolfgang.queueless.vendor.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.ui.components.AppVersionLabel
import tech.thewolfgang.queueless.vendor.ui.components.liveStatus
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.NavyElevated
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoggedIn: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) onLoggedIn()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Navy, NavyElevated, Navy),
                ),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
                .background(SurfaceCard, RoundedCornerShape(16.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = TextPrimary, fontWeight = FontWeight.Bold)) {
                        append("Queue")
                    }
                    withStyle(SpanStyle(color = Lime, fontWeight = FontWeight.Bold)) {
                        append("less")
                    }
                },
                fontSize = 34.sp,
            )
            Text(
                text = when (state.step) {
                    LoginStep.Phone -> "Vendor sign in — use your phone number."
                    LoginStep.Pin -> "Enter your 4-digit PIN."
                    LoginStep.Otp -> "Enter the SMS code we sent you."
                    LoginStep.SetPin -> "Create and confirm your 4-digit PIN."
                },
                color = TextMuted,
            )
            Spacer(Modifier.height(4.dp))

            when (state.step) {
                LoginStep.Phone -> {
                    OutlinedTextField(
                        value = state.phone,
                        onValueChange = viewModel::onPhoneChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Phone number") },
                        placeholder = { Text("07XXXXXXXX") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.continueWithPhone()
                            },
                        ),
                        colors = fieldColors(),
                    )
                    PrimaryButton(
                        label = "Continue",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.continueWithPhone()
                        },
                    )
                }

                LoginStep.Pin -> {
                    Text(text = "+${state.phone}", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = state.pin,
                        onValueChange = viewModel::onPinChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("PIN") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.loginWithPin()
                            },
                        ),
                        colors = fieldColors(),
                    )
                    PrimaryButton(
                        label = "Sign in",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.loginWithPin()
                        },
                    )
                    TextButton(onClick = viewModel::forgotPin, enabled = !state.loading) {
                        Text("Forgot PIN?", color = TextMuted)
                    }
                    TextButton(onClick = viewModel::backToPhone, enabled = !state.loading) {
                        Text("Use a different number", color = TextMuted)
                    }
                }

                LoginStep.Otp -> {
                    Text(text = "+${state.phone}", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = state.otp,
                        onValueChange = viewModel::onOtpChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("SMS code") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.verifyOtp()
                            },
                        ),
                        colors = fieldColors(),
                    )
                    PrimaryButton(
                        label = "Verify code",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.verifyOtp()
                        },
                    )
                    TextButton(onClick = viewModel::resendOtp, enabled = !state.loading) {
                        Text("Resend code", color = TextMuted)
                    }
                    TextButton(onClick = viewModel::backToPhone, enabled = !state.loading) {
                        Text("Use a different number", color = TextMuted)
                    }
                }

                LoginStep.SetPin -> {
                    Text(text = "+${state.phone}", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = state.pin,
                        onValueChange = viewModel::onPinChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("New PIN") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                            imeAction = ImeAction.Next,
                        ),
                        colors = fieldColors(),
                    )
                    OutlinedTextField(
                        value = state.confirmPin,
                        onValueChange = viewModel::onConfirmPinChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Confirm PIN") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.NumberPassword,
                            imeAction = ImeAction.Done,
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = {
                                focusManager.clearFocus()
                                viewModel.savePin()
                            },
                        ),
                        colors = fieldColors(),
                    )
                    PrimaryButton(
                        label = "Save PIN & sign in",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.savePin()
                        },
                    )
                }
            }

            if (!state.info.isNullOrBlank()) {
                Text(
                    text = state.info ?: "",
                    color = Lime,
                    modifier = Modifier.liveStatus(),
                )
            }
            if (!state.error.isNullOrBlank()) {
                Text(
                    text = state.error ?: "",
                    color = Danger,
                    modifier = Modifier.liveStatus(),
                )
            }
        }

        AppVersionLabel(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 28.dp),
            onDark = true,
        )
    }
}

@Composable
private fun PrimaryButton(
    label: String,
    loading: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = !loading,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .height(52.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Lime,
            contentColor = Navy,
            disabledContainerColor = Lime.copy(alpha = 0.5f),
        ),
        shape = RoundedCornerShape(10.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Navy,
                strokeWidth = 2.dp,
                modifier = Modifier
                    .height(22.dp)
                    .semantics { contentDescription = "Loading" },
            )
        } else {
            Text(label, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Lime,
    unfocusedBorderColor = TextMuted.copy(alpha = 0.4f),
    focusedLabelColor = Lime,
    unfocusedLabelColor = TextMuted,
    cursorColor = Lime,
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    focusedPlaceholderColor = TextMuted,
    unfocusedPlaceholderColor = TextMuted,
)
