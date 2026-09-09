package tech.thewolfgang.queueless.vendor.data

class VendorRepository(
    private val api: ApiClient,
    private val tokenStore: TokenStore,
) {
    fun hasSession(): Boolean = !tokenStore.getToken().isNullOrBlank()

    fun clearSession() = tokenStore.clear()

    suspend fun login(username: String, password: String): LoginResponse {
        val session = api.login(username.trim(), password)
        tokenStore.setToken(session.token)
        return session
    }

    suspend fun businesses() = api.getBusinesses()

    suspend fun business(businessId: Int) = api.getBusiness(businessId)

    suspend fun updateBusiness(
        businessId: Int,
        name: String,
        operatingHours: String?,
        isActive: Boolean,
    ) = api.updateBusiness(businessId, name, operatingHours, isActive)

    suspend fun queue(businessId: Int) = api.getQueue(businessId)

    suspend fun setWalkIns(businessId: Int, queueSize: Int) =
        api.setWalkIns(businessId, queueSize.coerceIn(0, 500))

    suspend fun serve(entryId: Int) = api.serve(entryId)

    suspend fun noShow(entryId: Int) = api.noShow(entryId)
}
