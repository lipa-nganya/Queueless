package tech.thewolfgang.queueless.vendor.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.ui.theme.Lime
import tech.thewolfgang.queueless.vendor.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BranchSwitcherCard(
    branchName: String,
    meta: String?,
    branches: List<BusinessProfile>,
    selectedId: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val canSwitch = branches.size > 1
    val selectedLabel = branches
        .find { it.id == selectedId }
        ?.let { branch ->
            buildString {
                append(branch.name)
                if (!branch.isActive) append(" (inactive)")
            }
        }
        ?: branchName

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(SurfaceCard, RoundedCornerShape(14.dp))
            .padding(16.dp)
            .semantics {
                contentDescription = "Current branch $branchName"
            },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "CURRENT BRANCH",
            color = TextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
        Text(
            text = branchName,
            color = TextPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
        )
        if (!meta.isNullOrBlank()) {
            Text(
                text = meta,
                color = TextMuted,
                fontSize = 14.sp,
            )
        }

        ExposedDropdownMenuBox(
            expanded = expanded && canSwitch,
            onExpandedChange = { if (canSwitch) expanded = !expanded },
        ) {
            OutlinedTextField(
                value = selectedLabel,
                onValueChange = {},
                readOnly = true,
                enabled = canSwitch,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                label = { Text(if (canSwitch) "Switch branch" else "Only branch") },
                trailingIcon = {
                    if (canSwitch) {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Lime,
                    unfocusedBorderColor = TextMuted.copy(alpha = 0.4f),
                    focusedLabelColor = Lime,
                    unfocusedLabelColor = TextMuted,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    disabledTextColor = TextPrimary,
                    disabledBorderColor = TextMuted.copy(alpha = 0.25f),
                    disabledLabelColor = TextMuted,
                ),
            )
            ExposedDropdownMenu(
                expanded = expanded && canSwitch,
                onDismissRequest = { expanded = false },
            ) {
                branches.forEach { branch ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(
                                    text = buildString {
                                        append(branch.name)
                                        if (!branch.isActive) append(" (inactive)")
                                    },
                                    fontWeight = if (branch.id == selectedId) {
                                        FontWeight.Bold
                                    } else {
                                        FontWeight.Normal
                                    },
                                )
                                if (!branch.location.isNullOrBlank()) {
                                    Text(
                                        text = branch.location.orEmpty(),
                                        color = TextMuted,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        },
                        onClick = {
                            expanded = false
                            if (branch.id != selectedId) onSelect(branch.id)
                        },
                    )
                }
            }
        }
    }
}
