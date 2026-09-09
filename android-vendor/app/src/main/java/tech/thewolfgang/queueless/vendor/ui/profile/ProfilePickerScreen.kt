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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.ui.businesses.BusinessesViewModel
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

@Composable
fun ProfilePickerScreen(
    viewModel: BusinessesViewModel,
    onOpenProfile: (Int) -> Unit,
    onOpenQueue: () -> Unit,
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
            .background(Navy),
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
                text = "Edit branch name, status, and operating hours.",
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
                        CircularProgressIndicator(color = Lime)
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
                                    .background(SurfaceCard, RoundedCornerShape(14.dp))
                                    .clickable { onOpenProfile(business.id) }
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
                                    color = if (business.isActive) Lime else TextMuted,
                                    modifier = Modifier.padding(top = 6.dp),
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
            onProfile = {},
            onSignOut = onSignOut,
        )
    }
}
