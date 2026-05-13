// GENERATED CODE - DO NOT MODIFY BY HAND
part of 'checkmark.dart';

Widget _$CheckmarkBuild(Checkmark widget, BuildContext context) {
  return Row(
    mainAxisSize: MainAxisSize.min,
    spacing: 8,
    children: [
      Text('Status:'),
      (widget.checked
          ? /* TODO(tsxf): replace this SVG scaffold with a Flutter best-practice equivalent.
 *   1) UI glyph?  Use Icons.<name> or CupertinoIcons.<name> (free, themed, scales).
 *   2) Artwork?   Precompile with vector_graphics_compiler → VectorGraphic widget
 *                 (https://pub.dev/packages/vector_graphics_compiler).
 *   3) Last resort: flutter_svg SvgPicture.asset / SvgPicture.string
 *                 (runtime parse; OK for prototypes).
 * The original <svg> markup was dropped during scaffold generation. */ SizedBox(
              width: 12,
              height: 12,
              child: const Placeholder(),
            )
          : const SizedBox.shrink()),
    ],
  );
}
