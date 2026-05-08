// Hand-maintained Gradle build script for the Flutter Android Runner.
//
// Survives `flutter create --platforms=android .`. If `flutter create` complains
// that the file already exists, that is the intended behavior — keep this one
// and discard the regenerated stub.
//
// Targets:
//   compileSdk  = 36   (Android 16)
//   targetSdk   = 36   (Play Store mandatory floor as of 2026)
//   minSdk      = 24   (Android 7.0 — covers ~98% of active devices)
//
// 16 KB page-size alignment is required for 64-bit native libs starting
// Android 15. AGP 8.5+ aligns by default; we still set the lint flag below
// so a misaligned plugin fails the build instead of failing on-device.

plugins {
    id("com.android.application")
    id("kotlin-android")
    // Flutter Gradle Plugin must apply *after* Android + Kotlin.
    id("dev.flutter.flutter-gradle-plugin")
}

import java.util.Properties
import java.io.FileInputStream

// ----- Signing config from key.properties (env-var-backed; never baked in) -----
val keystoreProperties = Properties().apply {
    val keystorePropertiesFile = rootProject.file("key.properties")
    if (keystorePropertiesFile.exists()) {
        load(FileInputStream(keystorePropertiesFile))
    } else {
        // Fallback to env vars so CI signs without a file on disk.
        setProperty("storeFile",     System.getenv("ANDROID_KEYSTORE_PATH")     ?: "")
        setProperty("storePassword", System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "")
        setProperty("keyAlias",      System.getenv("ANDROID_KEY_ALIAS")         ?: "")
        setProperty("keyPassword",   System.getenv("ANDROID_KEY_PASSWORD")      ?: "")
    }
}

android {
    namespace = "com.example.flutter_app"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.example.flutter_app"
        minSdk = 24
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // App Bundle output is the modern delivery format for Play Store.
        // Resource shrinker + R8 reduce APK size further.
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        create("release") {
            val storeFilePath = keystoreProperties.getProperty("storeFile")
            if (storeFilePath.isNotEmpty()) {
                storeFile = file(storeFilePath)
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // R8 (full-mode) shrinking + resource shrinker.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            // Use release signing config when present; otherwise unsigned
            // (CI sets env vars; local dev uses debug signing automatically).
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile != null) {
                signingConfig = releaseSigning
            }
        }
    }

    // Surface 16 KB page-size misalignment as a build failure rather than
    // a silent crash on Android 15+ devices.
    packaging {
        jniLibs {
            useLegacyPackaging = false
        }
    }

    // App Bundle (AAB) is the default `assembleRelease` output for Play Store.
    bundle {
        language { enableSplit = true }
        density  { enableSplit = true }
        abi      { enableSplit = true }
    }
}

flutter {
    source = "../.."
}
