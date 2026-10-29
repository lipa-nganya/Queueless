package tech.thewolfgang.queueless.vendor.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class VendorRepository(
    private val api: ApiClient,
    private val tokenStore: TokenStore,
) {
    fun hasSession(): Boolean = !tokenStore.getToken().isNullOrBlank()

    fun clearSession() {
        tokenStore.clear()
        _unreadNotifications.value = 0
    }

    private val _unreadNotifications = MutableStateFlow(0)

    /** Unread saved notifications, shown as the badge on the top bar bell. */
    val unreadNotifications: StateFlow<Int> = _unreadNotifications.asStateFlow()

    suspend fun notifications(): VendorNotificationsResponse {
        val result = api.getNotifications()
        _unreadNotifications.value = result.unreadCount
        return result
    }

    /** Marks the given notifications read, or all of them when [ids] is empty. */
    suspend fun markNotificationsRead(ids: List<Int> = emptyList()) {
        api.markNotificationsRead(ids)
        refreshUnreadNotifications()
    }

    /** Refreshes the badge count. Failures keep the last count. */
    suspend fun refreshUnreadNotifications() {
        if (!hasSession()) return
        runCatching { api.getNotifications(limit = 1).unreadCount }
            .onSuccess { _unreadNotifications.value = it }
    }

    suspend fun phoneStatus(phone: String) = api.phoneStatus(normalizePhone(phone))

    suspend fun requestOtp(phone: String, purpose: String) =
        api.requestOtp(normalizePhone(phone), purpose)

    suspend fun resendOtp(phone: String, purpose: String) =
        api.resendOtp(normalizePhone(phone), purpose)

    suspend fun verifyOtp(phone: String, otp: String) =
        api.verifyOtp(normalizePhone(phone), otp)

    suspend fun setPin(phone: String, pin: String, confirmPin: String, otp: String?): LoginResponse {
        val session = api.setPin(normalizePhone(phone), pin, confirmPin, otp)
        if (!session.token.isNullOrBlank()) {
            tokenStore.setToken(session.token)
        }
        return session
    }

    suspend fun login(phone: String, pin: String): LoginResponse {
        val session = api.login(normalizePhone(phone), pin)
        if (!session.token.isNullOrBlank()) {
            tokenStore.setToken(session.token)
        }
        return session
    }

    /** Permanently deletes the signed-in vendor with their businesses and queues. */
    suspend fun deleteAccount(pin: String): DeleteAccountResponse {
        val phone = api.me().phone ?: throw ApiException("This account has no phone number. Contact Queueless.")
        val result = api.deleteAccount(phone, pin)
        clearSession()
        return result
    }

    suspend fun registerPushToken(token: String) = api.registerPushToken(token)

    suspend fun registerPendingPushToken(phone: String, token: String) =
        api.registerPendingPushToken(normalizePhone(phone), token)

    suspend fun businesses() = api.getBusinesses()

    suspend fun business(businessId: Int) = api.getBusiness(businessId)

    suspend fun updateBusiness(
        businessId: Int,
        name: String,
        operatingSchedule: List<DayHours>,
        isActive: Boolean,
        accessibilityOptions: List<String>,
    ) = api.updateBusiness(businessId, name, operatingSchedule, isActive, accessibilityOptions)

    suspend fun queue(businessId: Int) = api.getQueue(businessId)

    suspend fun addWalkIn(businessId: Int, body: AddWalkInRequest) = api.addWalkIn(businessId, body)

    suspend fun updateWalkIn(entryId: Int, body: UpdateWalkInRequest) = api.updateWalkIn(entryId, body)

    suspend fun setQueuePaused(businessId: Int, paused: Boolean) =
        api.setQueuePaused(businessId, paused)

    suspend fun serve(entryId: Int) = api.serve(entryId)

    suspend fun noShow(entryId: Int) = api.noShow(entryId)

    suspend fun services(branchId: Int) = api.getServices(branchId)

    suspend fun createService(
        branchId: Int,
        name: String,
        durationMinutes: Int,
        description: String?,
        isActive: Boolean,
    ) = api.createService(branchId, name, durationMinutes, description, isActive)

    suspend fun updateService(
        branchId: Int,
        serviceId: Int,
        name: String,
        durationMinutes: Int,
        description: String?,
        isActive: Boolean,
    ) = api.updateService(branchId, serviceId, name, durationMinutes, description, isActive)

    suspend fun deleteService(branchId: Int, serviceId: Int) =
        api.deleteService(branchId, serviceId)

    suspend fun branches(branchId: Int) = api.getBranches(branchId)

    suspend fun searchPlaces(query: String, bearer: String? = null) = api.searchPlaces(query, bearer)

    suspend fun reverseGeocode(latitude: Double, longitude: Double, bearer: String? = null) =
        api.reverseGeocode(latitude, longitude, bearer)

    suspend fun onboardingInfo(onboardingToken: String) = api.getOnboarding(onboardingToken)

    suspend fun submitOnboarding(onboardingToken: String, body: OnboardingRequest) =
        api.submitOnboarding(onboardingToken, body)

    suspend fun createBranch(
        branchId: Int,
        name: String,
        location: String?,
        landmark: String?,
        phone: String?,
        isActive: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
    ) = api.createBranch(branchId, name, location, landmark, phone, isActive, latitude, longitude)

    suspend fun updateBranchDetails(
        branchId: Int,
        name: String,
        location: String?,
        landmark: String?,
        phone: String?,
        isActive: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
    ) = api.updateBranchDetails(branchId, name, location, landmark, phone, isActive, latitude, longitude)

    companion object {
        fun normalizePhone(raw: String): String {
            var digits = raw.filter { it.isDigit() }
            if (digits.startsWith("0") && digits.length == 10) {
                digits = "254${digits.drop(1)}"
            } else if (digits.length == 9 && digits.startsWith("7")) {
                digits = "254$digits"
            }
            return digits
        }
    }
}
