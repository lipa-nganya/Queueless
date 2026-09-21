package tech.thewolfgang.queueless.vendor.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PhoneStatusRequest(
    val phone: String,
)

@Serializable
data class PhoneStatusResponse(
    val phone: String,
    val registered: Boolean = false,
    @SerialName("has_pin") val hasPin: Boolean = false,
    @SerialName("needs_otp") val needsOtp: Boolean = false,
    @SerialName("needs_pin_setup") val needsPinSetup: Boolean = false,
    @SerialName("pending_activation") val pendingActivation: Boolean = false,
    val activated: Boolean = false,
    @SerialName("can_register") val canRegister: Boolean = false,
    val username: String? = null,
)

@Serializable
data class OtpRequest(
    val phone: String,
    val purpose: String = "setup",
)

@Serializable
data class OtpResponse(
    val phone: String? = null,
    val purpose: String? = null,
    @SerialName("otp_mode") val otpMode: String? = null,
    val message: String? = null,
    @SerialName("can_resend") val canResend: Boolean = true,
    @SerialName("cooldown_seconds") val cooldownSeconds: Int = 0,
    val error: String? = null,
)

@Serializable
data class VerifyOtpRequest(
    val phone: String,
    val otp: String,
)

@Serializable
data class VerifyOtpResponse(
    val phone: String? = null,
    val verified: Boolean = false,
    @SerialName("needs_pin_setup") val needsPinSetup: Boolean = true,
    @SerialName("has_pin") val hasPin: Boolean = false,
    val message: String? = null,
)

@Serializable
data class SetPinRequest(
    val phone: String,
    val pin: String,
    @SerialName("confirm_pin") val confirmPin: String,
    val otp: String? = null,
)

@Serializable
data class LoginRequest(
    val phone: String,
    val pin: String,
)

@Serializable
data class PushTokenRequest(
    val token: String,
    val platform: String = "android",
    val phone: String? = null,
    @SerialName("device_label") val deviceLabel: String? = null,
)

@Serializable
data class PushTokenResponse(
    val ok: Boolean = false,
    val id: Int? = null,
    val pending: Boolean = false,
    val error: String? = null,
)

@Serializable
data class LoginResponse(
    val token: String? = null,
    val username: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val message: String? = null,
    @SerialName("pending_activation") val pendingActivation: Boolean = false,
    val activated: Boolean = false,
)

@Serializable
data class ErrorResponse(
    val error: String? = null,
    @SerialName("needs_otp") val needsOtp: Boolean = false,
    @SerialName("needs_pin_setup") val needsPinSetup: Boolean = false,
    @SerialName("not_registered") val notRegistered: Boolean = false,
    @SerialName("pending_activation") val pendingActivation: Boolean = false,
    @SerialName("has_pin") val hasPin: Boolean = false,
    @SerialName("can_register") val canRegister: Boolean = false,
    val phone: String? = null,
)

@Serializable
data class BusinessSummary(
    val id: Int,
    val name: String,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("business_name") val businessName: String? = null,
    val location: String? = null,
    val landmark: String? = null,
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
data class DayHours(
    val day: String,
    val open: Boolean = true,
    val start: String = "08:00",
    val end: String = "18:00",
)

@Serializable
data class AccessibilityInfo(
    val id: String,
    val emoji: String? = null,
    val label: String? = null,
    val description: String? = null,
)

@Serializable
data class BusinessProfile(
    val id: Int,
    val name: String,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("business_name") val businessName: String? = null,
    val location: String? = null,
    val landmark: String? = null,
    val phone: String? = null,
    @SerialName("operating_hours") val operatingHours: String? = null,
    @SerialName("operating_schedule") val operatingSchedule: List<DayHours>? = null,
    @SerialName("operating_hours_display") val operatingHoursDisplay: String? = null,
    @SerialName("accessibility_options") val accessibilityOptions: List<String> = emptyList(),
    val accessibility: List<AccessibilityInfo> = emptyList(),
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
    @SerialName("business_group_id") val businessGroupId: Int? = null,
    @SerialName("business_group_name") val businessGroupName: String? = null,
)

@Serializable
data class UpdateBusinessProfileRequest(
    val name: String,
    @SerialName("operating_schedule") val operatingSchedule: List<DayHours>,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("accessibility_options") val accessibilityOptions: List<String> = emptyList(),
)

@Serializable
data class UpsertBranchRequest(
    val name: String,
    val location: String? = null,
    val landmark: String? = null,
    val phone: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class PlaceSuggestion(
    val label: String,
    val latitude: Double,
    val longitude: Double,
)

@Serializable
data class BranchesResponse(
    @SerialName("business_id") val businessId: Int,
    @SerialName("business_name") val businessName: String? = null,
    @SerialName("business_group_name") val businessGroupName: String? = null,
    val branches: List<BusinessProfile> = emptyList(),
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
    @SerialName("queue_paused") val queuePaused: Boolean = false,
)

@Serializable
data class QueueEntry(
    val id: Int,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("joined_at") val joinedAt: String? = null,
    @SerialName("booking_id") val bookingId: Int? = null,
    @SerialName("customer_first_name") val customerFirstName: String? = null,
    @SerialName("customer_phone") val customerPhone: String? = null,
    @SerialName("party_size") val partySize: Int = 1,
    @SerialName("party_names") val partyNames: List<String> = emptyList(),
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
data class QueuePauseRequest(
    val paused: Boolean,
)

@Serializable
data class QueuePauseResponse(
    val ok: Boolean = true,
    val id: Int? = null,
    val name: String? = null,
    @SerialName("queue_paused") val queuePaused: Boolean = false,
    @SerialName("is_active") val isActive: Boolean? = null,
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

@Serializable
data class BusinessService(
    val id: Int,
    @SerialName("business_id") val businessId: Int? = null,
    @SerialName("branch_id") val branchId: Int? = null,
    val name: String,
    @SerialName("duration_minutes") val durationMinutes: Int = 15,
    val description: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)

@Serializable
data class UpsertServiceRequest(
    val name: String,
    @SerialName("duration_minutes") val durationMinutes: Int,
    val description: String? = null,
    @SerialName("is_active") val isActive: Boolean = true,
)
