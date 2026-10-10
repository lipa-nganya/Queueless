package tech.thewolfgang.queueless.customer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
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
import tech.thewolfgang.queueless.customer.BuildConfig
import tech.thewolfgang.queueless.customer.ui.theme.ButtonShape
import tech.thewolfgang.queueless.customer.ui.theme.CardShape
import tech.thewolfgang.queueless.customer.ui.theme.Danger
import tech.thewolfgang.queueless.customer.ui.theme.FieldShape
import tech.thewolfgang.queueless.customer.ui.theme.Lime
import tech.thewolfgang.queueless.customer.ui.theme.LimeDim
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.LimeSoft
import tech.thewolfgang.queueless.customer.ui.theme.Navy
import tech.thewolfgang.queueless.customer.ui.theme.PageBackground
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextFaint
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import tech.thewolfgang.queueless.customer.ui.theme.limeButtonColors

enum class CustomerTab { Discover, Queue, Bookings, Profile }

@Composable
fun BrandMark(modifier: Modifier = Modifier) {
    Text(
        text = buildAnnotatedString {
            withStyle(SpanStyle(color = TextPrimary, fontWeight = FontWeight.Bold)) { append("Queue") }
            withStyle(SpanStyle(color = LimeInk, fontWeight = FontWeight.Bold)) { append("less") }
        },
        fontSize = 22.sp,
        modifier = modifier.semantics { contentDescription = "Queueless" },
    )
}

@Composable
fun TopBar(onBack: (() -> Unit)? = null) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(FieldShape)
                    .background(SurfaceCard)
                    .clickable(onClickLabel = "Back", role = Role.Button, onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = TextPrimary,
                    modifier = Modifier.size(22.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
        }
        BrandMark()
    }
}

@Composable
fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = title,
            color = TextPrimary,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() },
        )
        if (!subtitle.isNullOrBlank()) Text(subtitle, color = TextMuted)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = TextPrimary,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier.semantics { heading() },
    )
}

@Composable
fun StatusBanner(text: String?, isError: Boolean) {
    if (text.isNullOrBlank()) return
    Text(
        text = text,
        color = if (isError) Danger else LimeInk,
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isError) Danger.copy(alpha = 0.08f) else LimeSoft, FieldShape)
            .padding(horizontal = 14.dp, vertical = 12.dp)
            .semantics { liveRegion = if (isError) LiveRegionMode.Assertive else LiveRegionMode.Polite },
    )
}

@Composable
fun PrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    enabled: Boolean = true,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier
            .fillMaxWidth()
            .height(54.dp),
        colors = limeButtonColors(),
        shape = ButtonShape,
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = Navy,
                strokeWidth = 2.dp,
                modifier = Modifier
                    .size(22.dp)
                    .semantics { contentDescription = "Loading" },
            )
        } else {
            Text(label, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun LoadingState(label: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator(color = LimeDim)
        Text(label, color = TextMuted, modifier = Modifier.padding(top = 12.dp))
    }
}

/** Full-width radio row; the whole row is the touch target and announces as a radio button. */
@Composable
fun ChoiceRow(
    selected: Boolean,
    title: String,
    subtitle: String? = null,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(if (selected) LimeSoft else SurfaceCard)
            .border(1.5.dp, if (selected) LimeDim else Color.Transparent, CardShape)
            .selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(
            selected = selected,
            onClick = null,
            enabled = enabled,
            colors = RadioButtonDefaults.colors(selectedColor = LimeInk),
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = if (enabled) TextPrimary else TextFaint, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = TextMuted, fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun AppVersionLabel(modifier: Modifier = Modifier) {
    val apiHost = android.net.Uri.parse(BuildConfig.API_BASE_URL).host.orEmpty()
    Text(
        text = if (BuildConfig.ENV_NAME == "production") {
            "v${BuildConfig.VERSION_NAME}"
        } else {
            "v${BuildConfig.VERSION_NAME} · $apiHost"
        },
        modifier = modifier.semantics { contentDescription = "App version ${BuildConfig.VERSION_NAME}" },
        color = TextFaint,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        textAlign = TextAlign.Center,
    )
}

@Composable
fun CustomerBottomBar(
    selected: CustomerTab,
    signedIn: Boolean,
    onSelect: (CustomerTab) -> Unit,
) {
    val barShape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    Row(
        modifier = Modifier
            .shadow(18.dp, barShape, ambientColor = Navy.copy(alpha = 0.25f), spotColor = Navy.copy(alpha = 0.25f))
            .background(PageBackground, barShape)
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp)
            .semantics { contentDescription = "Main navigation" },
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        BottomItem(selected == CustomerTab.Discover, "Discover", Icons.Filled.Explore, Modifier.weight(1f)) {
            onSelect(CustomerTab.Discover)
        }
        BottomItem(selected == CustomerTab.Queue, "My queue", Icons.Filled.HourglassTop, Modifier.weight(1f)) {
            onSelect(CustomerTab.Queue)
        }
        BottomItem(selected == CustomerTab.Bookings, "Bookings", Icons.Filled.EventNote, Modifier.weight(1f)) {
            onSelect(CustomerTab.Bookings)
        }
        BottomItem(
            selected = selected == CustomerTab.Profile,
            label = if (signedIn) "Profile" else "Log in",
            icon = if (signedIn) Icons.Filled.Person else Icons.AutoMirrored.Filled.Login,
            modifier = Modifier.weight(1f),
        ) { onSelect(CustomerTab.Profile) }
    }
}

@Composable
private fun BottomItem(
    selected: Boolean,
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val tint = if (selected) LimeInk else TextMuted
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .semantics(mergeDescendants = true) {
                role = Role.Tab
                this.selected = selected
                stateDescription = if (selected) "Selected" else "Not selected"
            }
            .clickable(onClick = onClick)
            .padding(top = 10.dp, bottom = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
        Text(label, color = tint, fontSize = 11.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
        Box(
            modifier = Modifier
                .size(5.dp)
                .background(if (selected) Lime else Color.Transparent, CircleShape),
        )
    }
}

@Composable
fun InfoChip(text: String, modifier: Modifier = Modifier, warning: Boolean = false) {
    Text(
        text = text,
        color = if (warning) Danger else LimeInk,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .background(if (warning) Danger.copy(alpha = 0.08f) else LimeSoft, RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
fun MutedChip(text: String) {
    Text(
        text = text,
        color = TextMuted,
        fontSize = 12.sp,
        modifier = Modifier
            .background(SurfaceMuted, RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

fun formatWaitMinutes(minutes: Double): String {
    val total = minutes.toInt().coerceAtLeast(0)
    if (total < 60) return "$total min"
    val hours = total / 60
    val mins = total % 60
    return if (mins == 0) "${hours}h" else "${hours}h ${mins}min"
}

fun peopleLabel(count: Int): String = if (count == 1) "1 person" else "$count people"
