package tech.thewolfgang.queueless.customer.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import tech.thewolfgang.queueless.customer.BuildConfig
import java.io.File
import java.util.concurrent.TimeUnit

class ApiException(
    message: String,
    val statusCode: Int? = null,
    val payload: ErrorResponse? = null,
) : Exception(message)

class ApiClient(
    private val tokenStore: TokenStore,
    cacheDir: File? = null,
    private val baseUrl: String = BuildConfig.API_BASE_URL,
) {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    /** Uploads are served from the API origin, outside `/api`. */
    fun absoluteUrl(path: String?): String? {
        if (path.isNullOrBlank()) return null
        if (path.startsWith("http")) return path
        return baseUrl.trimEnd('/').removeSuffix("/api") + path
    }

    // Revalidates with the server's ETags, so unchanged lists and polls come back as empty 304s.
    private val client = OkHttpClient.Builder()
        .apply { if (cacheDir != null) cache(Cache(cacheDir, HTTP_CACHE_BYTES)) }
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val original = chain.request()
            val request = if (original.url.host.contains("ngrok", ignoreCase = true)) {
                // Free ngrok interstitial breaks non-browser clients without this header.
                original.newBuilder().header("ngrok-skip-browser-warning", "true").build()
            } else {
                original
            }
            chain.proceed(request)
        }
        .build()

    private val mediaType = "application/json; charset=utf-8".toMediaType()

    fun clearCache() {
        runCatching { client.cache?.evictAll() }
    }

    suspend inline fun <reified T> get(path: String): T = decode(execute("GET", path, null))

    suspend inline fun <reified B, reified T> post(path: String, body: B): T =
        decode(execute("POST", path, json.encodeToString(body)))

    suspend inline fun <reified T> postEmpty(path: String): T = decode(execute("POST", path, null))

    suspend inline fun <reified B, reified T> put(path: String, body: B): T =
        decode(execute("PUT", path, json.encodeToString(body)))

    inline fun <reified T> decode(text: String): T = json.decodeFromString(text)

    suspend fun execute(method: String, path: String, bodyJson: String?): String = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + path)
        val requestBody = (bodyJson ?: "").toRequestBody(mediaType)
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(requestBody)
            "PUT" -> builder.put(requestBody)
            else -> error("Unsupported method $method")
        }
        builder.header("Accept", "application/json")
        tokenStore.getToken()?.let { builder.header("Authorization", "Bearer $it") }

        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val payload = runCatching { json.decodeFromString<ErrorResponse>(text) }.getOrNull()
                if (response.code == 401 && tokenStore.getToken() != null && !path.startsWith("/customer/login")) {
                    tokenStore.clear()
                    clearCache()
                }
                throw ApiException(
                    payload?.error ?: "Request failed (${response.code}).",
                    response.code,
                    payload,
                )
            }
            text.ifBlank { "{}" }
        }
    }

    private companion object {
        const val HTTP_CACHE_BYTES = 10L * 1024 * 1024
    }
}
