package tech.thewolfgang.queueless.vendor.data

object OperatingHours {
    data class DayMeta(val key: String, val label: String)

    val weekDays = listOf(
        DayMeta("mon", "Monday"),
        DayMeta("tue", "Tuesday"),
        DayMeta("wed", "Wednesday"),
        DayMeta("thu", "Thursday"),
        DayMeta("fri", "Friday"),
        DayMeta("sat", "Saturday"),
        DayMeta("sun", "Sunday"),
    )

    fun defaultSchedule(): List<DayHours> =
        weekDays.map { day ->
            DayHours(
                day = day.key,
                open = day.key != "sat" && day.key != "sun",
                start = "08:00",
                end = "18:00",
            )
        }

    fun parse(schedule: List<DayHours>?, raw: String?): List<DayHours> {
        val defaults = defaultSchedule().associateBy { it.day }.toMutableMap()
        if (!schedule.isNullOrEmpty()) {
            for (item in schedule) {
                val key = item.day.lowercase().take(3)
                if (defaults.containsKey(key)) {
                    defaults[key] = item.copy(
                        day = key,
                        start = normalizeTime(item.start),
                        end = normalizeTime(item.end),
                    )
                }
            }
            return weekDays.map { defaults.getValue(it.key) }
        }
        val text = raw?.trim().orEmpty()
        if (text.startsWith("[")) {
            // Best-effort: leave defaults if raw JSON wasn't decoded by kotlinx.
            return defaultSchedule()
        }
        return defaultSchedule()
    }

    fun normalizeTime(value: String?, fallback: String = "08:00"): String {
        val raw = value?.trim().orEmpty()
        val match = Regex("^(\\d{1,2}):([0-5]\\d)$").matchEntire(raw) ?: return fallback
        val hour = match.groupValues[1].toInt()
        if (hour !in 0..23) return fallback
        return "%02d:%s".format(hour, match.groupValues[2])
    }

    fun toMinutes(value: String): Int {
        val parts = normalizeTime(value).split(":")
        return parts[0].toInt() * 60 + parts[1].toInt()
    }

    fun validate(schedule: List<DayHours>): String? {
        for (day in schedule) {
            if (!day.open) continue
            if (toMinutes(day.start) >= toMinutes(day.end)) {
                val label = weekDays.find { it.key == day.day }?.label ?: day.day
                return "$label: ending time must be after starting time."
            }
        }
        return null
    }

    fun formatDisplay(time: String): String {
        val normalized = normalizeTime(time)
        val hour = normalized.substring(0, 2).toInt()
        val minute = normalized.substring(3)
        val suffix = if (hour < 12) "AM" else "PM"
        val hour12 = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        return "$hour12:$minute $suffix"
    }
}
