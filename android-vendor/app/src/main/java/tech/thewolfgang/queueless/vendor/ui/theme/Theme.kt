package tech.thewolfgang.queueless.vendor.ui.theme

import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.TextFieldColors
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tech.thewolfgang.queueless.vendor.R

val Navy = Color(0xFF0A0F1A)
val NavyElevated = Color(0xFF1C2740)
val Lime = Color(0xFFA6E600)
val LimeDim = Color(0xFF7AAB00)
val LimeInk = Color(0xFF4F6F00)
val LimeSoft = Color(0xFFEEF9D2)
val LimeBlob = Color(0xFFC8F45F)
val Teal = Color(0xFF00D1C1)
val TealInk = Color(0xFF00756C)
val PageBackground = Color(0xFFFFFFFF)
val TextPrimary = Color(0xFF0A0F1A)
val TextMuted = Color(0xFF717784)
val TextFaint = Color(0xFFA4A9B3)
val SurfaceCard = Color(0xFFF5F6F8)
val SurfaceMuted = Color(0xFFECEEF1)
val Danger = Color(0xFFD92D20)
val OnDanger = Color(0xFFFFFFFF)

val CardShape = RoundedCornerShape(20.dp)
val ButtonShape = RoundedCornerShape(16.dp)
val FieldShape = RoundedCornerShape(14.dp)
val ChipShape = RoundedCornerShape(12.dp)
val SheetShape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp)

val Poppins = FontFamily(
    Font(R.font.poppins_regular, FontWeight.Normal),
    Font(R.font.poppins_medium, FontWeight.Medium),
    Font(R.font.poppins_semibold, FontWeight.SemiBold),
    Font(R.font.poppins_bold, FontWeight.Bold),
)

private val ColorScheme = lightColorScheme(
    primary = LimeInk,
    onPrimary = PageBackground,
    primaryContainer = Lime,
    onPrimaryContainer = Navy,
    secondary = LimeInk,
    onSecondary = PageBackground,
    secondaryContainer = LimeSoft,
    onSecondaryContainer = LimeInk,
    tertiaryContainer = LimeSoft,
    onTertiaryContainer = LimeInk,
    background = PageBackground,
    onBackground = TextPrimary,
    surface = PageBackground,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceCard,
    onSurfaceVariant = TextMuted,
    surfaceContainer = PageBackground,
    surfaceContainerLow = SurfaceCard,
    surfaceContainerHigh = PageBackground,
    outline = TextFaint,
    outlineVariant = SurfaceMuted,
    error = Danger,
    onError = OnDanger,
)

private val Typography = Typography().run {
    fun TextStyle.poppins() = copy(fontFamily = Poppins)
    copy(
        displayLarge = displayLarge.poppins().copy(fontWeight = FontWeight.Bold, fontSize = 36.sp, letterSpacing = (-0.5).sp),
        displayMedium = displayMedium.poppins(),
        displaySmall = displaySmall.poppins(),
        headlineLarge = headlineLarge.poppins().copy(fontWeight = FontWeight.Bold),
        headlineMedium = headlineMedium.poppins().copy(fontWeight = FontWeight.Bold, fontSize = 26.sp),
        headlineSmall = headlineSmall.poppins().copy(fontWeight = FontWeight.SemiBold),
        titleLarge = titleLarge.poppins().copy(fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
        titleMedium = titleMedium.poppins().copy(fontWeight = FontWeight.SemiBold),
        titleSmall = titleSmall.poppins(),
        bodyLarge = bodyLarge.poppins().copy(fontSize = 15.sp),
        bodyMedium = bodyMedium.poppins(),
        bodySmall = bodySmall.poppins(),
        labelLarge = labelLarge.poppins().copy(fontWeight = FontWeight.SemiBold, fontSize = 14.sp),
        labelMedium = labelMedium.poppins(),
        labelSmall = labelSmall.poppins(),
    )
}

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = ChipShape,
    medium = FieldShape,
    large = CardShape,
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun queuelessFieldColors(): TextFieldColors = TextFieldDefaults.colors(
    focusedContainerColor = SurfaceMuted,
    unfocusedContainerColor = SurfaceCard,
    disabledContainerColor = SurfaceCard,
    errorContainerColor = Danger.copy(alpha = 0.08f),
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
    disabledIndicatorColor = Color.Transparent,
    errorIndicatorColor = Color.Transparent,
    focusedLabelColor = LimeInk,
    unfocusedLabelColor = TextMuted,
    disabledLabelColor = TextMuted,
    cursorColor = LimeInk,
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    disabledTextColor = TextPrimary,
    focusedPlaceholderColor = TextFaint,
    unfocusedPlaceholderColor = TextFaint,
    focusedTrailingIconColor = TextMuted,
    unfocusedTrailingIconColor = TextMuted,
)

@Composable
fun limeButtonColors(): ButtonColors = ButtonDefaults.buttonColors(
    containerColor = Lime,
    contentColor = Navy,
    disabledContainerColor = SurfaceMuted,
    disabledContentColor = TextFaint,
)

@Composable
fun GhostButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    shape: Shape = ButtonShape,
    content: @Composable RowScope.() -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
            containerColor = LimeSoft,
            contentColor = LimeInk,
            disabledContainerColor = SurfaceCard,
            disabledContentColor = TextFaint,
        ),
        content = content,
    )
}

/** Solid card with a lighter circle in the top-right corner, as on the Figma subject cards. */
fun Modifier.blobCard(color: Color, blob: Color): Modifier = this
    .clip(CardShape)
    .drawBehind {
        drawRect(color)
        drawCircle(blob, radius = 54.dp.toPx(), center = Offset(size.width, 0f))
    }

fun Modifier.limeCard(): Modifier = blobCard(Lime, LimeBlob)

fun Modifier.navyCard(): Modifier = blobCard(Navy, NavyElevated)

@Composable
fun QueuelessTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ColorScheme,
        typography = Typography,
        shapes = AppShapes,
        content = content,
    )
}
