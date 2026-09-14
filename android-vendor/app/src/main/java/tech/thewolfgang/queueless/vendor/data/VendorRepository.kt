package tech.thewolfgang.queueless.vendor.data

class VendorRepository(
    private val api: ApiClient,
    private val tokenStore: TokenStore,
) {
    fun hasSession(): Boolean = !tokenStore.getToken().isNullOrBlank()

    fun clearSession() = tokenStore.clear()

    suspend fun phoneStatus(phone: String) = api.phoneStatus(normalizePhone(phone))

    suspend fun requestOtp(phone: String, purpose: String) =
        api.requestOtp(normalizePhone(phone), purpose)

    suspend fun resendOtp(phone: String, purpose: String) =
        api.resendOtp(normalizePhone(phone), purpose)

    suspend fun verifyOtp(phone: String, otp: String) =
        api.verifyOtp(normalizePhone(phone), otp)

    suspend fun setPin(phone: String, pin: String, confirmPin: String, otp: String?): LoginResponse {
        val session = api.setPin(normalizePhone(phone), pin, confirmPin, otp)
        tokenStore.setToken(session.token)
        return session
    }

    suspend fun login(phone: String, pin: String): LoginResponse {
        val session = api.login(normalizePhone(phone), pin)
        tokenStore.setToken(session.token)
        return session
    }

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

    suspend fun setWalkIns(businessId: Int, queueSize: Int) =
        api.setWalkIns(businessId, queueSize.coerceIn(0, 500))

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

    suspend fun createBranch(
        branchId: Int,
        name: String,
        location: String?,
        phone: String?,
        isActive: Boolean,
    ) = api.createBranch(branchId, name, location, phone, isActive)

    suspend fun updateBranchDetails(
        branchId: Int,
        name: String,
        location: String?,
        phone: String?,
        isActive: Boolean,
    ) = api.updateBranchDetails(branchId, name, location, phone, isActive)

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
