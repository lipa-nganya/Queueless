package tech.thewolfgang.queueless.customer.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.thewolfgang.queueless.customer.data.AccessibilityOptions
import tech.thewolfgang.queueless.customer.ui.theme.ChipShape
import tech.thewolfgang.queueless.customer.ui.theme.FieldShape
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.LimeSoft
import tech.thewolfgang.queueless.customer.ui.theme.queuelessFieldColors

/**
 * [offered] limits the choices to what a branch supports (joining a queue); null shows
 * every option (the customer's own profile). Saved needs that aren't shown stay selected.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AccessibilityNeedsPicker(
    selected: List<String>,
    note: String,
    onToggle: (String) -> Unit,
    onNoteChange: (String) -> Unit,
    enabled: Boolean = true,
    offered: List<String>? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            AccessibilityOptions.all.filter { offered == null || it.id in offered }.forEach { option ->
                FilterChip(
                    selected = option.id in selected,
                    onClick = { onToggle(option.id) },
                    enabled = enabled,
                    label = { Text(option.need) },
                    leadingIcon = {
                        Icon(option.icon, contentDescription = null, modifier = Modifier.size(18.dp))
                    },
                    shape = ChipShape,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = LimeSoft,
                        selectedLabelColor = LimeInk,
                        selectedLeadingIconColor = LimeInk,
                    ),
                )
            }
        }
        TextField(
            value = note,
            onValueChange = { onNoteChange(it.take(AccessibilityOptions.NOTE_MAX)) },
            modifier = Modifier.fillMaxWidth(),
            shape = FieldShape,
            enabled = enabled,
            label = { Text("Anything else? (optional)") },
            placeholder = { Text("e.g. I'll arrive with my guide dog") },
            colors = queuelessFieldColors(),
        )
    }
}
