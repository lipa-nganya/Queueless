package tech.thewolfgang.queueless.customer.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PhoneRequest(val phone: String)

@Serializable
data class PhoneStatusResponse(
    val phone: String,
    val registered: Boolean = false,
    @SerialName("needs_otp") val needsOtp: Boolean = false,
    @SerialName("first_name") val firstName: String? = null,
)

@Serializable
data class SignupRequest(
    @SerialName("first_name") val firstName: String,
    val phone: String,
    val pin: String,
    @SerialName("confirm_pin") val confirmPin: String,
)

@Serializable
data class MessageResponse(
    val phone: String? = null,
    val message: String? = null,
    @SerialName("cooldown_seconds") val cooldownSeconds: Int = 0,
    @SerialName("resends_left") val resendsLeft: Int? = null,
)

@Serializable
data class VerifyOtpRequest(val phone: String, val otp: String)

@Serializable
data class LoginRequest(val phone: String, val pin: String)

@Serializable
data class SessionResponse(
    val token: String? = null,
    @SerialName("first_name") val firstName: String? = null,
    val phone: String? = null,
    val message: String? = null,
)

@Serializable
data class ErrorResponse(
    val error: String? = null,
    @SerialName("not_registered") val notRegistered: Boolean = false,
    @SerialName("needs_otp") val needsOtp: Boolean = false,
    @SerialName("needs_service") val needsService: Boolean = false,
    @SerialName("queue_paused") val queuePaused: Boolean = false,
    @SerialName("cooldown_seconds") val cooldownSeconds: Int = 0,
)

@Serializable
data class BusinessGroup(
    val id: Int,
    val name: String,
    val icon: String? = null,
)

@Serializable
data class BusinessService(
    val id: Int,
    val name: String,
    @SerialName("duration_minutes") val durationMinutes: Int? = null,
    val description: String? = null,
)

@Serializable
data class Branch(
    val id: Int,
    val name: String,
    val location: String? = null,
    val landmark: String? = null,
    val phone: String? = null,
    @SerialName("queue_size") val queueSize: Int = 0,
    @SerialName("avg_wait_minutes") val avgWaitMinutes: Double? = null,
    @SerialName("queue_paused") val queuePaused: Boolean = false,
    @SerialName("accessibility_options") val accessibilityOptions: List<String> = emptyList(),
    val services: List<BusinessService> = emptyList(),
)

@Serializable
data class Business(
    val id: Int,
    val name: String,
    val description: String? = null,
    val location: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("queue_size") val queueSize: Int = 0,
    @SerialName("avg_wait_minutes") val avgWaitMinutes: Double? = null,
    @SerialName("business_group_id") val businessGroupId: Int? = null,
    @SerialName("business_group_name") val businessGroupName: String? = null,
    val branches: List<Branch> = emptyList(),
    @SerialName("accessibility_options") val accessibilityOptions: List<String> = emptyList(),
)

@Serializable
data class QueueEntry(
    val id: Int,
    @SerialName("business_id") val businessId: Int,
    @SerialName("branch_id") val branchId: Int? = null,
    @SerialName("business_name") val businessName: String = "",
    @SerialName("branch_name") val branchName: String? = null,
    @SerialName("service_name") val serviceName: String? = null,
    val location: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("party_size") val partySize: Int = 1,
    @SerialName("people_ahead") val peopleAhead: Int = 0,
    val position: Int = 1,
    @SerialName("queue_length") val queueLength: Int = 0,
    @SerialName("estimated_wait_minutes") val estimatedWaitMinutes: Double = 0.0,
    @SerialName("accessibility_need_labels") val accessibilityNeedLabels: List<String> = emptyList(),
)

@Serializable
data class JoinQueueRequest(
    @SerialName("branch_id") val branchId: Int,
    @SerialName("service_id") val serviceId: Int? = null,
    @SerialName("party_size") val partySize: Int = 1,
    /** Null keeps the customer's saved needs; a list (even empty) replaces them for this visit. */
    @SerialName("accessibility_needs") val accessibilityNeeds: List<String>? = null,
    @SerialName("accessibility_note") val accessibilityNote: String? = null,
    @SerialName("booking_id") val bookingId: Int? = null,
)

@Serializable
data class Booking(
    val id: Int,
    @SerialName("business_id") val businessId: Int,
    @SerialName("branch_id") val branchId: Int? = null,
    @SerialName("scheduled_for") val scheduledFor: String,
    val status: String = "booked",
    @SerialName("service_name") val serviceName: String? = null,
    @SerialName("business_name") val businessName: String? = null,
    @SerialName("branch_name") val branchName: String? = null,
    @SerialName("branch_count") val branchCount: Int = 1,
    @SerialName("branch_queue_paused") val branchQueuePaused: Boolean = false,
    val location: String? = null,
    @SerialName("business_group_name") val businessGroupName: String? = null,
)

@Serializable
data class BookingRequest(
    @SerialName("branch_id") val branchId: Int,
    @SerialName("service_id") val serviceId: Int? = null,
    @SerialName("scheduled_for") val scheduledFor: String,
)

@Serializable
data class CustomerMe(
    val id: Int,
    @SerialName("first_name") val firstName: String? = null,
    val phone: String? = null,
    @SerialName("accessibility_needs") val accessibilityNeeds: List<String> = emptyList(),
    @SerialName("accessibility_note") val accessibilityNote: String? = null,
)

@Serializable
data class AccessibilityUpdateRequest(
    @SerialName("accessibility_needs") val accessibilityNeeds: List<String>,
    @SerialName("accessibility_note") val accessibilityNote: String? = null,
)

@Serializable
data class ContactResponse(
    val phone: String? = null,
    val email: String? = null,
)

@Serializable
data class OkResponse(val ok: Boolean = false)
