package tech.thewolfgang.queueless.vendor.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.Role as SemanticsRole

fun Modifier.accessibleButton(
    label: String,
    selected: Boolean? = null,
    stateDescription: String? = null,
): Modifier = semantics {
    role = SemanticsRole.Button
    contentDescription = label
    if (selected != null) {
        this.selected = selected
    }
    if (!stateDescription.isNullOrBlank()) {
        this.stateDescription = stateDescription
    }
}

fun Modifier.accessibleTab(
    label: String,
    selected: Boolean,
): Modifier = semantics {
    role = SemanticsRole.Tab
    contentDescription = label
    this.selected = selected
    this.stateDescription = if (selected) "Selected" else "Not selected"
}

fun Modifier.liveStatus(): Modifier = semantics {
    liveRegion = LiveRegionMode.Polite
}

@Composable
fun LiveStatusText(
    text: String,
    modifier: Modifier = Modifier,
    color: androidx.compose.ui.graphics.Color,
) {
    androidx.compose.material3.Text(
        text = text,
        color = color,
        modifier = modifier.liveStatus(),
    )
}
