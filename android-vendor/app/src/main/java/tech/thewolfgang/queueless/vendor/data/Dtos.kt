package tech.thewolfgang.queueless.vendor.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class LoginResponse(
    val token: String,
    val username: String? = null,
    val email: String? = null,
)

@Serializable
data class ErrorResponse(
    val error: String? = null,
)

@Serializable
data class BusinessSummary(
    val id: Int,
    val name: String,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("business_name") val businessName: String? = null,
    val location: String? = null,
    val phone: String? = null,
    @SerialName("operating_hours") val operatingHours: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("queue_size") val queueSize: Int = 0,
    @SerialName("avg_wait_minutes") val avgWaitMinutes: Double? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("business_group_name") val businessGroupName: String? = null,
    @SerialName("app_waiting") val appWaiting: Int = 0,
    @SerialName("waiting_total") val waitingTotal: Int = 0,
)

@Serializable
data class BusinessProfile(
    val id: Int,
    val name: String,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("business_name") val businessName: String? = null,
    val location: String? = null,
    val phone: String? = null,
    @SerialName("operating_hours") val operatingHours: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("business_group_id") val businessGroupId: Int? = null,
    @SerialName("business_group_name") val businessGroupName: String? = null,
)

@Serializable
data class UpdateBusinessProfileRequest(
    val name: String,
    @SerialName("operating_hours") val operatingHours: String? = null,
    @SerialName("is_active") val isActive: Boolean,
)

@Serializable
data class QueueBusiness(
    val id: Int,
    @SerialName("business_id") val businessId: Int? = null,
    val name: String,
    @SerialName("branch_name") val branchName: String? = null,
    val location: String? = null,
    @SerialName("queue_size") val queueSize: Int = 0,
    @SerialName("avg_wait_minutes") val avgWaitMinutes: Double? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("business_group_name") val businessGroupName: String? = null,
    @SerialName("waiting_total") val waitingTotal: Int = 0,
    @SerialName("app_waiting") val appWaiting: Int = 0,
)

@Serializable
data class QueueEntry(
    val id: Int,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("joined_at") val joinedAt: String? = null,
    @SerialName("booking_id") val bookingId: Int? = null,
    @SerialName("customer_first_name") val customerFirstName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    val position: Int = 0,
    @SerialName("people_ahead") val peopleAhead: Int = 0,
    @SerialName("estimated_wait_minutes") val estimatedWaitMinutes: Double = 0.0,
)

@Serializable
data class QueueResponse(
    val business: QueueBusiness,
    val entries: List<QueueEntry> = emptyList(),
)

@Serializable
data class WalkInsRequest(
    @SerialName("queue_size") val queueSize: Int,
)

@Serializable
data class WalkInsResponse(
    val id: Int,
    val name: String? = null,
    @SerialName("queue_size") val queueSize: Int = 0,
    @SerialName("avg_wait_minutes") val avgWaitMinutes: Double? = null,
)
