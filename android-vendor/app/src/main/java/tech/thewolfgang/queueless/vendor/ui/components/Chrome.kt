package tech.thewolfgang.queueless.vendor.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MiscellaneousServices
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.NavyElevated
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

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
        withStyle(SpanStyle(color = Lime, fontWeight = FontWeight.Bold)) {
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
        color = if (onDark) TextMuted.copy(alpha = 0.75f) else TextMuted,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
    )
}

@Composable
fun TopBar(
    title: String? = null,
    showBack: Boolean = false,
    showBrand: Boolean = true,
    onBack: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (showBack && onBack != null) {
            TextButton(onClick = onBack) {
                Text("Back")
            }
        }
        if (showBrand) {
            BrandMark(subtitle = title)
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
    Column(
        modifier = Modifier
            .background(NavyElevated)
            .semantics { contentDescription = "Main navigation" },
    ) {
        HorizontalDivider(color = TextMuted.copy(alpha = 0.2f))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 2.dp, vertical = 6.dp),
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
                .padding(bottom = 8.dp),
            onDark = true,
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
    val tint = if (selected) Lime else TextMuted
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
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(22.dp),
        )
        Text(
            text = label,
            color = tint,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
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
