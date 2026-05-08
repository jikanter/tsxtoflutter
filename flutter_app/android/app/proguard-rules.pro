# ProGuard / R8 keep rules for the Flutter Android Runner.
#
# HAND-MAINTAINED. Codegen never overwrites this file. R8 full-mode is enabled
# in build.gradle.kts release buildType.
#
# Rules are organized by the closed widget catalog the codegen targets — every
# generated widget that touches reflection, serialization, or platform channels
# needs an entry here so R8 doesn't strip it.

# === Flutter / Dart ===
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }
-keep class io.flutter.embedding.** { *; }

# === Kotlin coroutines (used by some plugins) ===
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# === Reflection used by `dart:ffi` and method-channel codecs ===
-keepclassmembers class * {
    @androidx.annotation.Keep <fields>;
    @androidx.annotation.Keep <methods>;
}

# === tsxtoflutter generated widgets (closed catalog) ===
# Keep annotation-driven members on every `_$<Component>Build` partial — these
# are referenced from the generated `*.g.dart` and must survive R8.
-keep class com.example.flutter_app.** { *; }

# === Common third-party plugins ===
# Add entries here as plugins are added; e.g. shared_preferences, path_provider,
# url_launcher do not currently need keep rules but plugin updates may change that.
