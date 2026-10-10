package tech.thewolfgang.queueless.customer.ui.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.ApiException
import tech.thewolfgang.queueless.customer.data.ContactResponse
import tech.thewolfgang.queueless.customer.data.CustomerMe
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.ui.components.AccessibilityNeedsPicker
import tech.thewolfgang.queueless.customer.ui.components.AppVersionLabel
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.PrimaryButton
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.SectionTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.theme.CardShape
import tech.thewolfgang.queueless.customer.ui.theme.GhostButton
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary

data class ProfileUiState(
    val loading: Boolean = true,
    val me: CustomerMe? = null,
    val contact: ContactResponse? = null,
    val needs: List<String> = emptyList(),
    val note: String = "",
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val unauthorized: Boolean = false,
)

class ProfileViewModel(private val repository: CustomerRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            try {
                val me = repository.me()
                val contact = runCatching { repository.contact() }.getOrNull()
                _uiState.update {
                    it.copy(
                        loading = false,
                        me = me,
                        contact = contact,
                        needs = me.accessibilityNeeds,
                        note = me.accessibilityNote.orEmpty(),
                    )
                }
            } catch (e: ApiException) {
                _uiState.update { it.copy(loading = false, error = e.message, unauthorized = e.statusCode == 401) }
            } catch (e: Exception) {
                _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load your profile.") }
            }
        }
    }

    fun toggleNeed(id: String) = _uiState.update {
        it.copy(needs = if (id in it.needs) it.needs - id else it.needs + id, message = null)
    }

    fun onNote(value: String) = _uiState.update { it.copy(note = value, message = null) }

    fun save() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(saving = true, error = null, message = null) }
            try {
                val me = repository.saveAccessibility(state.needs, state.note.trim().ifBlank { null })
                _uiState.update { it.copy(saving = false, me = me, message = "Accessibility needs saved.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(saving = false, error = e.message ?: "Could not save.") }
            }
        }
    }

    fun signOut() = repository.signOut()
}

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onSignedOut: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onSignedOut()
    }

    Column(Modifier.fillMaxSize()) {
        TopBar()
        if (state.loading) {
            LoadingState("Loading your profile…")
            return@Column
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            ScreenTitle(
                title = state.me?.firstName?.let { "Hi, $it" } ?: "Profile",
                subtitle = state.me?.phone?.let { "+$it" },
            )
            StatusBanner(state.error, isError = true)

            SectionTitle("Accessibility needs")
            Text(
                "Saved needs are shared with the business each time you join a queue.",
                color = TextMuted,
            )
            AccessibilityNeedsPicker(
                selected = state.needs,
                note = state.note,
                onToggle = viewModel::toggleNeed,
                onNoteChange = viewModel::onNote,
                enabled = !state.saving,
            )
            StatusBanner(state.message, isError = false)
            PrimaryButton(label = "Save needs", onClick = viewModel::save, loading = state.saving)

            val contact = state.contact
            if (contact != null && (!contact.phone.isNullOrBlank() || !contact.email.isNullOrBlank())) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(CardShape)
                        .background(SurfaceCard)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text("Need help?", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    contact.phone?.takeIf { it.isNotBlank() }?.let { phone ->
                        TextButton(onClick = {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                        }) { Text("Call $phone", color = LimeInk) }
                    }
                    contact.email?.takeIf { it.isNotBlank() }?.let { email ->
                        TextButton(onClick = {
                            context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$email")))
                        }) { Text("Email $email", color = LimeInk) }
                    }
                }
            }

            GhostButton(
                onClick = {
                    viewModel.signOut()
                    onSignedOut()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) { Text("Log out") }
            AppVersionLabel(Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
        }
    }
}
