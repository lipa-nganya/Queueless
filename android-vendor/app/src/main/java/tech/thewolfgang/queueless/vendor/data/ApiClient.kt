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

class ApiException(message: String, val statusCode: Int? = null) : Exception(message)

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
        .build()

    private val mediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun login(username: String, password: String): LoginResponse =
        request(
            method = "POST",
            path = "/vendor/login",
            bodyJson = json.encodeToString(LoginRequest(username = username, password = password)),
            authenticated = false,
        )

    suspend fun getBusinesses(): List<BusinessSummary> =
        request(method = "GET", path = "/vendor/businesses")

    suspend fun getBusiness(businessId: Int): BusinessProfile =
        request(method = "GET", path = "/vendor/businesses/$businessId")

    suspend fun updateBusiness(
        businessId: Int,
        name: String,
        operatingHours: String?,
        isActive: Boolean,
    ): BusinessProfile =
        request(
            method = "PUT",
            path = "/vendor/businesses/$businessId",
            bodyJson = json.encodeToString(
                UpdateBusinessProfileRequest(
                    name = name,
                    operatingHours = operatingHours,
                    isActive = isActive,
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

    suspend fun serve(entryId: Int) {
        requestUnit(method = "POST", path = "/vendor/queue/$entryId/serve")
    }

    suspend fun noShow(entryId: Int) {
        requestUnit(method = "POST", path = "/vendor/queue/$entryId/no-show")
    }

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

        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (response.code == 401) {
                tokenStore.clear()
                val message = runCatching {
                    json.decodeFromString<ErrorResponse>(text).error
                }.getOrNull() ?: "Session expired. Please sign in again."
                throw ApiException(message, 401)
            }
            if (!response.isSuccessful) {
                val message = runCatching {
                    json.decodeFromString<ErrorResponse>(text).error
                }.getOrNull() ?: "Request failed (${response.code})."
                throw ApiException(message, response.code)
            }
            return text.ifBlank { "{}" }
        }
    }
}
