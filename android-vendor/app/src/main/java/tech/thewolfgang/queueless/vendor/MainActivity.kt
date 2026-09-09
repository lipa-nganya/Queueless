package tech.thewolfgang.queueless.vendor

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import tech.thewolfgang.queueless.vendor.data.VendorRepository
import tech.thewolfgang.queueless.vendor.ui.businesses.BusinessesScreen
import tech.thewolfgang.queueless.vendor.ui.businesses.BusinessesViewModel
import tech.thewolfgang.queueless.vendor.ui.login.LoginScreen
import tech.thewolfgang.queueless.vendor.ui.login.LoginViewModel
import tech.thewolfgang.queueless.vendor.ui.profile.ProfilePickerScreen
import tech.thewolfgang.queueless.vendor.ui.profile.ProfileScreen
import tech.thewolfgang.queueless.vendor.ui.profile.ProfileViewModel
import tech.thewolfgang.queueless.vendor.ui.queue.QueueScreen
import tech.thewolfgang.queueless.vendor.ui.queue.QueueViewModel
import tech.thewolfgang.queueless.vendor.ui.theme.Navy
import tech.thewolfgang.queueless.vendor.ui.theme.QueuelessTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as QueuelessVendorApp
        setContent {
            QueuelessTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .safeDrawingPadding(),
                    color = Navy,
                ) {
                    VendorNav(repository = app.repository)
                }
            }
        }
    }
}

private object Routes {
    const val Login = "login"
    const val Businesses = "businesses"
    const val Queue = "queue/{businessId}"
    const val Profiles = "profiles"
    const val Profile = "profile/{businessId}"

    fun queue(businessId: Int) = "queue/$businessId"
    fun profile(businessId: Int) = "profile/$businessId"
}

@Composable
private fun VendorNav(repository: VendorRepository) {
    val navController = rememberNavController()
    val startDestination = remember {
        if (repository.hasSession()) Routes.Businesses else Routes.Login
    }

    fun signOut() {
        repository.clearSession()
        navController.navigate(Routes.Login) {
            popUpTo(0) { inclusive = true }
        }
    }

    fun onUnauthorized() = signOut()

    fun goQueueHome() {
        navController.navigate(Routes.Businesses) {
            popUpTo(Routes.Businesses) { inclusive = true }
            launchSingleTop = true
        }
    }

    fun goProfile(businessId: Int? = null) {
        if (businessId != null) {
            navController.navigate(Routes.profile(businessId)) {
                launchSingleTop = true
            }
        } else {
            navController.navigate(Routes.Profiles) {
                launchSingleTop = true
            }
        }
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.Login) {
            val vm: LoginViewModel = viewModel(factory = LoginViewModel.factory(repository))
            LoginScreen(
                viewModel = vm,
                onLoggedIn = {
                    navController.navigate(Routes.Businesses) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.Businesses) {
            val vm: BusinessesViewModel = viewModel(
                factory = BusinessesViewModel.factory(repository),
            )
            BusinessesScreen(
                viewModel = vm,
                onOpenQueue = { id -> navController.navigate(Routes.queue(id)) },
                onOpenProfile = { goProfile() },
                onSignOut = ::signOut,
                onUnauthorized = ::onUnauthorized,
            )
        }

        composable(
            route = Routes.Queue,
            arguments = listOf(navArgument("businessId") { type = NavType.IntType }),
        ) { entry ->
            val businessId = entry.arguments?.getInt("businessId") ?: return@composable
            val vm: QueueViewModel = viewModel(
                factory = QueueViewModel.factory(businessId, repository),
            )
            QueueScreen(
                viewModel = vm,
                onBack = { navController.popBackStack() },
                onOpenProfile = { goProfile(businessId) },
                onSignOut = ::signOut,
                onUnauthorized = ::onUnauthorized,
            )
        }

        composable(Routes.Profiles) {
            val vm: BusinessesViewModel = viewModel(
                key = "profile-picker",
                factory = BusinessesViewModel.factory(repository),
            )
            ProfilePickerScreen(
                viewModel = vm,
                onOpenProfile = { id ->
                    navController.navigate(Routes.profile(id)) {
                        popUpTo(Routes.Profiles) { inclusive = true }
                    }
                },
                onOpenQueue = ::goQueueHome,
                onSignOut = ::signOut,
                onUnauthorized = ::onUnauthorized,
            )
        }

        composable(
            route = Routes.Profile,
            arguments = listOf(navArgument("businessId") { type = NavType.IntType }),
        ) { entry ->
            val businessId = entry.arguments?.getInt("businessId") ?: return@composable
            val vm: ProfileViewModel = viewModel(
                factory = ProfileViewModel.factory(businessId, repository),
            )
            ProfileScreen(
                viewModel = vm,
                onOpenQueue = {
                    navController.navigate(Routes.queue(businessId)) {
                        launchSingleTop = true
                    }
                },
                onSignOut = ::signOut,
                onUnauthorized = ::onUnauthorized,
            )
        }
    }
}
