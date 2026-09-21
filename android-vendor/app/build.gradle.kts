import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

fun apiUrl(propertyKey: String, default: String): String =
    localProperties.getProperty(propertyKey)?.trim()?.takeIf { it.isNotEmpty() } ?: default

val googleServicesFile = file("google-services.json")
val hasGoogleServices = googleServicesFile.exists()

android {
    namespace = "tech.thewolfgang.queueless.vendor"
    compileSdk = 35

    defaultConfig {
        applicationId = "tech.thewolfgang.queueless.vendor"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
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
            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"${apiUrl("queueless.api.production", "https://queueless.up.railway.app/api")}\"",
            )
        }
    }

    buildTypes {
        debug {
            // Debuggable variants for each flavor (localDebug, devDebug, productionDebug).
        }
        release {
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

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
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
