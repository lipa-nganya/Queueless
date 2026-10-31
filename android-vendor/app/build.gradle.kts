import com.github.triplet.gradle.androidpublisher.ResolutionStrategy
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.github.triplet.play")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

// Play upload key: copy keystore.properties.example to keystore.properties (gitignored).
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile")?.isNotBlank() == true

// Play upload: set playServiceAccountJson in keystore.properties; run ../scripts/publish-android.sh.
// Without credentials the plugin stays off, so release builds still work locally.
val playServiceAccountJson = keystoreProperties.getProperty("playServiceAccountJson")?.takeIf { it.isNotBlank() }
play {
    enabled.set(playServiceAccountJson != null)
    playServiceAccountJson?.let { serviceAccountCredentials.set(rootProject.file(it)) }
    defaultToAppBundles.set(true)
    track.set("internal")
    // Uploads use Play's highest versionCode + 1, so versionCode below never needs a manual bump.
    resolutionStrategy.set(ResolutionStrategy.AUTO)
}

fun apiUrl(propertyKey: String, default: String): String =
    localProperties.getProperty(propertyKey)?.trim()?.takeIf { it.isNotEmpty() } ?: default

val googleServicesFile = file("google-services.json")
val hasGoogleServices = googleServicesFile.exists()

android {
    namespace = "tech.thewolfgang.queueless.vendor"
    compileSdk = 36

    defaultConfig {
        applicationId = "tech.thewolfgang.queueless.vendor"
        minSdk = 26
        targetSdk = 36
        versionCode = 9
        versionName = "2.1.1"
        buildConfigField("boolean", "PUSH_ENABLED", hasGoogleServices.toString())
    }

    flavorDimensions += "environment"

    productFlavors {
        create("local") {
            dimension = "environment"
            applicationIdSuffix = ".local"
            versionNameSuffix = "-local"
            resValue("string", "app_name", "Queueless Vendor (Local)")
            buildConfigField("String", "ENV_NAME", "\"local\"")
            buildConfigField("String", "LANDING_BASE_URL", "\"https://queueless.thewolfgang.tech\"")
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"${apiUrl("queueless.api.local", "https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api")}\"",
            )
        }
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            resValue("string", "app_name", "Queueless Vendor (Dev)")
            buildConfigField("String", "ENV_NAME", "\"dev\"")
            buildConfigField("String", "LANDING_BASE_URL", "\"https://queueless.thewolfgang.tech\"")
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"${apiUrl("queueless.api.dev", "https://queueless-staging.up.railway.app/api")}\"",
            )
        }
        create("production") {
            dimension = "environment"
            resValue("string", "app_name", "Queueless Vendor")
            buildConfigField("String", "ENV_NAME", "\"production\"")
            buildConfigField("String", "LANDING_BASE_URL", "\"https://queueless.co.ke\"")
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"${apiUrl("queueless.api.production", "https://queueless-prod.up.railway.app/api")}\"",
            )
        }
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Debuggable variants for each flavor (localDebug, devDebug, productionDebug).
        }
        release {
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    // Play services and Firebase pull in an old Fragment; release lint rejects ActivityResult APIs below 1.3.
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("org.osmdroid:osmdroid-android:6.1.20")

    // Firebase Messaging — only fully wired when google-services.json is present.
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

if (hasGoogleServices) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.lifecycle(
        "Skipping Google Services plugin — add android-vendor/app/google-services.json to enable FCM push."
    )
}
