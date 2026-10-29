package tech.thewolfgang.queueless.vendor.ui.notifications

import android.text.format.DateUtils
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonRemove
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import tech.thewolfgang.queueless.vendor.data.VendorNotification
import tech.thewolfgang.queueless.vendor.ui.components.TopBar
import tech.thewolfgang.queueless.vendor.ui.theme.CardShape
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.LimeDim
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TealInk
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import java.time.Instant

@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onBack: () -> Unit,
    onOpenQueue: (Int) -> Unit,
    onUnauthorized: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.unauthorized) {
        if (state.unauthorized) onUnauthorized()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PageBackground)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        TopBar(title = "Notifications", showBack = true, onBack = onBack, showNotifications = false)
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Notifications",
                color = TextPrimary,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (state.unreadCount > 0) {
                TextButton(onClick = viewModel::markAllRead) {
                    Text("Mark all read", color = LimeInk, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Text(
            text = "Activation, trial and queue updates for your account.",
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
                    CircularProgressIndicator(color = LimeDim)
                    Text("Loading…", color = TextMuted, modifier = Modifier.padding(top = 12.dp))
                }
            }

            !state.error.isNullOrBlank() && state.notifications.isEmpty() -> {
                Text(text = state.error ?: "", color = Danger)
            }

            state.notifications.isEmpty() -> {
                Text(text = "No notifications yet.", color = TextMuted)
            }

            else -> {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(state.notifications, key = { it.id }) { notification ->
                        NotificationRow(
                            notification = notification,
                            onClick = {
                                viewModel.markRead(notification)
                                notification.queueId?.let(onOpenQueue)
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(
    notification: VendorNotification,
    onClick: () -> Unit,
) {
    val time = relativeTime(notification.createdAt)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(if (notification.read) PageBackground else SurfaceCard)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = listOfNotNull(
                    if (notification.read) null else "Unread",
                    notification.title,
                    notification.body,
                    time,
                ).joinToString(", ")
            }
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(SurfaceCard, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = notificationIcon(notification.type),
                contentDescription = null,
                tint = TealInk,
                modifier = Modifier.size(22.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = notification.title,
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (!notification.read) {
                    Box(
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .size(8.dp)
                            .background(TealInk, CircleShape),
                    )
                }
            }
            if (notification.body.isNotBlank()) {
                Text(
                    text = notification.body,
                    color = TextMuted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (time != null) {
                Text(
                    text = time,
                    color = TextMuted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

private fun notificationIcon(type: String): ImageVector = when (type) {
    "vendor_activated" -> Icons.Filled.Verified
    "vendor_trial" -> Icons.Filled.Event
    "queue_join" -> Icons.Filled.PersonAdd
    "queue_leave" -> Icons.Filled.PersonRemove
    else -> Icons.Filled.Notifications
}

private fun relativeTime(createdAt: String?): String? {
    val millis = createdAt?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
        ?: return null
    return DateUtils.getRelativeTimeSpanString(
        millis,
        System.currentTimeMillis(),
        DateUtils.MINUTE_IN_MILLIS,
    ).toString()
}
