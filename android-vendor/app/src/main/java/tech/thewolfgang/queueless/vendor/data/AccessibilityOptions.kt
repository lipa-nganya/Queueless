package tech.thewolfgang.queueless.vendor.data

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Accessible
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.HearingDisabled
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Pets
import androidx.compose.material.icons.filled.SignLanguage
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Wc
import androidx.compose.ui.graphics.vector.ImageVector

data class AccessibilityOption(
    val id: String,
    val icon: ImageVector,
    val label: String,
    val description: String,
)

object AccessibilityOptions {
    val all: List<AccessibilityOption> = listOf(
        AccessibilityOption(
            id = "wheelchair",
            icon = Icons.AutoMirrored.Filled.Accessible,
            label = "Wheelchair Accessible",
            description = "Step-free entrance and spaces/routes usable by wheelchair users",
        ),
        AccessibilityOption(
            id = "blind_low_vision",
            icon = Icons.Filled.VisibilityOff,
            label = "Blind & Low-Vision Friendly",
            description = "Staff/environment can reasonably assist blind or low-vision customers",
        ),
        AccessibilityOption(
            id = "deaf_hard_of_hearing",
            icon = Icons.Filled.HearingDisabled,
            label = "Deaf & Hard-of-Hearing Friendly",
            description = "Communication accommodations are available beyond spoken communication",
        ),
        AccessibilityOption(
            id = "sign_language",
            icon = Icons.Filled.SignLanguage,
            label = "Sign Language Available",
            description = "At least one staff member or service option can communicate in sign language",
        ),
        AccessibilityOption(
            id = "autism_friendly",
            icon = Icons.Filled.Extension,
            label = "Autism-Friendly",
            description = "Accommodations are available for autistic customers, such as reduced sensory stimulation or flexible service",
        ),
        AccessibilityOption(
            id = "quiet_low_sensory",
            icon = Icons.AutoMirrored.Filled.VolumeOff,
            label = "Quiet / Low-Sensory Space Available",
            description = "A quieter waiting or service area is available",
        ),
        AccessibilityOption(
            id = "accessible_seating",
            icon = Icons.Filled.EventSeat,
            label = "Accessible Seating Available",
            description = "Seating accommodates customers with mobility needs",
        ),
        AccessibilityOption(
            id = "accessible_restroom",
            icon = Icons.Filled.Wc,
            label = "Accessible Restroom Available",
            description = "An accessible toilet/restroom is available on the premises",
        ),
        AccessibilityOption(
            id = "assistance_animals",
            icon = Icons.Filled.Pets,
            label = "Assistance Animals Welcome",
            description = "Customers using trained assistance/service animals are accommodated",
        ),
        AccessibilityOption(
            id = "support_person",
            icon = Icons.Filled.People,
            label = "Support Person Welcome",
            description = "A customer may be accompanied by a caregiver, interpreter, aide, or other support person",
        ),
    )

    private val ids = all.map { it.id }.toSet()

    fun normalize(ids: List<String>?): List<String> {
        if (ids.isNullOrEmpty()) return emptyList()
        val selected = ids.map { it.trim() }.filter { it in this.ids }.toSet()
        return all.map { it.id }.filter { it in selected }
    }
}
