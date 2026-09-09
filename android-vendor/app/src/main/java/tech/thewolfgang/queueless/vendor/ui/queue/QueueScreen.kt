package tech.thewolfgang.queueless.vendor.ui.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.QueueEntry
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorBottomBar
import tech.thewolfgang.queueless.vendor.ui.components.VendorTab
import tech.thewolfgang.queueless.vendor.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

@Composable
fun QueueScreen(
    viewModel: QueueViewModel,
    onBack: () -> Unit,
    onOpenProfile: () -> Unit,
    onSignOut: () -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner, viewModel) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> viewModel.startPolling()
                Lifecycle.Event.ON_STOP -> viewModel.stopPolling()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            viewModel.stopPolling()
        }
    }

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
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
            TopBar(
                showBack = true,
                showBrand = false,
                onBack = onBack,
            )
            Spacer(Modifier.height(8.dp))

            when {
                state.loading && state.data == null -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = Lime)
                        Text("Loading queue…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
                    }
                }

                state.data == null && !state.error.isNullOrBlank() -> {
                    Text(text = state.error ?: "", color = Danger)
                }

                state.data != null -> {
                    val data = state.data!!
                    val business = data.business
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        item {
                            val title = listOfNotNull(
                                business.name.takeIf { it.isNotBlank() },
                                business.branchName?.takeIf { it.isNotBlank() && it != "Main" },
                            ).joinToString(" · ")
                            Text(
                                text = title.ifBlank { business.name },
                                color = TextPrimary,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            val meta = listOfNotNull(
                                business.businessGroupName?.takeIf { it.isNotBlank() },
                                business.location?.takeIf { it.isNotBlank() },
                            ).joinToString(" · ")
                            if (meta.isNotBlank()) {
                                Text(text = meta, color = TextMuted, modifier = Modifier.padding(top = 4.dp))
                            }
                        }

                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                StatCard("Total waiting", "${business.waitingTotal}", Modifier.weight(1f))
                                StatCard("In app", "${business.appWaiting}", Modifier.weight(1f))
                                StatCard("Walk-ins", "${business.queueSize}", Modifier.weight(1f))
                            }
                        }

                        item {
                            WalkInStepper(
                                count = business.queueSize,
                                enabled = !state.actionBusy,
                                onDecrease = { viewModel.adjustWalkIns(-1) },
                                onIncrease = { viewModel.adjustWalkIns(1) },
                            )
                        }

                        if (!state.error.isNullOrBlank()) {
                            item {
                                Text(text = state.error ?: "", color = Danger)
                            }
                        }

                        if (data.entries.isEmpty()) {
                            item {
                                Text(
                                    text = "Queue is clear. Waiting for the next customer.",
                                    color = TextMuted,
                                    modifier = Modifier.padding(vertical = 24.dp),
                                )
                            }
                        } else {
                            itemsIndexed(data.entries, key = { _, entry -> entry.id }) { index, entry ->
                                QueueCard(
                                    entry = entry,
                                    isNow = index == 0,
                                    busy = state.actionBusy,
                                    onServe = { viewModel.serve(entry) },
                                    onNoShow = { viewModel.noShow(entry) },
                                )
                            }
                        }

                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
        VendorBottomBar(
            selected = VendorTab.Queue,
            onQueue = {},
            onProfile = onOpenProfile,
            onSignOut = onSignOut,
        )
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(SurfaceCard, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = value, color = Lime, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(text = label, color = TextMuted, fontSize = 12.sp)
    }
}

@Composable
private fun WalkInStepper(
    count: Int,
    enabled: Boolean,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Walk-in baseline", color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Text(
                text = "People physically in line who did not join via the app",
                color = TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                onClick = onDecrease,
                enabled = enabled && count > 0,
                shape = RoundedCornerShape(8.dp),
            ) { Text("−", fontSize = 20.sp) }
            Text(
                text = "$count",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                modifier = Modifier.padding(horizontal = 12.dp),
            )
            OutlinedButton(
                onClick = onIncrease,
                enabled = enabled && count < 500,
                shape = RoundedCornerShape(8.dp),
            ) { Text("+", fontSize = 20.sp) }
        }
    }
}

@Composable
private fun QueueCard(
    entry: QueueEntry,
    isNow: Boolean,
    busy: Boolean,
    onServe: () -> Unit,
    onNoShow: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                if (isNow) SurfaceCard.copy(alpha = 1f) else SurfaceCard.copy(alpha = 0.7f),
                RoundedCornerShape(14.dp),
            )
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isNow) "Now serving" else "Position #${entry.position}",
                    color = Lime,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    text = entry.customerFirstName ?: "Customer",
                    color = TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    text = "+${entry.customerPhone.orEmpty()}",
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatWaitMinutes(entry.estimatedWaitMinutes),
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                )
                Text(text = "est. wait", color = TextMuted, fontSize = 12.sp)
            }
        }
        if (isNow) {
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onServe,
                    enabled = !busy,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Lime,
                        contentColor = Navy,
                    ),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("Serve", fontWeight = FontWeight.SemiBold)
                }
                Button(
                    onClick = onNoShow,
                    enabled = !busy,
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Danger,
                        contentColor = TextPrimary,
                    ),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Text("No-show", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
