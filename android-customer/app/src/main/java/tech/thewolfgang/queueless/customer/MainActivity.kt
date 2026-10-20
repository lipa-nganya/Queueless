package tech.thewolfgang.queueless.customer

import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import tech.thewolfgang.queueless.customer.data.CustomerRepository
import tech.thewolfgang.queueless.customer.ui.bookings.BookingsScreen
import tech.thewolfgang.queueless.customer.ui.bookings.BookingsViewModel
import tech.thewolfgang.queueless.customer.ui.business.BusinessScreen
import tech.thewolfgang.queueless.customer.ui.business.BusinessViewModel
import tech.thewolfgang.queueless.customer.ui.components.CustomerBottomBar
import tech.thewolfgang.queueless.customer.ui.components.CustomerTab
import tech.thewolfgang.queueless.customer.ui.discover.DiscoverScreen
import tech.thewolfgang.queueless.customer.ui.discover.DiscoverViewModel
import tech.thewolfgang.queueless.customer.ui.login.LoginScreen
import tech.thewolfgang.queueless.customer.ui.login.LoginViewModel
import tech.thewolfgang.queueless.customer.ui.profile.ProfileScreen
import tech.thewolfgang.queueless.customer.ui.profile.ProfileViewModel
import tech.thewolfgang.queueless.customer.ui.queue.MyQueueScreen
import tech.thewolfgang.queueless.customer.ui.queue.MyQueueViewModel
import tech.thewolfgang.queueless.customer.ui.theme.PageBackground
import tech.thewolfgang.queueless.customer.ui.theme.QueuelessTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.WHITE, Color.WHITE),
            navigationBarStyle = SystemBarStyle.light(Color.WHITE, Color.WHITE),
        )
        val repository = (application as QueuelessCustomerApp).repository
        setContent {
            QueuelessTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .safeDrawingPadding(),
                    color = PageBackground,
                ) {
                    CustomerNav(repository)
                }
            }
        }
    }
}

private object Routes {
    const val Discover = "discover"
    const val Queue = "queue"
    const val Bookings = "bookings"
    const val Profile = "profile"
    const val Business = "business/{businessId}"
    const val Login = "login?reason={reason}&return={return}"

    fun business(id: Int) = "business/$id"
    fun login(reason: String?, returnTo: String) =
        "login?reason=${Uri.encode(reason.orEmpty())}&return=${Uri.encode(returnTo)}"
}

private val TAB_ROUTES = mapOf(
    Routes.Discover to CustomerTab.Discover,
    Routes.Queue to CustomerTab.Queue,
    Routes.Bookings to CustomerTab.Bookings,
    Routes.Profile to CustomerTab.Profile,
)

private fun NavHostController.goToTab(route: String) {
    navigate(route) {
        popUpTo(Routes.Discover) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
private fun CustomerNav(repository: CustomerRepository) {
    val navController = rememberNavController()
    val signedIn by repository.signedIn.collectAsStateWithLifecycle()
    val backStack by navController.currentBackStackEntryAsState()
    val currentTab = TAB_ROUTES[backStack?.destination?.route]

    fun requireLogin(reason: String, returnTo: String) {
        navController.navigate(Routes.login(reason, returnTo))
    }

    fun openTab(tab: CustomerTab) {
        val route = TAB_ROUTES.entries.first { it.value == tab }.key
        val reason = when (tab) {
            CustomerTab.Discover -> null
            CustomerTab.Queue -> "Log in to see your place in line."
            CustomerTab.Bookings -> "Log in to see your bookings."
            CustomerTab.Profile -> "Log in to manage your profile."
        }
        if (reason != null && !repository.hasSession()) requireLogin(reason, route) else navController.goToTab(route)
    }

    fun signedOut() {
        navController.navigate(Routes.Discover) {
            popUpTo(navController.graph.id) { inclusive = true }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            NavHost(navController = navController, startDestination = Routes.Discover) {
                composable(Routes.Discover) {
                    val vm: DiscoverViewModel = viewModel(factory = viewModelFactory {
                        initializer { DiscoverViewModel(repository) }
                    })
                    DiscoverScreen(
                        viewModel = vm,
                        onOpenBusiness = { navController.navigate(Routes.business(it)) },
                    )
                }
                composable(
                    Routes.Business,
                    arguments = listOf(navArgument("businessId") { type = NavType.IntType }),
                ) { entry ->
                    val businessId = entry.arguments?.getInt("businessId") ?: 0
                    val vm: BusinessViewModel = viewModel(factory = viewModelFactory {
                        initializer { BusinessViewModel(businessId, repository) }
                    })
                    BusinessScreen(
                        viewModel = vm,
                        onBack = { navController.popBackStack() },
                        onRequireLogin = { reason -> requireLogin(reason, Routes.business(businessId)) },
                        onJoined = { navController.goToTab(Routes.Queue) },
                        onBooked = { navController.goToTab(Routes.Bookings) },
                        onOpenQueue = { navController.goToTab(Routes.Queue) },
                    )
                }
                composable(Routes.Queue) {
                    val vm: MyQueueViewModel = viewModel(factory = viewModelFactory {
                        initializer { MyQueueViewModel(repository) }
                    })
                    MyQueueScreen(
                        viewModel = vm,
                        onDiscover = { navController.goToTab(Routes.Discover) },
                        onUnauthorized = { requireLogin("Your session ended. Log in again.", Routes.Queue) },
                    )
                }
                composable(Routes.Bookings) {
                    val vm: BookingsViewModel = viewModel(factory = viewModelFactory {
                        initializer { BookingsViewModel(repository) }
                    })
                    BookingsScreen(
                        viewModel = vm,
                        onDiscover = { navController.goToTab(Routes.Discover) },
                        onCheckedIn = { navController.goToTab(Routes.Queue) },
                        onUnauthorized = { requireLogin("Your session ended. Log in again.", Routes.Bookings) },
                    )
                }
                composable(Routes.Profile) {
                    val vm: ProfileViewModel = viewModel(factory = viewModelFactory {
                        initializer { ProfileViewModel(repository) }
                    })
                    ProfileScreen(viewModel = vm, onSignedOut = ::signedOut)
                }
                composable(
                    Routes.Login,
                    arguments = listOf(
                        navArgument("reason") { type = NavType.StringType; defaultValue = "" },
                        navArgument("return") { type = NavType.StringType; defaultValue = Routes.Discover },
                    ),
                ) { entry ->
                    val reason = entry.arguments?.getString("reason")?.takeIf { it.isNotBlank() }
                    val returnTo = entry.arguments?.getString("return") ?: Routes.Discover
                    val vm: LoginViewModel = viewModel(factory = viewModelFactory {
                        initializer { LoginViewModel(repository) }
                    })
                    LoginScreen(
                        viewModel = vm,
                        reason = reason,
                        onSignedIn = {
                            navController.popBackStack()
                            val current = navController.currentBackStackEntry
                            val backOnTarget = current?.destination?.route == Routes.Business &&
                                returnTo == Routes.business(current.arguments?.getInt("businessId") ?: -1)
                            when {
                                backOnTarget -> Unit
                                returnTo in TAB_ROUTES -> navController.goToTab(returnTo)
                                else -> navController.navigate(returnTo)
                            }
                        },
                        // Not goToTab: its saveState would stash this login screen under
                        // Discover and restoreState would bring it straight back.
                        onBrowse = {
                            if (!navController.popBackStack(Routes.Discover, inclusive = false)) {
                                navController.navigate(Routes.Discover) {
                                    popUpTo(navController.graph.id) { inclusive = true }
                                }
                            }
                        },
                    )
                }
            }
        }
        if (currentTab != null) {
            CustomerBottomBar(selected = currentTab, signedIn = signedIn, onSelect = ::openTab)
        }
    }
}
