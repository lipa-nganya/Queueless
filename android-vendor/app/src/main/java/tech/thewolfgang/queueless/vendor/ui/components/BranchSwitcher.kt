package tech.thewolfgang.queueless.vendor.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import tech.thewolfgang.queueless.vendor.data.BusinessProfile
import tech.thewolfgang.queueless.vendor.ui.theme.FieldShape
import tech.thewolfgang.queueless.vendor.ui.theme.LimeInk
import tech.thewolfgang.queueless.vendor.ui.theme.PageBackground
import tech.thewolfgang.queueless.vendor.ui.theme.TextMuted
import tech.thewolfgang.queueless.vendor.ui.theme.TextPrimary
import tech.thewolfgang.queueless.vendor.ui.theme.navyCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BranchSwitcherCard(
    branchName: String,
    meta: String?,
    allBranches: List<BusinessProfile>,
    selectedId: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val branches = allBranches.filter { it.isActive || it.id == selectedId }
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
            .navyCard()
            .padding(18.dp)
            .semantics {
                contentDescription = "Current branch $branchName"
            },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "Current branch",
            color = Color.White.copy(alpha = 0.65f),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        )
        Text(
            text = branchName,
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
        )
        if (!meta.isNullOrBlank()) {
            Text(
                text = meta,
                color = Color.White.copy(alpha = 0.7f),
                fontSize = 14.sp,
            )
        }

        ExposedDropdownMenuBox(
            expanded = expanded && canSwitch,
            onExpandedChange = { if (canSwitch) expanded = !expanded },
        ) {
            TextField(
                shape = FieldShape,
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
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = PageBackground,
                    unfocusedContainerColor = PageBackground,
                    disabledContainerColor = PageBackground.copy(alpha = 0.12f),
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent,
                    focusedLabelColor = LimeInk,
                    unfocusedLabelColor = TextMuted,
                    disabledLabelColor = Color.White.copy(alpha = 0.6f),
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    disabledTextColor = Color.White,
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
