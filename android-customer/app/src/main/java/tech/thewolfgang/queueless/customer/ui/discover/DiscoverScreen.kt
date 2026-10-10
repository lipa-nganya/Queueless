package tech.thewolfgang.queueless.customer.ui.discover

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.Business
import tech.thewolfgang.queueless.customer.data.BusinessGroup
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.ui.components.InfoChip
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.MutedChip
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.customer.ui.components.peopleLabel
import tech.thewolfgang.queueless.customer.ui.theme.CardShape
import tech.thewolfgang.queueless.customer.ui.theme.ChipShape
import tech.thewolfgang.queueless.customer.ui.theme.FieldShape
import tech.thewolfgang.queueless.customer.ui.theme.LimeInk
import tech.thewolfgang.queueless.customer.ui.theme.LimeSoft
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceCard
import tech.thewolfgang.queueless.customer.ui.theme.SurfaceMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextMuted
import tech.thewolfgang.queueless.customer.ui.theme.TextPrimary
import tech.thewolfgang.queueless.customer.ui.theme.queuelessFieldColors

data class DiscoverUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val groups: List<BusinessGroup> = emptyList(),
    val businesses: List<Business> = emptyList(),
    val groupId: Int? = null,
    val query: String = "",
) {
    val visible: List<Business>
        get() {
            val q = query.trim().lowercase()
            return businesses.filter { business ->
                (groupId == null || business.businessGroupId == groupId) &&
                    (
                        q.isEmpty() ||
                            business.name.lowercase().contains(q) ||
                            business.location.orEmpty().lowercase().contains(q) ||
                            business.businessGroupName.orEmpty().lowercase().contains(q) ||
                            business.branches.any { it.name.lowercase().contains(q) || it.location.orEmpty().lowercase().contains(q) }
                        )
            }
        }
}

class DiscoverViewModel(private val repository: CustomerRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(DiscoverUiState())
    val uiState: StateFlow<DiscoverUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = it.businesses.isEmpty(), error = null) }
            try {
                val groups = async { repository.groups() }
                val businesses = async { repository.businesses() }
                _uiState.update {
                    it.copy(loading = false, groups = groups.await(), businesses = businesses.await())
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load businesses.") }
            }
        }
    }

    fun onQuery(value: String) = _uiState.update { it.copy(query = value) }

    fun onGroup(groupId: Int?) = _uiState.update { it.copy(groupId = groupId) }

    fun imageUrl(path: String?) = repository.imageUrl(path)
}

@Composable
fun DiscoverScreen(
    viewModel: DiscoverViewModel,
    onOpenBusiness: (Int) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        TopBar()
        if (state.loading) {
            LoadingState("Loading businesses…")
            return@Column
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ScreenTitle(
                    title = "Skip the line",
                    subtitle = "Find a place, see how busy it is, and join the queue from your phone.",
                )
            }
            item {
                TextField(
                    value = state.query,
                    onValueChange = viewModel::onQuery,
                    modifier = Modifier.fillMaxWidth(),
                    shape = FieldShape,
                    singleLine = true,
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    label = { Text("Search businesses or areas") },
                    colors = queuelessFieldColors(),
                )
            }
            if (state.groups.isNotEmpty()) {
                item {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item {
                            GroupChip("All", state.groupId == null) { viewModel.onGroup(null) }
                        }
                        items(state.groups, key = { it.id }) { group ->
                            GroupChip(group.name, state.groupId == group.id) { viewModel.onGroup(group.id) }
                        }
                    }
                }
            }
            if (!state.error.isNullOrBlank()) {
                item {
                    StatusBanner(state.error, isError = true)
                    TextButton(onClick = viewModel::load) { Text("Try again", color = LimeInk) }
                }
            }
            val visible = state.visible
            if (visible.isEmpty() && state.error == null) {
                item {
                    Text(
                        text = if (state.query.isNotBlank() || state.groupId != null) {
                            "No businesses match. Try another search or category."
                        } else {
                            "No businesses are taking queues yet."
                        },
                        color = TextMuted,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                }
            }
            items(visible, key = { it.id }) { business ->
                BusinessCard(
                    business = business,
                    imageUrl = viewModel.imageUrl(business.imageUrl),
                    onClick = { onOpenBusiness(business.id) },
                )
            }
            item { Spacer(Modifier.height(12.dp)) }
        }
    }
}

@Composable
private fun GroupChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        shape = ChipShape,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = LimeSoft,
            selectedLabelColor = LimeInk,
        ),
    )
}

@Composable
private fun BusinessCard(business: Business, imageUrl: String?, onClick: () -> Unit) {
    val branchCount = business.branches.size
    val openBranches = business.branches.count { !it.queuePaused }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(SurfaceCard)
            .clickable(onClickLabel = "Open ${business.name}", role = Role.Button, onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(ChipShape)
                .background(SurfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            if (imageUrl != null) {
                AsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Icon(Icons.Filled.Storefront, contentDescription = null, tint = TextMuted)
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                business.name,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                listOfNotNull(
                    business.businessGroupName,
                    if (branchCount > 1) "$branchCount branches" else business.location,
                ).joinToString(" · "),
                color = TextMuted,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (branchCount > 0 && openBranches == 0) {
                    InfoChip("On a short break", warning = true)
                } else {
                    InfoChip(if (business.queueSize == 0) "No wait" else "${peopleLabel(business.queueSize)} waiting")
                    business.avgWaitMinutes?.takeIf { business.queueSize > 0 }?.let {
                        MutedChip("~${formatWaitMinutes(it)} each")
                    }
                }
            }
        }
    }
}
