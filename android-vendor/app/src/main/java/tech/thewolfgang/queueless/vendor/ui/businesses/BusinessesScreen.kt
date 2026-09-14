package tech.thewolfgang.queueless.vendor.ui.businesses

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.BusinessSummary
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.components.liveStatus
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import androidx.compose.ui.semantics.Role as SemanticsRole

@Composable
fun BusinessesScreen(
    viewModel: BusinessesViewModel,
    onOpenQueue: (Int) -> Unit,
    onOpenBranches: () -> Unit,
    onOpenServices: () -> Unit,
    onOpenProfile: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    LaunchedEffect(state.autoOpenId) {
        val id = state.autoOpenId ?: return@LaunchedEffect
        viewModel.consumeAutoOpen()
        onOpenQueue(id)
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
            TopBar()
            Spacer(Modifier.height(12.dp))
            Text(
                text = "Your branches",
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Pick a branch to manage its live queue.",
                color = TextMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp),
            )

            when {
                state.loading -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
                    }
                }

                !state.error.isNullOrBlank() -> {
                    Text(text = state.error ?: "", color = Danger)
                }

                state.businesses.isEmpty() -> {
                    Text(
                        text = "No businesses assigned yet. Ask an admin to link you to a business.",
                        color = TextMuted,
                    )
                }

                else -> {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(state.businesses, key = { it.id }) { business ->
                            BusinessRow(business = business, onClick = { onOpenQueue(business.id) })
                        }
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Queue,
            onQueue = {},
            onBranches = onOpenBranches,
            onServices = onOpenServices,
            onProfile = onOpenProfile,
            onSignOut = onSignOut,
        )
    }
}

@Composable
private fun BusinessRow(
    business: BusinessSummary,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = SemanticsRole.Button
                val title = listOfNotNull(
                    business.businessName?.takeIf { it.isNotBlank() },
                    business.name.takeIf { it.isNotBlank() },
                ).distinct().joinToString(" · ").ifBlank { business.name }
                contentDescription =
                    "$title, ${if (business.isActive) "Active" else "Inactive"}, ${business.waitingTotal} waiting"
            }
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
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
            val meta = listOfNotNull(
                business.businessGroupName?.takeIf { it.isNotBlank() },
                business.location?.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(text = meta, color = TextMuted, modifier = Modifier.padding(top = 4.dp))
            }
            Text(
                text = if (business.isActive) "Active" else "Inactive",
                color = if (business.isActive) Lime else TextMuted,
                modifier = Modifier.padding(top = 8.dp),
                fontWeight = FontWeight.Medium,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${business.waitingTotal}",
                color = Lime,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(text = "waiting", color = TextMuted)
        }
    }
}
