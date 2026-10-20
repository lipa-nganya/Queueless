package tech.thewolfgang.queueless.customer.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class CustomerRepository(
    val api: ApiClient,
    private val tokenStore: TokenStore,
) {
    private val _signedIn = MutableStateFlow(tokenStore.getToken() != null)
    val signedIn: StateFlow<Boolean> = _signedIn.asStateFlow()

    fun hasSession(): Boolean = tokenStore.getToken() != null

    fun signOut() {
        tokenStore.clear()
        api.clearCache()
        _signedIn.value = false
    }

    private fun startSession(session: SessionResponse): SessionResponse {
        session.token?.takeIf { it.isNotBlank() }?.let {
            tokenStore.setToken(it)
            _signedIn.value = true
        }
        return session
    }

    /** Any 401 clears the stored token; keep the signed-in flag in step with it. */
    private suspend fun <T> authed(block: suspend () -> T): T = try {
        block()
    } catch (e: ApiException) {
        if (e.statusCode == 401) _signedIn.value = tokenStore.getToken() != null
        throw e
    }

    suspend fun phoneStatus(phone: String): PhoneStatusResponse =
        api.post("/customer/phone-status", PhoneRequest(phone))

    suspend fun signup(firstName: String, phone: String, pin: String, confirmPin: String): MessageResponse =
        api.post("/customer/signup", SignupRequest(firstName, phone, pin, confirmPin))

    suspend fun resendOtp(phone: String): MessageResponse =
        api.post("/customer/resend-otp", PhoneRequest(phone))

    suspend fun verifyOtp(phone: String, otp: String): SessionResponse =
        startSession(api.post("/customer/verify-otp", VerifyOtpRequest(phone, otp)))

    suspend fun login(phone: String, pin: String): SessionResponse =
        startSession(api.post("/customer/login", LoginRequest(phone, pin)))

    suspend fun groups(): List<BusinessGroup> = api.get("/customer/business-groups")

    suspend fun businesses(): List<Business> = api.get("/customer/businesses")

    suspend fun business(id: Int): Business = api.get("/customer/businesses/$id")

    suspend fun me(): CustomerMe = authed { api.get("/customer/me") }

    suspend fun saveAccessibility(needs: List<String>, note: String?): CustomerMe = authed {
        api.put("/customer/me/accessibility", AccessibilityUpdateRequest(needs, note))
    }

    suspend fun contact(): ContactResponse = authed { api.get("/customer/contact") }

    suspend fun myQueue(): List<QueueEntry> = authed { api.get("/customer/queue") }

    suspend fun joinQueue(businessId: Int, body: JoinQueueRequest): QueueEntry = authed {
        api.post("/customer/businesses/$businessId/queue", body)
    }

    suspend fun leaveQueue(entryId: Int): OkResponse = authed { api.postEmpty("/customer/queue/$entryId/leave") }

    suspend fun bookings(): List<Booking> = authed { api.get("/customer/bookings") }

    suspend fun book(businessId: Int, body: BookingRequest): Booking = authed {
        api.post("/customer/businesses/$businessId/bookings", body)
    }

    suspend fun cancelBooking(bookingId: Int): OkResponse = authed {
        api.postEmpty("/customer/bookings/$bookingId/cancel")
    }

    /** Permanently deletes the account; the PIN re-confirms it's really the owner. */
    suspend fun deleteAccount(phone: String, pin: String): MessageResponse {
        val result: MessageResponse = api.post("/customer/account/delete", LoginRequest(phone, pin))
        signOut()
        return result
    }

    fun imageUrl(path: String?): String? = api.absoluteUrl(path)
}
