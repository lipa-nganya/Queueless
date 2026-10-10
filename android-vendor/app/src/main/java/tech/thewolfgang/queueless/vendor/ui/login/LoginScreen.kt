package tech.thewolfgang.queueless.vendor.ui.login

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.semantics.heading
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
import tech.thewolfgang.queueless.vendor.ui.components.BranchLocationField
import tech.thewolfgang.queueless.vendor.ui.components.liveStatus
import tech.thewolfgang.queueless.vendor.ui.theme.ButtonShape
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.GhostButton
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.LimeSoft
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.NavyElevated
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.SheetShape
import tech.thewolfgang.queueless.vendor.ui.theme.Teal
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import tech.thewolfgang.queueless.vendor.ui.theme.queuelessFieldColors
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoggedIn: () -> Unit,
    onRegisterPush: suspend (phoneForPending: String?) -> Unit = {},
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var notificationsEnabled by remember {
        mutableStateOf(NotificationManagerCompat.from(context).areNotificationsEnabled())
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) {
            onRegisterPush(null)
            onLoggedIn()
        }
    }

    LaunchedEffect(state.step, state.phone, notificationsEnabled) {
        if (state.step == LoginStep.PendingActivation && state.phone.isNotBlank()) {
            onRegisterPush(state.phone)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Navy)
            .drawBehind {
                drawCircle(NavyElevated, radius = 120.dp.toPx(), center = Offset(size.width * 0.1f, -30.dp.toPx()))
                drawCircle(Lime, radius = 78.dp.toPx(), center = Offset(size.width * 0.92f, 40.dp.toPx()))
                drawCircle(Teal, radius = 34.dp.toPx(), center = Offset(size.width * 0.74f, 196.dp.toPx()))
            },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp)
                .padding(horizontal = 28.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.Bottom,
        ) {
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = Color.White, fontWeight = FontWeight.Bold)) {
                        append("Queue")
                    }
                    withStyle(SpanStyle(color = Lime, fontWeight = FontWeight.Bold)) {
                        append("less")
                    }
                },
                fontSize = 34.sp,
                letterSpacing = (-0.5).sp,
                modifier = Modifier.semantics { contentDescription = "Queueless" },
            )
            Text(
                text = "Vendor",
                color = Color.White.copy(alpha = 0.7f),
                fontWeight = FontWeight.Medium,
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(PageBackground, SheetShape)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 28.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = when (state.step) {
                    LoginStep.Phone -> "Sign in"
                    LoginStep.Pin -> "Welcome back"
                    LoginStep.Otp -> "Verify your number"
                    LoginStep.SetPin -> "Create your PIN"
                    LoginStep.Onboarding -> "Add your business"
                    LoginStep.PendingActivation -> "Almost there"
                },
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.5).sp,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = when (state.step) {
                    LoginStep.Phone -> "Vendor sign in or create an account with your phone number."
                    LoginStep.Pin -> "Enter your 4-digit PIN."
                    LoginStep.Otp -> "Enter the SMS code we sent you."
                    LoginStep.SetPin -> "Create and confirm your 4-digit PIN."
                    LoginStep.Onboarding ->
                        "Tell us about your business and its first branch. An admin reviews it before your account goes live."
                    LoginStep.PendingActivation -> "Account pending activation"
                },
                color = TextMuted,
            )
            Spacer(Modifier.height(4.dp))

            when (state.step) {
                LoginStep.Phone -> {
                    TextField(
                        shape = FieldShape,
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
                    TextField(
                        shape = FieldShape,
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
                    TextField(
                        shape = FieldShape,
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
                    TextField(
                        shape = FieldShape,
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
                    TextField(
                        shape = FieldShape,
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
                        label = "Save PIN",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.savePin()
                        },
                    )
                }

                LoginStep.Onboarding -> {
                    OnboardingFields(
                        form = state.onboarding,
                        viewModel = viewModel,
                        loading = state.loading,
                    )
                    PrimaryButton(
                        label = "Send for approval",
                        loading = state.loading,
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.submitOnboarding()
                        },
                    )
                    TextButton(onClick = viewModel::backToPhone, enabled = !state.loading) {
                        Text("Back to sign in", color = TextMuted)
                    }
                }

                LoginStep.PendingActivation -> {
                    Text(
                        text = "+${state.phone}",
                        color = TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "We'll notify you on this device when an admin activates your account. Then sign in with your phone and PIN.",
                        color = TextMuted,
                    )
                    if (!notificationsEnabled) {
                        Text(
                            text = "Notifications are off for Queueless Vendor, so we can't alert you. Turn them on to get the activation alert.",
                            color = Danger,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Danger.copy(alpha = 0.08f), FieldShape)
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                        )
                        GhostButton(
                            onClick = {
                                context.startActivity(
                                    Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
                                )
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                        ) {
                            Text("Turn on notifications")
                        }
                    }
                    PrimaryButton(
                        label = "Back to sign in",
                        loading = false,
                        onClick = viewModel::backToPhone,
                    )
                }
            }

            if (!state.info.isNullOrBlank()) {
                Text(
                    text = state.info ?: "",
                    color = LimeInk,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(LimeSoft, FieldShape)
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                        .liveStatus(),
                )
            }
            if (!state.error.isNullOrBlank()) {
                Text(
                    text = state.error ?: "",
                    color = Danger,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Danger.copy(alpha = 0.08f), FieldShape)
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                        .liveStatus(),
                )
            }
            AppVersionLabel(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
            )
        }
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
            .height(54.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Lime,
            contentColor = Navy,
            disabledContainerColor = Lime.copy(alpha = 0.5f),
        ),
        shape = ButtonShape,
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnboardingFields(
    form: OnboardingForm,
    viewModel: LoginViewModel,
    loading: Boolean,
) {
    var categoryMenuOpen by remember { mutableStateOf(false) }
    val selectedGroup = form.groups.firstOrNull { it.id == form.groupId }

    TextField(
        shape = FieldShape,
        value = form.businessName,
        onValueChange = viewModel::onBusinessNameChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Business name") },
        placeholder = { Text("e.g. Mama Njeri Salon") },
        singleLine = true,
        enabled = !loading,
        colors = fieldColors(),
    )
    ExposedDropdownMenuBox(
        expanded = categoryMenuOpen,
        onExpandedChange = { if (form.groups.isNotEmpty()) categoryMenuOpen = it },
        modifier = Modifier.fillMaxWidth(),
    ) {
        TextField(
            shape = FieldShape,
            value = selectedGroup?.name ?: "",
            onValueChange = {},
            readOnly = true,
            label = { Text("Category") },
            placeholder = { Text(if (form.loadingGroups) "Loading categories…" else "Choose a category") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryMenuOpen) },
            enabled = !loading,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable),
            colors = fieldColors(),
        )
        ExposedDropdownMenu(
            expanded = categoryMenuOpen,
            onDismissRequest = { categoryMenuOpen = false },
        ) {
            form.groups.forEach { group ->
                DropdownMenuItem(
                    text = { Text(group.name, color = TextPrimary) },
                    onClick = {
                        viewModel.onGroupSelected(group.id)
                        categoryMenuOpen = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                )
            }
        }
    }
    Text(
        text = "First branch",
        color = TextPrimary,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .padding(top = 8.dp)
            .semantics { heading() },
    )
    TextField(
        shape = FieldShape,
        value = form.branchName,
        onValueChange = viewModel::onBranchNameChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Branch name") },
        placeholder = { Text("e.g. Westlands") },
        singleLine = true,
        enabled = !loading,
        colors = fieldColors(),
    )
    BranchLocationField(
        state = form.location,
        controller = viewModel.onboardingLocation,
        enabled = !loading,
    )
    TextField(
        shape = FieldShape,
        value = form.landmark,
        onValueChange = viewModel::onLandmarkChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Landmark (optional)") },
        placeholder = { Text("e.g. Opposite Naivas, next to the blue gate") },
        singleLine = true,
        enabled = !loading,
        colors = fieldColors(),
    )
    TextField(
        shape = FieldShape,
        value = form.branchPhone,
        onValueChange = viewModel::onBranchPhoneChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text("Branch phone (optional)") },
        placeholder = { Text("07XXXXXXXX") },
        singleLine = true,
        enabled = !loading,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        colors = fieldColors(),
    )
}

@Composable
private fun fieldColors() = queuelessFieldColors()
