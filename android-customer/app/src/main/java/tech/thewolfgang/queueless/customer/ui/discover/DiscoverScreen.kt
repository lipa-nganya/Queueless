package tech.thewolfgang.queueless.customer.ui.discover

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import coil.compose.AsyncImage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import tech.thewolfgang.queueless.customer.data.Business
import tech.thewolfgang.queueless.customer.data.BusinessGroup
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.data.Travel
import tech.thewolfgang.queueless.customer.data.UserLocation
import tech.thewolfgang.queueless.customer.data.nearestTravelFrom
import tech.thewolfgang.queueless.customer.ui.components.InfoChip
import tech.thewolfgang.queueless.customer.ui.components.LoadingState
import tech.thewolfgang.queueless.customer.ui.components.MutedChip
import tech.thewolfgang.queueless.customer.ui.components.ScreenTitle
import tech.thewolfgang.queueless.customer.ui.components.StatusBanner
import tech.thewolfgang.queueless.customer.ui.components.TopBar
import tech.thewolfgang.queueless.customer.ui.components.formatWaitMinutes
import tech.thewolfgang.queueless.customer.ui.components.peopleLabel
import tech.thewolfgang.queueless.customer.ui.components.placeholderBusinessImage
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
                // coroutineScope keeps a failed async inside this try; otherwise it also fails the
                // launch and crashes the app even though the error was caught here.
                val (groups, businesses) = coroutineScope {
                    val groups = async { repository.groups() }
                    val businesses = async { repository.businesses() }
                    groups.await() to businesses.await()
                }
                _uiState.update { it.copy(loading = false, groups = groups, businesses = businesses) }
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
    userLocation: UserLocation,
    onOpenBusiness: (Int) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val origin by userLocation.current.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var locating by remember { mutableStateOf(false) }

    fun refreshLocation() {
        if (locating) return
        scope.launch {
            locating = true
            userLocation.refresh()
            locating = false
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) refreshLocation()
    }

    fun useMyLocation() {
        val activity = context as? Activity
        when {
            userLocation.hasPermission -> refreshLocation()
            // Denied twice: Android won't show the prompt again, so send them to the app's settings.
            userLocation.asked && activity != null &&
                !ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.ACCESS_COARSE_LOCATION) ->
                context.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
                )
            else -> {
                userLocation.asked = true
                permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
        }
    }

    // Ask once on first visit so cards can show travel time; afterwards only when tapped.
    LaunchedEffect(Unit) {
        if (!userLocation.hasPermission && !userLocation.asked) {
            userLocation.asked = true
            permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
    }
    // Also picks up a permission granted from Settings when the customer comes back.
    LifecycleResumeEffect(Unit) {
        if (userLocation.hasPermission && origin == null) refreshLocation()
        onPauseOrDispose { }
    }

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
                LocationRow(located = origin != null, locating = locating, onClick = ::useMyLocation)
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
            itemsIndexed(visible, key = { _, business -> business.id }) { _, business ->
                BusinessCard(
                    business = business,
                    travel = business.nearestTravelFrom(origin),
                    imageUrl = viewModel.imageUrl(business.imageUrl)
                        ?: placeholderBusinessImage(business.id),
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
private fun LocationRow(located: Boolean, locating: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(ChipShape)
            .clickable(
                enabled = !locating,
                onClickLabel = if (located) "Refresh your location" else "Use your location",
                role = Role.Button,
                onClick = onClick,
            )
            .padding(vertical = 6.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = LimeInk, modifier = Modifier.size(20.dp))
        Text(
            when {
                locating -> "Finding your location…"
                located -> "Showing distance from you"
                else -> "Use my location to see how far each place is"
            },
            color = LimeInk,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
        )
    }
}

@Composable
private fun BusinessCard(business: Business, travel: Travel?, imageUrl: String?, onClick: () -> Unit) {
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
            travel?.let {
                Text(
                    if (branchCount > 1) "Nearest branch: ${it.summary}" else it.summary,
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
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
