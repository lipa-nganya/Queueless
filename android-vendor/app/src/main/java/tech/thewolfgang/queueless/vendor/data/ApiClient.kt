package tech.thewolfgang.queueless.vendor.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import tech.thewolfgang.queueless.vendor.BuildConfig
import java.util.concurrent.TimeUnit

class ApiException(
    message: String,
    val statusCode: Int? = null,
    val payload: ErrorResponse? = null,
) : Exception(message)

class ApiClient(
    private val tokenStore: TokenStore,
    private val baseUrl: String = BuildConfig.API_BASE_URL,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val original = chain.request()
            val host = original.url.host
            val request = if (host.contains("ngrok", ignoreCase = true)) {
                // Free ngrok interstitial breaks non-browser clients without this header.
                original.newBuilder()
                    .header("ngrok-skip-browser-warning", "true")
                    .build()
            } else {
                original
            }
            chain.proceed(request)
        }
        .build()

    private val mediaType = "application/json; charset=utf-8".toMediaType()
    private val etagCache = java.util.concurrent.ConcurrentHashMap<String, Pair<String, String>>()

    suspend fun phoneStatus(phone: String): PhoneStatusResponse =
        request(
            method = "POST",
            path = "/vendor/phone-status",
            bodyJson = json.encodeToString(PhoneStatusRequest(phone = phone)),
            authenticated = false,
        )

    suspend fun requestOtp(phone: String, purpose: String): OtpResponse =
        request(
            method = "POST",
            path = "/vendor/request-otp",
            bodyJson = json.encodeToString(OtpRequest(phone = phone, purpose = purpose)),
            authenticated = false,
        )

    suspend fun resendOtp(phone: String, purpose: String): OtpResponse =
        request(
            method = "POST",
            path = "/vendor/resend-otp",
            bodyJson = json.encodeToString(OtpRequest(phone = phone, purpose = purpose)),
            authenticated = false,
        )

    suspend fun verifyOtp(phone: String, otp: String): VerifyOtpResponse =
        request(
            method = "POST",
            path = "/vendor/verify-otp",
            bodyJson = json.encodeToString(VerifyOtpRequest(phone = phone, otp = otp)),
            authenticated = false,
        )

    suspend fun setPin(phone: String, pin: String, confirmPin: String, otp: String?): LoginResponse =
        request(
            method = "POST",
            path = "/vendor/set-pin",
            bodyJson = json.encodeToString(
                SetPinRequest(phone = phone, pin = pin, confirmPin = confirmPin, otp = otp),
            ),
            authenticated = false,
        )

    suspend fun login(phone: String, pin: String): LoginResponse =
        request(
            method = "POST",
            path = "/vendor/login",
            bodyJson = json.encodeToString(LoginRequest(phone = phone, pin = pin)),
            authenticated = false,
        )

    suspend fun registerPushToken(token: String, deviceLabel: String? = null): PushTokenResponse =
        request(
            method = "POST",
            path = "/vendor/push-tokens",
            bodyJson = json.encodeToString(
                PushTokenRequest(token = token, deviceLabel = deviceLabel),
            ),
            authenticated = true,
        )

    suspend fun registerPendingPushToken(
        phone: String,
        token: String,
        deviceLabel: String? = null,
    ): PushTokenResponse =
        request(
            method = "POST",
            path = "/vendor/push-tokens/pending",
            bodyJson = json.encodeToString(
                PushTokenRequest(token = token, phone = phone, deviceLabel = deviceLabel),
            ),
            authenticated = false,
        )

    suspend fun getBusinesses(): List<BusinessSummary> =
        request(method = "GET", path = "/vendor/businesses")

    suspend fun getBusiness(businessId: Int): BusinessProfile =
        request(method = "GET", path = "/vendor/businesses/$businessId")

    suspend fun updateBusiness(
        businessId: Int,
        name: String,
        operatingSchedule: List<DayHours>,
        isActive: Boolean,
        accessibilityOptions: List<String>,
    ): BusinessProfile =
        request(
            method = "PUT",
            path = "/vendor/businesses/$businessId",
            bodyJson = json.encodeToString(
                UpdateBusinessProfileRequest(
                    name = name,
                    operatingSchedule = operatingSchedule,
                    isActive = isActive,
                    accessibilityOptions = accessibilityOptions,
                ),
            ),
        )

    suspend fun getQueue(businessId: Int): QueueResponse =
        request(method = "GET", path = "/vendor/businesses/$businessId/queue")

    suspend fun setWalkIns(businessId: Int, queueSize: Int): WalkInsResponse =
        request(
            method = "PUT",
            path = "/vendor/businesses/$businessId/walk-ins",
            bodyJson = json.encodeToString(WalkInsRequest(queueSize = queueSize)),
        )

    suspend fun setQueuePaused(businessId: Int, paused: Boolean): QueuePauseResponse =
        request(
            method = "PUT",
            path = "/vendor/businesses/$businessId/queue-pause",
            bodyJson = json.encodeToString(QueuePauseRequest(paused = paused)),
        )

    suspend fun serve(entryId: Int) {
        requestUnit(method = "POST", path = "/vendor/queue/$entryId/serve")
    }

    suspend fun noShow(entryId: Int) {
        requestUnit(method = "POST", path = "/vendor/queue/$entryId/no-show")
    }

    suspend fun getServices(branchId: Int): List<BusinessService> =
        request(method = "GET", path = "/vendor/businesses/$branchId/services")

    suspend fun createService(
        branchId: Int,
        name: String,
        durationMinutes: Int,
        description: String?,
        isActive: Boolean,
    ): BusinessService =
        request(
            method = "POST",
            path = "/vendor/businesses/$branchId/services",
            bodyJson = json.encodeToString(
                UpsertServiceRequest(
                    name = name,
                    durationMinutes = durationMinutes,
                    description = description,
                    isActive = isActive,
                ),
            ),
        )

    suspend fun updateService(
        branchId: Int,
        serviceId: Int,
        name: String,
        durationMinutes: Int,
        description: String?,
        isActive: Boolean,
    ): BusinessService =
        request(
            method = "PUT",
            path = "/vendor/businesses/$branchId/services/$serviceId",
            bodyJson = json.encodeToString(
                UpsertServiceRequest(
                    name = name,
                    durationMinutes = durationMinutes,
                    description = description,
                    isActive = isActive,
                ),
            ),
        )

    suspend fun deleteService(branchId: Int, serviceId: Int) {
        requestUnit(method = "DELETE", path = "/vendor/businesses/$branchId/services/$serviceId")
    }

    suspend fun getBranches(branchId: Int): BranchesResponse =
        request(method = "GET", path = "/vendor/businesses/$branchId/branches")

    suspend fun searchPlaces(query: String): List<PlaceSuggestion> {
        val encoded = java.net.URLEncoder.encode(query.trim(), Charsets.UTF_8.name())
        return request(method = "GET", path = "/places/search?q=$encoded")
    }

    suspend fun reverseGeocode(latitude: Double, longitude: Double): PlaceSuggestion =
        request(
            method = "GET",
            path = "/places/reverse?lat=$latitude&lon=$longitude",
        )

    suspend fun createBranch(
        branchId: Int,
        name: String,
        location: String?,
        landmark: String?,
        phone: String?,
        isActive: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
    ): BusinessProfile =
        request(
            method = "POST",
            path = "/vendor/businesses/$branchId/branches",
            bodyJson = json.encodeToString(
                UpsertBranchRequest(
                    name = name,
                    location = location,
                    landmark = landmark,
                    phone = phone,
                    latitude = latitude,
                    longitude = longitude,
                    isActive = isActive,
                ),
            ),
        )

    suspend fun updateBranchDetails(
        branchId: Int,
        name: String,
        location: String?,
        landmark: String?,
        phone: String?,
        isActive: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
    ): BusinessProfile =
        request(
            method = "PUT",
            path = "/vendor/businesses/$branchId",
            bodyJson = json.encodeToString(
                UpsertBranchRequest(
                    name = name,
                    location = location,
                    landmark = landmark,
                    phone = phone,
                    latitude = latitude,
                    longitude = longitude,
                    isActive = isActive,
                ),
            ),
        )

    private suspend inline fun <reified T> request(
        method: String,
        path: String,
        bodyJson: String? = null,
        authenticated: Boolean = true,
    ): T = withContext(Dispatchers.IO) {
        val responseBody = execute(method, path, bodyJson, authenticated)
        json.decodeFromString(responseBody)
    }

    private suspend fun requestUnit(
        method: String,
        path: String,
        bodyJson: String? = null,
    ) = withContext(Dispatchers.IO) {
        execute(method, path, bodyJson, authenticated = true)
        Unit
    }

    private fun execute(
        method: String,
        path: String,
        bodyJson: String?,
        authenticated: Boolean,
    ): String {
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + path)
        val requestBody = bodyJson?.toRequestBody(mediaType)
        val emptyBody = "".toRequestBody(mediaType)

        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(requestBody ?: emptyBody)
            "PUT" -> builder.put(requestBody ?: emptyBody)
            "DELETE" -> {
                if (requestBody != null) builder.delete(requestBody) else builder.delete()
            }
            else -> error("Unsupported method $method")
        }

        builder.header("Accept", "application/json")
        if (requestBody != null) {
            builder.header("Content-Type", "application/json")
        }
        if (authenticated) {
            val token = tokenStore.getToken()
            if (!token.isNullOrBlank()) {
                builder.header("Authorization", "Bearer $token")
            }
        }
        if (method == "GET") {
            etagCache[path]?.first?.let { builder.header("If-None-Match", it) }
        }

        client.newCall(builder.build()).execute().use { response ->
            if (response.code == 304) {
                val cached = etagCache[path]?.second
                if (!cached.isNullOrBlank()) return cached
            }

            val text = response.body?.string().orEmpty()
            val errorPayload = runCatching {
                json.decodeFromString<ErrorResponse>(text)
            }.getOrNull()
            if (response.code == 401 && authenticated) {
                tokenStore.clear()
                etagCache.clear()
                throw ApiException(
                    errorPayload?.error ?: "Session expired. Please sign in again.",
                    401,
                    errorPayload,
                )
            }
            if (!response.isSuccessful) {
                throw ApiException(
                    errorPayload?.error ?: "Request failed (${response.code}).",
                    response.code,
                    errorPayload,
                )
            }
            val body = text.ifBlank { "{}" }
            if (method == "GET") {
                response.header("ETag")?.let { etag ->
                    etagCache[path] = etag to body
                }
            } else if (path.contains("/queue")) {
                etagCache.keys.filter { it.contains("/queue") }.forEach { etagCache.remove(it) }
            }
            return body
        }
    }
}
