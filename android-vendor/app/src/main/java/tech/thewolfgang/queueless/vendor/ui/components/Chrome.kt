package tech.thewolfgang.queueless.vendor.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MiscellaneousServices
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tech.thewolfgang.queueless.vendor.BuildConfig
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextFaint
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import tech.thewolfgang.queueless.vendor.ui.theme.Danger
import tech.thewolfgang.queueless.vendor.ui.theme.OnDanger

enum class VendorTab {
    Queue,
    Branches,
    Services,
    Profile,
}

@Composable
fun BrandMark(
    modifier: Modifier = Modifier,
    subtitle: String? = null,
) {
    val title = buildAnnotatedString {
        withStyle(SpanStyle(color = TextPrimary, fontWeight = FontWeight.Bold)) {
            append("Queue")
        }
        withStyle(SpanStyle(color = LimeInk, fontWeight = FontWeight.Bold)) {
            append("less")
        }
    }
    Text(
        text = title,
        modifier = modifier.semantics { contentDescription = "Queueless" },
    )
    if (!subtitle.isNullOrBlank()) {
        Text(
            text = subtitle,
            color = TextMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
fun AppVersionLabel(
    modifier: Modifier = Modifier,
    onDark: Boolean = false,
) {
    Text(
        text = "v${BuildConfig.VERSION_NAME}",
        modifier = modifier.semantics {
            contentDescription = "App version ${BuildConfig.VERSION_NAME}"
        },
        color = if (onDark) Color.White.copy(alpha = 0.6f) else TextFaint,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
    )
}

/** The notifications bell every top bar shows: unread count and where tapping it goes. */
data class NotificationsEntry(
    val unread: Int,
    val onOpen: () -> Unit,
)

val LocalNotificationsEntry = compositionLocalOf<NotificationsEntry?> { null }

@Composable
fun TopBar(
    title: String? = null,
    showBack: Boolean = false,
    showBrand: Boolean = true,
    onBack: (() -> Unit)? = null,
    showNotifications: Boolean = true,
) {
    val notifications = LocalNotificationsEntry.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showBack && onBack != null) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(FieldShape)
                    .background(SurfaceCard)
                    .semantics { role = Role.Button }
                    .clickable(onClickLabel = "Back", onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = TextPrimary,
                    modifier = Modifier.size(22.dp),
                )
            }
            if (showBrand) Spacer(Modifier.width(12.dp))
        }
        if (showBrand) {
            BrandMark(subtitle = title)
        }
        if (showNotifications && notifications != null) {
            Spacer(Modifier.weight(1f))
            NotificationsBell(entry = notifications)
        }
    }
}

@Composable
private fun NotificationsBell(entry: NotificationsEntry) {
    val label = if (entry.unread > 0) {
        "Notifications, ${entry.unread} unread"
    } else {
        "Notifications"
    }
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(FieldShape)
            .background(SurfaceCard)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                contentDescription = label
            }
            .clickable(onClick = entry.onOpen),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Notifications,
            contentDescription = null,
            tint = TextPrimary,
            modifier = Modifier.size(22.dp),
        )
        if (entry.unread > 0) {
            Text(
                text = if (entry.unread > 9) "9+" else entry.unread.toString(),
                color = OnDanger,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 4.dp, end = 4.dp)
                    .background(Danger, CircleShape)
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            )
        }
    }
}

@Composable
fun VendorBottomBar(
    selected: VendorTab,
    onQueue: () -> Unit,
    onBranches: () -> Unit,
    onServices: () -> Unit,
    onProfile: () -> Unit,
    onSignOut: () -> Unit,
) {
    val barShape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    Column(
        modifier = Modifier
            .shadow(18.dp, barShape, ambientColor = Navy.copy(alpha = 0.25f), spotColor = Navy.copy(alpha = 0.25f))
            .background(PageBackground, barShape)
            .semantics { contentDescription = "Main navigation" },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BottomItem(
                selected = selected == VendorTab.Queue,
                label = "Queue",
                icon = Icons.Filled.Home,
                onClick = onQueue,
                role = BottomRole.Tab,
                modifier = Modifier.weight(1f),
            )
            BottomItem(
                selected = selected == VendorTab.Branches,
                label = "Branches",
                icon = Icons.Filled.AccountTree,
                onClick = onBranches,
                role = BottomRole.Tab,
                modifier = Modifier.weight(1f),
            )
            BottomItem(
                selected = selected == VendorTab.Services,
                label = "Services",
                icon = Icons.Filled.MiscellaneousServices,
                onClick = onServices,
                role = BottomRole.Tab,
                modifier = Modifier.weight(1f),
            )
            BottomItem(
                selected = selected == VendorTab.Profile,
                label = "Settings",
                icon = Icons.Filled.Person,
                onClick = onProfile,
                role = BottomRole.Tab,
                modifier = Modifier.weight(1f),
            )
            BottomItem(
                selected = false,
                label = "Sign out",
                icon = Icons.AutoMirrored.Filled.Logout,
                onClick = onSignOut,
                role = BottomRole.Button,
                modifier = Modifier.weight(1f),
            )
        }
        AppVersionLabel(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 6.dp),
        )
    }
}

private enum class BottomRole { Tab, Button }

@Composable
private fun BottomItem(
    selected: Boolean,
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    role: BottomRole,
    modifier: Modifier = Modifier,
) {
    val tint = if (selected) LimeInk else TextMuted
    Column(
        modifier = modifier
            .semantics(mergeDescendants = true) {
                this.role = if (role == BottomRole.Tab) Role.Tab else Role.Button
                contentDescription = label
                if (role == BottomRole.Tab) {
                    this.selected = selected
                    stateDescription = if (selected) "Selected" else "Not selected"
                }
            }
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(top = 12.dp, bottom = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(24.dp),
        )
        Box(
            modifier = Modifier
                .size(5.dp)
                .background(if (selected) Lime else Color.Transparent, CircleShape),
        )
    }
}

fun formatWaitMinutes(minutes: Double): String {
    val total = minutes.toInt().coerceAtLeast(0)
    if (total < 60) return "$total min"
    val hours = total / 60
    val mins = total % 60
    return if (mins == 0) "${hours}h" else "${hours}h ${mins}min"
}
