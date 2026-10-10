package tech.thewolfgang.queueless.vendor.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.ui.businesses.BusinessesViewModel
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import androidx.compose.ui.semantics.Role as SemanticsRole
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.LimeDim
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.CardShape
import tech.thewolfgang.queueless.vendor.ui.theme.LimeSoft
import tech.thewolfgang.queueless.vendor.ui.theme.ChipShape
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceMuted

@Composable
fun ProfilePickerScreen(
    viewModel: BusinessesViewModel,
    onOpenProfile: (Int) -> Unit,
    onOpenQueue: () -> Unit,
    onOpenBranches: () -> Unit,
    onOpenServices: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    LaunchedEffect(state.loading, state.businesses) {
        if (!state.loading && state.businesses.size == 1) {
            onOpenProfile(state.businesses.first().id)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PageBackground),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            TopBar(title = "Profile")
            Spacer(Modifier.height(12.dp))
            Text(
                text = "Choose a branch",
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Edit branch name, status, and business hours.",
                color = TextMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
            )

            when {
                state.loading || state.businesses.size == 1 -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = LimeDim)
                    }
                }

                !state.error.isNullOrBlank() -> {
                    Text(text = state.error ?: "", color = Danger)
                }

                state.businesses.isEmpty() -> {
                    Text(
                        text = "No businesses assigned yet.",
                        color = TextMuted,
                    )
                }

                else -> {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.businesses, key = { it.id }) { business ->
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(CardShape)
                                    .background(SurfaceCard)
                                    .clickable { onOpenProfile(business.id) }
                                    .semantics(mergeDescendants = true) {
                                        role = SemanticsRole.Button
                                        val title = listOfNotNull(
                                            business.businessName?.takeIf { it.isNotBlank() },
                                            business.name.takeIf { it.isNotBlank() },
                                        ).distinct().joinToString(" · ").ifBlank { business.name }
                                        contentDescription =
                                            "$title, ${if (business.isActive) "Active" else "Inactive"}"
                                    }
                                    .padding(16.dp),
                            ) {
                                val title = listOfNotNull(
                                    business.businessName?.takeIf { it.isNotBlank() },
                                    business.name.takeIf { it.isNotBlank() },
                                ).distinct().joinToString(" · ").ifBlank { business.name }
                                Text(
                                    text = title,
                                    color = TextPrimary,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 18.sp,
                                )
                                Text(
                                    text = if (business.isActive) "Active" else "Inactive",
                                    color = if (business.isActive) LimeInk else TextMuted,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 12.sp,
                                    modifier = Modifier
                                        .padding(top = 8.dp)
                                        .background(if (business.isActive) LimeSoft else SurfaceMuted, ChipShape)
                                        .padding(horizontal = 10.dp, vertical = 3.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Profile,
            onQueue = onOpenQueue,
            onBranches = onOpenBranches,
            onServices = onOpenServices,
            onProfile = {},
            onSignOut = onSignOut,
        )
    }
}
