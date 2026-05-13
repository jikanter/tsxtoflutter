// GENERATED CODE - DO NOT MODIFY BY HAND
part of 'page_header.dart';

Widget _$PageHeaderBuild(PageHeader widget, BuildContext context) {
  return Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        Text(widget.title),
        (widget.subtitle ? Text(widget.subtitle) : const SizedBox.shrink()),
      ],
    ),
  );
}
